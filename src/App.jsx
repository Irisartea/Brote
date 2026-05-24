import { useState, useMemo, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import SimulatorView from "./components/SimulatorView";
import DashboardView from "./components/DashboardView";
import { procesarDatos } from "./utils/epidemiology";
import {
  obtenerTodosLosDatos,
  agregarRegistro,
  exportarCSV,
} from "./data/dengueStore";
import "./styles/global.css";

function buildDatos() {
  return procesarDatos(obtenerTodosLosDatos());
}

export default function App() {
  const [module, setModule] = useState("simulador");
  const [disease, setDisease] = useState("dengue");
  const [datosVersion, setDatosVersion] = useState(0); // trigger recalculo

  const datos = useMemo(() => buildDatos(), [datosVersion]);

  const [selectedIdx, setSelectedIdx] = useState(() => datos.length - 1);

  const currentRow = datos[selectedIdx];
  const currentGt = currentRow?.Gt ?? 0;

  // Asegurarse de que selectedIdx no quede fuera de rango al recargar datos
  const safeIdx = Math.min(selectedIdx, datos.length - 1);
  const safeGt = datos[safeIdx]?.Gt ?? 0;

  const handleAgregarRegistro = useCallback((registro) => {
    const result = agregarRegistro(registro);
    if (result.ok) {
      setDatosVersion((v) => v + 1);
      // Ir a la semana recién agregada
      setTimeout(() => {
        const nuevos = buildDatos();
        const idx = nuevos.findIndex(
          (r) => r.año === registro.año && r.se === registro.se,
        );
        if (idx >= 0) setSelectedIdx(idx);
      }, 50);
    }
    return result;
  }, []);

  const handleExportar = useCallback(() => {
    exportarCSV(obtenerTodosLosDatos());
  }, []);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "var(--bg)",
      }}
    >
      <Sidebar
        module={module}
        onModule={setModule}
        disease={disease}
        onDisease={setDisease}
        currentGt={safeGt}
        onExportar={handleExportar}
      />
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {module === "simulador" ? (
          <SimulatorView
            disease={disease}
            datos={datos}
            currentGt={safeGt}
            selectedIdx={safeIdx}
            onSelectIdx={setSelectedIdx}
            onAgregarRegistro={handleAgregarRegistro}
          />
        ) : (
          <DashboardView disease={disease} datos={datos} />
        )}
      </main>
    </div>
  );
}
