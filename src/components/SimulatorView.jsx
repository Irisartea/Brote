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
  sigmaInfluenza,
  fTemp_dengue,
  fHumedad_dengue,
  fLluvia_dengue,
  fVacuna_dengue,
  fAgua,
  fFumigacion,
  fTemp_inf,
  fHumedad_inf,
  fHacinamiento,
  fVentilacion,
  fVacuna_inf,
} from "../utils/mathEngine";

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR = '&copy; <a href="https://carto.com/">CARTO</a>';

// Paleta del simulador — tema claro
const N = {
  bg: "#f4f6fa",
  surface: "#ffffff",
  surface2: "#f8faff",
  border: "#dde3ee",
  text: "#111827",
  mid: "#374151",
  muted: "#6b7280",
  faint: "#9ca3af",
  // acentos funcionales
  cyan: "#0ea5e9",
  blue: "#2563eb",
  lila: "#8b5cf6",
  green: "#16a34a",
  orange: "#d97706",
  red: "#dc2626",
};

const DEFAULT_FACTORES = {
  temp: 28,
  humidity: 70,
  lluvia: 80,
  breeding: 0.4,
  intervention: 0.2,
  vacuna: 0,
  hacinamiento: 0.5,
  ventilacion: 0.3,
  casos: 20,
};

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

function calcularF(disease, factores) {
  if (disease === "dengue") {
    return (
      fTemp_dengue(factores.temp) *
      fHumedad_dengue(factores.humidity) *
      fLluvia_dengue(factores.lluvia) *
      fAgua(factores.breeding) *
      fFumigacion(factores.intervention) *
      fVacuna_dengue(factores.vacuna)
    );
  }
  return (
    fTemp_inf(factores.temp) *
    fHumedad_inf(factores.humidity) *
    fHacinamiento(factores.hacinamiento) *
    fVentilacion(factores.ventilacion) *
    fVacuna_inf(factores.vacuna)
  );
}

function calcularSigma(disease, factores, sigmaBase) {
  if (disease === "dengue") {
    return sigmaDengue(
      sigmaBase,
      factores.breeding,
      factores.lluvia / 200,
      factores.intervention,
    );
  }
  return sigmaInfluenza(sigmaBase, factores.hacinamiento, factores.ventilacion);
}

function ClickHandler({ addingFocus, onAdd, foci, disease, theme }) {
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
          <div style="font-family:'Space Grotesk',sans-serif">
            <div style="font-size:10px;color:#6b7280;margin-bottom:4px">${lat.toFixed(5)}, ${lon.toFixed(5)}</div>
            <div style="font-size:22px;font-weight:700;color:${theme.primary};font-family:'JetBrains Mono',monospace">
              R = ${r.toFixed(5)}
            </div>
            <div style="display:flex;gap:12px;font-size:11px;color:#6b7280;font-family:'JetBrains Mono',monospace;margin-top:6px">
              <span>|∇R| = ${mag.toFixed(5)}</span>
              <span>θ = ${theta.toFixed(1)}°</span>
            </div>
            <div style="margin-top:6px;font-size:11px;color:#374151">
              Dirección: <strong style="color:${theme.primary}">${angleToCardinal(theta)}</strong>
            </div>
          </div>`,
        )
        .openOn(e.target);
    },
  });
  return null;
}

// ── Slider rediseñado ──────────────────────────────────────────────────
function Slider({
  label,
  value,
  onChange,
  color = N.cyan,
  min = 0,
  max = 1,
  step = 0.01,
  unit = "",
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, color: N.mid, fontWeight: 500 }}>
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 600,
            color,
            background: color + "12",
            padding: "2px 9px",
            borderRadius: 6,
            border: `1px solid ${color}30`,
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
          height: 4,
          background: N.border,
          borderRadius: 4,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${pct}%`,
            borderRadius: 4,
            background: color,
            transition: "width 0.1s",
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
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "white",
            border: `2px solid ${color}`,
            boxShadow: `0 1px 4px rgba(0,0,0,0.12)`,
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
        boxShadow: "var(--shadow-sm)",
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
              fontSize: 12,
              color: N.cyan,
              background: "#f0f9ff",
              padding: "10px 12px",
              borderRadius: 6,
              marginBottom: 8,
              border: `1px solid #bae6fd`,
              whiteSpace: "pre-wrap",
            }}
          >
            {formula}
          </div>
          <p
            style={{ fontSize: 12, color: N.muted, lineHeight: 1.6, margin: 0 }}
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

function FactoresPanel({
  disease,
  factores,
  onChange,
  theme,
  showCasos = false,
}) {
  const isDengue = disease === "dengue";
  return (
    <>
      {isDengue ? (
        <>
          <SectionLabel icon="🌡️">Condiciones del entorno</SectionLabel>
          <Slider
            label="Temperatura"
            value={factores.temp}
            min={15}
            max={40}
            unit="°C"
            color={N.orange}
            onChange={(v) => onChange({ ...factores, temp: v })}
          />
          <Slider
            label="Humedad"
            value={factores.humidity}
            min={30}
            max={100}
            unit="%"
            color={N.cyan}
            onChange={(v) => onChange({ ...factores, humidity: v })}
          />
          <Slider
            label="Lluvia"
            value={factores.lluvia}
            min={0}
            max={200}
            unit=" mm"
            color={N.blue}
            onChange={(v) => onChange({ ...factores, lluvia: v })}
          />
          <Slider
            label="Agua estancada / criaderos"
            value={factores.breeding}
            color={N.lila}
            onChange={(v) => onChange({ ...factores, breeding: v })}
          />
          <SectionLabel icon="🏥">Medidas de control</SectionLabel>
          <Slider
            label="Fumigación"
            value={factores.intervention}
            color={N.green}
            onChange={(v) => onChange({ ...factores, intervention: v })}
          />
          <Slider
            label="Vacunación de la población"
            value={factores.vacuna}
            color="#8b5cf6"
            onChange={(v) => onChange({ ...factores, vacuna: v })}
          />
        </>
      ) : (
        <>
          <SectionLabel icon="🌡️">Condiciones del entorno</SectionLabel>
          <Slider
            label="Temperatura"
            value={factores.temp}
            min={5}
            max={35}
            unit="°C"
            color={N.orange}
            onChange={(v) => onChange({ ...factores, temp: v })}
          />
          <Slider
            label="Humedad"
            value={factores.humidity}
            min={30}
            max={100}
            unit="%"
            color={N.cyan}
            onChange={(v) => onChange({ ...factores, humidity: v })}
          />
          <SectionLabel icon="🏘️">Condiciones sociales</SectionLabel>
          <Slider
            label="Aglomeración de personas"
            value={factores.hacinamiento}
            color={N.orange}
            onChange={(v) => onChange({ ...factores, hacinamiento: v })}
          />
          <Slider
            label="Ventilación de espacios"
            value={factores.ventilacion}
            color={N.green}
            onChange={(v) => onChange({ ...factores, ventilacion: v })}
          />
          <Slider
            label="Vacunación de la población"
            value={factores.vacuna}
            color="#8b5cf6"
            onChange={(v) => onChange({ ...factores, vacuna: v })}
          />
        </>
      )}
      {showCasos && (
        <>
          <SectionLabel icon="📍">Casos en esta zona</SectionLabel>
          <Slider
            label="Casos reportados"
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

export default function SimulatorView({
  disease,
  datos,
  currentGt,
  selectedIdx,
  onSelectIdx,
}) {
  const theme = DISEASE_THEME[disease];
  const level = getGtLevel(currentGt ?? 0);
  const [calcMode, setCalcMode] = useState(false);
  const [addingFocus, setAddingFocus] = useState(false);
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

  // ── Proyección animada ──────────────────────────────────────────────
  // semanaProyeccion: 0 = estado base, 1-8 = semanas proyectadas
  // gtProy: multiplicador de Gₜ que crece o decrece con beta
  // El heatmap usa gtProy para escalar las intensidades de TODAS las zonas
  const [proyectando, setProyectando] = useState(false);
  const [semanaProyeccion, setSemanaProyeccion] = useState(0);
  const [gtProy, setGtProy] = useState(null); // null = sin proyección
  const [focosProy, setFocosProy] = useState([]);
  const intervalRef = useRef(null);

  const iniciarProyeccion = useCallback(() => {
    setSemanaProyeccion(0);
    setGtProy(Math.max(0.01, currentGt ?? 0.01));
    setFocosProy(focos.map((f) => ({ ...f })));
    setProyectando(true);
  }, [focos, currentGt]);

  const reiniciarProyeccion = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProyectando(false);
    setSemanaProyeccion(0);
    setGtProy(null);
    setFocosProy([]);
  }, []);

  useEffect(() => {
    if (!proyectando) return;
    intervalRef.current = setInterval(() => {
      setSemanaProyeccion((prev) => {
        const next = prev + 1;
        if (next > 8) {
          clearInterval(intervalRef.current);
          setProyectando(false);
          return 8;
        }
        // Beta: tasa de reproducción efectiva modulada por factores globales
        // β = 1.18 × (1 - 0.61×vacuna) × (1 - 0.35×fumigación)
        // β > 1 → expansión, β < 1 → contracción
        const vac = factoresGlobales.vacuna ?? 0;
        const fum = factoresGlobales.intervention ?? 0;
        const beta = 1.18 * (1 - 0.61 * vac) * (1 - 0.35 * fum);

        // Actualizar Gₜ proyectado — escala el campo de riesgo completo
        setGtProy((prevGt) => {
          const nuevoGt = Math.min(1, Math.max(0.001, prevGt * beta));
          return nuevoGt;
        });

        // Actualizar focos hipotéticos con su propia vacunación/fumigación
        setFocosProy((prevFocos) =>
          prevFocos.map((f) => {
            const vF = f.factores.vacuna ?? 0;
            const fumF = f.factores.intervention ?? 0;
            const betaF = 1.18 * (1 - 0.61 * vF) * (1 - 0.35 * fumF);
            const nuevosCasos = Math.max(
              1,
              Math.round(f.factores.casos * betaF),
            );
            return { ...f, factores: { ...f.factores, casos: nuevosCasos } };
          }),
        );

        return next;
      });
    }, 900);
    return () => clearInterval(intervalRef.current);
  }, [proyectando, factoresGlobales]);

  const toggleLayer = (k) => setLayers((l) => ({ ...l, [k]: !l[k] }));

  const handleMapClick = useCallback(
    (lat, lon) => {
      if (!addingFocus) return;
      const nuevoFoco = {
        lat,
        lon,
        label: `Foco ${focos.length + 1}`,
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
    // Durante proyección usamos gtProy (Gₜ que evoluciona semana a semana)
    // Esto hace que el heatmap de TODAS las zonas base se expanda/contraiga
    const GtBase = gtProy !== null ? gtProy : Math.max(0.01, currentGt ?? 0.01);
    const Fg = calcularF(disease, factoresGlobales);
    const zonas = calcularIntensidades(GtBase);
    const baseZonas = zonas.map((z) => ({
      lat: z.lat,
      lon: z.lon,
      Ai: z.Ai * Fg,
      sigma: calcularSigma(disease, factoresGlobales, z.sigma),
      nombre: z.nombre,
      tipo: "base",
    }));
    // Focos: usar versión proyectada si existe, si no la normal
    const focosSource = focosProy.length > 0 ? focosProy : focos;
    const focosHip = focosSource.map((f) => {
      const Ff = calcularF(disease, f.factores);
      const sigF = calcularSigma(disease, f.factores, f.sigmaBase ?? 0.006);
      const Ai = (f.factores.casos / 1453549) * 100000 * Ff * GtBase * 0.024;
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

  const tabs = calcMode
    ? [
        { id: "capas", label: "Visualización" },
        { id: "math", label: "Modelo matemático" },
        { id: "criticos", label: "Puntos críticos" },
      ]
    : [
        {
          id: "factores",
          label:
            focoSeleccionado !== null
              ? `Foco ${focoSeleccionado + 1}`
              : "Factores",
        },
        { id: "focos", label: "Zonas de brote" },
      ];

  // Factor F compuesto para mostrar en el panel
  const Fcompuesto = calcularF(disease, factoresActivos);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 54,
          background: N.surface,
          borderBottom: `1px solid ${N.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 12,
          flexShrink: 0,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            fontWeight: 700,
            color: N.text,
            flex: 1,
            letterSpacing: "-0.2px",
          }}
        >
          Simulador de Riesgo Espacial
        </h1>

        {/* Selector Año + Semana */}
        {datos?.length > 0 &&
          (() => {
            const años = [...new Set(datos.map((r) => r.año))].sort();
            const añoActual = datos[selectedIdx]?.año;
            const seActual = datos[selectedIdx]?.se;
            const semanasDelAño = datos
              .filter((r) => r.año === añoActual)
              .map((r) => r.se);
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <select
                  value={añoActual}
                  onChange={(e) => {
                    const año = +e.target.value;
                    const idx = datos.findIndex((r) => r.año === año);
                    if (idx >= 0) onSelectIdx(idx);
                  }}
                  style={{
                    padding: "5px 8px",
                    borderRadius: 8,
                    border: `1px solid ${N.border}`,
                    background: "white",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: N.text,
                    cursor: "pointer",
                    outline: "none",
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
                  onChange={(e) => {
                    const se = +e.target.value;
                    const idx = datos.findIndex(
                      (r) => r.año === añoActual && r.se === se,
                    );
                    if (idx >= 0) onSelectIdx(idx);
                  }}
                  style={{
                    padding: "5px 8px",
                    borderRadius: 8,
                    border: `1px solid ${N.border}`,
                    background: "white",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: N.text,
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {semanasDelAño.map((s) => (
                    <option key={s} value={s}>
                      Semana {s}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: N.muted }}>
                  {datos[selectedIdx]?.confirmados?.toLocaleString()} casos
                </span>
              </div>
            );
          })()}

        {/* Badge nivel */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 14px",
            borderRadius: 100,
            background: level.bg,
            border: `1px solid ${level.color}40`,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
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

        {/* Modo Cálculo */}
        <button
          onClick={() => setCalcMode(!calcMode)}
          style={{
            padding: "6px 16px",
            borderRadius: 8,
            border: `1px solid ${calcMode ? N.lila : N.border}`,
            background: calcMode ? N.lila : "white",
            color: calcMode ? "white" : N.muted,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: 0.5,
            transition: "all 0.14s",
            boxShadow: calcMode ? "0 2px 8px rgba(139,92,246,0.25)" : "none",
          }}
        >
          ∫ Ver cálculo matemático
        </button>
      </div>

      {/* ── Barra de proyección ──────────────────────────────────────── */}
      {
        <div
          style={{
            background: "white",
            borderBottom: `1px solid ${N.border}`,
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
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
          {!proyectando && semanaProyeccion === 0 && (
            <button
              onClick={iniciarProyeccion}
              style={{
                padding: "5px 16px",
                borderRadius: 100,
                background: N.blue,
                color: "white",
                border: "none",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
              }}
            >
              ▶ Iniciar proyección
            </button>
          )}
          {(proyectando || semanaProyeccion > 0) && (
            <>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  background: N.border,
                  borderRadius: 4,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(semanaProyeccion / 8) * 100}%`,
                    background: semanaProyeccion >= 8 ? N.green : N.blue,
                    borderRadius: 4,
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
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
                  ? "Semana 8 — completado"
                  : `Semana +${semanaProyeccion}`}
              </span>
              <button
                onClick={reiniciarProyeccion}
                style={{
                  padding: "5px 14px",
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
      }

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── Mapa ─────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: "relative" }}>
          {disease === "influenza" && (
            <div
              style={{
                position: "absolute",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1001,
                background: "rgba(255,255,255,0.95)",
                backdropFilter: "blur(8px)",
                border: `1px solid ${N.lila}40`,
                borderRadius: 8,
                padding: "7px 16px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "var(--shadow-md)",
              }}
            >
              <span style={{ fontSize: 14 }}>🤧</span>
              <span style={{ fontSize: 11, color: N.mid }}>
                Simulador activo — datos epidemiológicos de influenza pendientes
              </span>
            </div>
          )}

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
                  color: `rgba(14,165,233,${0.12 + i * 0.04})`,
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
                  html: `<div style="background:rgba(255,255,255,0.95);border:1px solid #dde3ee;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(15,23,42,0.12)">${lm.icon}</div>`,
                  iconSize: [28, 28],
                  iconAnchor: [14, 14],
                })}
              >
                <Tooltip direction="top" offset={[0, -16]} opacity={0.97}>
                  <span
                    style={{
                      fontFamily: "'Space Grotesk',sans-serif",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {lm.name}
                  </span>
                </Tooltip>
              </Marker>
            ))}

            {focos.map((f, i) => {
              const isSelected = focoSeleccionado === i;
              const Ff = calcularF(disease, f.factores);
              const radio = 150 + (f.factores.casos / 500) * 600;
              const intensidad = Math.min(1, Ff / 2.5);
              return (
                <Circle
                  key={i}
                  center={[f.lat, f.lon]}
                  radius={radio}
                  pathOptions={{
                    color: isSelected ? N.blue : theme.primary,
                    fillColor: theme.primary,
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
                  <Tooltip>
                    <div
                      style={{
                        fontFamily: "'Space Grotesk',sans-serif",
                        fontSize: 12,
                      }}
                    >
                      <strong>{f.label}</strong> — {f.factores.casos} casos
                      <br />
                      <span style={{ fontSize: 10, color: "#6b7280" }}>
                        F={Ff.toFixed(2)} ·{" "}
                        {isSelected ? "✓ editando" : "click para editar"}
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
              disease={disease}
              theme={theme}
            />
          </MapContainer>

          {/* ── Info card sobre el mapa ─────────────────────── */}
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
              boxShadow: "0 4px 20px rgba(15,23,42,0.12)",
              minWidth: 170,
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
                fontSize: 28,
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

            {/* Barra de riesgo */}
            <div
              style={{
                marginTop: 10,
                height: 4,
                background: N.border,
                borderRadius: 4,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min((currentGt ?? 0) * 100, 100)}%`,
                  background: level.color,
                  borderRadius: 4,
                  transition: "width 0.4s",
                }}
              />
            </div>
          </div>

          {/* ── Stats rápidas (solo con stats disponibles) ──── */}
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
                boxShadow: "0 2px 12px rgba(15,23,42,0.08)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
              }}
            >
              <div
                style={{
                  color: N.muted,
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
                  gap: "4px 16px",
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
                <span style={{ color: N.cyan, fontWeight: 600 }}>
                  {stats.gradAvg?.toFixed(4)}
                </span>
              </div>
            </div>
          )}

          {/* ── Botón agregar foco ─────────────────────────── */}
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
                ? "0 4px 16px rgba(37,99,235,0.35)"
                : "0 2px 8px rgba(15,23,42,0.1)",
              letterSpacing: 0.5,
              transition: "all 0.14s",
            }}
          >
            {addingFocus
              ? "📍 Haz click en el mapa"
              : "+ Agregar foco hipotético"}
          </button>
        </div>

        {/* ── Panel lateral ─────────────────────────────────────────────── */}
        <div
          style={{
            width: 296,
            background: N.surface,
            borderLeft: `1px solid ${N.border}`,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {/* F compuesto badge */}
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
              <span style={{ fontSize: 11, color: N.muted }}>
                Factor ambiental F
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  fontWeight: 700,
                  color:
                    Fcompuesto > 1.3
                      ? N.red
                      : Fcompuesto > 1.1
                        ? N.orange
                        : N.green,
                }}
              >
                {Fcompuesto.toFixed(3)}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 400,
                    color: N.muted,
                    marginLeft: 4,
                  }}
                >
                  {Fcompuesto > 1.15
                    ? "↑ aumenta el riesgo"
                    : "↓ reduce el riesgo"}
                </span>
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
                    color: active ? N.blue : N.muted,
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    borderBottom: active
                      ? `2px solid ${N.blue}`
                      : "2px solid transparent",
                    transition: "all 0.14s",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
            {/* ── TAB FACTORES ──────────────────────────────── */}
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
                        width: 8,
                        height: 8,
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
                  disease={disease}
                  factores={factoresActivos}
                  onChange={setFactoresActivos}
                  theme={theme}
                  showCasos={focoSeleccionado !== null}
                />

                {/* Stats de R en tiempo real */}
                {stats && (
                  <div style={{ marginTop: 8 }}>
                    <SectionLabel icon="📊">Valores calculados</SectionLabel>
                    <StatRow
                      label="Riesgo máximo"
                      value={stats.rMax?.toFixed(4)}
                      color={N.red}
                    />
                    <StatRow
                      label="Riesgo promedio"
                      value={stats.rAvg?.toFixed(4)}
                      color={N.mid}
                    />
                    <StatRow
                      label="Velocidad de expansión"
                      value={stats.gradAvg?.toFixed(4)}
                      color={N.cyan}
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

            {/* ── TAB FOCOS ─────────────────────────────────── */}
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
                      No hay focos hipotéticos
                    </div>
                    <div style={{ fontSize: 11, color: N.faint }}>
                      Usa el botón "Agregar foco" para simular brotes en zonas
                      específicas
                    </div>
                  </div>
                ) : (
                  focos.map((f, i) => {
                    const isSelected = focoSeleccionado === i;
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
                          transition: "all 0.14s",
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
                              color: N.red,
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
                          <span>{f.factores.casos} casos reportados</span>
                          <span
                            style={{ color: isSelected ? N.blue : N.faint }}
                          >
                            {isSelected ? "✓ editando" : "→ click para editar"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── TAB CAPAS ─────────────────────────────────── */}
            {activeTab === "capas" && (
              <div className="fade-in">
                <SectionLabel>Visualización de capas</SectionLabel>
                {[
                  {
                    key: "heatmap",
                    label: "Mapa de calor R(x,y)",
                    desc: "Muestra dónde hay mayor riesgo",
                    color: theme.primary,
                  },
                  {
                    key: "gradient",
                    label: "Campo gradiente ∇R",
                    desc: "Hacia dónde se expande el brote",
                    color: N.cyan,
                  },
                  {
                    key: "contours",
                    label: "Curvas de nivel",
                    desc: "Líneas de igual nivel de riesgo",
                    color: N.lila,
                  },
                  {
                    key: "critical",
                    label: "Puntos críticos",
                    desc: "Detecta epicentros del brote",
                    color: N.orange,
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
                    {/* Toggle switch */}
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

            {/* ── TAB FÓRMULAS ──────────────────────────────── */}
            {activeTab === "math" && (
              <div className="fade-in">
                <SectionLabel>Modelo matemático</SectionLabel>
                {MATH_FORMULAS[disease].map((f, i) => (
                  <MathCard key={i} {...f} />
                ))}
              </div>
            )}

            {/* ── TAB CRÍTICOS ──────────────────────────────── */}
            {activeTab === "criticos" && (
              <div className="fade-in">
                <SectionLabel>Epicentros y zonas de transición</SectionLabel>
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
                    Activa "Puntos críticos" en Capas
                    <br />
                    para calcularlos
                  </div>
                ) : (
                  criticals.map((c, i) => {
                    const col =
                      c.type === "máximo"
                        ? N.red
                        : c.type === "mínimo"
                          ? N.green
                          : N.orange;
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
                            {c.type}
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
                          D={c.D?.toFixed(5)}
                          <br />
                          Rxx={c.Rxx?.toFixed(5)}
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
    </div>
  );
}
