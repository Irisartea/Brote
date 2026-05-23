import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { DISEASE_THEME, getGtLevel } from "../utils/constants";
import {
  estadisticasDescriptivas,
  calcularCorrelacionesMejoradas,
  resumenAnual,
} from "../utils/epidemiology";

// Datos reales temperatura verano (SENAMHI SCZ) vs casos totales por año
const TEMP_VERANO_ANUAL = [
  { año: 2022, tempVerano: 31.5, label: "2022" },
  { año: 2023, tempVerano: 34.2, label: "2023" },
  { año: 2024, tempVerano: 32.8, label: "2024" },
  { año: 2025, tempVerano: 31.2, label: "2025" },
];

function pearsonSimple(xs, ys) {
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

function linregSimple(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const slope =
    xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) /
    xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const intercept = my - slope * mx;
  const r = pearsonSimple(xs, ys);
  return { slope, intercept, r2: r ** 2 };
}

function StatKpi({ label, value, sub, color }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 130,
        padding: "16px 18px",
        background: "var(--surface)",
        borderRadius: 12,
        border: `1px solid ${color}20`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 28,
          fontWeight: 800,
          color,
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.8,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Card({ title, children, style = {} }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 12,
        padding: "16px 20px",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
          letterSpacing: 1.5,
          textTransform: "uppercase",
          marginBottom: 14,
          fontWeight: 600,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontFamily: "var(--font-mono)",
    fontSize: 11,
  },
  labelStyle: { color: "var(--text-muted)", fontSize: 10 },
};

export default function DashboardView({ disease, datos }) {
  const theme = DISEASE_THEME[disease];
  const [yearFilter, setYearFilter] = useState("todos");

  const filtered = useMemo(() => {
    if (yearFilter === "todos") return datos;
    return datos.filter((r) => r.año === +yearFilter);
  }, [datos, yearFilter]);

  const stats = useMemo(() => estadisticasDescriptivas(filtered), [filtered]);
  const corr = useMemo(
    () => calcularCorrelacionesMejoradas(filtered),
    [filtered],
  );
  const anual = useMemo(() => resumenAnual(datos), [datos]);

  const años = [...new Set(datos.map((r) => r.año))].sort();
  const totalConf = filtered.reduce((s, r) => s + r.confirmados, 0);
  const GtMax = Math.max(...filtered.map((r) => r.Gt));
  const totalGrave = filtered.reduce((s, r) => s + r.grave, 0);
  const totalFall = filtered.reduce((s, r) => s + r.fallecidos, 0);
  const levelMax = getGtLevel(GtMax);

  // Chart data
  const temporalData = filtered.map((r, i) => ({
    idx: i + 1,
    año: r.año,
    se: r.se,
    confirmados: r.confirmados,
    sospechosos: r.sospechosos,
    grave: r.grave,
    Gt: +r.Gt.toFixed(4),
    incidencia: +r.incidenciaNorm?.toFixed(3),
    severidad: +r.severidad?.toFixed(4),
    letalidad: +r.letalidad?.toFixed(4),
    crecimiento: +r.crecimientoNorm?.toFixed(3),
  }));

  // Scatter: temp verano real vs casos totales por año
  const scatterAnual = useMemo(() => {
    return TEMP_VERANO_ANUAL.map((d) => {
      const filas = datos.filter((r) => r.año === d.año);
      const totalCasos = filas.reduce((s, r) => s + r.confirmados, 0);
      return { tempVerano: d.tempVerano, totalCasos, label: d.label };
    });
  }, [datos]);

  // Regresión lineal sobre los 5 puntos anuales
  const regAnual = useMemo(() => {
    const xs = scatterAnual.map((d) => d.tempVerano);
    const ys = scatterAnual.map((d) => d.totalCasos);
    return linregSimple(xs, ys);
  }, [scatterAnual]);

  // Curva ajustada lineal para el scatter anual
  const lineaAjustada = useMemo(() => {
    const temps = scatterAnual.map((d) => d.tempVerano);
    const mn = Math.min(...temps) - 0.2;
    const mx = Math.max(...temps) + 0.2;
    return Array.from({ length: 20 }, (_, i) => {
      const t = mn + (i / 19) * (mx - mn);
      return {
        tempVerano: +t.toFixed(2),
        fitted: Math.max(0, regAnual.intercept + regAnual.slope * t),
      };
    });
  }, [scatterAnual, regAnual]);

  // Modo año específico: scatter semanal temp vs casos + regresión polinómica
  const scatterSemanal = filtered.map((r) => ({
    temp: r.temp,
    confirmados: r.confirmados,
  }));

  const tempRangePoly = useMemo(() => {
    if (yearFilter === "todos") return [];
    const temps = filtered.map((r) => r.temp);
    const mn = Math.min(...temps);
    const mx = Math.max(...temps);
    return Array.from({ length: 40 }, (_, i) => {
      const t = mn + (i / 39) * (mx - mn);
      return { temp: t, fitted: Math.max(0, corr.temp.poly.predict(t)) };
    });
  }, [filtered, yearFilter, corr]);

  const distData = (() => {
    const bins = 12,
      vals = filtered.map((r) => r.confirmados);
    const mn = Math.min(...vals),
      mx = Math.max(...vals);
    const size = (mx - mn) / bins;
    return Array.from({ length: bins }, (_, i) => {
      const from = mn + i * size,
        to = from + size;
      return {
        rango: `${Math.round(from)}`,
        count: vals.filter((v) => v >= from && v < to).length,
      };
    });
  })();

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: "var(--header-h, 52px)",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--text)",
            flex: 1,
          }}
        >
          Dashboard Epidemiológico
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 100,
            background: levelMax.bg,
            border: `1px solid ${levelMax.color}30`,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              color: levelMax.color,
            }}
          >
            Gₜmax: {GtMax.toFixed(3)}
          </span>
        </div>
        {/* Filtro año */}
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text)",
            cursor: "pointer",
          }}
        >
          <option value="todos">Todos los años</option>
          {años.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* Scroll content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* KPIs */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatKpi
            label="Casos Confirmados"
            value={totalConf.toLocaleString()}
            sub="Total histórico 2022–2026"
            color={theme.primary}
          />
          <StatKpi
            label="Gₜ Máximo"
            value={GtMax.toFixed(3)}
            sub="Semana de mayor alerta"
            color="#f59e0b"
          />
          <StatKpi
            label="Dengue Grave"
            value={totalGrave.toLocaleString()}
            sub="Casos severos acumulados"
            color="#a78bfa"
          />
          <StatKpi
            label="Fallecidos"
            value={totalFall}
            sub="Total histórico registrado"
            color="#ef4444"
          />
        </div>

        {/* Evolución temporal + Gt */}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <Card title="Evolución Temporal de Casos">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={temporalData}
                margin={{ top: 4, right: 8, bottom: 4, left: -10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-light)"
                />
                <XAxis
                  dataKey="idx"
                  tick={{
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    fill: "var(--text-muted)",
                  }}
                />
                <YAxis
                  tick={{
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    fill: "var(--text-muted)",
                  }}
                />
                <RechartsTip {...TOOLTIP_STYLE} />
                <Legend
                  wrapperStyle={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sospechosos"
                  stroke="var(--blue-mid)"
                  strokeWidth={1.2}
                  dot={false}
                  name="Sospechosos"
                />
                <Line
                  type="monotone"
                  dataKey="confirmados"
                  stroke="#f43f5e"
                  strokeWidth={1.8}
                  dot={false}
                  name="Confirmados"
                />
                <Line
                  type="monotone"
                  dataKey="grave"
                  stroke="#f59e0b"
                  strokeWidth={1.2}
                  dot={false}
                  name="D. Grave"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Índice de Alerta Gₜ">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={temporalData}
                margin={{ top: 4, right: 8, bottom: 4, left: -10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-light)"
                />
                <XAxis
                  dataKey="idx"
                  tick={{
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    fill: "var(--text-muted)",
                  }}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    fill: "var(--text-muted)",
                  }}
                />
                <RechartsTip {...TOOLTIP_STYLE} />
                <ReferenceLine
                  y={0.5}
                  stroke="#ef4444"
                  strokeDasharray="4 3"
                  label={{
                    value: "Umbral alto",
                    fontSize: 9,
                    fill: "#ef4444",
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <ReferenceLine
                  y={0.3}
                  stroke="#f59e0b"
                  strokeDasharray="4 3"
                  label={{
                    value: "Umbral mod.",
                    fontSize: 9,
                    fill: "#f59e0b",
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <Bar dataKey="Gt" name="Gₜ" radius={[2, 2, 0, 0]}>
                  {temporalData.map((entry, i) => {
                    const col =
                      entry.Gt >= 0.5
                        ? "#ef4444"
                        : entry.Gt >= 0.3
                          ? "#f59e0b"
                          : "#10b981";
                    return <Cell key={i} fill={col} fillOpacity={0.75} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Indicadores epidemiológicos */}
        <Card title="Indicadores Epidemiológicos por Semana">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart
              data={temporalData}
              margin={{ top: 4, right: 8, bottom: 4, left: -10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-light)"
              />
              <XAxis
                dataKey="idx"
                tick={{
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  fill: "var(--text-muted)",
                }}
              />
              <YAxis
                domain={[0, 1]}
                tick={{
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  fill: "var(--text-muted)",
                }}
              />
              <RechartsTip {...TOOLTIP_STYLE} />
              <Legend
                wrapperStyle={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
              />
              <Line
                type="monotone"
                dataKey="incidencia"
                stroke="#00d4ff"
                strokeWidth={1.5}
                dot={false}
                name="Incidencia (norm.)"
              />
              <Line
                type="monotone"
                dataKey="crecimiento"
                stroke="#f59e0b"
                strokeWidth={1.2}
                dot={false}
                name="Crecimiento"
              />
              <Line
                type="monotone"
                dataKey="severidad"
                stroke="#a78bfa"
                strokeWidth={1.2}
                dot={false}
                name="Severidad"
              />
              <Line
                type="monotone"
                dataKey="letalidad"
                stroke="#ef4444"
                strokeWidth={1}
                dot={false}
                name="Letalidad"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Scatter + Histograma + Correlaciones */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
          }}
        >
          {/* ── Regresión: condicional según filtro ── */}
          {yearFilter === "todos" ? (
            <Card title="Temp. Verano vs Casos Anuales (SENAMHI)">
              <ResponsiveContainer width="100%" height={180}>
                <ScatterChart
                  margin={{ top: 4, right: 8, bottom: 4, left: -10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-light)"
                  />
                  <XAxis
                    dataKey="tempVerano"
                    name="Temp. Verano (°C)"
                    type="number"
                    domain={[30.8, 34.6]}
                    tickCount={5}
                    tick={{
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                      fill: "var(--text-muted)",
                    }}
                  />
                  <YAxis
                    dataKey="totalCasos"
                    name="Casos totales"
                    tick={{
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                      fill: "var(--text-muted)",
                    }}
                  />
                  <RechartsTip
                    {...TOOLTIP_STYLE}
                    cursor={{ strokeDasharray: "3 3" }}
                    formatter={(val, name) =>
                      name === "totalCasos"
                        ? [val.toLocaleString(), "Casos"]
                        : [`${val}°C`, "Temp. verano"]
                    }
                  />
                  <Scatter
                    data={lineaAjustada}
                    dataKey="fitted"
                    line={{ stroke: "#f59e0b", strokeWidth: 2 }}
                    shape={() => null}
                    legendType="line"
                    name="Regresión lineal"
                    fill="none"
                  />
                  <Scatter
                    data={scatterAnual}
                    fill={theme.primary}
                    fillOpacity={0.85}
                    r={6}
                    name="Año"
                  />
                </ScatterChart>
              </ResponsiveContainer>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 6,
                }}
              >
                {scatterAnual.map((d) => (
                  <span
                    key={d.label}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: "var(--text-faint)",
                    }}
                  >
                    {d.label}: {d.tempVerano}°C /{" "}
                    {d.totalCasos.toLocaleString()}
                  </span>
                ))}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--text-muted)",
                  marginTop: 6,
                }}
              >
                R² = {regAnual.r2.toFixed(3)} · n=4 años completos · Fuente:
                SENAMHI SCZ
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--text-faint)",
                  marginTop: 2,
                }}
              >
                Y = {regAnual.intercept.toFixed(0)} +{" "}
                {regAnual.slope.toFixed(0)}·T
              </div>
            </Card>
          ) : (
            <Card
              title={`Regresión Polinómica: Temp vs Casos ${yearFilter} (grado 2)`}
            >
              <ResponsiveContainer width="100%" height={180}>
                <ScatterChart
                  margin={{ top: 4, right: 8, bottom: 4, left: -10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-light)"
                  />
                  <XAxis
                    dataKey="temp"
                    name="Temp (°C)"
                    type="number"
                    domain={["auto", "auto"]}
                    tick={{
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                      fill: "var(--text-muted)",
                    }}
                  />
                  <YAxis
                    dataKey="confirmados"
                    name="Confirmados"
                    tick={{
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                      fill: "var(--text-muted)",
                    }}
                  />
                  <RechartsTip
                    {...TOOLTIP_STYLE}
                    cursor={{ strokeDasharray: "3 3" }}
                  />
                  <Scatter
                    data={tempRangePoly}
                    dataKey="fitted"
                    line={{ stroke: "#f59e0b", strokeWidth: 2 }}
                    shape={() => null}
                    legendType="line"
                    name="Curva ajustada"
                    fill="none"
                  />
                  <Scatter
                    data={scatterSemanal}
                    fill={theme.primary}
                    fillOpacity={0.55}
                    r={3}
                    name="Semana"
                  />
                </ScatterChart>
              </ResponsiveContainer>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--text-muted)",
                  marginTop: 6,
                }}
              >
                R² = {corr.temp.r2.toFixed(3)}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--text-faint)",
                  marginTop: 2,
                }}
              >
                Y = {corr.temp.poly.coefs[0].toFixed(0)} +{" "}
                {corr.temp.poly.coefs[1].toFixed(1)}·T +{" "}
                {corr.temp.poly.coefs[2].toFixed(2)}·T²
              </div>
            </Card>
          )}

          {/* ── Distribución de Casos ── */}
          <Card title="Distribución de Casos">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={distData}
                margin={{ top: 4, right: 8, bottom: 4, left: -10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-light)"
                />
                <XAxis
                  dataKey="rango"
                  tick={{
                    fontSize: 8,
                    fontFamily: "var(--font-mono)",
                    fill: "var(--text-muted)",
                  }}
                />
                <YAxis
                  tick={{
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    fill: "var(--text-muted)",
                  }}
                />
                <RechartsTip {...TOOLTIP_STYLE} />
                <Bar
                  dataKey="count"
                  fill="#00d4ff"
                  fillOpacity={0.7}
                  radius={[2, 2, 0, 0]}
                  name="Semanas"
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* ── Correlaciones Clima vs Casos (R² polinómico) ── */}
          <Card title="Ajuste Polinómico: Clima vs Casos">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                paddingTop: 8,
              }}
            >
              {[
                {
                  label: "Temperatura (grado 2)",
                  r2: corr.temp.r2,
                  color: theme.primary,
                },
                {
                  label: "Humedad (grado 1)",
                  r2: corr.hum.r2,
                  color: "#3b82f6",
                },
                {
                  label: "Lluvia (grado 2)",
                  r2: corr.lluvia.r2,
                  color: "#06b6d4",
                },
              ].map(({ label, r2, color }) => (
                <div key={label}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ fontSize: 11, color: "var(--text-mid)" }}>
                      {label}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        fontWeight: 700,
                        color,
                      }}
                    >
                      R² = {r2.toFixed(3)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: "var(--border-light)",
                      borderRadius: 4,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(r2 * 100, 100)}%`,
                        background: color,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 14,
                borderTop: "1px solid var(--border-light)",
                paddingTop: 12,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Estadística descriptiva
              </div>
              {[
                { label: "Confirmados", stat: stats.confirmados },
                { label: "Sospechosos", stat: stats.sospechosos },
                { label: "D. Grave", stat: stats.grave },
              ].map(({ label, stat }) => (
                <div
                  key={label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 1fr 1fr 1fr",
                    gap: 4,
                    marginBottom: 4,
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <span style={{ color: "var(--text-mid)", fontWeight: 600 }}>
                    {label}
                  </span>
                  <span style={{ color: "var(--cyan)" }}>
                    x̄ {stat.media.toFixed(0)}
                  </span>
                  <span style={{ color: "var(--lila)" }}>
                    σ {stat.std.toFixed(0)}
                  </span>
                  <span style={{ color: theme.primary }}>↑ {stat.max}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Resumen anual */}
        <Card title="Resumen Anual">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={anual}
              margin={{ top: 4, right: 8, bottom: 4, left: -10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-light)"
              />
              <XAxis
                dataKey="año"
                tick={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  fill: "var(--text-muted)",
                }}
              />
              <YAxis
                tick={{
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  fill: "var(--text-muted)",
                }}
              />
              <RechartsTip {...TOOLTIP_STYLE} />
              <Legend
                wrapperStyle={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
              />
              <Bar
                dataKey="confirmados"
                fill="#00d4ff"
                fillOpacity={0.75}
                radius={[3, 3, 0, 0]}
                name="Confirmados"
              />
              <Bar
                dataKey="grave"
                fill="#a78bfa"
                fillOpacity={0.75}
                radius={[3, 3, 0, 0]}
                name="Grave"
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
