import React from "react";
import { Canvas } from "@react-three/fiber";
import MarsScene from "./scene/MarsScene";
import TelemetryPanel from "./components/TelemetryPanel";
import EvaluationModal from "./components/EvaluationModal";
import MissionBriefingModal from "./components/MissionBriefingModal";

/**
 * Coordinate system: 1 visual unit = 500 m
 * Lander starts at altitude 65 000 m → Y = 130 units
 * Camera starts above the lander, zooms in as it descends.
 */
export default function App() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "#020408",
      }}
    >
      {/* 3D Three.js / R3F Canvas */}
      <Canvas
        shadows
        camera={{
          // Start high above the entry point looking down at Mars
          position: [0, 145, 20],
          fov: 50,
          near: 0.05,
          far: 8000,
        }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <MarsScene />
      </Canvas>

      {/* HUD Overlays */}
      <TelemetryPanel />
      <EvaluationModal />
      <MissionBriefingModal />
    </div>
  );
}