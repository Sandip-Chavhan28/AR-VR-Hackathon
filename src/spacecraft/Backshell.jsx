import React from "react";
import * as THREE from "three";

/**
 * Mars 2020 Backshell — Conical aeroshell that houses the parachute mortar,
 * RCS attitude thrusters, and avionics during hypersonic entry.
 *
 * Shape: 70° half-angle blunt-body cone (like a truncated cone / frustum)
 * with white-painted ceramic insulation tiles.
 *
 * Scale: ~0.22 radius at base, 0.32 height (visual units)
 */
export default function Backshell() {
  return (
    <group position={[0, 0.18, 0]}>
      {/* Main Conical Aeroshell Body */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.05, 0.22, 0.32, 36]} />
        <meshStandardMaterial
          color="#f2f0ec"
          roughness={0.45}
          metalness={0.1}
        />
      </mesh>

      {/* Horizontal insulation tile seam bands */}
      {[-0.1, 0.0, 0.08].map((y, i) => {
        const radius = 0.05 + (0.5 - (y + 0.16) / 0.32) * 0.17;
        return (
          <mesh key={i} position={[0, y, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[radius, 0.005, 6, 36]} />
            <meshBasicMaterial color="#444444" />
          </mesh>
        );
      })}

      {/* Apex Parachute Mortar Canister */}
      <group position={[0, 0.17, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.055, 0.06, 0.06, 24]} />
          <meshStandardMaterial color="#1c1e22" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Ejection port ring */}
        <mesh position={[0, 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.025, 0.055, 20]} />
          <meshBasicMaterial color="#111111" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* 4x RCS cold-gas attitude thrusters at 90° intervals */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, idx) => {
        const r = 0.205;
        return (
          <group
            key={idx}
            position={[Math.cos(angle) * r, -0.04, Math.sin(angle) * r]}
            rotation={[0, -angle, 0]}
          >
            <mesh>
              <boxGeometry args={[0.025, 0.018, 0.025]} />
              <meshStandardMaterial color="#111111" metalness={0.9} />
            </mesh>
            {/* Thruster nozzle */}
            <mesh position={[0.018, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[0.005, 0.018, 8]} />
              <meshBasicMaterial color="#555" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
