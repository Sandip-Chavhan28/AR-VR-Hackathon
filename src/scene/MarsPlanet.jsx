import React, { useMemo } from "react";
import * as THREE from "three";
import { useSimulationStore } from "../simulation/SimulationStore";
import { VISUAL_SCALE } from "../components/EntryController";

/**
 * Procedurally textured Mars Globe
 * Center is at Y=-200 so the top of the sphere (radius 200) sits at Y=0,
 * matching the terrain plane and giving a correct "planet below" appearance.
 * The globe fades out as altitude approaches 0 (replaced by close-up terrain).
 */
export default function MarsPlanet() {
  const altitude = useSimulationStore((s) => s.altitude);

  // Procedural Mars surface texture
  const marsTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    // Base red-orange regolith
    ctx.fillStyle = "#9e4520";
    ctx.fillRect(0, 0, 1024, 512);

    // Dark basalt lowland regions
    ctx.fillStyle = "#5e2812";
    for (let i = 0; i < 45; i++) {
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * 1024,
        80 + Math.random() * 350,
        30 + Math.random() * 100,
        20 + Math.random() * 60,
        Math.random() * Math.PI,
        0, Math.PI * 2
      );
      ctx.fill();
    }

    // Lighter iron-oxide highlands
    ctx.fillStyle = "rgba(200, 90, 40, 0.3)";
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * 1024,
        100 + Math.random() * 312,
        40 + Math.random() * 80,
        25 + Math.random() * 50,
        Math.random() * Math.PI,
        0, Math.PI * 2
      );
      ctx.fill();
    }

    // Valles Marineris canyon system
    ctx.strokeStyle = "rgba(40, 15, 8, 0.8)";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(340, 265);
    ctx.bezierCurveTo(500, 280, 650, 258, 800, 268);
    ctx.stroke();

    // North polar ice cap
    ctx.fillStyle = "rgba(255, 252, 248, 0.9)";
    ctx.beginPath();
    ctx.ellipse(512, 22, 210, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    // South polar ice cap
    ctx.beginPath();
    ctx.ellipse(512, 490, 180, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }, []);

  // Globe opacity: fully visible from high altitude, fades as we approach surface
  // At alt > 10000 m (20 visual units) → opacity 1.0
  // At alt < 2000 m (4 visual units)   → opacity 0.0
  const altVisual = altitude * VISUAL_SCALE;
  const opacity = Math.max(0, Math.min(1, (altVisual - 4) / 16));

  if (opacity <= 0.01) return null;

  return (
    <group position={[0, -200, 0]}>
      {/* Planet sphere: radius 200 units, so top sits at Y=0 */}
      <mesh receiveShadow>
        <sphereGeometry args={[200, 64, 64]} />
        <meshStandardMaterial
          map={marsTexture}
          roughness={0.88}
          metalness={0.04}
          transparent={opacity < 0.99}
          opacity={opacity}
        />
      </mesh>

      {/* Atmospheric limb glow around the planet */}
      <mesh scale={1.015}>
        <sphereGeometry args={[200, 40, 40]} />
        <meshBasicMaterial
          color="#d96030"
          transparent
          opacity={0.12 * opacity}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}