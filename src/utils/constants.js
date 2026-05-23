// ═══════════════════════════════════════════
// BROTE° — Constantes globales
// ═══════════════════════════════════════════

export const SCZ_CENTER = [-17.7833, -63.1822];
export const SCZ_ZOOM = 13;

export const SCZ_BOUNDS = {
  latMin: -17.845,
  latMax: -17.73,
  lonMin: -63.23,
  lonMax: -63.12,
};

export const SCZ_LANDMARKS = [
  { name: "Plaza 24 de Septiembre", lat: -17.7833, lon: -63.1822, icon: "⛪" },
  { name: "Cristo Redentor", lat: -17.7595, lon: -63.167, icon: "✝️" },
  { name: "Plan 3000", lat: -17.815, lon: -63.14, icon: "🏘️" },
  { name: "Villa 1ro de Mayo", lat: -17.805, lon: -63.175, icon: "🏘️" },
  { name: "Equipetrol", lat: -17.768, lon: -63.198, icon: "🏢" },
  { name: "Urbarí", lat: -17.775, lon: -63.155, icon: "🏠" },
  { name: "Pampa de la Isla", lat: -17.82, lon: -63.16, icon: "🏘️" },
];

export const SCZ_ANILLOS = [
  { name: "1er Anillo", radius: 0.007 },
  { name: "2do Anillo", radius: 0.013 },
  { name: "3er Anillo", radius: 0.02 },
  { name: "4to Anillo", radius: 0.03 },
  { name: "5to Anillo", radius: 0.04 },
];

// ─── PALETA PRINCIPAL ────────────────────────
// Fondo claro + acentos cyan/lila/azul vibrantes
export const PALETTE = {
  bg: "#f0f4f8",
  surface: "#ffffff",
  surfaceAlt: "#f8faff",
  border: "#e2e8f0",
  borderLight: "#eef2f8",

  // Acentos vibrantes
  cyan: "#00d4ff",
  cyanSoft: "#e0f8ff",
  cyanMid: "#7ee8fa",
  lila: "#a78bfa",
  lilaSoft: "#f3f0ff",
  lilaMid: "#c4b5fd",
  blue: "#3b82f6",
  blueSoft: "#eff6ff",
  blueMid: "#93c5fd",
  teal: "#14b8a6",
  tealSoft: "#f0fdfa",
  pink: "#f472b6",
  pinkSoft: "#fdf2f8",

  // Semánticos
  danger: "#ef4444",
  warning: "#f59e0b",
  success: "#10b981",
  info: "#3b82f6",

  // Texto
  text: "#0f172a",
  textMid: "#475569",
  textMuted: "#94a3b8",
  textFaint: "#cbd5e1",
};

// Colores por enfermedad
export const DISEASE_THEME = {
  dengue: {
    primary: "#1ad5fa",
    secondary: "#38bfff",
    accent: "#4aefa2",
    soft: "#061628",
    border: "#0e3a6e",
    gradient: [
      "rgba(26,213,250,0)",
      "rgba(26,213,250,0.15)",
      "rgba(26,213,250,0.45)",
      "rgba(26,213,250,0.75)",
    ],
    heatmap: (norm) => {
      // centro: lila eléctrico → cyan → verde agua
      const r = Math.round(100 + 60 * (1 - norm));
      const g = Math.round(80 + 180 * norm);
      const b = Math.round(255);
      const a = 0.05 + norm * 0.65;
      return `rgba(${r},${g},${b},${a})`;
    },
    label: "Dengue",
    icon: "🦟",
  },
  influenza: {
    primary: "#b794ff",
    secondary: "#38bfff",
    accent: "#1ad5fa",
    soft: "#061628",
    border: "#0e3a6e",
    gradient: [
      "rgba(183,148,255,0)",
      "rgba(183,148,255,0.15)",
      "rgba(183,148,255,0.45)",
      "rgba(183,148,255,0.75)",
    ],
    heatmap: (norm) => {
      // centro: lila → azul eléctrico → cyan helado
      const r = Math.round(183 - 80 * norm);
      const g = Math.round(60 + 120 * norm);
      const b = Math.round(255);
      const a = 0.05 + norm * 0.65;
      return `rgba(${r},${g},${b},${a})`;
    },
    label: "Influenza",
    icon: "🤧",
  },
};

// Umbrales Gt
export const GT_LEVELS = [
  { max: 0.15, label: "MUY BAJO", color: "#10b981", bg: "#f0fdf4" },
  { max: 0.3, label: "BAJO", color: "#22c55e", bg: "#f0fdf4" },
  { max: 0.5, label: "MODERADO", color: "#f59e0b", bg: "#fffbeb" },
  { max: 0.7, label: "ALTO", color: "#ef4444", bg: "#fef2f2" },
  { max: 1.0, label: "CRÍTICO", color: "#7f1d1d", bg: "#fef2f2" },
];

export function getGtLevel(Gt) {
  return GT_LEVELS.find((l) => Gt <= l.max) ?? GT_LEVELS[GT_LEVELS.length - 1];
}

// Formulas para MathCard
export const MATH_FORMULAS = {
  dengue: [
    {
      title: "R(x,y) — Función de riesgo",
      formula: "R(x,y) = Σᵢ Aᵢ · e^(−dᵢ² / 2σᵢ²)",
      explanation:
        "Suma de gaussianas bidimensionales. Cada distrito genera una mancha de riesgo proporcional a su intensidad Aᵢ y radio σᵢ (proporcional al área real del distrito).",
    },
    {
      title: "∇R — Gradiente de riesgo",
      formula: "∇R = (∂R/∂x, ∂R/∂y)",
      explanation:
        "Indica la dirección donde el riesgo crece más rápido. Las flechas apuntan hacia los epicentros.",
    },
    {
      title: "|∇R| — Magnitud del gradiente",
      formula: "|∇R| = √((∂R/∂x)² + (∂R/∂y)²)",
      explanation:
        "Mide la velocidad de cambio espacial del riesgo. Valores altos = frente de expansión activo.",
    },
    {
      title: "H — Hessiana y puntos críticos",
      formula: "D = Rxx·Ryy − Rxy²\nD>0, Rxx<0 → máximo (epicentro)",
      explanation:
        "Clasifica los puntos donde ∇R=0: máximos son epicentros del brote, puntos silla son zonas de transición.",
    },
    {
      title: "Gₜ — Índice de alerta",
      formula: "Gₜ = 0.40·I + 0.25·C + 0.20·S + 0.15·L",
      explanation:
        "Suma ponderada de incidencia (I), crecimiento (C), severidad (S) y letalidad (L). Rango 0–1.",
    },
    {
      title: "Aᵢ — Intensidad por distrito",
      formula: "Aᵢ = Gₜ × pᵢ × √(dᵢ) × F",
      explanation:
        "pᵢ = proporción poblacional real (ICE 2023). √(dᵢ) = efecto sublineal de densidad sobre contacto vector-huésped (Ross-Macdonald). F = producto de factores ambientales.",
    },
    {
      title: "F_T — Factor temperatura",
      formula: "F_T = 1 + 0.32·e^(−(T−28)²/18)",
      explanation:
        "Pico en 28°C. Fuente: meta-análisis 30 estudios (Cambridge Core, 2025), r=0.85 en rango 25–30°C. OMS (2024): período incubación extrínseco mínimo a 25–28°C.",
    },
    {
      title: "F_H — Factor humedad",
      formula: "F_H = 1 + 0.20·(H−50)/40  [50–90%]",
      explanation:
        "Entre 50–90% HR, transmisión aumenta hasta +20%. Fuente: modelo Ae. aegypti Puerto Rico (PMC, 2018) — supervivencia adulta cae de 91% a 50% en temporada seca.",
    },
    {
      title: "F_L — Factor lluvia",
      formula: "F_L = 1 + 0.25·e^(−(L−80)²/2000)",
      explanation:
        "Pico en 80mm/semana. Lluvia crea criaderos pero lluvia intensa los destruye (flushing effect — Koenraadt & Harrington, 2008; OMS, 2024).",
    },
    {
      title: "F_C — Fumigación / Control",
      formula: "F_C = 1 − 0.35·Q",
      explanation:
        "Reducción máxima del 35%. Fuente: estudio Brasil ULV (PMC, 2019) evitó 24% de casos. Meta-análisis IVM (J. Chemical Health Risks, 2025): reducción del 32%.",
    },
    {
      title: "F_V — Vacunación",
      formula: "F_V = 1 − 0.61·V",
      explanation:
        "Eficacia del 61.2% (ensayo TIDES fase III, 4.5 años). Fuente: Applied Clinical Trials (2025) — vacuna QDenga (TAK-003), protección contra los 4 serotipos.",
    },
  ],
  influenza: [
    {
      title: "R(x,y) — Función de riesgo",
      formula: "R(x,y) = Σᵢ Aᵢ · F_I · e^(−dᵢ²/2σᵢ²)",
      explanation:
        "Igual que dengue pero con factores de transmisión aérea. σ proporcional al área real del distrito.",
    },
    {
      title: "∇R — Gradiente de riesgo",
      formula: "∇R = (∂R/∂x, ∂R/∂y)",
      explanation:
        "Dirección de mayor aumento del riesgo respiratorio en el mapa.",
    },
    {
      title: "F_T — Factor temperatura",
      formula: "F_T = 1 + 0.30·e^(−(T−5)²/50)",
      explanation:
        "Pico en 5°C (frío favorece supervivencia viral en aerosoles). En SCZ (25–32°C promedio) el efecto es mínimo — epidemiológicamente correcto.",
    },
    {
      title: "F_H — Factor humedad",
      formula: "F_H = 1 + 0.20·(1−(H−30)/60)",
      explanation:
        "Humedad BAJA favorece aerosoles de influenza. Relación inversa al dengue. Fuente: PMC (2024) — baja HR aumenta supervivencia de partículas virales.",
    },
    {
      title: "F_HAC — Hacinamiento",
      formula: "F_HAC = 1 + 0.45·Hac",
      explanation:
        "Factor dominante para influenza. Hacinamiento en espacios cerrados puede aumentar transmisión hasta +45%. Fuente: OMS — transmisión respiratoria proporcional a concentración de personas.",
    },
    {
      title: "F_VENT — Ventilación",
      formula: "F_VENT = 1 − 0.40·Vent",
      explanation:
        "Buena ventilación reduce transmisión hasta 40%. Fuente: CDC / OMS — ventilación adecuada reduce concentración de aerosoles hasta 70% en espacios cerrados.",
    },
    {
      title: "F_V — Vacunación influenza",
      formula: "F_V = 1 − 0.50·V",
      explanation:
        "Eficacia promedio del 50%. Fuente: CDC — eficacia vacuna estacional 40–60% en años con buena concordancia cepa-vacuna.",
    },
  ],
};
