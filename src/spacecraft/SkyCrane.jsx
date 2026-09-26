import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * 3D Model of the NASA Powered Descent Vehicle (Sky Crane)
 * Features octagonal titanium truss, 4 gold hydrazine propellant tanks,
 * 8 canted Mars Lander Engines (MLE) with realistic particle exhaust plumes,
 * and deployable bridle tethers that lower the Perseverance rover.
 */
export default function SkyCrane({ throttle = 0, cableLength = 0, isHovering = false }) {
  const plumesRef = useRef([]);

  // 8 Engine positions and cant angles (pairs of 2 at 4 corners, canted ~45° outwards)
  const engineConfigs = [
    // Corner 1: (+X, -Z)
    { pos: [1.3, -0.4, -1.3], rot: [0.35, 0, -0.45] },
    { pos: [1.45, -0.4, -1.15], rot: [0.25, 0, -0.55] },
    // Corner 2: (-X, -Z)
    { pos: [-1.3, -0.4, -1.3], rot: [0.35, 0, 0.45] },
    { pos: [-1.45, -0.4, -1.15], rot: [0.25, 0, 0.55] },
    // Corner 3: (+X, +Z)
    { pos: [1.3, -0.4, 1.3], rot: [-0.35, 0, -0.45] },
    { pos: [1.45, -0.4, 1.15], rot: [-0.25, 0, -0.55] },
    // Corner 4: (-X, +Z)
    { pos: [-1.3, -0.4, 1.3], rot: [-0.35, 0, 0.45] },
    { pos: [-1.45, -0.4, 1.15], rot: [-0.25, 0, 0.55] },
  ];

  useFrame((state) => {
    // Dynamic flame flicker & length scaling based on throttle
    const flicker = 1 + (Math.random() - 0.5) * 0.15;
    const flameScaleY = Math.max(0.01, throttle * 2.5 * flicker);
    const flameScaleXZ = Math.max(0.01, (0.4 + throttle * 0.8) * flicker);

    plumesRef.current.forEach((mesh) => {
      if (mesh) {
        mesh.scale.set(flameScaleXZ, flameScaleY, flameScaleXZ);
        mesh.visible = throttle > 0.05;
      }
    });
  });

  return (
    <group position={[0, 1.2, 0]}>
      {/* Central Equipment Structure & Avionics Deck */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[1.6, 1.8, 0.5, 8]} />
        <meshStandardMaterial color="#404348" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Titanium Tubular Truss Beams */}
      {[0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].map((ang, i) => (
        <group key={i} rotation={[0, ang, 0]}>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 3.4, 8]} rotation={[0, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#8e9297" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* 4 Spherical Hydrazine Fuel Tanks wrapped in Gold MLI foil */}
      {[
        [0.85, 0.25, 0.85],
        [-0.85, 0.25, 0.85],
        [0.85, 0.25, -0.85],
        [-0.85, 0.25, -0.85],
      ].map((pos, i) => (
        <group key={i} position={pos}>
          <mesh castShadow>
            <sphereGeometry args={[0.5, 20, 20]} />
            <meshStandardMaterial color="#d49a2a" roughness={0.25} metalness={0.85} />
          </mesh>
          {/* Tank retaining bands */}
          <mesh>
            <torusGeometry args={[0.51, 0.02, 8, 24]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* 8 Canted Retro-Rocket Engines with Multi-Stage Plumes */}
      {engineConfigs.map((cfg, idx) => (
        <group key={idx} position={cfg.pos} rotation={cfg.rot}>
          {/* Thruster Nozzle */}
          <mesh castShadow>
            <cylinderGeometry args={[0.1, 0.22, 0.38, 16]} />
            <meshStandardMaterial color="#222" metalness={0.95} roughness={0.2} />
          </mesh>

          {/* Engine Throat Heat Glow */}
          <mesh position={[0, -0.18, 0]}>
            <circleGeometry args={[0.18, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>

          {/* Dynamic Rocket Exhaust Plume */}
          <group
            ref={(el) => (plumesRef.current[idx] = el)}
            position={[0, -0.3, 0]}
            visible={throttle > 0.05}
          >
            {/* Inner Core: Hot white-blue Mach diamond core */}
            <mesh position={[0, -0.5, 0]}>
              <coneGeometry args={[0.16, 1.2, 16]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
            </mesh>

            {/* Mid Flame: Intense fiery orange plasma cone */}
            <mesh position={[0, -0.9, 0]}>
              <coneGeometry args={[0.32, 2.0, 16]} />
              <meshBasicMaterial color="#ff7700" transparent opacity={0.8} />
            </mesh>

            {/* Outer Gas Halo: Transparent glowing red-orange plume */}
            <mesh position={[0, -1.2, 0]}>
              <coneGeometry args={[0.48, 2.6, 16]} />
              <meshBasicMaterial color="#ff2200" transparent opacity={0.4} />
            </mesh>

            {/* Dynamic point light for dramatic thruster illumination */}
            {idx % 2 === 0 && (
              <pointLight
                color="#ff8822"
                intensity={throttle * 15}
                distance={18}
                position={[0, -0.8, 0]}
              />
            )}
          </group>
        </group>
      ))}

      {/* Deployable Bridle Tether Cables (lowers the rover) */}
      {cableLength > 0.1 && (
        <group>
          {[
            [0.5, 0, 0.6],
            [-0.5, 0, 0.6],
            [0.5, 0, -0.6],
            [-0.5, 0, -0.6],
          ].map((startPos, i) => (
            <mesh
              key={i}
              position={[startPos[0], -cableLength / 2, startPos[2]]}
            >
              <cylinderGeometry args={[0.012, 0.012, cableLength, 6]} />
              <meshBasicMaterial color="#33ddff" />
            </mesh>
          ))}
          {/* Bridle umbilical line */}
          <mesh position={[0, -cableLength / 2, 0]}>
            <cylinderGeometry args={[0.02, 0.02, cableLength, 8]} />
            <meshStandardMaterial color="#ffcc00" metalness={0.5} />
          </mesh>
        </group>
      )}
    </group>
  );
}
