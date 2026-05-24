// ═══════════════════════════════════════════
// BROTE° — Store de datos con persistencia
// Gestiona registros originales + nuevos agregados por el usuario
// ═══════════════════════════════════════════

import { DENGUE_RAW } from "./dengueData";

const LS_KEY = "brote_registros_extra";

// Leer registros extra del localStorage
export function leerRegistrosExtra() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Guardar registros extra
export function guardarRegistrosExtra(registros) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(registros));
    return true;
  } catch {
    return false;
  }
}

// Obtener todos los datos (originales + extras)
export function obtenerTodosLosDatos() {
  const extras = leerRegistrosExtra();
  // Combinar y ordenar por año y semana
  return [...DENGUE_RAW, ...extras].sort((a, b) =>
    a.año !== b.año ? a.año - b.año : a.se - b.se,
  );
}

// Agregar un nuevo registro
export function agregarRegistro(registro) {
  const extras = leerRegistrosExtra();
  // Evitar duplicado exacto de año+semana
  const existe = [...DENGUE_RAW, ...extras].some(
    (r) => r.año === registro.año && r.se === registro.se,
  );
  if (existe)
    return {
      ok: false,
      error: `Ya existe la Semana ${registro.se} de ${registro.año}`,
    };
  extras.push({ ...registro, esExtra: true });
  guardarRegistrosExtra(extras);
  return { ok: true };
}

// Eliminar un registro extra
export function eliminarRegistroExtra(año, se) {
  const extras = leerRegistrosExtra().filter(
    (r) => !(r.año === año && r.se === se),
  );
  guardarRegistrosExtra(extras);
}

// Exportar todos los datos como CSV (para descarga)
export function exportarCSV(datos) {
  const headers = [
    "año",
    "semana",
    "sospechosos",
    "confirmados",
    "dengue_grave",
    "fallecidos",
    "es_nuevo",
  ];
  const rows = datos.map((r) => [
    r.año,
    r.se,
    r.sospechosos,
    r.confirmados,
    r.grave,
    r.fallecidos,
    r.esExtra ? "SI" : "NO",
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `brote_dengue_scz_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
