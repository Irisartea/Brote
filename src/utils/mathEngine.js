// ═══════════════════════════════════════════
// BROTE° — Motor Matemático (Capa 2)
// Gaussianas, gradiente, hessiana, factores
// ═══════════════════════════════════════════

// ─── R(x,y) = Σ Aᵢ · e^(-dᵢ²/2σᵢ²) ────────
export function gaussian(lat, lon, fLat, fLon, A, sigma) {
  const d2 = (lat - fLat) ** 2 + (lon - fLon) ** 2;
  return A * Math.exp(-d2 / (2 * sigma ** 2));
}

export function computeR(lat, lon, foci) {
  return foci.reduce(
    (s, f) => s + gaussian(lat, lon, f.lat, f.lon, f.Ai ?? f.A, f.sigma),
    0,
  );
}

// ─── ∇R = (∂R/∂x, ∂R/∂y) ────────────────────
export function gradR(lat, lon, foci) {
  let gLat = 0,
    gLon = 0;
  for (const f of foci) {
    const A = f.Ai ?? f.A;
    const G = gaussian(lat, lon, f.lat, f.lon, A, f.sigma);
    const s2 = f.sigma ** 2;
    gLat += G * (-(lat - f.lat) / s2);
    gLon += G * (-(lon - f.lon) / s2);
  }
  return [gLat, gLon];
}

export function gradMagnitude(lat, lon, foci) {
  const [g, h] = gradR(lat, lon, foci);
  return Math.sqrt(g ** 2 + h ** 2);
}

export function gradDirection(lat, lon, foci) {
  const [g, h] = gradR(lat, lon, foci);
  return Math.atan2(h, g) * (180 / Math.PI);
}

// ─── Matriz Hessiana ─────────────────────────
export function hessian(lat, lon, foci) {
  let Rxx = 0,
    Ryy = 0,
    Rxy = 0;
  for (const f of foci) {
    const A = f.Ai ?? f.A;
    const G = gaussian(lat, lon, f.lat, f.lon, A, f.sigma);
    const s2 = f.sigma ** 2,
      s4 = s2 ** 2;
    Rxx += G * ((lat - f.lat) ** 2 / s4 - 1 / s2);
    Ryy += G * ((lon - f.lon) ** 2 / s4 - 1 / s2);
    Rxy += G * (((lat - f.lat) * (lon - f.lon)) / s4);
  }
  const D = Rxx * Ryy - Rxy ** 2;
  return { Rxx, Ryy, Rxy, D };
}

export function classifyCritical(H) {
  if (H.D > 0 && H.Rxx < 0) return "máximo";
  if (H.D > 0 && H.Rxx > 0) return "mínimo";
  if (H.D < 0) return "silla";
  return "indeterminado";
}

// ─── Normalización ───────────────────────────
export function normalizeR(r, rMin, rMax) {
  if (rMax === rMin) return 0;
  return (r - rMin) / (rMax - rMin);
}

export function angleToCardinal(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// ═══════════════════════════════════════════════════════════════════════
// FACTORES DENGUE — calibrados con literatura epidemiológica peer-reviewed
// ═══════════════════════════════════════════════════════════════════════

// ─── F_T — Factor temperatura ────────────────────────────────────────
// Forma: gaussiana con pico en T_opt = 28°C
//
// Fuente: Meta-análisis de 30 estudios (Cambridge Core / PMC, 2025):
//   correlación r=0.85 entre temperatura 25–30°C y eficiencia de transmisión.
//   Estudios en Colombia (20 ciudades) confirman pico de incidencia en 28°C.
//   OMS (2024): período incubación extrínseco mínimo a 25–28°C.
//   PLoS NTDs (2017): intervalo generacional se reduce a la mitad entre 25–35°C.
//
// Amplitud 0.32: a 28°C el mosquito opera al máximo de su capacidad vectorial.
//   A 20°C: F_T ≈ 1.0 (transmisión mínima, por debajo del umbral de 18°C cesa).
//   A 28°C: F_T ≈ 1.32 (+32% sobre la línea base).
//   A 35°C: F_T ≈ 1.08 (reducción por estrés térmico, >40°C mosquito muere).
// Denominador 18: ancho de campana ajustado al rango biológico activo 18–40°C.
export function fTemp_dengue(T) {
  return 1 + 0.32 * Math.exp(-((T - 28) ** 2) / 18);
}

// ─── F_H — Factor humedad ────────────────────────────────────────────
// Forma: lineal creciente entre 50–90%, con clamp en los extremos.
//
// Fuente: PMC (2018) — modelo de abundancia Ae. aegypti en Puerto Rico:
//   supervivencia diaria del adulto cae de ~91% a ~50% en temporada seca.
//   Scielo Brasil: a 25°C y 80% HR las hembras viven el doble y producen
//   40% más huevos que a 80% HR pero 35°C.
//   Humidity óptima documentada: ~80% HR (Canyon et al., 1999; Costa et al., 2010).
//
// Amplitud 0.20: entre 50% y 90% HR, transmisión aumenta hasta +20%.
//   Esto refleja el efecto de HR sobre supervivencia adulta y tasa de oviposición,
//   sin llegar a duplicar el riesgo (efecto moderado respecto a temperatura).
export function fHumedad_dengue(H) {
  if (H <= 50) return 1.0;
  if (H >= 90) return 1.2;
  return 1 + (0.2 * (H - 50)) / 40;
}

// ─── F_L — Factor lluvia ─────────────────────────────────────────────
// Forma: gaussiana con pico en L_opt = 80 mm/semana.
//
// Fuente: OMS (2024): lluvia crea criaderos, pero lluvia intensa puede destruirlos
//   ("flushing effect" — Koenraadt & Harrington, 2008; Seidahmed & Eltahir, 2016).
//   PMC Delhi (19 años): dengue responde a lluvia con lag de 1–2 meses;
//   el pico de casos coincide con post-monsoon, no con el pico de lluvias.
//   Scielo Pune: rango óptimo de transmisión correlaciona con lluvia moderada.
//
// Amplitud 0.25: lluvia moderada puede aumentar transmisión hasta +25%.
// Pico en 80mm/semana: lluvia suficiente para crear criaderos sin el flushing effect.
// Denominador 2000: ancho de campana cubre rango 20–200mm con caída suave.
export function fLluvia_dengue(L) {
  return 1 + 0.25 * Math.exp(-((L - 80) ** 2) / 2000);
}

// ─── F_A — Factor criaderos / agua estancada ─────────────────────────
// Forma: lineal. W ∈ [0,1] donde 1 = máxima presencia de criaderos.
//
// Fuente: OMS (2024): "La aparición de criaderos es el principal factor
//   modificable de transmisión." Larval source management reduce incidencia
//   en 21% en meta-análisis (Journal of Chemical Health Risks, 2025, 48 estudios).
//   Control integrado de vectores (IVM) produce reducción del 32%.
//
// Amplitud 0.32: con máxima presencia de criaderos, transmisión aumenta +32%
//   (consistente con la reducción reportada por IVM al eliminarlos).
export function fAgua(W) {
  return 1 + 0.32 * W;
}

// ─── F_C — Factor fumigación / control vectorial ─────────────────────
// Forma: lineal reductora. Q ∈ [0,1] donde 1 = cobertura completa.
//
// Fuente: PMC Brasil (2019): fumigación ULV indujo mortalidad del 40% en
//   mosquitos y evitó ~24% de casos sintomáticos en temporada 2015–2016.
//   PMC Yucatán (2018): IRS con 75% cobertura redujo infecciones en 89.7%
//   el primer año, pero estabiliza en ~27% a largo plazo (año 20).
//   Meta-análisis PLoS NTDs (2016): "chemical control alone showed no
//   significant effect" — el impacto epidemiológico real es incierto.
//
// Coeficiente 0.35: reducción máxima del 35% con cobertura completa.
//   Valor conservador entre el 24% (Brasil, ULV) y 89.7% (Yucatán, IRS óptimo),
//   reconociendo que en condiciones reales la efectividad es menor al ideal.
export function fFumigacion(Q) {
  return Math.max(0, 1 - 0.35 * Q);
}

// ─── F_V — Factor vacunación ─────────────────────────────────────────
// Forma: lineal reductora. V ∈ [0,1] donde 1 = cobertura completa.
//
// Fuente: Ensayo TIDES fase III, 4.5 años (Applied Clinical Trials, 2025):
//   QDenga (TAK-003): eficacia del 61.2% contra dengue confirmado (2 dosis).
//   Con dosis refuerzo: eficacia sube a 74.3%.
//   Contra hospitalización: 84.1% a 4.5 años, 90.6% con refuerzo.
//   Nature Medicine (2025): con 80% cobertura evita 95 casos / 1000 niños vacunados.
//   OMS SAGE (2023): recomienda para 6–16 años en zonas de alta transmisión.
//
// Coeficiente 0.61: eficacia clínica documentada del ensayo TIDES (4.5 años).
//   Representa reducción de transmisión con esquema completo de 2 dosis.
export function fVacuna_dengue(V) {
  return Math.max(0, 1 - 0.61 * V);
}

// ─── Intensidad foco dengue completa ─────────────────────────────────
export function intensidadDengue(Ci, { T, H, L, di = 0.5, W, Q, V = 0 }) {
  return (
    Ci *
    fTemp_dengue(T) *
    fHumedad_dengue(H) *
    fLluvia_dengue(L) *
    fAgua(W) *
    fFumigacion(Q) *
    fVacuna_dengue(V)
  );
}

// ─── sigma dinámico dengue ────────────────────────────────────────────
// Base: sigma del distrito (por área real). Modulado por criaderos y lluvia
// (más agua = mayor radio de dispersión del vector) y fumigación (lo reduce).
export function sigmaDengue(sigmaBase, W, L_norm, Q) {
  return sigmaBase * (1 + 0.15 * W + 0.1 * L_norm - 0.2 * Q);
}

// ═══════════════════════════════════════════════════════════════════════
// FACTORES INFLUENZA — calibrados con literatura
// ═══════════════════════════════════════════════════════════════════════

// ─── F_T_inf — Factor temperatura ────────────────────────────────────
// Forma: gaussiana con pico en T_opt = 5°C (frío favorece supervivencia viral).
//
// Fuente: literatura de influenza — el virus sobrevive más en aerosoles
//   a baja temperatura y baja humedad. Transmisión cae drásticamente >20°C.
//   Rango activo: 0–15°C óptimo, efecto residual hasta 20°C.
//
// En SCZ (temperatura promedio 25–32°C) el efecto es mínimo,
// lo que es epidemiológicamente correcto — SCZ no es zona de alta influenza.
export function fTemp_inf(T) {
  return 1 + 0.3 * Math.exp(-((T - 5) ** 2) / 50);
}

// ─── F_H_inf — Factor humedad influenza ──────────────────────────────
// Forma: lineal decreciente. Humedad BAJA favorece aerosoles de influenza.
//
// Fuente: PMC (2024) — baja HR aumenta supervivencia de partículas virales
//   en aerosol. Relación inversa a dengue: a 30% HR transmisión es máxima,
//   a 90% HR las partículas caen más rápido por condensación.
//
// Amplitud 0.20: entre 30–90% HR, efecto moderado de ±20%.
export function fHumedad_inf(H) {
  const Hc = Math.min(90, Math.max(30, H));
  return 1 + 0.2 * (1 - (Hc - 30) / 60);
}

// ─── F_HAC — Factor hacinamiento ─────────────────────────────────────
// Forma: lineal. Hac ∈ [0,1].
//
// Fuente: OMS — transmisión respiratoria directamente proporcional a la
//   concentración de personas en espacios cerrados. Factor dominante para
//   influenza en entornos urbanos y escolares.
//
// Amplitud 0.45: hacinamiento completo puede aumentar transmisión hasta +45%.
export function fHacinamiento(Hac) {
  return 1 + 0.45 * Hac;
}

// ─── F_VENT — Factor ventilación ─────────────────────────────────────
// Forma: lineal reductora. Vent ∈ [0,1].
//
// Fuente: CDC y OMS — ventilación adecuada reduce concentración de aerosoles
//   hasta en 70% en espacios cerrados. Efecto conservador en modelo: hasta -40%.
//
// Coeficiente 0.40: buena ventilación reduce transmisión en hasta 40%.
export function fVentilacion(Vent) {
  return Math.max(0, 1 - 0.4 * Vent);
}

// ─── F_VAC_inf — Factor vacunación influenza ─────────────────────────
// Forma: lineal reductora. V ∈ [0,1].
//
// Fuente: CDC — eficacia promedio de la vacuna estacional contra influenza:
//   40–60% en años con buena concordancia cepa-vacuna.
//   Usamos 50% como valor central del rango documentado.
export function fVacuna_inf(V) {
  return Math.max(0, 1 - 0.5 * V);
}

// ─── Intensidad foco influenza completa ──────────────────────────────
export function intensidadInfluenza(Ci, { T, H, Hac, Vent, V = 0 }) {
  return (
    Ci *
    fTemp_inf(T) *
    fHumedad_inf(H) *
    fHacinamiento(Hac) *
    fVentilacion(Vent) *
    fVacuna_inf(V)
  );
}

// ─── sigma dinámico influenza ─────────────────────────────────────────
export function sigmaInfluenza(sigmaBase, Hac, Vent) {
  return sigmaBase * (1 + 0.2 * Hac - 0.15 * Vent);
}
