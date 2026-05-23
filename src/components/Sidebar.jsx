import { DISEASE_THEME, getGtLevel } from "../utils/constants";

const N = {
  bg: "#ffffff",
  surface: "#f4f6fa",
  surface2: "#eef2f9",
  border: "#dde3ee",
  cyan: "#0ea5e9",
  blue: "#2563eb",
  lila: "#8b5cf6",
  green: "#16a34a",
  text: "#111827",
  muted: "#374151",
  faint: "#9ca3af",
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

export default function Sidebar({
  module,
  onModule,
  disease,
  onDisease,
  currentGt,
}) {
  const theme = DISEASE_THEME[disease];
  const level = getGtLevel(currentGt ?? 0);

  return (
    <aside
      style={{
        width: 260,
        height: "100%",
        background: N.bg,
        borderRight: `1px solid ${N.border}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        boxShadow: "2px 0 12px rgba(15,23,42,0.06)",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px 20px 16px",
          borderBottom: `1px solid ${N.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary ?? theme.primary}cc)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 17,
              boxShadow: `0 0 16px ${theme.primary}60`,
              transition: "box-shadow 0.3s",
            }}
          >
            {theme.icon}
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 19,
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
              Santa Cruz de la Sierra
            </div>
          </div>
        </div>

        {/* Badge Gt */}
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 10,
            background: N.surface,
            border: `1px solid ${level.color}40`,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: N.muted,
              fontFamily: "var(--font-mono)",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Índice de alerta
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: 24,
                color: level.color,
                lineHeight: 1,
                textShadow: "none",
              }}
            >
              {(currentGt ?? 0).toFixed(3)}
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
                border: `1px solid ${level.color}50`,
                boxShadow: `0 0 8px ${level.color}30`,
              }}
            >
              {level.label}
            </span>
          </div>
        </div>
      </div>

      {/* Módulos */}
      <nav style={{ padding: "16px 12px 0" }}>
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
                borderRadius: 10,
                border: `1px solid ${active ? N.cyan + "40" : "transparent"}`,
                cursor: "pointer",
                marginBottom: 4,
                fontFamily: "var(--font-body)",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                background: active ? N.cyan + "12" : "transparent",
                color: active ? N.cyan : N.muted,
                transition: "all 0.15s ease",
                boxShadow: active ? `0 0 12px ${N.cyan}15` : "none",
                textShadow: active ? `0 0 8px ${N.cyan}60` : "none",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = N.surface;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ color: active ? N.cyan : N.faint }}>
                <Icon />
              </span>
              {label}
              {active && (
                <div
                  style={{
                    marginLeft: "auto",
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: N.cyan,
                    boxShadow: "none",
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Enfermedad */}
      <div
        style={{
          padding: "16px 12px 0",
          borderTop: `1px solid ${N.border}`,
          marginTop: 12,
        }}
      >
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
          Enfermedad
        </div>
        {["dengue", "influenza"].map((d) => {
          const t = DISEASE_THEME[d];
          const active = disease === d;
          return (
            <button
              key={d}
              onClick={() => onDisease(d)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${active ? t.primary + "50" : "transparent"}`,
                cursor: "pointer",
                marginBottom: 4,
                background: active ? t.primary + "12" : "transparent",
                fontFamily: "var(--font-body)",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? t.primary : N.muted,
                transition: "all 0.15s ease",
                boxShadow: active ? `0 0 12px ${t.primary}15` : "none",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = N.surface;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span style={{ textTransform: "capitalize" }}>{t.label}</span>
              {active && (
                <div
                  style={{
                    marginLeft: "auto",
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: t.primary,
                    boxShadow: `0 0 8px ${t.primary}`,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "auto",
          padding: "16px 20px",
          borderTop: `1px solid ${N.border}`,
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: N.faint,
            fontFamily: "var(--font-mono)",
            textAlign: "center",
            lineHeight: 1.8,
            letterSpacing: 0.5,
          }}
        >
          TECNO UPSA 2026
          <br />
          <span style={{ color: N.muted }}>BROTE° v1.0</span>
        </div>
      </div>
    </aside>
  );
}
