import React, { useMemo } from "react";
import * as THREE from "three";
import { useSimulationStore } from "../simulation/SimulationStore";

/**
 * Renders a persistent 3D trajectory trail ribbon
 * Color-coded by landing phase to clearly visualize flight corridor & GN&C corrections.
 */
export default function TrajectoryTrail() {
  const trajectoryHistory = useSimulationStore((state) => state.trajectoryHistory);

  const { points, colors } = useMemo(() => {
    if (!trajectoryHistory || trajectoryHistory.length < 2) {
      return { points: [], colors: [] };
    }

    const pts = [];
    const cols = [];

    const phaseColorMap = {
      ENTRY: new THREE.Color("#ff3b19"),       // Red-orange hypersonic heat
      PARACHUTE: new THREE.Color("#ffaa00"),   // Amber parachute braking
      POWERED: new THREE.Color("#00c8ff"),     // Blue cyan retro-rockets
      SKY_CRANE: new THREE.Color("#a855f7"),   // Purple sky crane hover
      TOUCHDOWN: new THREE.Color("#10b981"),   // Green touchdown success
      COMPLETED: new THREE.Color("#10b981"),
    };

    for (let i = 0; i < trajectoryHistory.length; i++) {
      const p = trajectoryHistory[i];
      pts.push(new THREE.Vector3(p.x, p.y, p.z));

      const col = phaseColorMap[p.phase] || new THREE.Color("#ffffff");
      cols.push(col.r, col.g, col.b);
    }

    return { points: pts, colors: new Float32Array(cols) };
  }, [trajectoryHistory]);

  if (points.length < 2) return null;

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return (
    <line geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        linewidth={3}
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
      />
    </line>
  );
}
