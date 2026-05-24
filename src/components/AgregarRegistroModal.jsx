import { useState } from "react";

const C = {
  text: "#0d1117",
  mid: "#3d4554",
  muted: "#6e7891",
  border: "#e2e6ef",
  teal: "#0d9488",
  rose: "#e11d48",
  bg: "#f0f2f7",
};

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: C.mid,
          marginBottom: 5,
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}

function Input({ value, onChange, type = "number", min, max, placeholder }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) =>
        onChange(type === "number" ? +e.target.value : e.target.value)
      }
      min={min}
      max={max}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "9px 12px",
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        color: C.text,
        background: "white",
        outline: "none",
        transition: "border-color 0.15s",
      }}
      onFocus={(e) => (e.target.style.borderColor = C.teal)}
      onBlur={(e) => (e.target.style.borderColor = C.border)}
    />
  );
}

export default function AgregarRegistroModal({
  onGuardar,
  onCerrar,
  datosExistentes = [],
}) {
  const añoActual = new Date().getFullYear();
  const seActual = Math.ceil(
    (Date.now() - new Date(añoActual, 0, 1)) / (7 * 24 * 3600 * 1000),
  );

  const [form, setForm] = useState({
    año: añoActual,
    se: seActual,
    sospechosos: "",
    confirmados: "",
    grave: "",
    fallecidos: "",
  });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Validación
  const validar = () => {
    if (!form.año || form.año < 2022 || form.año > 2030)
      return "Año inválido (2022–2030)";
    if (!form.se || form.se < 1 || form.se > 52)
      return "Semana inválida (1–52)";
    if (form.confirmados === "" || form.confirmados < 0)
      return "Ingresa los casos confirmados";
    if (form.sospechosos === "" || form.sospechosos < 0)
      return "Ingresa los casos sospechosos";
    if (form.grave === "" || form.grave < 0)
      return "Ingresa casos de dengue grave";
    if (form.fallecidos === "" || form.fallecidos < 0)
      return "Ingresa fallecidos (puede ser 0)";
    if (+form.grave > +form.confirmados)
      return "Dengue grave no puede superar confirmados";
    if (+form.fallecidos > +form.confirmados)
      return "Fallecidos no puede superar confirmados";
    return null;
  };

  const handleGuardar = async () => {
    const err = validar();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setGuardando(true);

    const registro = {
      año: +form.año,
      se: +form.se,
      sospechosos: +form.sospechosos,
      confirmados: +form.confirmados,
      grave: +form.grave,
      fallecidos: +form.fallecidos,
    };

    const result = onGuardar(registro);
    setGuardando(false);
    if (!result.ok) {
      setError(result.error);
    } else {
      onCerrar();
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="modal-box">
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                fontWeight: 700,
                color: C.text,
                marginBottom: 4,
              }}
            >
              Agregar nuevo registro
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              Ingresa los datos epidemiológicos de una nueva semana
            </div>
          </div>
          <button
            onClick={onCerrar}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: C.muted,
              padding: 4,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Año + Semana */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 2,
          }}
        >
          <Field label="Año" hint="Entre 2022 y 2030">
            <Input
              value={form.año}
              onChange={(v) => set("año", v)}
              min={2022}
              max={2030}
            />
          </Field>
          <Field label="Semana epidemiológica" hint="Número 1 al 52">
            <Input
              value={form.se}
              onChange={(v) => set("se", v)}
              min={1}
              max={52}
            />
          </Field>
        </div>

        <div
          style={{ height: 1, background: C.border, margin: "4px 0 18px" }}
        />

        {/* Casos */}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <Field label="Casos sospechosos">
            <Input
              value={form.sospechosos}
              onChange={(v) => set("sospechosos", v)}
              min={0}
              placeholder="0"
            />
          </Field>
          <Field label="Casos confirmados">
            <Input
              value={form.confirmados}
              onChange={(v) => set("confirmados", v)}
              min={0}
              placeholder="0"
            />
          </Field>
          <Field
            label="Dengue grave"
            hint="Casos que requirieron hospitalización"
          >
            <Input
              value={form.grave}
              onChange={(v) => set("grave", v)}
              min={0}
              placeholder="0"
            />
          </Field>
          <Field label="Fallecidos" hint="Muertes confirmadas por dengue">
            <Input
              value={form.fallecidos}
              onChange={(v) => set("fallecidos", v)}
              min={0}
              placeholder="0"
            />
          </Field>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              borderRadius: 7,
              background: "#fff1f2",
              border: `1px solid ${C.rose}30`,
              fontSize: 12,
              color: C.rose,
              fontWeight: 500,
            }}
          >
            ⚠ {error}
          </div>
        )}

        {/* Botones */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 24,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onCerrar}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: "white",
              color: C.mid,
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            style={{
              padding: "9px 24px",
              borderRadius: 8,
              border: "none",
              background: C.teal,
              color: "white",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 600,
              cursor: guardando ? "wait" : "pointer",
              opacity: guardando ? 0.7 : 1,
              boxShadow: "0 2px 8px rgba(13,148,136,0.35)",
              transition: "opacity 0.15s",
            }}
          >
            {guardando ? "Guardando..." : "Guardar registro"}
          </button>
        </div>
      </div>
    </div>
  );
}
