import React from "react";
import { Stars, OrbitControls } from "@react-three/drei";
import MarsPlanet from "./MarsPlanet";
import MarsAtmosphere from "./MarsAtmosphere";
import MarsTerrain from "./MarsTerrain";
import Lander from "../spacecraft/Lander";
import TrajectoryTrail from "../effects/TrajectoryTrail";
import EntryController from "../components/EntryController";
import CameraController from "./CameraController";
import { useSimulationStore } from "../simulation/SimulationStore";

/**
 * Coordinate System (1 visual unit = 500 m):
 *   Y = 0     → Martian surface (terrain plane)
 *   Y = 130   → 65 km altitude (atmospheric entry interface)
 *   Y = -200  → Center of Mars globe (for correct sphere appearance)
 */
export default function MarsScene() {
  const cameraMode = useSimulationStore((state) => state.cameraMode);

  return (
    <>
      {/* Deep space void — replaced the flat orange background */}
      <color attach="background" args={["#020408"]} />

      {/* Stars — the Milky Way from Martian orbit */}
      <Stars
        radius={400}
        depth={100}
        count={4000}
        factor={4}
        saturation={0.1}
        fade
        speed={0.4}
      />

      {/* Atmospheric depth fog near surface */}
      <fog attach="fog" args={["#1a0a04", 300, 2000]} />

      {/* Distant Sun — primary key light */}
      <ambientLight intensity={0.35} color="#fff4e0" />
      <directionalLight
        position={[300, 400, 200]}
        intensity={2.8}
        color="#fff8f0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={600}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      {/* Warm bounce light from the Martian regolith */}
      <directionalLight
        position={[-150, -80, -100]}
        intensity={0.4}
        color="#c85a2a"
      />

      {/* ============================================================
          WORLD GEOMETRY (scaled: 1 unit = 500 m)
          ============================================================ */}

      {/* Mars Surface Terrain — sits at Y=0 (sea level) */}
      <MarsTerrain />

      {/* Mars Globe visible from high altitude — center at Y=-200 so
          its top edge sits at Y≈0, matching the terrain plane */}
      <MarsPlanet />

      {/* Atmospheric haze dome centered at Y=0 */}
      <MarsAtmosphere />

      {/* ============================================================
          SPACECRAFT ASSEMBLY (positioned via Lander.jsx / physics)
          ============================================================ */}
      <Lander />

      {/* Color-coded 3D trajectory ribbon */}
      <TrajectoryTrail />

      {/* Autonomous 3-DoF GN&C flight controller (no visual output) */}
      <EntryController />

      {/* Multi-angle camera director */}
      <CameraController />

      {/* Manual orbit controls (only when FREE_ORBIT mode is active) */}
      {cameraMode === "FREE_ORBIT" && (
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={1.5}
          maxDistance={600}
          maxPolarAngle={Math.PI * 0.65}
        />
      )}
    </>
  );
}