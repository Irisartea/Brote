import { useEffect, useRef, useCallback } from "react";
import { useMap } from "react-leaflet";
import { hessian, classifyCritical } from "../../utils/mathEngine";
import { DISEASE_THEME } from "../../utils/constants";

const RES = 3;
const CUTOFF = 2.8;

function calcLoop(focusSet, bbox, W, H, latN, lonW, latRange, lonRange) {
  const { pxMin, pxMax, pyMin, pyMax } = bbox;
  const total =
    Math.ceil((pxMax - pxMin) / RES) * Math.ceil((pyMax - pyMin) / RES);
  const rArr = new Float32Array(total);
  const gLatArr = new Float32Array(total);
  const gLonArr = new Float32Array(total);
  const pxArr = new Int16Array(total);
  const pyArr = new Int16Array(total);

  let rMin = Infinity,
    rMax = -Infinity;
  let totalR = 0,
    totalGrad = 0;
  let maxPos = { lat: latN, lon: lonW };
  let idx = 0;

  for (let py = pyMin; py < pyMax; py += RES) {
    for (let px = pxMin; px < pxMax; px += RES) {
      const lat = latN - (py / H) * latRange;
      const lon = lonW + (px / W) * lonRange;
      let r = 0,
        gLat = 0,
        gLon = 0;
      for (const f of focusSet) {
        const A = f.Ai ?? f.A ?? 0;
        const s2 = f.sigma * f.sigma;
        const dl = lat - f.lat;
        const dn = lon - f.lon;
        const d2 = dl * dl + dn * dn;
        if (d2 > CUTOFF * CUTOFF * s2) continue;
        const G = A * Math.exp(-d2 / (2 * s2));
        r += G;
        const inv = 1 / s2;
        gLat -= G * dl * inv;
        gLon -= G * dn * inv;
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
  };
}

function getBBox(containerPointFn, focusSet, W, H, latRange, lonRange) {
  if (!focusSet.length) return null;
  let pxMin = W,
    pxMax = 0,
    pyMin = H,
    pyMax = 0;
  for (const f of focusSet) {
    const cp = containerPointFn([f.lat, f.lon]);
    const rx = f.sigma * (W / lonRange) * CUTOFF;
    const ry = f.sigma * (H / latRange) * CUTOFF;
    pxMin = Math.min(pxMin, Math.max(0, Math.floor((cp.x - rx) / RES) * RES));
    pxMax = Math.max(pxMax, Math.min(W, Math.ceil(cp.x + rx)));
    pyMin = Math.min(pyMin, Math.max(0, Math.floor((cp.y - ry) / RES) * RES));
    pyMax = Math.max(pyMax, Math.min(H, Math.ceil(cp.y + ry)));
  }
  if (pxMax <= pxMin || pyMax <= pyMin) return null;
  return { pxMin, pxMax, pyMin, pyMax };
}

function renderCanvas(
  canvas,
  map,
  foci,
  disease,
  layers,
  isCalculo,
  onStatsUpdate,
  onCriticalUpdate,
) {
  if (!canvas || !map || !foci?.length) return;

  const size = map.getSize();
  const W = size.x,
    H = size.y;
  if (!W || !H) return;

  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  const bounds = map.getBounds();
  const latN = bounds.getNorth();
  const lonW = bounds.getWest();
  const latRange = bounds.getNorth() - bounds.getSouth();
  const lonRange = bounds.getEast() - bounds.getWest();

  const cpFn = (latlng) => map.latLngToContainerPoint(latlng);

  const theme = DISEASE_THEME[disease];
  const fociBase = foci.filter((f) => f.tipo === "base");
  const fociHip = foci.filter((f) => f.tipo === "foco");
  const activeFoci = fociBase.length ? fociBase : foci;

  const bbox = getBBox(cpFn, activeFoci, W, H, latRange, lonRange);
  if (!bbox) {
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

  const base = calcLoop(activeFoci, bbox, W, H, latN, lonW, latRange, lonRange);
  const { count: cBase, rMin: rMinB, rMax: rMaxB } = base;
  const rRangeB = rMaxB > rMinB ? rMaxB - rMinB : 0.001;

  onStatsUpdate?.({
    rAvg: cBase > 0 ? base.totalR / cBase : 0,
    rMax: rMaxB,
    rMin: rMinB,
    gradAvg: cBase > 0 ? base.totalGrad / cBase : 0,
    maxPos: base.maxPos,
    fociCount: foci.length,
  });

  let hip = null,
    rRangeH = 0;
  if (fociHip.length) {
    const bboxH = getBBox(cpFn, fociHip, W, H, latRange, lonRange);
    if (bboxH) {
      hip = calcLoop(fociHip, bboxH, W, H, latN, lonW, latRange, lonRange);
      rRangeH = hip.rMax > hip.rMin ? hip.rMax - hip.rMin : 0.001;
    }
  }

  if (layers.heatmap) {
    const imgData = ctx.createImageData(W, H);
    const d = imgData.data;

    for (let i = 0; i < cBase; i++) {
      const norm = (base.rArr[i] - rMinB) / rRangeB;
      if (norm < 0.08) continue;
      const col = theme.heatmap(norm);
      const m = col.match(/[\d.]+/g);
      if (!m) continue;
      const cr = +m[0],
        cg = +m[1],
        cb = +m[2];
      const ca = Math.round(+m[3] * 255);
      const bx = base.pxArr[i],
        by = base.pyArr[i];
      for (let dy = 0; dy < RES && by + dy < H; dy++)
        for (let dx = 0; dx < RES && bx + dx < W; dx++) {
          const off = ((by + dy) * W + (bx + dx)) * 4;
          d[off] = cr;
          d[off + 1] = cg;
          d[off + 2] = cb;
          d[off + 3] = ca;
        }
    }
    ctx.putImageData(imgData, 0, 0);

    if (hip) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const imgH = ctx.createImageData(W, H);
      const dH = imgH.data;
      for (let i = 0; i < hip.count; i++) {
        const norm = (hip.rArr[i] - hip.rMin) / rRangeH;
        if (norm < 0.04) continue;
        const col = theme.heatmap(Math.pow(norm, 0.5));
        const m = col.match(/[\d.]+/g);
        if (!m) continue;
        const cr = +m[0],
          cg = +m[1],
          cb = +m[2];
        const ca = Math.round(Math.min(+m[3] * 2.5, 1) * 255);
        const bx = hip.pxArr[i],
          by = hip.pyArr[i];
        for (let dy = 0; dy < RES && by + dy < H; dy++)
          for (let dx = 0; dx < RES && bx + dx < W; dx++) {
            const off = ((by + dy) * W + (bx + dx)) * 4;
            dH[off] = cr;
            dH[off + 1] = cg;
            dH[off + 2] = cb;
            dH[off + 3] = ca;
          }
      }
      ctx.putImageData(imgH, 0, 0);
      ctx.restore();
    }
  }

  if (isCalculo && layers.contours) {
    for (const lvl of [0.15, 0.3, 0.5, 0.7, 0.85]) {
      const target = rMinB + lvl * rRangeB;
      const tol = rRangeB * 0.025;
      ctx.beginPath();
      for (let i = 0; i < cBase; i++) {
        if (Math.abs(base.rArr[i] - target) < tol)
          ctx.rect(base.pxArr[i], base.pyArr[i], 2, 2);
      }
      ctx.fillStyle = `rgba(13,148,136,${0.25 + lvl * 0.5})`;
      ctx.fill();
    }
  }

  if (isCalculo && layers.gradient) {
    const step = 44;
    for (let i = 0; i < cBase; i++) {
      const px = base.pxArr[i],
        py = base.pyArr[i];
      if (px % step > RES || py % step > RES) continue;
      const gL = base.gLatArr[i],
        gN = base.gLonArr[i];
      const mag = Math.sqrt(gL * gL + gN * gN);
      if (mag < 1e-8) continue;
      const scale = Math.min(mag * 6000, 24);
      const dx = (gN / mag) * scale,
        dy = -(gL / mag) * scale;
      const al = Math.min(0.3 + mag * 3000, 0.85);
      const col = `rgba(220,38,38,${al})`;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + dx, py + dy);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
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

  if (isCalculo && layers.critical) {
    const cpStep = Math.max(10, Math.round(Math.min(W, H) / 22));
    const mags = [];
    for (let i = 0; i < cBase; i++) {
      const gL = base.gLatArr[i],
        gN = base.gLonArr[i];
      mags.push(Math.sqrt(gL * gL + gN * gN));
    }
    mags.sort((a, b) => a - b);
    const gradThreshold = mags[Math.floor(mags.length * 0.04)] ?? 0;

    const crits = [];
    for (let i = 0; i < cBase; i++) {
      const px = base.pxArr[i],
        py = base.pyArr[i];
      if (px % cpStep > RES || py % cpStep > RES) continue;
      const gL = base.gLatArr[i],
        gN = base.gLonArr[i];
      const mag = Math.sqrt(gL * gL + gN * gN);
      if (mag > gradThreshold) continue;

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
          ? "#e11d48"
          : type === "mínimo"
            ? "#059669"
            : "#d97706";
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
      ctx.font = "bold 9px 'DM Mono',monospace";
      ctx.fillText(type === "máximo" ? "epicentro" : type, px + 13, py - 11);
      crits.push({ lat, lon, type, r, D: H2.D, Rxx: H2.Rxx, px, py });
    }
    onCriticalUpdate?.(crits.map(({ px, py, ...rest }) => rest));
  } else {
    onCriticalUpdate?.([]);
  }
}

export default function HeatmapLayer({
  foci,
  disease,
  layers,
  mode,
  onStatsUpdate,
  onCriticalUpdate,
}) {
  const map = useMap();
  const canvasRef = useRef(null);
  const isCalculo = mode === "calculo";

  useEffect(() => {
    if (!map) return;
    const L = window.L;
    const pane = map.getPane("overlayPane");
    const canvas = document.createElement("canvas");
    canvas.className = "brote-canvas";
    Object.assign(canvas.style, {
      position: "absolute",
      top: "0",
      left: "0",
      pointerEvents: "none",
      zIndex: "250",
    });
    pane.appendChild(canvas);
    canvasRef.current = canvas;

    function onMove() {
      const tl = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, tl);
    }
    map.on("move", onMove);

    return () => {
      map.off("move", onMove);
      if (pane.contains(canvas)) pane.removeChild(canvas);
      canvasRef.current = null;
    };
  }, [map]);

  const draw = useCallback(() => {
    if (!canvasRef.current || !map) return;
    const L = window.L;
    const tl = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvasRef.current, tl);
    renderCanvas(
      canvasRef.current,
      map,
      foci,
      disease,
      layers,
      isCalculo,
      onStatsUpdate,
      onCriticalUpdate,
    );
  }, [map, foci, disease, layers, isCalculo, onStatsUpdate, onCriticalUpdate]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    if (!map) return;
    map.on("moveend zoomend resize", draw);
    return () => map.off("moveend zoomend resize", draw);
  }, [map, draw]);

  return null;
}
