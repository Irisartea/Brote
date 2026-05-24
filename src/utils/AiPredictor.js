// ═══════════════════════════════════════════
// BROTE° — Predictor IA (Regresión Polinómica Multivariable)
// Entrenado con datos históricos SCZ 2022–2026
// ═══════════════════════════════════════════

import { polyreg } from "./epidemiology";

// ── Construir dataset de entrenamiento ─────────────────────────────────────
// Cada muestra: [Gt_actual, temp, humedad, lluvia, se_norm] → Gt_siguiente
function buildTrainingSet(datos) {
  const X = [];
  const y = [];

  for (let i = 0; i < datos.length - 1; i++) {
    const curr = datos[i];
    const next = datos[i + 1];

    // Solo pares del mismo año o transición enero→siguiente (se continua)
    const mismoAño = curr.año === next.año;
    const transicionAnual =
      next.año === curr.año + 1 && curr.se === 52 && next.se === 1;

    if (!mismoAño && !transicionAnual) continue;
    if (curr.Gt == null || next.Gt == null) continue;

    X.push([
      curr.Gt,
      curr.temp / 40, // normalizado 0-1
      curr.humedad / 100,
      curr.lluvia / 200,
      curr.se / 52, // semana epidemiológica normalizada
    ]);
    y.push(next.Gt);
  }

  return { X, y };
}

// ── Regresión multivariable linealizada ────────────────────────────────────
// Expandimos las 5 features a términos polinómicos de grado 2
// Para n features con grado 2: términos = n + n*(n+1)/2 + 1
function expandFeatures(x) {
  const [g, t, h, l, s] = x;
  return [
    1, // intercepto
    g,
    t,
    h,
    l,
    s, // lineales
    g * g,
    t * t,
    h * h,
    l * l,
    s * s, // cuadráticos
    g * t,
    g * h,
    g * l,
    g * s, // interacciones con Gt
    t * h,
    t * l,
    t * s, // interacciones climáticas
    h * l,
    h * s,
    l * s,
  ];
}

// Resolver mínimos cuadrados via eliminación gaussiana
function leastSquares(A, b) {
  const m = A.length;
  const n = A[0].length;

  // ATA y ATb
  const ATA = Array.from({ length: n }, () => Array(n).fill(0));
  const ATb = Array(n).fill(0);

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      ATb[j] += A[i][j] * b[i];
      for (let k = 0; k < n; k++) {
        ATA[j][k] += A[i][j] * A[i][k];
      }
    }
  }

  // Tikhonov regularization (ridge) para evitar overfitting
  const lambda = 0.001;
  for (let i = 0; i < n; i++) ATA[i][i] += lambda;

  // Eliminación gaussiana con pivoteo parcial
  const aug = ATA.map((row, i) => [...row, ATb[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-12) continue;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col] / aug[col][col];
      for (let k = col; k <= n; k++) aug[row][k] -= factor * aug[col][k];
    }
  }

  return aug.map((row, i) =>
    Math.abs(aug[i][i]) < 1e-12 ? 0 : row[n] / aug[i][i],
  );
}

// ── Función principal: entrenar el modelo ──────────────────────────────────
export function entrenarModeloIA(datos) {
  const { X, y } = buildTrainingSet(datos);

  if (X.length < 10) {
    // Fallback si no hay suficientes datos
    return {
      predecir: (gt) => Math.min(1, Math.max(0, gt * 1.1)),
      rmse: 0.05,
      r2: 0,
      n: X.length,
      entrenado: false,
    };
  }

  // Expandir a términos polinómicos
  const A = X.map(expandFeatures);
  const coefs = leastSquares(A, y);

  // Calcular RMSE y R² en entrenamiento
  const predichos = X.map((x) => {
    const features = expandFeatures(x);
    return Math.min(
      1,
      Math.max(
        0,
        features.reduce((s, f, i) => s + f * coefs[i], 0),
      ),
    );
  });

  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  const ssTot = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);
  const ssRes = y.reduce((s, yi, i) => s + (yi - predichos[i]) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  const rmse = Math.sqrt(ssRes / y.length);

  // Residuales por semana para banda de confianza
  const residuales = y.map((yi, i) => Math.abs(yi - predichos[i]));
  const stdResid = Math.sqrt(
    residuales.reduce((s, r) => s + r * r, 0) / residuales.length,
  );

  function predecir(gtActual, temp, humedad, lluvia, se) {
    const x = [
      gtActual,
      (temp ?? 28) / 40,
      (humedad ?? 70) / 100,
      (lluvia ?? 80) / 200,
      (se ?? 26) / 52,
    ];
    const features = expandFeatures(x);
    const raw = features.reduce((s, f, i) => s + f * coefs[i], 0);
    return Math.min(1, Math.max(0, raw));
  }

  return { predecir, rmse, r2, n: X.length, entrenado: true, stdResid };
}

// ── Proyección híbrida: 4 semanas IA + 4 semanas beta ────────────────────
export function proyectarHibrido(
  modelo,
  gtInicial,
  factores,
  seInicial,
  añoInicial,
  datos,
) {
  const semanas = [];
  let gtActual = Math.max(0.01, gtInicial);

  // Beta para las semanas de escenario (semanas 5-8)
  const vac = factores.vacuna ?? 0;
  const fum = factores.intervention ?? 0;
  const beta = 1.18 * (1 - 0.61 * vac) * (1 - 0.35 * fum);

  for (let i = 1; i <= 8; i++) {
    const se = ((seInicial - 1 + i) % 52) + 1;
    const usarIA = i <= 4 && modelo.entrenado;

    let gtPredicho;
    if (usarIA) {
      gtPredicho = modelo.predecir(
        gtActual,
        factores.temp,
        factores.humidity,
        factores.lluvia,
        se,
      );
    } else {
      gtPredicho = Math.min(1, Math.max(0.001, gtActual * beta));
    }

    const std = modelo.stdResid ?? 0.03;
    semanas.push({
      semana: i,
      se,
      gt: gtPredicho,
      gtMin: Math.max(0, gtPredicho - std),
      gtMax: Math.min(1, gtPredicho + std),
      tendencia: gtPredicho > gtActual ? "↑" : "↓",
      metodo: usarIA ? "IA" : "escenario",
    });

    gtActual = gtPredicho;
  }

  return semanas;
}

// ── Generar texto de recomendación automática ──────────────────────────────
export function generarRecomendacion(semanas, factores) {
  if (!semanas || semanas.length === 0) return null;

  const gt4 = semanas[3]?.gt ?? 0;
  const gt8 = semanas[7]?.gt ?? 0;
  const tendenciaGeneral = gt8 > semanas[0].gt ? "creciente" : "decreciente";
  const subiendoContinuo = semanas
    .slice(0, 4)
    .every((s, i) => (i === 0 ? true : s.gt >= semanas[i - 1].gt));

  let nivel = "BAJO";
  let color = "#059669";
  if (gt4 >= 0.5) {
    nivel = "ALTO";
    color = "#e11d48";
  } else if (gt4 >= 0.3) {
    nivel = "MODERADO";
    color = "#d97706";
  }

  const recomendaciones = [];
  if (gt4 > 0.5)
    recomendaciones.push("Intensificar fumigación de manera inmediata");
  if (gt4 > 0.3 && factores.breeding > 0.3)
    recomendaciones.push("Campaña de eliminación de criaderos");
  if (gt4 > 0.4 && factores.vacuna < 0.3)
    recomendaciones.push("Ampliar cobertura de vacunación");
  if (subiendoContinuo)
    recomendaciones.push("Activar alerta epidemiológica preventiva");
  if (recomendaciones.length === 0)
    recomendaciones.push("Mantener vigilancia epidemiológica rutinaria");

  return {
    gt4: gt4.toFixed(3),
    nivel,
    color,
    tendencia: tendenciaGeneral,
    recomendacion: recomendaciones[0],
    recomendaciones,
  };
}
