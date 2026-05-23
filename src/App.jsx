import { useState, useMemo } from "react";
import Sidebar from "./components/Sidebar";
import SimulatorView from "./components/SimulatorView";
import DashboardView from "./components/DashboardView";
import { procesarDatos } from "./utils/epidemiology";
import "./styles/global.css";

// Procesar datos una sola vez al inicio
const DATOS = procesarDatos();

export default function App() {
  const [module, setModule] = useState("simulador");
  const [disease, setDisease] = useState("dengue");

  // Semana/año seleccionada (para el simulador usa la más reciente con datos)
  const [selectedIdx, setSelectedIdx] = useState(() => {
    // Usar la última semana disponible
    return DATOS.length - 1;
  });

  const currentRow = DATOS[selectedIdx];
  const currentGt = currentRow?.Gt ?? 0;

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
        currentGt={currentGt}
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
            datos={DATOS}
            currentGt={currentGt}
            selectedIdx={selectedIdx}
            onSelectIdx={setSelectedIdx}
          />
        ) : (
          <DashboardView disease={disease} datos={DATOS} />
        )}
      </main>
    </div>
  );
}
