import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { hessian, classifyCritical } from "../../utils/mathEngine";
import { DISEASE_THEME } from "../../utils/constants";

export default function HeatmapLayer({
  foci,
  disease,
  layers,
  mode,
  onStatsUpdate,
  onCriticalUpdate,
}) {
  const map = useMap();
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!map || !foci?.length) return;
    if (overlayRef.current) map.removeLayer(overlayRef.current);

    const L = window.L;
    const theme = DISEASE_THEME[disease];
    const isCalculo = mode === "calculo";

    // Separar focos por tipo UNA SOLA VEZ fuera del canvas
    const fociBase = foci.filter((f) => f.tipo === "base");
    const fociHip = foci.filter((f) => f.tipo === "foco");

    const CanvasOverlay = L.Layer.extend({
      onAdd(map) {
        this._map = map;
        this._canvas = L.DomUtil.create("canvas", "brote-canvas");
        Object.assign(this._canvas.style, {
          position: "absolute",
          top: "0",
          left: "0",
          pointerEvents: "none",
          zIndex: "250",
          willChange: "transform",
        });
        map.getPane("overlayPane").appendChild(this._canvas);
        map.on("move", this._onMove, this);
        map.on("moveend zoomend resize", this._update, this);
        this._update();
      },

      onRemove(map) {
        const pane = map.getPane("overlayPane");
        if (this._canvas && pane.contains(this._canvas))
          pane.removeChild(this._canvas);
        map.off("move", this._onMove, this);
        map.off("moveend zoomend resize", this._update, this);
      },

      _onMove() {},

      _update() {
        if (!this._map) return;
        const size = this._map.getSize();
        const canvas = this._canvas;

        canvas.width = size.x;
        canvas.height = size.y;
        canvas.style.width = size.x + "px";
        canvas.style.height = size.y + "px";

        // Guard: skip render if canvas has no dimensions yet
        if (!size.x || !size.y || size.x <= 0 || size.y <= 0) return;

        const topLeft = this._map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(canvas, topLeft);

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const bounds = this._map.getBounds();
        const res = 3;
        const W = canvas.width;
        const H = canvas.height;
        const latN = bounds.getNorth();
        const latS = bounds.getSouth();
        const lonW = bounds.getWest();
        const lonE = bounds.getEast();
        const latRange = latN - latS;
        const lonRange = lonE - lonW;

        // ── Función helper: calcular bounding box activa para un set de focos ──
        const CUTOFF_SIGMAS = 2.8;
        function getBBox(focusSet) {
          if (!focusSet.length) return null;
          let pxMin = W,
            pxMax = 0,
            pyMin = H,
            pyMax = 0;
          for (const f of focusSet) {
            const cPx = this._map.latLngToContainerPoint([f.lat, f.lon]);
            const radiusPxY = f.sigma * (H / latRange) * CUTOFF_SIGMAS;
            const radiusPxX = f.sigma * (W / lonRange) * CUTOFF_SIGMAS;
            pxMin = Math.min(
              pxMin,
              Math.max(0, Math.floor((cPx.x - radiusPxX) / res) * res),
            );
            pxMax = Math.max(pxMax, Math.min(W, Math.ceil(cPx.x + radiusPxX)));
            pyMin = Math.min(
              pyMin,
              Math.max(0, Math.floor((cPx.y - radiusPxY) / res) * res),
            );
            pyMax = Math.max(pyMax, Math.min(H, Math.ceil(cPx.y + radiusPxY)));
          }
          if (pxMax <= pxMin || pyMax <= pyMin) return null;
          return { pxMin, pxMax, pyMin, pyMax };
        }

        // ── Función helper: loop de cálculo R para un set de focos y bbox ──────
        function calcLoop(focusSet, bbox) {
          const cols = Math.ceil((bbox.pxMax - bbox.pxMin) / res);
          const rows = Math.ceil((bbox.pyMax - bbox.pyMin) / res);
          const total = cols * rows;
          const rArr = new Float32Array(total);
          const gLatArr = new Float32Array(total);
          const gLonArr = new Float32Array(total);
          const pxArr = new Int16Array(total);
          const pyArr = new Int16Array(total);

          let rMin = Infinity,
            rMax = -Infinity;
          let totalR = 0,
            totalGrad = 0;
          let maxPos = { lat: latS, lon: lonW };
          let idx = 0;

          for (let py = bbox.pyMin; py < bbox.pyMax; py += res) {
            for (let px = bbox.pxMin; px < bbox.pxMax; px += res) {
              const lat = latN - (py / H) * latRange;
              const lon = lonW + (px / W) * lonRange;

              let r = 0,
                gLat = 0,
                gLon = 0;
              for (const f of focusSet) {
                const A = f.Ai ?? f.A;
                const s2 = f.sigma * f.sigma;
                const dlat = lat - f.lat;
                const dlon = lon - f.lon;
                const d2 = dlat * dlat + dlon * dlon;
                const G = A * Math.exp(-d2 / (2 * s2));
                r += G;
                const inv_s2 = 1 / s2;
                gLat -= G * dlat * inv_s2;
                gLon -= G * dlon * inv_s2;
              }

              if (r < rMin) rMin = r;
              if (r > rMax) {
                rMax = r;
                maxPos = { lat, lon };
              }
              totalR += r;
              totalGrad += Math.sqrt(gLat * gLat + gLon * gLon);

              rArr[idx] = r;
              gLatArr[idx] = gLat;
              gLonArr[idx] = gLon;
              pxArr[idx] = px;
              pyArr[idx] = py;
              idx++;
            }
          }

          return {
            rArr,
            gLatArr,
            gLonArr,
            pxArr,
            pyArr,
            count: idx,
            rMin,
            rMax,
            totalR,
            totalGrad,
            maxPos,
            cols,
          };
        }

        // ── PASADA 1: zonas base ──────────────────────────────────────────────
        const bboxBase = getBBox.call(this, fociBase.length ? fociBase : foci);
        if (!bboxBase) {
          onStatsUpdate?.({
            rAvg: 0,
            rMax: 0,
            rMin: 0,
            gradAvg: 0,
            maxPos: { lat: 0, lon: 0 },
            fociCount: foci.length,
          });
          onCriticalUpdate?.([]);
          return;
        }

        const base = calcLoop(fociBase.length ? fociBase : foci, bboxBase);
        const { count: countBase, rMin: rMinBase, rMax: rMaxBase } = base;
        const rRangeBase = rMaxBase === rMinBase ? 0.001 : rMaxBase - rMinBase;

        onStatsUpdate?.({
          rAvg: countBase > 0 ? base.totalR / countBase : 0,
          rMax: rMaxBase,
          rMin: rMinBase,
          gradAvg: countBase > 0 ? base.totalGrad / countBase : 0,
          maxPos: base.maxPos,
          fociCount: foci.length,
        });

        // ── PASADA 2: focos hipotéticos (solo si existen) ─────────────────────
        let hip = null;
        let rRangeHip = 0;
        if (fociHip.length) {
          const bboxHip = getBBox.call(this, fociHip);
          if (bboxHip) {
            hip = calcLoop(fociHip, bboxHip);
            rRangeHip = hip.rMax === hip.rMin ? 0.001 : hip.rMax - hip.rMin;
          }
        }

        // ── Render heatmap ────────────────────────────────────────────────────
        const THRESHOLD_BASE = 0.12;
        const THRESHOLD_HIP = 0.05; // más sensible para focos hipotéticos

        if (layers.heatmap) {
          const imgData = ctx.createImageData(W, H);
          const data = imgData.data;

          // Pintar zonas base
          for (let i = 0; i < countBase; i++) {
            const norm = (base.rArr[i] - rMinBase) / rRangeBase;
            if (norm < THRESHOLD_BASE) continue;
            const col = theme.heatmap(norm);
            const m = col.match(/[\d.]+/g);
            if (!m) continue;
            const cr = +m[0],
              cg = +m[1],
              cb = +m[2],
              ca = Math.round(+m[3] * 255);
            const bx = base.pxArr[i],
              by = base.pyArr[i];
            for (let dy = 0; dy < res && by + dy < H; dy++) {
              for (let dx = 0; dx < res && bx + dx < W; dx++) {
                const off = ((by + dy) * W + (bx + dx)) * 4;
                data[off] = cr;
                data[off + 1] = cg;
                data[off + 2] = cb;
                data[off + 3] = ca;
              }
            }
          }
          ctx.putImageData(imgData, 0, 0);

          // Pintar focos hipotéticos ENCIMA con su propia normalización
          // Usan ctx.globalCompositeOperation = "screen" para el efecto de brillo
          if (hip) {
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            const imgHip = ctx.createImageData(W, H);
            const dataHip = imgHip.data;

            for (let i = 0; i < hip.count; i++) {
              const norm = (hip.rArr[i] - hip.rMin) / rRangeHip;
              if (norm < THRESHOLD_HIP) continue;

              // Color del foco: más brillante e intenso que las zonas base
              // norm elevado a 0.5 para que la gaussiana se vea más "puntiaguda"
              const normBright = Math.pow(norm, 0.5);
              const col = theme.heatmap(normBright);
              const m = col.match(/[\d.]+/g);
              if (!m) continue;

              // Boosteamos alpha para que brille
              const cr = +m[0],
                cg = +m[1],
                cb = +m[2];
              const ca = Math.round(Math.min(+m[3] * 2.5, 1) * 255);

              const bx = hip.pxArr[i],
                by = hip.pyArr[i];
              for (let dy = 0; dy < res && by + dy < H; dy++) {
                for (let dx = 0; dx < res && bx + dx < W; dx++) {
                  const off = ((by + dy) * W + (bx + dx)) * 4;
                  dataHip[off] = cr;
                  dataHip[off + 1] = cg;
                  dataHip[off + 2] = cb;
                  dataHip[off + 3] = ca;
                }
              }
            }
            ctx.putImageData(imgHip, 0, 0);
            ctx.restore();
          }
        }

        // ── Curvas de nivel — sobre todos los focos combinados ────────────────
        if (isCalculo && layers.contours) {
          for (const lvl of [0.15, 0.3, 0.5, 0.7, 0.85]) {
            const target = rMinBase + lvl * rRangeBase;
            const tol = rRangeBase * 0.02;
            ctx.beginPath();
            for (let i = 0; i < countBase; i++) {
              if (Math.abs(base.rArr[i] - target) < tol)
                ctx.rect(base.pxArr[i], base.pyArr[i], 1.8, 1.8);
            }
            const alpha = 0.2 + lvl * 0.45;
            ctx.fillStyle =
              disease === "dengue"
                ? `rgba(26,213,250,${alpha})`
                : `rgba(183,148,255,${alpha})`;
            ctx.fill();
          }
        }

        // ── Flechas de gradiente ──────────────────────────────────────────────
        if (isCalculo && layers.gradient) {
          const step = 44;
          for (let i = 0; i < countBase; i++) {
            const px = base.pxArr[i],
              py = base.pyArr[i];
            if (px % step > res || py % step > res) continue;
            const gLat = base.gLatArr[i],
              gLon = base.gLonArr[i];
            const mag = Math.sqrt(gLat * gLat + gLon * gLon);
            if (mag < 0.00004) continue;
            const scale = Math.min(mag * 7000, 22);
            const dx = (gLon / mag) * scale;
            const dy = -(gLat / mag) * scale;
            const al = 0.25 + Math.min(mag * 4000, 0.6);
            const col =
              disease === "dengue"
                ? `rgba(239,68,68,${al})`
                : `rgba(139,92,246,${al})`;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + dx, py + dy);
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.4;
            ctx.stroke();
            const ang = Math.atan2(dy, dx);
            ctx.beginPath();
            ctx.moveTo(px + dx, py + dy);
            ctx.lineTo(
              px + dx - 5 * Math.cos(ang - 0.45),
              py + dy - 5 * Math.sin(ang - 0.45),
            );
            ctx.lineTo(
              px + dx - 5 * Math.cos(ang + 0.45),
              py + dy - 5 * Math.sin(ang + 0.45),
            );
            ctx.closePath();
            ctx.fillStyle = col;
            ctx.fill();
          }
        }

        // ── Puntos críticos ───────────────────────────────────────────────────
        if (isCalculo && layers.critical) {
          const cpStep = Math.max(10, Math.round(Math.min(W, H) / 22));
          const crits = [];
          for (let i = 0; i < countBase; i++) {
            const px = base.pxArr[i],
              py = base.pyArr[i];
            if (px % cpStep > res || py % cpStep > res) continue;
            const gLat = base.gLatArr[i],
              gLon = base.gLonArr[i];
            const mag = Math.sqrt(gLat * gLat + gLon * gLon);
            if (mag > 0.00007) continue;
            const lat = latN - (py / H) * latRange;
            const lon = lonW + (px / W) * lonRange;
            const H2 = hessian(lat, lon, foci);
            const type = classifyCritical(H2);
            const r = base.rArr[i];
            const tooClose = crits.some(
              (c) =>
                Math.abs(c.px - px) < cpStep * 1.3 &&
                Math.abs(c.py - py) < cpStep * 1.3,
            );
            if (tooClose) continue;
            const col =
              type === "máximo"
                ? "#ef4444"
                : type === "mínimo"
                  ? "#10b981"
                  : "#f59e0b";
            ctx.beginPath();
            ctx.arc(px, py, 11, 0, Math.PI * 2);
            ctx.fillStyle = col + "18";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(px, py, 7, 0, Math.PI * 2);
            ctx.strokeStyle = col + "90";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = col;
            ctx.fill();
            ctx.fillStyle = col;
            ctx.font = "bold 9px 'JetBrains Mono',monospace";
            ctx.fillText(type, px + 13, py - 11);
            crits.push({ lat, lon, type, r, D: H2.D, Rxx: H2.Rxx, px, py });
          }
          onCriticalUpdate?.(crits.map(({ px, py, ...rest }) => rest));
        } else {
          onCriticalUpdate?.([]);
        }
      },
    });

    const overlay = new CanvasOverlay();
    overlay.addTo(map);
    overlayRef.current = overlay;
    return () => {
      if (overlayRef.current) map.removeLayer(overlayRef.current);
    };
  }, [map, foci, disease, layers, mode]);

  return null;
}
