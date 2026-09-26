import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * High-fidelity 3D model of Mars 2020 Perseverance Rover
 * Includes 6-wheel rocker-bogie suspension, chassis, MMRTG,
 * Mastcam-Z remote sensing mast, robotic arm, and high-gain antenna.
 */
export default function MarsRover({ settled = false }) {
  const mastRef = useRef();

  useFrame((state) => {
    if (mastRef.current && settled) {
      // Pan mastcam triumphantly once landed on Martian surface
      mastRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.45;
    }
  });

  return (
    <group position={[0, -0.2, 0]}>
      {/* Main Rover Body / Chassis */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.6, 2.2]} />
        <meshStandardMaterial color="#f0ede6" roughness={0.4} metalness={0.5} />
      </mesh>

      {/* Gold Thermal Multi-Layer Insulation (MLI) Deck Top */}
      <mesh position={[0, 0.76, 0]}>
        <boxGeometry args={[1.4, 0.04, 2.1]} />
        <meshStandardMaterial color="#dfa233" roughness={0.25} metalness={0.85} />
      </mesh>

      {/* MMRTG (Radioisotope Thermoelectric Generator) at rear */}
      <group position={[0, 0.75, 1.25]} rotation={[0.4, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.25, 0.25, 0.8, 16]} />
          <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Heat dissipation fins */}
        {[-0.28, 0, 0.28].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]}>
            <boxGeometry args={[0.02, 0.7, 0.35]} />
            <meshStandardMaterial color="#444" roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* High-Gain Dish Antenna */}
      <group position={[-0.45, 0.95, 0.4]}>
        <mesh rotation={[-0.4, 0.3, 0]}>
          <cylinderGeometry args={[0.3, 0.05, 0.08, 24]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.6} />
        </mesh>
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
          <meshStandardMaterial color="#555" />
        </mesh>
      </group>

      {/* Remote Sensing Mast (Mastcam-Z & SuperCam) */}
      <group ref={mastRef} position={[0.4, 0.75, -0.8]}>
        {/* Mast vertical pole */}
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 1.2, 12]} />
          <meshStandardMaterial color="#e0ded8" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Sensor Head */}
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[0.3, 0.22, 0.28]} />
          <meshStandardMaterial color="#222222" metalness={0.7} roughness={0.2} />
        </mesh>
        {/* Mastcam-Z Stereo Camera Lenses */}
        <mesh position={[-0.09, 1.2, -0.16]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.06, 16]} />
          <meshStandardMaterial color="#00ffcc" emissive="#004433" roughness={0.1} />
        </mesh>
        <mesh position={[0.09, 1.2, -0.16]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.06, 16]} />
          <meshStandardMaterial color="#00ffcc" emissive="#004433" roughness={0.1} />
        </mesh>
        {/* SuperCam laser optics lens */}
        <mesh position={[0, 1.28, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.04, 16]} />
          <meshStandardMaterial color="#ff2200" emissive="#330000" roughness={0.1} />
        </mesh>
      </group>

      {/* Robotic Arm (stowed at front) */}
      <group position={[-0.4, 0.45, -1.15]}>
        <mesh position={[0, 0, -0.2]}>
          <boxGeometry args={[0.1, 0.1, 0.45]} />
          <meshStandardMaterial color="#888888" metalness={0.8} />
        </mesh>
        <mesh position={[0, -0.1, -0.45]}>
          <cylinderGeometry args={[0.12, 0.12, 0.15, 16]} />
          <meshStandardMaterial color="#333333" metalness={0.8} />
        </mesh>
      </group>

      {/* Rocker-Bogie Suspension & 6 Wheels */}
      {/* Left side wheels (x = 1.05) */}
      {[
        { pos: [1.1, 0.1, -0.85], id: "front-left" },
        { pos: [1.18, 0.1, 0.0], id: "mid-left" },
        { pos: [1.1, 0.1, 0.85], id: "rear-left" },
      ].map((w) => (
        <group key={w.id} position={w.pos}>
          {/* Wheel Rim & Tire with machined cleats */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.26, 0.26, 0.24, 24]} />
            <meshStandardMaterial color="#4f5257" metalness={0.8} roughness={0.35} />
          </mesh>
          {/* Wheel hub cap */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.26, 16]} />
            <meshStandardMaterial color="#e5a93b" metalness={0.8} />
          </mesh>
          {/* Suspension strut to body */}
          <mesh position={[-0.15, 0.18, 0]} rotation={[0, 0, -0.5]}>
            <cylinderGeometry args={[0.03, 0.03, 0.45, 8]} />
            <meshStandardMaterial color="#2b2d30" metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Right side wheels (x = -1.05) */}
      {[
        { pos: [-1.1, 0.1, -0.85], id: "front-right" },
        { pos: [-1.18, 0.1, 0.0], id: "mid-right" },
        { pos: [-1.1, 0.1, 0.85], id: "rear-right" },
      ].map((w) => (
        <group key={w.id} position={w.pos}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.26, 0.26, 0.24, 24]} />
            <meshStandardMaterial color="#4f5257" metalness={0.8} roughness={0.35} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.26, 16]} />
            <meshStandardMaterial color="#e5a93b" metalness={0.8} />
          </mesh>
          <mesh position={[0.15, 0.18, 0]} rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.03, 0.03, 0.45, 8]} />
            <meshStandardMaterial color="#2b2d30" metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Status LED / Beacon (flashing green when touchdown confirmed) */}
      <mesh position={[0.4, 0.82, -0.4]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshBasicMaterial color={settled ? "#00ff66" : "#ffaa00"} />
      </mesh>
    </group>
  );
}
