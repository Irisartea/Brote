// ═══════════════════════════════════════════
// BROTE° — Motor Epidemiológico (Capa 1)
// ═══════════════════════════════════════════

import { DENGUE_RAW, getClima } from "../data/dengueData";
import { ZONAS_SCZ, POBLACION_TOTAL } from "../data/desidadPoblacional";

// Re-exportar ZONAS_SCZ para que el resto del código lo siga importando
// desde epidemiology.js sin cambiar nada
export { ZONAS_SCZ };
export const POBLACION_SCZ = POBLACION_TOTAL;

// ─── Normalización min-max ───────────────────
function minmax(arr) {
  const mn = Math.min(...arr);
  const mx = Math.max(...arr);
  return arr.map((v) => (mx === mn ? 0 : (v - mn) / (mx - mn)));
}

function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(
    xs.reduce((s, x) => s + (x - mx) ** 2, 0) *
      ys.reduce((s, y) => s + (y - my) ** 2, 0),
  );
  return den === 0 ? 0 : num / den;
}

function linreg(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const slope =
    xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) /
    xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const intercept = my - slope * mx;
  const r2 = pearson(xs, ys) ** 2;
  return { slope, intercept, r2 };
}

// ─── Regresión polinómica de grado n ────────────────────────────────
// Resuelve por mínimos cuadrados con eliminación gaussiana.
// USO correcto:
//   Temperatura vs casos → polyreg(temps, casos, 2)  [cuadrática, pico ~28°C]
//   Lluvia vs casos      → polyreg(lluvias, casos, 2) [gaussiana aproximada]
//   Humedad vs casos     → polyreg(humedades, casos, 1) [lineal en 50-90%]
//   Serie temporal Gₜ   → polyreg(indices, Gts, 3)   [captura estacionalidad]
export function polyreg(xs, ys, degree = 2) {
  const n = xs.length;
  const d = degree + 1;

  const A = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < d; j++) row.push(Math.pow(xs[i], j));
    A.push(row);
  }

  const ATA = Array.from({ length: d }, () => Array(d).fill(0));
  const ATb = Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      ATb[j] += A[i][j] * ys[i];
      for (let k = 0; k < d; k++) ATA[j][k] += A[i][j] * A[i][k];
    }
  }

  const aug = ATA.map((row, i) => [...row, ATb[i]]);
  for (let col = 0; col < d; col++) {
    let maxRow = col;
    for (let row = col + 1; row < d; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-12) continue;
    for (let row = 0; row < d; row++) {
      if (row === col) continue;
      const factor = aug[row][col] / aug[col][col];
      for (let k = col; k <= d; k++) aug[row][k] -= factor * aug[col][k];
    }
  }
  const coefs = aug.map((row, i) =>
    Math.abs(aug[i][i]) < 1e-12 ? 0 : row[d] / aug[i][i],
  );

  const predict = (x) => coefs.reduce((s, c, i) => s + c * Math.pow(x, i), 0);

  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const ssTot = ys.reduce((s, y) => s + (y - yMean) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - predict(xs[i])) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { coefs, predict, r2, degree };
}

// ─── Media móvil ─────────────────────────────────────────────────────
export function movingAverage(ys, window = 4) {
  return ys.map((_, i) => {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(ys.length, start + window);
    const slice = ys.slice(start, end);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// ─── Procesar todos los datos ────────────────
export function procesarDatos() {
  const rows = DENGUE_RAW.map((r, i) => {
    const clima = getClima(r.se, r.año);
    const incidencia = (r.confirmados / POBLACION_SCZ) * 100000;
    const severidad = r.confirmados > 0 ? r.grave / r.confirmados : 0;
    const letalidad = r.confirmados > 0 ? r.fallecidos / r.confirmados : 0;
    return { ...r, ...clima, incidencia, severidad, letalidad, idx: i };
  });

  for (let i = 0; i < rows.length; i++) {
    const prev = i > 0 ? rows[i - 1].confirmados : 0;
    const curr = rows[i].confirmados;
    rows[i].crecimiento = prev > 0 ? Math.max(0, (curr - prev) / prev) : 0;
  }

  const incNorm = minmax(rows.map((r) => r.incidencia));
  const crecNorm = minmax(rows.map((r) => r.crecimiento));

  rows.forEach((r, i) => {
    r.incidenciaNorm = incNorm[i];
    r.crecimientoNorm = crecNorm[i];
    r.Gt =
      0.4 * incNorm[i] +
      0.25 * crecNorm[i] +
      0.2 * r.severidad +
      0.15 * r.letalidad;
  });

  return rows;
}

// ─── Calcular intensidad por zona (A_i) ──────
export function calcularIntensidades(Gt) {
  return ZONAS_SCZ.map((zona) => {
    const Ai = Gt * zona.pi * zona.sqrtDi;
    return { ...zona, Ai, sigma: zona.sigma };
  });
}

// ─── Estadísticas descriptivas ───────────────
export function estadisticasDescriptivas(datos) {
  const vars = {
    confirmados: datos.map((r) => r.confirmados),
    sospechosos: datos.map((r) => r.sospechosos),
    grave: datos.map((r) => r.grave),
    fallecidos: datos.map((r) => r.fallecidos),
    Gt: datos.map((r) => r.Gt),
  };

  const stats = {};
  for (const [k, arr] of Object.entries(vars)) {
    const n = arr.length;
    const media = arr.reduce((a, b) => a + b, 0) / n;
    const sorted = [...arr].sort((a, b) => a - b);
    const mediana =
      n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];
    const std = Math.sqrt(arr.reduce((s, x) => s + (x - media) ** 2, 0) / n);
    const cv = media > 0 ? (std / media) * 100 : 0;
    stats[k] = {
      media,
      mediana,
      std,
      cv,
      max: Math.max(...arr),
      min: Math.min(...arr),
      n,
    };
  }
  return stats;
}

// ─── Correlaciones con clima (lineal — referencia) ───────────────────
export function calcularCorrelaciones(datos) {
  const confirmados = datos.map((r) => r.confirmados);
  const rTemp = pearson(
    datos.map((r) => r.temp),
    confirmados,
  );
  const rHum = pearson(
    datos.map((r) => r.humedad),
    confirmados,
  );
  const rLluv = pearson(
    datos.map((r) => r.lluvia),
    confirmados,
  );
  const regTemp = linreg(
    datos.map((r) => r.temp),
    confirmados,
  );
  const regHum = linreg(
    datos.map((r) => r.humedad),
    confirmados,
  );
  return { rTemp, rHum, rLluv, regTemp, regHum };
}

// ─── Correlaciones mejoradas (polinómica) ────────────────────────────
export function calcularCorrelacionesMejoradas(datos) {
  const confirmados = datos.map((r) => r.confirmados);
  const regTemp = polyreg(
    datos.map((r) => r.temp),
    confirmados,
    2,
  );
  const regHum = polyreg(
    datos.map((r) => r.humedad),
    confirmados,
    1,
  );
  const regLluv = polyreg(
    datos.map((r) => r.lluvia),
    confirmados,
    2,
  );
  const indices = datos.map((_, i) => i);
  const Gts = datos.map((r) => r.Gt);
  const regGt = polyreg(indices, Gts, 3);
  const maGt = movingAverage(Gts, 4);
  return {
    temp: { poly: regTemp, r2: regTemp.r2, label: "Temp vs casos (grado 2)" },
    hum: { poly: regHum, r2: regHum.r2, label: "Humedad vs casos (grado 1)" },
    lluvia: {
      poly: regLluv,
      r2: regLluv.r2,
      label: "Lluvia vs casos (grado 2)",
    },
    gt: {
      poly: regGt,
      r2: regGt.r2,
      ma: maGt,
      label: "Tendencia Gₜ (grado 3)",
    },
  };
}

// ─── Resumen anual ────────────────────────────
export function resumenAnual(datos) {
  const años = [...new Set(datos.map((r) => r.año))];
  return años.map((año) => {
    const filas = datos.filter((r) => r.año === año);
    return {
      año,
      confirmados: filas.reduce((s, r) => s + r.confirmados, 0),
      sospechosos: filas.reduce((s, r) => s + r.sospechosos, 0),
      grave: filas.reduce((s, r) => s + r.grave, 0),
      fallecidos: filas.reduce((s, r) => s + r.fallecidos, 0),
      GtMax: Math.max(...filas.map((r) => r.Gt)),
      seMax: filas.reduce((a, b) => (a.Gt > b.Gt ? a : b)).se,
    };
  });
}

export { pearson, linreg };
