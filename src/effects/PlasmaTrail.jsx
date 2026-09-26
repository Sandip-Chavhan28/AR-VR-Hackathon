import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulationStore } from "../simulation/SimulationStore";

/**
 * Hypersonic Entry Plasma Trail
 * The single most iconic visual of Mars EDL — a blazing comet tail
 * that forms as the aeroshell compresses the thin CO2 atmosphere
 * to superheated plasma at temperatures exceeding 1600°C.
 *
 * Visual: bright white-blue ionized core → deep orange → fading red wake
 */
export default function PlasmaTrail({ heatNorm = 0, velocity = 0 }) {
  const pointsRef = useRef();

  // Create 600 plasma particles
  const PARTICLE_COUNT = 600;

  const { positions, velocities, lifetimes, sizes } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = [];
    const lifetimes = new Float32Array(PARTICLE_COUNT);
    const sizes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Spawn near the heat shield (below spacecraft in local space)
      positions[i * 3 + 0] = (Math.random() - 0.5) * 0.15;
      positions[i * 3 + 1] = -0.1 - Math.random() * 0.3; // below spacecraft
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.15;

      // Particles stream UPWARD (spacecraft moves down so wake goes up)
      velocities.push({
        x: (Math.random() - 0.5) * 0.4,
        y: 0.8 + Math.random() * 2.2, // upward wake
        z: (Math.random() - 0.5) * 0.4,
        age: Math.random() * 2.5,     // randomize starting age for continuous stream
        maxAge: 1.5 + Math.random() * 1.5,
      });

      lifetimes[i] = Math.random();
      sizes[i] = 0.04 + Math.random() * 0.12;
    }

    return { positions, velocities, lifetimes, sizes };
  }, []);

  // Pre-build color array
  const colors = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  useFrame((_, delta) => {
    if (!pointsRef.current || heatNorm < 0.01) return;

    const geom = pointsRef.current.geometry;
    const pos = geom.attributes.position.array;
    const col = geom.attributes.color.array;

    const dt = Math.min(delta, 0.05);
    const intensity = heatNorm;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const vel = velocities[i];
      vel.age += dt;

      // Reset particle when lifetime expires
      if (vel.age > vel.maxAge) {
        vel.age = 0;
        vel.maxAge = 1.2 + Math.random() * 1.8;

        // Respawn near heat shield with spread based on velocity
        const spread = 0.05 + Math.random() * 0.08;
        const angle = Math.random() * Math.PI * 2;
        pos[i * 3 + 0] = Math.cos(angle) * spread;
        pos[i * 3 + 1] = -0.08 - Math.random() * 0.15;
        pos[i * 3 + 2] = Math.sin(angle) * spread;

        vel.x = (Math.random() - 0.5) * 0.5;
        vel.y = 0.6 + Math.random() * 2.0;
        vel.z = (Math.random() - 0.5) * 0.5;
      }

      // Integrate position
      pos[i * 3 + 0] += vel.x * dt * intensity;
      pos[i * 3 + 1] += vel.y * dt * intensity;
      pos[i * 3 + 2] += vel.z * dt * intensity;

      // Colour based on age ratio (0=just spawned=white, 1=dying=red/transparent)
      const t = vel.age / vel.maxAge;
      let r, g, b;
      if (t < 0.15) {
        // Core plasma: bright white-yellow
        r = 1.0; g = 0.95; b = 0.8;
      } else if (t < 0.4) {
        // Transition: yellow-orange
        const u = (t - 0.15) / 0.25;
        r = 1.0; g = 0.95 - u * 0.55; b = 0.8 - u * 0.78;
      } else if (t < 0.75) {
        // Wake: deep orange-red
        const u = (t - 0.4) / 0.35;
        r = 1.0 - u * 0.2; g = 0.4 - u * 0.35; b = 0.02;
      } else {
        // Dying embers: dark red fading
        const u = (t - 0.75) / 0.25;
        r = 0.8 - u * 0.7; g = 0.05; b = 0.0;
      }

      col[i * 3 + 0] = r * intensity;
      col[i * 3 + 1] = g * intensity;
      col[i * 3 + 2] = b * intensity;
    }

    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
  });

  if (heatNorm < 0.01) return null;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geom.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  return (
    <points ref={pointsRef} geometry={geom}>
      <pointsMaterial
        vertexColors
        size={0.08}
        transparent
        opacity={Math.min(1, heatNorm * 1.2)}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
