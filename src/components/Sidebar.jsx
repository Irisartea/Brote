import { DISEASE_THEME, getGtLevel } from "../utils/constants";

const N = {
  bg: "#ffffff",
  surface: "#f7f9fc",
  border: "#e2e6ef",
  teal: "#0d9488",
  blue: "#1d4ed8",
  text: "#0d1117",
  muted: "#3d4554",
  faint: "#adb5c8",
};

function SimIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
      <path d="M4.93 4.93l2.12 2.12m9.9 9.9 2.12 2.12M4.93 19.07l2.12-2.12m9.9-9.9 2.12-2.12" />
    </svg>
  );
}
function DashIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

const NAV = [
  { id: "simulador", label: "Mapa de riesgo", Icon: SimIcon },
  { id: "dashboard", label: "Análisis histórico", Icon: DashIcon },
];

// Fila de nivel de alerta con barra de progreso
function GtBadge({ Gt, level }) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: "12px 14px",
        borderRadius: 10,
        background: N.surface,
        border: `1px solid ${level.color}30`,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: N.faint,
          fontFamily: "var(--font-mono)",
          letterSpacing: 1.5,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        Nivel de alerta actual
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: 26,
            color: level.color,
            lineHeight: 1,
          }}
        >
          {(Gt ?? 0).toFixed(3)}
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            color: level.color,
            background: level.color + "18",
            padding: "3px 10px",
            borderRadius: 100,
            letterSpacing: 0.5,
            border: `1px solid ${level.color}40`,
          }}
        >
          {level.label}
        </span>
      </div>
      {/* barra de riesgo */}
      <div style={{ height: 3, background: N.border, borderRadius: 3 }}>
        <div
          style={{
            height: "100%",
            width: `${Math.min((Gt ?? 0) * 100, 100)}%`,
            background: level.color,
            borderRadius: 3,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

export default function Sidebar({
  module,
  onModule,
  disease,
  onDisease,
  currentGt,
  onExportar,
}) {
  const theme = DISEASE_THEME[disease];
  const level = getGtLevel(currentGt ?? 0);

  return (
    <aside
      style={{
        width: 252,
        height: "100%",
        background: N.bg,
        borderRight: `1px solid ${N.border}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        boxShadow: "1px 0 8px rgba(13,17,23,0.05)",
      }}
    >
      {/* Marca */}
      <div
        style={{
          padding: "20px 20px 18px",
          borderBottom: `1px solid ${N.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 2,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary ?? theme.primary}cc)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              boxShadow: `0 4px 14px ${theme.primary}50`,
            }}
          >
            {theme.icon}
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 20,
                letterSpacing: "-0.5px",
                color: N.text,
              }}
            >
              BROTE°
            </div>
            <div
              style={{
                fontSize: 9,
                color: N.faint,
                fontFamily: "var(--font-mono)",
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              Santa Cruz · Bolivia
            </div>
          </div>
        </div>
        <GtBadge Gt={currentGt} level={level} />
      </div>

      {/* Navegación */}
      <nav style={{ padding: "16px 10px 0" }}>
        <div
          style={{
            fontSize: 9,
            color: N.faint,
            fontFamily: "var(--font-mono)",
            letterSpacing: 2,
            textTransform: "uppercase",
            padding: "0 8px",
            marginBottom: 8,
            fontWeight: 700,
          }}
        >
          Módulos
        </div>
        {NAV.map(({ id, label, Icon }) => {
          const active = module === id;
          return (
            <button
              key={id}
              onClick={() => onModule(id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 9,
                border: `1px solid ${active ? N.teal + "40" : "transparent"}`,
                cursor: "pointer",
                marginBottom: 3,
                fontFamily: "var(--font-body)",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                background: active ? N.teal + "10" : "transparent",
                color: active ? N.teal : N.muted,
                transition: "all 0.12s ease",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = N.surface;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ color: active ? N.teal : N.faint }}>
                <Icon />
              </span>
              {label}
              {active && (
                <div
                  style={{
                    marginLeft: "auto",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: N.teal,
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer: exportar + créditos */}
      <div
        style={{
          marginTop: "auto",
          padding: "16px 16px 18px",
          borderTop: `1px solid ${N.border}`,
        }}
      >
        <button
          onClick={onExportar}
          title="Descargar todos los registros como CSV"
          style={{
            width: "100%",
            padding: "9px 14px",
            borderRadius: 8,
            border: `1px solid ${N.border}`,
            background: N.surface,
            color: N.muted,
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.12s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = N.teal;
            e.currentTarget.style.color = N.teal;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = N.border;
            e.currentTarget.style.color = N.muted;
          }}
        >
          <svg
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exportar datos CSV
        </button>
        <div
          style={{
            fontSize: 9,
            color: N.faint,
            fontFamily: "var(--font-mono)",
            textAlign: "center",
            marginTop: 12,
            lineHeight: 1.8,
            letterSpacing: 0.5,
          }}
        >
          TECNO UPSA 2026
          <br />
          <span style={{ color: "#adb5c8" }}>ODS 3 · Salud</span>
        </div>
      </div>
    </aside>
  );
}
