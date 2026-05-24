import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { calcularIntensidades } from "../utils/epidemiology";
import { ZONAS_SCZ } from "../data/desidadPoblacional";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import HeatmapLayer from "./map/HeatmapLayer";
import {
  DISEASE_THEME,
  SCZ_CENTER,
  SCZ_ZOOM,
  SCZ_LANDMARKS,
  SCZ_ANILLOS,
  MATH_FORMULAS,
  getGtLevel,
} from "../utils/constants";
import {
  computeR,
  gradMagnitude,
  gradDirection,
  angleToCardinal,
  sigmaDengue,
  fTemp_dengue,
  fHumedad_dengue,
  fLluvia_dengue,
  fVacuna_dengue,
  fAgua,
  fFumigacion,
} from "../utils/mathEngine";
import AgregarRegistroModal from "./AgregarRegistroModal";
import {
  entrenarModeloIA,
  proyectarHibrido,
  generarRecomendacion,
} from "../utils/aiPredictor";

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR = '&copy; <a href="https://carto.com/">CARTO</a>';

const N = {
  bg: "#f0f2f7",
  surface: "#ffffff",
  surface2: "#f7f9fc",
  border: "#e2e6ef",
  text: "#0d1117",
  mid: "#3d4554",
  muted: "#6e7891",
  faint: "#adb5c8",
  teal: "#0d9488",
  blue: "#1d4ed8",
  lila: "#7c3aed",
  green: "#059669",
  amber: "#d97706",
  rose: "#e11d48",
};

const DEFAULT_FACTORES = {
  temp: 28,
  humidity: 70,
  lluvia: 80,
  breeding: 0.4,
  intervention: 0.2,
  vacuna: 0,
  casos: 20,
};

function calcularF(factores) {
  return (
    fTemp_dengue(factores.temp) *
    fHumedad_dengue(factores.humidity) *
    fLluvia_dengue(factores.lluvia) *
    fAgua(factores.breeding) *
    fFumigacion(factores.intervention) *
    fVacuna_dengue(factores.vacuna)
  );
}

function calcularSigma(factores, sigmaBase) {
  return sigmaDengue(
    sigmaBase,
    factores.breeding,
    factores.lluvia / 200,
    factores.intervention,
  );
}

function sigmaDelDistritoMasCercano(lat, lon) {
  let minDist = Infinity,
    sigmaCercano = 0.006;
  for (const z of ZONAS_SCZ) {
    const d = (lat - z.lat) ** 2 + (lon - z.lon) ** 2;
    if (d < minDist) {
      minDist = d;
      sigmaCercano = z.sigma;
    }
  }
  return Math.min(sigmaCercano, 0.004);
}

function ClickHandler({ addingFocus, onAdd, foci, theme }) {
  useMapEvents({
    click(e) {
      const { lat, lng: lon } = e.latlng;
      if (addingFocus) {
        onAdd(lat, lon);
        return;
      }
      const r = computeR(lat, lon, foci);
      const mag = gradMagnitude(lat, lon, foci);
      const theta = gradDirection(lat, lon, foci);
      L.popup({ closeButton: true, maxWidth: 240 })
        .setLatLng(e.latlng)
        .setContent(
          `
          <div style="font-family:'DM Sans',sans-serif">
            <div style="font-size:10px;color:#6e7891;margin-bottom:4px">${lat.toFixed(5)}, ${lon.toFixed(5)}</div>
            <div style="font-size:20px;font-weight:700;color:${theme.primary};font-family:'DM Mono',monospace">
              Riesgo: ${r.toFixed(4)}
            </div>
            <div style="font-size:11px;color:#6e7891;font-family:'DM Mono',monospace;margin-top:6px">
              Expansión: ${mag.toFixed(5)} · Dir: ${angleToCardinal(theta)}
            </div>
          </div>`,
        )
        .openOn(e.target);
    },
  });
  return null;
}

function Slider({
  label,
  sublabel,
  value,
  onChange,
  color = N.teal,
  min = 0,
  max = 1,
  step = 0.01,
  unit = "",
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 7,
        }}
      >
        <div>
          <span style={{ fontSize: 12, color: N.mid, fontWeight: 500 }}>
            {label}
          </span>
          {sublabel && (
            <div style={{ fontSize: 10, color: N.faint, marginTop: 1 }}>
              {sublabel}
            </div>
          )}
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 600,
            color,
            background: color + "12",
            padding: "2px 9px",
            borderRadius: 6,
            border: `1px solid ${color}28`,
            whiteSpace: "nowrap",
          }}
        >
          {Number.isInteger(step) || step >= 1
            ? Math.round(value)
            : value.toFixed(2)}
          {unit}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 5,
          background: N.border,
          borderRadius: 5,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${pct}%`,
            borderRadius: 5,
            background: color,
            transition: "width 0.08s",
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            transform: "translateY(-50%)",
            width: "100%",
            opacity: 0,
            cursor: "pointer",
            height: 20,
            margin: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${pct}%`,
            top: "50%",
            transform: "translate(-50%,-50%)",
            width: 15,
            height: 15,
            borderRadius: "50%",
            background: "white",
            border: `2px solid ${color}`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

function SectionLabel({ children, icon }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        color: N.muted,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        fontWeight: 600,
        marginBottom: 12,
        marginTop: 6,
        display: "flex",
        alignItems: "center",
        gap: 6,
        paddingBottom: 6,
        borderBottom: `1px solid ${N.border}`,
      }}
    >
      {icon && <span>{icon}</span>}
      {children}
    </div>
  );
}

function MathCard({ title, formula, explanation }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        marginBottom: 6,
        borderRadius: 8,
        border: `1px solid ${N.border}`,
        overflow: "hidden",
        background: N.surface,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          color: N.mid,
          fontFamily: "var(--font-body)",
          textAlign: "left",
        }}
      >
        <span>{title}</span>
        <span
          style={{
            fontSize: 10,
            color: N.faint,
            transform: open ? "rotate(180deg)" : "none",
            transition: "0.2s",
            display: "inline-block",
          }}
        >
          ▼
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: N.teal,
              background: "#f0fdfa",
              padding: "10px 12px",
              borderRadius: 6,
              marginBottom: 8,
              border: "1px solid #99f6e4",
              whiteSpace: "pre-wrap",
            }}
          >
            {formula}
          </div>
          <p
            style={{ fontSize: 11, color: N.muted, lineHeight: 1.6, margin: 0 }}
          >
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, color = N.mid }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        borderBottom: `1px solid ${N.border}`,
      }}
    >
      <span style={{ fontSize: 12, color: N.muted }}>{label}</span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 600,
          color,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function FactoresPanel({ factores, onChange, theme, showCasos = false }) {
  return (
    <>
      <SectionLabel icon="🌡️">Clima y ambiente</SectionLabel>
      <Slider
        label="Temperatura"
        sublabel="Afecta al mosquito vector"
        value={factores.temp}
        min={15}
        max={40}
        unit="°C"
        color={N.amber}
        onChange={(v) => onChange({ ...factores, temp: v })}
      />
      <Slider
        label="Humedad ambiental"
        sublabel="Favorece la supervivencia del mosquito"
        value={factores.humidity}
        min={30}
        max={100}
        unit="%"
        color={N.blue}
        onChange={(v) => onChange({ ...factores, humidity: v })}
      />
      <Slider
        label="Lluvia semanal"
        sublabel="Crea criaderos de mosquitos"
        value={factores.lluvia}
        min={0}
        max={200}
        unit=" mm"
        color={N.teal}
        onChange={(v) => onChange({ ...factores, lluvia: v })}
      />
      <Slider
        label="Agua estancada"
        sublabel="Lugares donde se reproduce el mosquito"
        value={factores.breeding}
        color={N.lila}
        onChange={(v) => onChange({ ...factores, breeding: v })}
      />
      <SectionLabel icon="🏥">Control sanitario</SectionLabel>
      <Slider
        label="Fumigación"
        sublabel="Reduce la cantidad de mosquitos"
        value={factores.intervention}
        color={N.green}
        onChange={(v) => onChange({ ...factores, intervention: v })}
      />
      <Slider
        label="Vacunación"
        sublabel="Porcentaje de la población vacunada"
        value={factores.vacuna}
        color={N.blue}
        onChange={(v) => onChange({ ...factores, vacuna: v })}
      />
      {showCasos && (
        <>
          <SectionLabel icon="📍">Casos en esta zona</SectionLabel>
          <Slider
            label="Casos reportados"
            sublabel="Número inicial de contagios"
            value={factores.casos}
            min={1}
            max={500}
            step={1}
            color={theme.primary}
            onChange={(v) => onChange({ ...factores, casos: v })}
          />
        </>
      )}
    </>
  );
}

function WeekSelector({ datos, selectedIdx, onSelectIdx }) {
  if (!datos?.length) return null;
  const años = [...new Set(datos.map((r) => r.año))].sort();
  const añoActual = datos[selectedIdx]?.año;
  const seActual = datos[selectedIdx]?.se;
  const semanasDelAño = datos
    .filter((r) => r.año === añoActual)
    .map((r) => r.se);
  const selStyle = {
    padding: "5px 10px",
    borderRadius: 7,
    border: `1px solid ${N.border}`,
    background: "white",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    fontWeight: 600,
    color: N.text,
    cursor: "pointer",
    outline: "none",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <select
        value={añoActual}
        style={selStyle}
        onChange={(e) => {
          const idx = datos.findIndex((r) => r.año === +e.target.value);
          if (idx >= 0) onSelectIdx(idx);
        }}
      >
        {años.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <select
        value={seActual}
        style={selStyle}
        onChange={(e) => {
          const idx = datos.findIndex(
            (r) => r.año === añoActual && r.se === +e.target.value,
          );
          if (idx >= 0) onSelectIdx(idx);
        }}
      >
        {semanasDelAño.map((s) => (
          <option key={s} value={s}>
            Semana {s}
          </option>
        ))}
      </select>
      <span
        style={{ fontSize: 11, color: N.muted, fontFamily: "var(--font-mono)" }}
      >
        {datos[selectedIdx]?.confirmados?.toLocaleString()} casos
      </span>
    </div>
  );
}

const AI_ESCALA = 12;

// ── Panel resumen al finalizar proyección ──────────────────────────────────
function ResumenProyeccion({ semanasIA, onReiniciar }) {
  if (!semanasIA || semanasIA.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 8,
        background: N.surface,
        borderRadius: 10,
        border: `1px solid ${N.border}`,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(13,17,23,0.06)",
      }}
    >
      <div
        style={{
          padding: "8px 14px",
          background: N.surface2,
          borderBottom: `1px solid ${N.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: N.muted,
            letterSpacing: 1,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Proyección completa — 8 semanas
        </span>
        <button
          onClick={onReiniciar}
          style={{
            background: "none",
            border: "none",
            fontSize: 11,
            color: N.muted,
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
          }}
        >
          ↺ Nueva simulación
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
          }}
        >
          <thead>
            <tr style={{ background: N.surface2 }}>
              {["Sem.", "SE", "Gₜ", "Rango", "Tend.", "Alerta", "Método"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "6px 10px",
                      textAlign: "left",
                      color: N.faint,
                      fontSize: 9,
                      letterSpacing: 0.8,
                      fontWeight: 600,
                      borderBottom: `1px solid ${N.border}`,
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {semanasIA.map((s, i) => {
              const level = getGtLevel(s.gt);
              return (
                <tr
                  key={i}
                  style={{
                    borderBottom: `1px solid ${N.border}`,
                    background: i % 2 === 0 ? "white" : N.surface2,
                  }}
                >
                  <td
                    style={{
                      padding: "5px 10px",
                      color: N.mid,
                      fontWeight: 700,
                    }}
                  >
                    +{s.semana}
                  </td>
                  <td style={{ padding: "5px 10px", color: N.muted }}>
                    SE{s.se}
                  </td>
                  <td
                    style={{
                      padding: "5px 10px",
                      color: level.color,
                      fontWeight: 700,
                    }}
                  >
                    {s.gt.toFixed(3)}
                  </td>
                  <td
                    style={{
                      padding: "5px 10px",
                      color: N.faint,
                      fontSize: 10,
                    }}
                  >
                    [{s.gtMin.toFixed(2)}–{s.gtMax.toFixed(2)}]
                  </td>
                  <td
                    style={{
                      padding: "5px 10px",
                      color: s.tendencia === "↑" ? N.rose : N.green,
                      fontSize: 13,
                    }}
                  >
                    {s.tendencia}
                  </td>
                  <td style={{ padding: "5px 10px" }}>
                    <span
                      style={{
                        background: level.bg,
                        color: level.color,
                        padding: "1px 7px",
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    >
                      {level.label}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "5px 10px",
                      color: s.metodo === "IA" ? N.lila : N.teal,
                      fontSize: 9,
                      fontWeight: 600,
                    }}
                  >
                    {s.metodo === "IA" ? "🤖 IA" : "⚙️ Escenario"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Panel de predicción IA (encima del botón simular) ────────────────────
function PanelPrediccionIA({ recomendacion, modelo }) {
  if (!recomendacion) return null;
  return (
    <div
      style={{
        background: "white",
        borderBottom: `1px solid ${N.border}`,
        padding: "7px 16px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexShrink: 0,
        borderLeft: `3px solid ${recomendacion.color}`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              color: N.faint,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            🤖 Predicción IA · {modelo?.n ?? 0} muestras · R²=
            {modelo?.r2?.toFixed(2) ?? "—"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: N.mid }}>
            Gₜ en 4 sem:{" "}
            <strong
              style={{
                color: recomendacion.color,
                fontFamily: "var(--font-mono)",
              }}
            >
              {recomendacion.gt4}
            </strong>
            <span
              style={{
                marginLeft: 6,
                background: recomendacion.color + "18",
                color: recomendacion.color,
                padding: "1px 8px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
              }}
            >
              {recomendacion.nivel}
            </span>
          </span>
          <span style={{ fontSize: 11, color: N.mid }}>
            Tendencia:{" "}
            <strong
              style={{
                color:
                  recomendacion.tendencia === "creciente" ? N.rose : N.green,
              }}
            >
              {recomendacion.tendencia === "creciente"
                ? "↑ Creciente"
                : "↓ Decreciente"}
            </strong>
          </span>
          <span style={{ fontSize: 11, color: N.amber, fontWeight: 600 }}>
            ⚠ {recomendacion.recomendacion}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SimulatorView({
  disease,
  datos,
  currentGt,
  selectedIdx,
  onSelectIdx,
  onAgregarRegistro,
}) {
  const theme = DISEASE_THEME[disease];
  const level = getGtLevel(currentGt ?? 0);

  const [calcMode, setCalcMode] = useState(false);
  const [addingFocus, setAddingFocus] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [layers, setLayers] = useState({
    heatmap: true,
    gradient: false,
    contours: false,
    critical: false,
  });
  const [stats, setStats] = useState(null);
  const [criticals, setCriticals] = useState([]);
  const [activeTab, setActiveTab] = useState("factores");
  const [factoresGlobales, setFactoresGlobales] = useState(DEFAULT_FACTORES);
  const [focos, setFocos] = useState([]);
  const [focoSeleccionado, setFocoSeleccionado] = useState(null);

  // ── Modelo IA entrenado una sola vez ───────────────────────────────────────
  const modeloIA = useMemo(() => {
    if (!datos || datos.length < 10) return null;
    return entrenarModeloIA(datos);
  }, [datos]);

  // ── Proyección completa con semanas IA ────────────────────────────────────
  const [semanasProyectadas, setSemanasProyectadas] = useState([]);
  const [semanaProyeccion, setSemanaProyeccion] = useState(0);
  const [gtProy, setGtProy] = useState(null);
  const [focosProy, setFocosProy] = useState([]);
  const [focosAnterior, setFocosAnterior] = useState([]); // para color dinámico
  const proyectandoRef = useRef(false);
  const intervalRef = useRef(null);
  const [proyectandoState, setProyectandoState] = useState(false);

  // Pre-calcular todas las semanas con IA antes de animar
  const planProyeccion = useRef([]);

  const iniciarProyeccion = useCallback(() => {
    if (proyectandoRef.current) return;
    proyectandoRef.current = true;
    setProyectandoState(true);
    setSemanaProyeccion(0);
    setSemanasProyectadas([]);

    const gtInicial = Math.max(0.05, currentGt ?? 0.05);
    const seActual = datos?.[selectedIdx]?.se ?? 26;

    // Calcular el plan completo con IA + beta
    const plan = modeloIA
      ? proyectarHibrido(
          modeloIA,
          gtInicial,
          factoresGlobales,
          seActual,
          datos?.[selectedIdx]?.año ?? 2025,
          datos,
        )
      : (() => {
          // Fallback sin IA
          const vac = factoresGlobales.vacuna ?? 0;
          const fum = factoresGlobales.intervention ?? 0;
          const beta = 1.18 * (1 - 0.61 * vac) * (1 - 0.35 * fum);
          let gt = gtInicial;
          return Array.from({ length: 8 }, (_, i) => {
            const se = ((seActual - 1 + i + 1) % 52) + 1;
            const prev = gt;
            gt = Math.min(1, Math.max(0.001, gt * beta));
            return {
              semana: i + 1,
              se,
              gt,
              gtMin: Math.max(0, gt - 0.03),
              gtMax: Math.min(1, gt + 0.03),
              tendencia: gt > prev ? "↑" : "↓",
              metodo: "escenario",
            };
          });
        })();

    planProyeccion.current = plan;

    setGtProy(gtInicial);
    setFocosProy(focos.map((f) => ({ ...f })));
    setFocosAnterior([]);

    let semana = 0;
    const vac = factoresGlobales.vacuna ?? 0;
    const fum = factoresGlobales.intervention ?? 0;
    const beta = 1.18 * (1 - 0.61 * vac) * (1 - 0.35 * fum);
    let focosActuales = focos.map((f) => ({ ...f }));

    intervalRef.current = setInterval(() => {
      semana += 1;
      const planSemana = planProyeccion.current[semana - 1];
      const gtActual = planSemana?.gt ?? gtInicial;

      const focosAnts = focosActuales.map((f) => ({ ...f }));
      focosActuales = focosActuales.map((f) => {
        const betaF =
          1.18 *
          (1 - 0.61 * (f.factores.vacuna ?? 0)) *
          (1 - 0.35 * (f.factores.intervention ?? 0));
        return {
          ...f,
          factores: {
            ...f.factores,
            casos: Math.max(1, Math.round(f.factores.casos * betaF)),
          },
        };
      });

      setGtProy(gtActual);
      setFocosProy([...focosActuales]);
      setFocosAnterior([...focosAnts]);
      setSemanaProyeccion(semana);
      setSemanasProyectadas((prev) => [...prev, planSemana]);

      if (semana >= 8) {
        clearInterval(intervalRef.current);
        proyectandoRef.current = false;
        setProyectandoState(false);
      }
    }, 800);
  }, [focos, currentGt, factoresGlobales, modeloIA, datos, selectedIdx]);

  const reiniciarProyeccion = useCallback(() => {
    clearInterval(intervalRef.current);
    proyectandoRef.current = false;
    setProyectandoState(false);
    setSemanaProyeccion(0);
    setGtProy(null);
    setFocosProy([]);
    setFocosAnterior([]);
    setSemanasProyectadas([]);
    planProyeccion.current = [];
  }, []);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  // ── Recomendación IA pre-calculada ────────────────────────────────────────
  const recomendacionIA = useMemo(() => {
    if (!modeloIA || !modeloIA.entrenado) return null;
    const gtInicial = Math.max(0.05, currentGt ?? 0.05);
    const seActual = datos?.[selectedIdx]?.se ?? 26;
    const semanas = proyectarHibrido(
      modeloIA,
      gtInicial,
      factoresGlobales,
      seActual,
      datos?.[selectedIdx]?.año ?? 2025,
      datos,
    );
    return generarRecomendacion(semanas, factoresGlobales);
  }, [modeloIA, currentGt, factoresGlobales, datos, selectedIdx]);

  const toggleLayer = (k) => setLayers((l) => ({ ...l, [k]: !l[k] }));

  const handleMapClick = useCallback(
    (lat, lon) => {
      if (!addingFocus) return;
      const nuevoFoco = {
        lat,
        lon,
        label: `Zona ${focos.length + 1}`,
        factores: { ...factoresGlobales },
        sigmaBase: sigmaDelDistritoMasCercano(lat, lon),
      };
      setFocos((prev) => {
        const nuevos = [...prev, nuevoFoco];
        setFocoSeleccionado(nuevos.length - 1);
        return nuevos;
      });
      setAddingFocus(false);
      setActiveTab("factores");
    },
    [addingFocus, focos.length, factoresGlobales],
  );

  const updateFocoFactores = useCallback((idx, nuevosFactores) => {
    setFocos((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, factores: nuevosFactores } : f)),
    );
  }, []);

  const factoresActivos =
    focoSeleccionado !== null
      ? (focos[focoSeleccionado]?.factores ?? factoresGlobales)
      : factoresGlobales;

  const setFactoresActivos = useCallback(
    (nuevos) => {
      if (focoSeleccionado !== null)
        updateFocoFactores(focoSeleccionado, nuevos);
      else setFactoresGlobales(nuevos);
    },
    [focoSeleccionado, updateFocoFactores],
  );

  const fociCalc = useMemo(() => {
    const GtBase = gtProy !== null ? gtProy : Math.max(0.01, currentGt ?? 0.01);
    const Fg = calcularF(factoresGlobales);

    const zonas = calcularIntensidades(GtBase);
    const baseZonas = zonas.map((z) => ({
      lat: z.lat,
      lon: z.lon,
      Ai: z.Ai * Fg * AI_ESCALA,
      sigma: calcularSigma(factoresGlobales, z.sigma),
      nombre: z.nombre,
      tipo: "base",
    }));

    const focosSource = focosProy.length > 0 ? focosProy : focos;
    const focosHip = focosSource.map((f) => {
      const Ff = calcularF(f.factores);
      const sigF = calcularSigma(f.factores, f.sigmaBase ?? 0.006);
      const Ai =
        (f.factores.casos / 1453549) * 100000 * Ff * GtBase * AI_ESCALA * 0.3;
      return {
        lat: f.lat,
        lon: f.lon,
        Ai,
        sigma: sigF,
        nombre: f.label,
        tipo: "foco",
      };
    });

    return [...baseZonas, ...focosHip];
  }, [disease, currentGt, factoresGlobales, focos, focosProy, gtProy]);

  const Fcompuesto = calcularF(factoresActivos);

  const tabs = calcMode
    ? [
        { id: "capas", label: "Visualización" },
        { id: "math", label: "Fórmulas" },
        { id: "criticos", label: "Epicentros" },
      ]
    : [
        {
          id: "factores",
          label:
            focoSeleccionado !== null
              ? `Zona ${focoSeleccionado + 1}`
              : "Factores",
        },
        { id: "focos", label: "Zonas de brote" },
      ];

  // Gt actual de la semana animada (para mostrar en grande)
  const semanaActualPlan =
    semanaProyeccion > 0 ? planProyeccion.current[semanaProyeccion - 1] : null;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 54,
          background: N.surface,
          borderBottom: `1px solid ${N.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 10,
          flexShrink: 0,
          boxShadow: "0 1px 4px rgba(13,17,23,0.05)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            fontWeight: 700,
            color: N.text,
            letterSpacing: "-0.2px",
          }}
        >
          Mapa de riesgo
        </h1>
        <div style={{ flex: 1 }} />
        <WeekSelector
          datos={datos}
          selectedIdx={selectedIdx}
          onSelectIdx={onSelectIdx}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: 100,
            background: level.bg,
            border: `1px solid ${level.color}40`,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: level.color,
              animation: "blink 1.5s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              color: level.color,
              letterSpacing: 0.5,
            }}
          >
            {level.label}
          </span>
        </div>
        <button
          onClick={() => setMostrarModal(true)}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: `1px solid ${N.teal}`,
            background: "white",
            color: N.teal,
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.12s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = N.teal;
            e.currentTarget.style.color = "white";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "white";
            e.currentTarget.style.color = N.teal;
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> Nuevo registro
        </button>
        <button
          onClick={() => setCalcMode(!calcMode)}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: `1px solid ${calcMode ? N.lila : N.border}`,
            background: calcMode ? N.lila : "white",
            color: calcMode ? "white" : N.muted,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.12s",
            boxShadow: calcMode ? "0 2px 8px rgba(124,58,237,0.25)" : "none",
          }}
        >
          ∫ Modo matemático
        </button>
      </div>

      {/* ── Panel predicción IA ──────────────────────────────────────────────── */}
      {recomendacionIA && semanaProyeccion === 0 && !proyectandoState && (
        <PanelPrediccionIA recomendacion={recomendacionIA} modelo={modeloIA} />
      )}

      {/* ── Barra proyección ─────────────────────────────────────────────────── */}
      <div
        style={{
          background: "white",
          borderBottom: `1px solid ${N.border}`,
          padding: "7px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontSize: 12,
              color: N.mid,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            Proyección 8 semanas
          </span>

          {!proyectandoState && semanaProyeccion === 0 && (
            <button
              onClick={iniciarProyeccion}
              style={{
                padding: "4px 14px",
                borderRadius: 100,
                background: N.blue,
                color: "white",
                border: "none",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 6px rgba(29,78,216,0.3)",
              }}
            >
              ▶ Simular expansión
            </button>
          )}

          {(proyectandoState || semanaProyeccion > 0) && (
            <>
              {/* Barra de progreso con segmentos IA vs escenario */}
              <div
                style={{
                  flex: 1,
                  position: "relative",
                  height: 8,
                  background: N.border,
                  borderRadius: 5,
                  overflow: "hidden",
                }}
              >
                {/* Tramo IA (primeras 4 semanas - color lila) */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${Math.min(semanaProyeccion / 8, 0.5) * 100}%`,
                    background: N.lila,
                    borderRadius: "5px 0 0 5px",
                    transition: "width 0.5s ease",
                  }}
                />
                {/* Tramo escenario (semanas 5-8 - color teal/green) */}
                {semanaProyeccion > 4 && (
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: 0,
                      height: "100%",
                      width: `${((semanaProyeccion - 4) / 8) * 100}%`,
                      background: semanaProyeccion >= 8 ? N.green : N.teal,
                      borderRadius: "0 5px 5px 0",
                      transition: "width 0.5s ease",
                    }}
                  />
                )}
                {/* Marcador de división IA/escenario */}
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: 0,
                    width: 1,
                    height: "100%",
                    background: "rgba(255,255,255,0.6)",
                  }}
                />
              </div>

              {/* Gt proyectado en GRANDE */}
              {gtProy !== null && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 4,
                    background: getGtLevel(gtProy).bg,
                    padding: "3px 10px",
                    borderRadius: 8,
                    border: `1px solid ${getGtLevel(gtProy).color}30`,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 20,
                      fontWeight: 800,
                      color: getGtLevel(gtProy).color,
                      lineHeight: 1,
                    }}
                  >
                    {gtProy.toFixed(3)}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: getGtLevel(gtProy).color,
                      opacity: 0.7,
                    }}
                  >
                    Gₜ
                  </span>
                </div>
              )}

              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: N.mid,
                  whiteSpace: "nowrap",
                }}
              >
                {semanaProyeccion >= 8
                  ? "✓ Completado"
                  : semanaProyeccion <= 4
                    ? `🤖 +${semanaProyeccion}/4 IA`
                    : `⚙️ +${semanaProyeccion}/8 Escenario`}
              </span>

              <button
                onClick={reiniciarProyeccion}
                style={{
                  padding: "4px 12px",
                  borderRadius: 100,
                  background: "transparent",
                  color: N.muted,
                  border: `1px solid ${N.border}`,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                ↺ Reiniciar
              </button>
            </>
          )}
        </div>

        {/* Leyenda de la barra */}
        {(proyectandoState || semanaProyeccion > 0) && (
          <div
            style={{
              display: "flex",
              gap: 14,
              paddingLeft: 2,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10,
                color: N.muted,
                fontFamily: "var(--font-mono)",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 4,
                  background: N.lila,
                  borderRadius: 2,
                  display: "inline-block",
                }}
              />
              Sem. 1–4: Predicción IA
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10,
                color: N.muted,
                fontFamily: "var(--font-mono)",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 4,
                  background: N.teal,
                  borderRadius: 2,
                  display: "inline-block",
                }}
              />
              Sem. 5–8: Simulación de escenario
            </span>
            {semanaActualPlan && (
              <span
                style={{
                  fontSize: 10,
                  color: N.faint,
                  fontFamily: "var(--font-mono)",
                }}
              >
                IC: [{semanaActualPlan.gtMin?.toFixed(2)}–
                {semanaActualPlan.gtMax?.toFixed(2)}]
              </span>
            )}
          </div>
        )}

        {/* Panel resumen al completar */}
        {semanaProyeccion >= 8 && semanasProyectadas.length === 8 && (
          <ResumenProyeccion
            semanasIA={semanasProyectadas}
            onReiniciar={reiniciarProyeccion}
          />
        )}
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── Mapa ──────────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer
            center={SCZ_CENTER}
            zoom={SCZ_ZOOM}
            style={{ width: "100%", height: "100%" }}
          >
            <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
            {SCZ_ANILLOS.map((a, i) => (
              <Circle
                key={a.name}
                center={SCZ_CENTER}
                radius={a.radius * 111320}
                pathOptions={{
                  color: `rgba(13,148,136,${0.1 + i * 0.03})`,
                  weight: 1,
                  dashArray: "5 6",
                  fillOpacity: 0,
                }}
              />
            ))}
            {SCZ_LANDMARKS.map((lm) => (
              <Marker
                key={lm.name}
                position={[lm.lat, lm.lon]}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="background:rgba(255,255,255,0.96);border:1px solid #e2e6ef;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(13,17,23,0.10)">${lm.icon}</div>`,
                  iconSize: [28, 28],
                  iconAnchor: [14, 14],
                })}
              >
                <Tooltip direction="top" offset={[0, -16]} opacity={0.97}>
                  <span
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {lm.name}
                  </span>
                </Tooltip>
              </Marker>
            ))}

            {/* Focos con color dinámico durante proyección */}
            {focos.map((f, i) => {
              const isSelected = focoSeleccionado === i;
              const focoProy = focosProy[i];
              const focoAnterior = focosAnterior[i];
              const casosActuales = focoProy
                ? focoProy.factores.casos
                : f.factores.casos;
              const casosAnteriores = focoAnterior
                ? focoAnterior.factores.casos
                : f.factores.casos;
              const proyectando = focosProy.length > 0;
              const subio = casosActuales > casosAnteriores;
              const Ff = calcularF(focoProy?.factores ?? f.factores);
              const radio = 150 + (casosActuales / 500) * 600;
              const intensidad = Math.min(1, Ff / 2.5);

              // Color dinámico: rojo si subió, verde si bajó, tema si no proyectando
              const colorDinamico =
                proyectando && semanaProyeccion > 0
                  ? subio
                    ? N.rose
                    : N.green
                  : isSelected
                    ? N.blue
                    : theme.primary;

              return (
                <Circle
                  key={i}
                  center={[f.lat, f.lon]}
                  radius={radio}
                  pathOptions={{
                    color: colorDinamico,
                    fillColor: colorDinamico,
                    fillOpacity: isSelected ? 0.2 : 0.05 + intensidad * 0.18,
                    weight: isSelected ? 2.5 : 1.5,
                    opacity: isSelected ? 1 : 0.5 + intensidad * 0.4,
                  }}
                  eventHandlers={{
                    click: (e) => {
                      e.originalEvent.stopPropagation();
                      setFocoSeleccionado(isSelected ? null : i);
                      setActiveTab("factores");
                    },
                  }}
                >
                  <Tooltip
                    permanent={proyectando && semanaProyeccion > 0}
                    direction="top"
                    offset={[0, (-radio / 111320) * 0.01]}
                  >
                    <div
                      style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 12,
                      }}
                    >
                      <strong>{f.label}</strong>
                      {proyectando && semanaProyeccion > 0 ? (
                        <>
                          {" "}
                          —{" "}
                          <span
                            style={{ color: colorDinamico, fontWeight: 700 }}
                          >
                            {casosActuales} casos {subio ? "↑" : "↓"}
                          </span>
                        </>
                      ) : (
                        <> — {f.factores.casos} casos</>
                      )}
                      <br />
                      <span style={{ fontSize: 10, color: "#6e7891" }}>
                        F={Ff.toFixed(2)} ·{" "}
                        {isSelected ? "✓ editando" : "clic para editar"}
                      </span>
                    </div>
                  </Tooltip>
                </Circle>
              );
            })}

            <HeatmapLayer
              foci={fociCalc}
              disease={disease}
              layers={layers}
              mode={calcMode ? "calculo" : "normal"}
              onStatsUpdate={setStats}
              onCriticalUpdate={setCriticals}
            />
            <ClickHandler
              addingFocus={addingFocus}
              onAdd={handleMapClick}
              foci={fociCalc}
              theme={theme}
            />
          </MapContainer>

          {/* Info card */}
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              zIndex: 1000,
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(8px)",
              borderRadius: 12,
              padding: "12px 16px",
              border: `1px solid ${level.color}30`,
              boxShadow: "var(--shadow-md)",
              minWidth: 160,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: N.muted,
                fontFamily: "var(--font-mono)",
                letterSpacing: 1,
                marginBottom: 4,
              }}
            >
              Semana {datos?.[selectedIdx]?.se} · {datos?.[selectedIdx]?.año}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 26,
                fontWeight: 700,
                color: level.color,
                lineHeight: 1,
              }}
            >
              {(currentGt ?? 0).toFixed(3)}
            </div>
            <div
              style={{
                fontSize: 11,
                color: level.color,
                fontWeight: 600,
                marginTop: 3,
              }}
            >
              {level.label}
            </div>
            <div
              style={{
                marginTop: 10,
                height: 3,
                background: N.border,
                borderRadius: 3,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min((currentGt ?? 0) * 100, 100)}%`,
                  background: level.color,
                  borderRadius: 3,
                  transition: "width 0.4s",
                }}
              />
            </div>

            {/* Badge IA */}
            {modeloIA?.entrenado && (
              <div
                style={{
                  marginTop: 8,
                  padding: "4px 8px",
                  background: N.lila + "12",
                  borderRadius: 6,
                  border: `1px solid ${N.lila}20`,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: N.lila,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                  }}
                >
                  🤖 Modelo IA activo
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: N.faint,
                    fontFamily: "var(--font-mono)",
                    marginTop: 1,
                  }}
                >
                  n={modeloIA.n} · R²={modeloIA.r2.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {/* Stats rápidas */}
          {stats && (
            <div
              style={{
                position: "absolute",
                bottom: 70,
                left: 12,
                zIndex: 1000,
                background: "rgba(255,255,255,0.97)",
                backdropFilter: "blur(8px)",
                borderRadius: 10,
                padding: "10px 14px",
                border: `1px solid ${N.border}`,
                boxShadow: "var(--shadow-sm)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
              }}
            >
              <div
                style={{
                  color: N.faint,
                  fontSize: 9,
                  letterSpacing: 1,
                  marginBottom: 6,
                }}
              >
                CAMPO R(x,y)
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "4px 14px",
                }}
              >
                <span style={{ color: N.muted }}>R máx</span>
                <span style={{ color: N.text, fontWeight: 600 }}>
                  {stats.rMax?.toFixed(4)}
                </span>
                <span style={{ color: N.muted }}>R prom</span>
                <span style={{ color: N.text, fontWeight: 600 }}>
                  {stats.rAvg?.toFixed(4)}
                </span>
                <span style={{ color: N.muted }}>|∇R| prom</span>
                <span style={{ color: N.teal, fontWeight: 600 }}>
                  {stats.gradAvg?.toFixed(4)}
                </span>
              </div>
            </div>
          )}

          {/* Botón agregar zona */}
          <button
            onClick={() => {
              setAddingFocus(!addingFocus);
              setFocoSeleccionado(null);
            }}
            style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1000,
              padding: "9px 22px",
              borderRadius: 100,
              border: `1px solid ${addingFocus ? N.blue : N.border}`,
              background: addingFocus ? N.blue : "rgba(255,255,255,0.97)",
              color: addingFocus ? "white" : N.mid,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              backdropFilter: "blur(8px)",
              boxShadow: addingFocus
                ? "0 4px 14px rgba(29,78,216,0.35)"
                : "0 2px 8px rgba(13,17,23,0.1)",
              transition: "all 0.12s",
            }}
          >
            {addingFocus
              ? "📍 Haz clic en el mapa"
              : "+ Agregar zona hipotética"}
          </button>
        </div>

        {/* ── Panel lateral ──────────────────────────────────────────────────── */}
        <div
          style={{
            width: 290,
            background: N.surface,
            borderLeft: `1px solid ${N.border}`,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {!calcMode && (
            <div
              style={{
                padding: "10px 14px",
                background: N.surface2,
                borderBottom: `1px solid ${N.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: N.faint,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: 1,
                  }}
                >
                  MULTIPLICADOR AMBIENTAL
                </div>
                <div style={{ fontSize: 11, color: N.muted, marginTop: 1 }}>
                  {Fcompuesto > 1.15
                    ? "↑ Condiciones amplifican el riesgo"
                    : "↓ Condiciones reducen el riesgo"}
                </div>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 16,
                  fontWeight: 700,
                  color:
                    Fcompuesto > 1.3
                      ? N.rose
                      : Fcompuesto > 1.1
                        ? N.amber
                        : N.green,
                }}
              >
                ×{Fcompuesto.toFixed(3)}
              </span>
            </div>
          )}

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: `1px solid ${N.border}`,
              flexShrink: 0,
            }}
          >
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    flex: 1,
                    padding: "11px 4px",
                    border: "none",
                    cursor: "pointer",
                    background: "transparent",
                    color: active ? N.teal : N.muted,
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    borderBottom: active
                      ? `2px solid ${N.teal}`
                      : "2px solid transparent",
                    transition: "all 0.12s",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
            {activeTab === "factores" && (
              <div className="fade-in">
                {focoSeleccionado !== null && (
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      marginBottom: 16,
                      background: "#eff6ff",
                      border: `1px solid ${N.blue}30`,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: N.blue,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{ fontSize: 12, color: N.blue, fontWeight: 600 }}
                    >
                      Editando {focos[focoSeleccionado]?.label}
                    </span>
                    <button
                      onClick={() => {
                        setFocoSeleccionado(null);
                        setActiveTab("factores");
                      }}
                      style={{
                        marginLeft: "auto",
                        background: "none",
                        border: "none",
                        color: N.muted,
                        cursor: "pointer",
                        fontSize: 16,
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
                <FactoresPanel
                  factores={factoresActivos}
                  onChange={setFactoresActivos}
                  theme={theme}
                  showCasos={focoSeleccionado !== null}
                />
                {stats && (
                  <div style={{ marginTop: 8 }}>
                    <SectionLabel icon="📊">Valores calculados</SectionLabel>
                    <StatRow
                      label="Riesgo máximo en el mapa"
                      value={stats.rMax?.toFixed(4)}
                      color={N.rose}
                    />
                    <StatRow
                      label="Riesgo promedio"
                      value={stats.rAvg?.toFixed(4)}
                      color={N.mid}
                    />
                    <StatRow
                      label="Velocidad de expansión"
                      value={stats.gradAvg?.toFixed(4)}
                      color={N.teal}
                    />
                    <StatRow
                      label="Epicentro (lat)"
                      value={stats.maxPos?.lat?.toFixed(4)}
                      color={N.mid}
                    />
                    <StatRow
                      label="Epicentro (lon)"
                      value={stats.maxPos?.lon?.toFixed(4)}
                      color={N.mid}
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === "focos" && (
              <div className="fade-in">
                {focos.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "32px 16px",
                      color: N.faint,
                    }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📍</div>
                    <div
                      style={{ fontSize: 13, color: N.muted, marginBottom: 6 }}
                    >
                      Sin zonas hipotéticas
                    </div>
                    <div style={{ fontSize: 11, color: N.faint }}>
                      Usa el botón de abajo para simular brotes en zonas
                      específicas
                    </div>
                  </div>
                ) : (
                  focos.map((f, i) => {
                    const isSelected = focoSeleccionado === i;
                    const focoProy = focosProy[i];
                    const casosActuales = focoProy
                      ? focoProy.factores.casos
                      : f.factores.casos;
                    const proyectando =
                      focosProy.length > 0 && semanaProyeccion > 0;
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          setFocoSeleccionado(isSelected ? null : i);
                          setActiveTab("factores");
                        }}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 10,
                          marginBottom: 8,
                          background: isSelected ? "#eff6ff" : N.surface2,
                          border: `1px solid ${isSelected ? N.blue + "60" : N.border}`,
                          cursor: "pointer",
                          transition: "all 0.12s",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: 13,
                              color: isSelected ? N.blue : N.text,
                            }}
                          >
                            {f.label}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFocos((prev) =>
                                prev.filter((_, j) => j !== i),
                              );
                              if (focoSeleccionado === i)
                                setFocoSeleccionado(null);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: N.rose,
                              cursor: "pointer",
                              fontSize: 18,
                              padding: 0,
                            }}
                          >
                            ×
                          </button>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: N.muted,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {f.lat.toFixed(4)}, {f.lon.toFixed(4)}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 11,
                            color: N.muted,
                            marginTop: 4,
                          }}
                        >
                          <span>
                            {proyectando
                              ? `${casosActuales} casos (sem. ${semanaProyeccion})`
                              : `${f.factores.casos} casos`}{" "}
                            · F={calcularF(f.factores).toFixed(2)}
                          </span>
                          <span
                            style={{ color: isSelected ? N.blue : N.faint }}
                          >
                            {isSelected ? "✓ editando" : "→ clic para editar"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === "capas" && (
              <div className="fade-in">
                <SectionLabel>Capas del mapa</SectionLabel>
                {[
                  {
                    key: "heatmap",
                    label: "Mapa de calor R(x,y)",
                    desc: "Dónde hay mayor riesgo",
                    color: theme.primary,
                  },
                  {
                    key: "gradient",
                    label: "Flechas de expansión ∇R",
                    desc: "Hacia dónde se propaga el brote",
                    color: N.teal,
                  },
                  {
                    key: "contours",
                    label: "Zonas de igual riesgo",
                    desc: "Líneas que separan niveles de riesgo",
                    color: N.lila,
                  },
                  {
                    key: "critical",
                    label: "Epicentros del brote",
                    desc: "Puntos donde el riesgo es máximo",
                    color: N.amber,
                  },
                ].map(({ key, label, desc, color }) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 0",
                      borderBottom: `1px solid ${N.border}`,
                    }}
                  >
                    <div>
                      <div
                        style={{ fontSize: 13, fontWeight: 500, color: N.text }}
                      >
                        {label}
                      </div>
                      <div style={{ fontSize: 11, color: N.muted }}>{desc}</div>
                    </div>
                    <div
                      onClick={() => toggleLayer(key)}
                      style={{
                        width: 40,
                        height: 22,
                        borderRadius: 11,
                        background: layers[key] ? color : N.border,
                        position: "relative",
                        cursor: "pointer",
                        transition: "background 0.2s",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 3,
                          left: layers[key] ? 21 : 3,
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "white",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          transition: "left 0.2s",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "math" && (
              <div className="fade-in">
                <SectionLabel>Base matemática del modelo</SectionLabel>
                {MATH_FORMULAS["dengue"].map((f, i) => (
                  <MathCard key={i} {...f} />
                ))}
              </div>
            )}

            {activeTab === "criticos" && (
              <div className="fade-in">
                <SectionLabel>Epicentros detectados</SectionLabel>
                {criticals.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      color: N.faint,
                      fontSize: 12,
                      paddingTop: 20,
                      lineHeight: 1.8,
                    }}
                  >
                    Activa "Epicentros del brote" en Capas
                    <br />
                    para calcularlos
                  </div>
                ) : (
                  criticals.map((c, i) => {
                    const col =
                      c.type === "máximo"
                        ? N.rose
                        : c.type === "mínimo"
                          ? N.green
                          : N.amber;
                    return (
                      <div
                        key={i}
                        style={{
                          padding: "10px 12px",
                          background: N.surface2,
                          borderRadius: 8,
                          marginBottom: 8,
                          border: `1px solid ${col}30`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                              fontWeight: 700,
                              color: col,
                            }}
                          >
                            {c.type === "máximo" ? "Epicentro" : c.type}
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              color: N.muted,
                            }}
                          >
                            R={c.r.toFixed(4)}
                          </span>
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            color: N.muted,
                            lineHeight: 1.7,
                          }}
                        >
                          {c.lat.toFixed(5)}, {c.lon.toFixed(5)}
                          <br />
                          D={c.D?.toFixed(5)}&nbsp;&nbsp;Rxx={c.Rxx?.toFixed(5)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {mostrarModal && (
        <AgregarRegistroModal
          onGuardar={onAgregarRegistro}
          onCerrar={() => setMostrarModal(false)}
          datosExistentes={datos}
        />
      )}
    </div>
  );
}
