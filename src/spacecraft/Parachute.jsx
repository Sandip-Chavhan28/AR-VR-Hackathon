import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * NASA Supersonic Disk-Gap-Band Parachute — Mars 2020 Perseverance
 * Diameter: 21.5 m actual → ~3.2 visual units at our scale
 *
 * Features:
 * - Iconic orange & white radial sector pattern (the "Dare Mighty Things" binary code)
 * - Hemispherical disk canopy with correctly proportioned vent gap and band
 * - 24 high-tensile Technora suspension lines converging to bridle
 * - Dynamic aerodynamic flutter & billowing animation
 * - Progressive deploy inflation (deployProgress 0→1)
 */
export default function Parachute({ deployProgress = 1.0 }) {
  const canopyRef = useRef();
  const canopyGrp = useRef();

  // Orange/white "Dare Mighty Things" binary pattern texture
  const parachuteTexture = useMemo(() => {
    const W = 1024, H = 512;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // White base
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // 80 sectors, alternating orange/white per NASA pattern
    const N = 80;
    const sw = W / N;
    // Mars 2020 binary message: "DARE MIGHTY THINGS" encoded in concentric rings
    // We replicate the visual pattern: alternating radial bands in 3 zones
    const pattern = [
      // Outer band (bottom of texture = outer canopy rim)
      [1,0,1,0,1,1,0,0,1,0,1,0,0,1,1,0,1,0,1,1,0,0,1,0,1,1,0,1,0,1,0,0,1,1,0,0,1,0,1,1,0,0,1,0,1,1,0,1,0,0,1,0,1,0,0,1,1,0,1,0,1,1,0,0,1,0,1,0,1,1,0,0,1,0,1,0,1,1,0,0],
      // Middle band
      [0,1,0,1,1,0,1,0,0,1,0,1,1,0,0,1,0,1,0,0,1,1,0,1,0,0,1,0,1,1,0,1,0,0,1,1,0,1,0,0,1,1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,0,0,1,1,0,1,0,1,0,0,1,1,0,1,0,1,0,0,1,1],
      // Inner band
      [1,1,0,0,1,0,1,1,0,0,1,1,0,1,0,0,1,0,1,0,1,1,0,0,1,1,0,0,1,0,1,1,0,1,0,1,0,0,1,0,1,1,0,1,0,0,1,1,0,0,1,0,1,0,1,1,0,0,1,0,1,1,0,0,1,1,0,1,0,1,0,0,1,1,0,0,1,0,1,1],
    ];

    ctx.fillStyle = "#e05010";
    // Band heights in the texture (outer rim → inner centre = bottom → top in unwrapped UV)
    const bands = [
      { y: 330, h: 130 }, // outer
      { y: 175, h: 130 }, // middle
      { y: 25,  h: 125 }, // inner
    ];

    for (let b = 0; b < 3; b++) {
      const { y, h } = bands[b];
      for (let s = 0; s < N; s++) {
        if (pattern[b][s]) {
          ctx.fillRect(s * sw, y, sw * 0.92, h);
        }
      }
    }

    // Disk-gap-band seam dividers
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 318, W, 10);
    ctx.fillRect(0, 162, W, 10);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, []);

  // 24 suspension lines (Technora composite cords)
  const lines = useMemo(() => {
    const result = [];
    const N = 24;
    const chuteRadius = 1.55;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2;
      result.push({
        end: [Math.cos(angle) * chuteRadius, 0, Math.sin(angle) * chuteRadius],
      });
    }
    return result;
  }, []);

  // Flutter animation
  useFrame((state) => {
    if (!canopyGrp.current) return;
    const t = state.clock.elapsedTime;
    canopyGrp.current.rotation.y = Math.sin(t * 0.18) * 0.04;
    canopyGrp.current.position.x = Math.sin(t * 1.1) * 0.04;
    canopyGrp.current.position.z = Math.cos(t * 0.85) * 0.04;
  });

  const scale = Math.max(0.005, deployProgress);
  const lineLength = 1.65;

  return (
    <group position={[0, 0.34, 0]} scale={[scale, scale, scale]}>
      {/* 24 Suspension Lines */}
      {lines.map((line, idx) => {
        const ex = line.end[0], ez = line.end[2];
        const len = Math.sqrt(ex * ex + lineLength * lineLength + ez * ez);
        const mx = ex / 2, my = lineLength / 2, mz = ez / 2;
        const ax = Math.atan2(Math.sqrt(ex * ex + ez * ez), lineLength);
        const ay = Math.atan2(ex, ez);
        return (
          <mesh key={idx} position={[mx, my + 0.04, mz]} rotation={[ax, ay, 0]}>
            <cylinderGeometry args={[0.006, 0.006, len, 3]} />
            <meshBasicMaterial color="#e8dfc8" transparent opacity={0.6} />
          </mesh>
        );
      })}

      {/* Canopy Group (animated flutter) */}
      <group ref={canopyGrp} position={[0, lineLength + 0.1, 0]}>
        {/* Main Disk Canopy Dome */}
        <mesh castShadow>
          <sphereGeometry args={[1.58, 52, 28, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
          <meshStandardMaterial
            map={parachuteTexture}
            side={THREE.DoubleSide}
            roughness={0.72}
            metalness={0.0}
          />
        </mesh>

        {/* Supersonic Vent Gap (dark ring) */}
        <mesh position={[0, -0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.54, 1.60, 36]} />
          <meshBasicMaterial color="#1a1a1a" side={THREE.DoubleSide} />
        </mesh>

        {/* Band (bottom stabilising ring) */}
        <mesh position={[0, -0.68, 0]}>
          <cylinderGeometry args={[1.58, 1.56, 0.26, 48, 1, true]} />
          <meshStandardMaterial color="#e05010" side={THREE.DoubleSide} roughness={0.7} />
        </mesh>

        {/* Apex vent hole */}
        <mesh position={[0, 1.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.18, 20]} />
          <meshBasicMaterial color="#060606" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}