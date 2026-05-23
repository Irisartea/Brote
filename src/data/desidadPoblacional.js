// ═══════════════════════════════════════════
// BROTE° — Distritos reales de Santa Cruz de la Sierra
// Fuente: Población 2023 estimación ICE / Alcaldía SCZ
// Superficie: datos oficiales (estimada* donde no disponible)
// ═══════════════════════════════════════════

export const DISTRITOS_SCZ = [
  {
    nombre: "Piraí",
    poblacion: 177915,
    superficie: 15.78, // km²
    lat: -17.775,
    lon: -63.205,
  },
  {
    nombre: "Norte Interno",
    poblacion: 99182,
    superficie: 9.36,
    lat: -17.765,
    lon: -63.172,
  },
  {
    nombre: "Estación Argentina",
    poblacion: 76071,
    superficie: 10.22,
    lat: -17.805,
    lon: -63.178,
  },
  {
    nombre: "La Batalla / El Pari",
    poblacion: 89563,
    superficie: 10.74,
    lat: -17.795,
    lon: -63.205,
  },
  {
    nombre: "Norte",
    poblacion: 196631,
    superficie: 78.72,
    lat: -17.73,
    lon: -63.185,
  },
  {
    nombre: "Pampa de la Isla",
    poblacion: 284425,
    superficie: 17.86,
    lat: -17.77,
    lon: -63.125,
  },
  {
    nombre: "Villa Primero de Mayo",
    poblacion: 237395,
    superficie: 1.650015, // km² — dato oficial ICE (165,001.5 m²)
    lat: -17.8,
    lon: -63.135,
  },
  {
    nombre: "Plan 3000",
    poblacion: 300037,
    superficie: 28.2,
    lat: -17.835,
    lon: -63.14,
  },
  {
    nombre: "Sur",
    poblacion: 137025,
    superficie: 22.79,
    lat: -17.845,
    lon: -63.205,
  },
  {
    nombre: "Bajío del Oriente",
    poblacion: 182936,
    superficie: 33.32,
    lat: -17.83,
    lon: -63.23,
  },
  {
    nombre: "Centro",
    poblacion: 144983,
    superficie: 4.2, // estimada* — comparable a Norte Interno por su posición central
    lat: -17.783,
    lon: -63.182,
  },
  {
    nombre: "Nuevo Palmar",
    poblacion: 208749,
    superficie: 52.0,
    lat: -17.87,
    lon: -63.185,
  },
  {
    nombre: "El Palmar",
    poblacion: 49941,
    superficie: 18.0, // estimada* — similar a Pampa de la Isla por proximidad
    lat: -17.882,
    lon: -63.152,
  },
  {
    nombre: "Paurito",
    poblacion: 2679,
    superficie: 560.0, // rural extenso
    lat: -17.881,
    lon: -62.941,
  },
  {
    nombre: "Montero Hoyos",
    poblacion: 3135,
    superficie: 120.0, // estimada* — distrito rural periurbano
    lat: -17.643,
    lon: -62.824,
  },
];

// ─── Calcular densidad y proporciones ────────
export const POBLACION_TOTAL = DISTRITOS_SCZ.reduce(
  (s, d) => s + d.poblacion,
  0,
);
const densidades = DISTRITOS_SCZ.map((d) => d.poblacion / d.superficie);
const D_MAX = Math.max(...densidades);

export const ZONAS_SCZ = DISTRITOS_SCZ.map((d, i) => {
  const pi = d.poblacion / POBLACION_TOTAL;
  const di = densidades[i] / D_MAX;

  // sigma basado en el área real del distrito
  // Asumimos forma circular: área = π·r² → r = √(área/π)
  // Convertimos de km a grados: 1° ≈ 111.32 km
  // sigma basado en el área real del distrito
  // Asumimos forma circular: área = π·r² → r = √(área/π)
  // Convertimos de km a grados: 1° ≈ 111.32 km
  // Cap en 0.018° (~2 km) para evitar que distritos grandes o rurales
  // (Norte 78 km², Paurito 560 km²) generen manchas que cubran toda la ciudad.
  // Justificación: dispersión del Ae. aegypti es 400–800 m (OMS);
  // 2 km es un límite conservador para el radio de influencia vectorial.
  const sigma = Math.min(Math.sqrt(d.superficie / Math.PI) / 111.32, 0.018);
  return {
    nombre: d.nombre,
    lat: d.lat,
    lon: d.lon,
    poblacion: d.poblacion,
    sup: d.superficie,
    pi,
    di,
    // √(di) — efecto sublineal de densidad sobre tasa de contacto vector-huésped
    // Justificación: en modelos Ross-Macdonald, la tasa de picadura a ∝ √(densidad)
    sqrtDi: Math.sqrt(di),
    sigma,
    densidadAbsoluta: Math.round(densidades[i]),
  };
});
