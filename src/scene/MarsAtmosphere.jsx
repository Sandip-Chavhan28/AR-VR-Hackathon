import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulationStore } from "../simulation/SimulationStore";
import { VISUAL_SCALE } from "../components/EntryController";

/**
 * Martian Atmospheric Horizon Dome & Dust Storm Particles
 * The atmosphere dome is centered at Y=0 (surface), radius 250 visual units.
 * Dust storm particles fill the lower atmosphere visible near the surface.
 */
export default function MarsAtmosphere() {
  const dustCloudRef = useRef();

  const altitude = useSimulationStore((s) => s.altitude);
  const dustStormEnabled = useSimulationStore((s) => s.disturbances.dustStorm);
  const dustIntensity = useSimulationStore((s) => s.disturbances.dustIntensity);

  const dustParticleCount = 250;
  const dustData = useMemo(() => {
    const pos = new Float32Array(dustParticleCount * 3);
    const speed = [];
    for (let i = 0; i < dustParticleCount; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 300;
      pos[i * 3 + 1] = Math.random() * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 300;
      speed.push({
        vx: 6 + Math.random() * 16,
        vy: (Math.random() - 0.5) * 3,
        vz: 3 + Math.random() * 10,
      });
    }
    return { pos, speed };
  }, []);

  useFrame((_, delta) => {
    if (!dustCloudRef.current || !dustStormEnabled) return;
    const positions = dustCloudRef.current.geometry.attributes.position.array;
    for (let i = 0; i < dustParticleCount; i++) {
      positions[i * 3 + 0] += dustData.speed[i].vx * delta;
      positions[i * 3 + 1] += dustData.speed[i].vy * delta;
      positions[i * 3 + 2] += dustData.speed[i].vz * delta;
      if (positions[i * 3 + 0] > 150) positions[i * 3 + 0] = -150;
      if (positions[i * 3 + 1] > 60) positions[i * 3 + 1] = 0.5;
      if (positions[i * 3 + 2] > 150) positions[i * 3 + 2] = -150;
    }
    dustCloudRef.current.geometry.attributes.position.needsUpdate = true;
  });

  // Atmosphere opacity — strong near surface, fades in space
  const altVisual = altitude * VISUAL_SCALE;
  const atmoOpacity = Math.max(0, Math.min(0.1, 0.1 - altVisual * 0.0004));

  return (
    <group>
      {/* Salmon/butterscotch atmospheric sky dome (Martian low-altitude haze) */}
      {altVisual < 60 && (
        <mesh position={[0, -10, 0]}>
          <sphereGeometry args={[850, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
          <meshBasicMaterial
            color={dustStormEnabled ? "#7a3814" : "#c87048"}
            transparent
            opacity={dustStormEnabled ? Math.min(0.3, atmoOpacity * 4) : atmoOpacity}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Martian dust storm particle cloud */}
      {dustStormEnabled && (
        <points ref={dustCloudRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={dustParticleCount}
              array={dustData.pos}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={1.4}
            color="#b04e22"
            transparent
            opacity={0.4 * (dustIntensity || 0.65)}
          />
        </points>
      )}
    </group>
  );
}