import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulationStore } from "../simulation/SimulationStore";
import { VISUAL_SCALE } from "../components/EntryController";

/**
 * Martian Surface — Jezero Crater Landing Zone
 * Sits at Y=0 (the surface plane). Scale: 1 visual unit = 500 m.
 * Features: procedural Martian texture, rocky dunes, 50 m target ellipse,
 * holographic landing beacon, and dust kickup on retro-rocket burn.
 */
export default function MarsTerrain() {
  const dustRingRef = useRef();
  const dustParticlesRef = useRef();

  const altitude = useSimulationStore((s) => s.altitude);
  const throttle = useSimulationStore((s) => s.throttle);
  const phase = useSimulationStore((s) => s.phase);
  const dustStormEnabled = useSimulationStore((s) => s.disturbances.dustStorm);

  // Procedural Jezero Crater terrain texture
  const surfaceTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");

    // Base: Jezero clay-carbonite regolith
    ctx.fillStyle = "#7a3518";
    ctx.fillRect(0, 0, 1024, 1024);

    // Gravel, pebbles and rock scatter
    for (let i = 0; i < 80000; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const r = Math.random() * 2.2;
      const t = Math.random();
      ctx.fillStyle =
        t < 0.3 ? "rgba(190,85,40,0.35)" :
        t < 0.65 ? "rgba(60,22,10,0.45)" :
        "rgba(220,105,55,0.25)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Aeolian dune ripples
    for (let y = 0; y < 1024; y += 28) {
      ctx.fillStyle = "rgba(100,42,18,0.14)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < 1024; x += 32) {
        ctx.lineTo(x, y + Math.sin(x * 0.018) * 7);
      }
      ctx.lineTo(1024, y + 20);
      ctx.lineTo(0, y + 20);
      ctx.fill();
    }

    // Small impact craters
    for (let i = 0; i < 18; i++) {
      const cx = Math.random() * 1024;
      const cy = Math.random() * 1024;
      const cr = 8 + Math.random() * 28;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(40,15,8,0.5)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, cr * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(180,80,35,0.2)";
      ctx.fill();
    }

    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(18, 18);
    return t;
  }, []);

  // Dust kickup particles for retro-rocket burn near surface
  const dustCount = 100;
  const dustPos = useMemo(() => {
    const arr = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 8;
      arr[i * 3] = Math.cos(angle) * r;
      arr[i * 3 + 1] = Math.random() * 2;
      arr[i * 3 + 2] = Math.sin(angle) * r;
    }
    return arr;
  }, []);
  const dustVel = useMemo(() =>
    Array.from({ length: dustCount }, (_, i) => {
      const angle = (i / dustCount) * Math.PI * 2;
      return {
        vx: Math.cos(angle) * (4 + Math.random() * 7),
        vy: 1 + Math.random() * 2.5,
        vz: Math.sin(angle) * (4 + Math.random() * 7),
      };
    }), []);

  useFrame((state, delta) => {
    const isNearGround = altitude < 30 && throttle > 0.08 && phase !== "COMPLETED";
    if (dustRingRef.current) {
      dustRingRef.current.visible = isNearGround;
      if (isNearGround) {
        const s = 1 + (state.clock.elapsedTime * 3.5) % 4;
        dustRingRef.current.scale.set(s, s, s);
      }
    }
    if (dustParticlesRef.current && isNearGround) {
      const pos = dustParticlesRef.current.geometry.attributes.position.array;
      for (let i = 0; i < dustCount; i++) {
        pos[i * 3] += dustVel[i].vx * delta;
        pos[i * 3 + 1] += dustVel[i].vy * delta;
        pos[i * 3 + 2] += dustVel[i].vz * delta;
        if (Math.hypot(pos[i * 3], pos[i * 3 + 2]) > 18 || pos[i * 3 + 1] > 5) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * 2;
          pos[i * 3] = Math.cos(angle) * r;
          pos[i * 3 + 1] = 0.05;
          pos[i * 3 + 2] = Math.sin(angle) * r;
        }
      }
      dustParticlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  // 50 m target ellipse radius in visual units (50 m / 500 m per unit = 0.1 units)
  const targetR = 50 * VISUAL_SCALE;  // 0.1 visual units

  return (
    <group position={[0, 0, 0]}>
      {/* Main terrain plane — very large for horizon effect */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[2000, 2000, 64, 64]} />
        <meshStandardMaterial
          map={surfaceTexture}
          roughness={0.92}
          metalness={0.06}
          color={dustStormEnabled ? "#6b2e14" : "#8a3c1c"}
        />
      </mesh>

      {/* Distant rocky crater rim hills */}
      {[0, 1.05, 2.09, 3.14, 4.19, 5.24].map((angle, i) => {
        const dist = 220;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * dist, 10, Math.sin(angle) * dist]}
            castShadow
          >
            <coneGeometry args={[55 + i * 8, 18 + i * 3, 7]} />
            <meshStandardMaterial color="#622e14" roughness={0.95} />
          </mesh>
        );
      })}

      {/* ========== TARGET LANDING ZONE ========== */}
      <group position={[0, 0.02, 0]}>
        {/* 50 m primary target ring (teal/cyan) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[targetR * 0.92, targetR, 56]} />
          <meshBasicMaterial color="#00ffcc" side={THREE.DoubleSide} />
        </mesh>

        {/* 100 m secondary ring (amber) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[targetR * 1.88, targetR * 2, 56]} />
          <meshBasicMaterial color="#ffaa00" transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>

        {/* 250 m outer reference ring (red) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[targetR * 4.8, targetR * 5, 56]} />
          <meshBasicMaterial color="#ff3333" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>

        {/* Bullseye centre */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[targetR * 0.35, 24]} />
          <meshBasicMaterial color="#00ffcc" transparent opacity={0.6} />
        </mesh>

        {/* Vertical holographic beacon pillar */}
        <mesh position={[0, 6, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 12, 6]} />
          <meshBasicMaterial color="#00ffcc" transparent opacity={0.35} />
        </mesh>
      </group>

      {/* Ground Dust Shockwave Ring */}
      <mesh
        ref={dustRingRef}
        position={[0, 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[0.8, 2.5, 32]} />
        <meshBasicMaterial color="#d07840" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>

      {/* Dust Particle Kickup */}
      {altitude < 30 && throttle > 0.08 && (
        <points ref={dustParticlesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={dustCount}
              array={dustPos}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.45}
            color="#c87040"
            transparent
            opacity={0.6}
          />
        </points>
      )}
    </group>
  );
}