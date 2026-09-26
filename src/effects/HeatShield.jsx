import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * NASA Mars 2020 PICA-X Ablative Heat Shield
 * Correct blunt-body shape: flattened spherical segment (like a bowl)
 * Dynamic emissive glow from cold grey → glowing orange → white-hot
 *
 * Scale: ~0.25 visual units diameter (≈ represents 4.5m actual diameter)
 */
export default function HeatShield({ temperature = 20, heatFlux = 0 }) {
  const shieldRef = useRef();
  const glowRef = useRef();
  const bowShockRef = useRef();

  // Normalised heating factor
  const heatNorm = Math.min(1, Math.max(0, (temperature - 100) / 1600));

  // Emissive colour: dark grey → deep red → fire orange → white
  const emissiveColor = useMemo(() => {
    if (heatNorm < 0.25) return new THREE.Color("#600d00").lerp(new THREE.Color("#cc2200"), heatNorm * 4);
    if (heatNorm < 0.6) return new THREE.Color("#cc2200").lerp(new THREE.Color("#ff8800"), (heatNorm - 0.25) / 0.35);
    return new THREE.Color("#ff8800").lerp(new THREE.Color("#ffffff"), (heatNorm - 0.6) / 0.4);
  }, [heatNorm]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Plasma pulsation at high heating
    if (bowShockRef.current) {
      const pulse = 1 + Math.sin(t * 22) * 0.025 * heatNorm;
      bowShockRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={[0, -0.04, 0]}>
      {/* Main heat shield bowl — spherical segment, concave face toward atmosphere */}
      <mesh ref={shieldRef} castShadow>
        {/* Flatten a sphere to get the correct blunt-body capsule shape */}
        <sphereGeometry args={[0.24, 48, 24, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45]} />
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.75}
          metalness={0.15}
          emissive={emissiveColor}
          emissiveIntensity={heatNorm * 3.5}
        />
      </mesh>

      {/* Ablative Phenolic tiles — concentric ring pattern */}
      {[0.08, 0.14, 0.20].map((r, i) => (
        <mesh key={i} position={[0, -0.035 + i * 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r, r + 0.012, 40]} />
          <meshBasicMaterial
            color={heatNorm > 0.08 ? emissiveColor : "#2a1a10"}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Bow Shock Plasma Envelope — the glowing cocoon around the capsule */}
      {heatNorm > 0.05 && (
        <group ref={bowShockRef}>
          {/* Inner plasma layer */}
          <mesh position={[0, 0.04, 0]}>
            <sphereGeometry args={[0.31, 32, 20, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55]} />
            <meshBasicMaterial
              color={emissiveColor}
              transparent
              opacity={Math.min(0.8, heatNorm * 0.85)}
              side={THREE.FrontSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* Outer diffuse plasma halo */}
          <mesh position={[0, 0.06, 0]}>
            <sphereGeometry args={[0.42, 28, 16, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.6]} />
            <meshBasicMaterial
              color={heatNorm > 0.5 ? "#ff6600" : "#ff3300"}
              transparent
              opacity={Math.min(0.45, heatNorm * 0.5)}
              side={THREE.FrontSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* Dramatic point light casting onto the backshell */}
          <pointLight
            color={emissiveColor}
            intensity={heatNorm * 30}
            distance={8}
            position={[0, -0.3, 0]}
          />
        </group>
      )}
    </group>
  );
}