/**
 * StarField.jsx – Subtle, cinematic deep-space star background.
 *
 * Requirements (item 4):
 *   - Very dark blue/black space backdrop
 *   - Sparse stars (support the scene, don't dominate)
 *   - Varied star sizes and subtle brightness/color variation (warm white, pale blue, faint amber)
 *   - Placed on a distant celestial sphere (r = 14,000 km) outside Mars (r = 3,389 km)
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';

export default function StarField({ count = 1200 }) {
  const [positions, colors, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz  = new Float32Array(count);

    // Star color palette in linear space
    const palette = [
      new THREE.Color(0.85, 0.90, 1.00), // pale blue-white (hot stars)
      new THREE.Color(0.95, 0.92, 0.85), // warm white (Sun-like)
      new THREE.Color(1.00, 0.82, 0.70), // faint amber / reddish
      new THREE.Color(0.75, 0.80, 0.90), // dim distant blue
    ];

    // Deterministic pseudo-random sequence for stability
    let seed = 42;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < count; i++) {
      // Distribute stars on a large sphere around the celestial origin
      const theta = rnd() * Math.PI * 2;
      const phi   = Math.acos(2 * rnd() - 1);
      const r     = 12000 + rnd() * 4000; // 12,000 - 16,000 units (far outside Mars)

      pos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      // Varied star sizes: most are small, few are brighter anchor stars
      const isBright = rnd() > 0.92;
      sz[i] = isBright ? (1.2 + rnd() * 1.0) : (0.4 + rnd() * 0.5);

      // Subtle color variation
      const baseCol = palette[Math.floor(rnd() * palette.length)];
      const brightness = isBright ? (0.7 + rnd() * 0.3) : (0.25 + rnd() * 0.45);

      col[i * 3 + 0] = baseCol.r * brightness;
      col[i * 3 + 1] = baseCol.g * brightness;
      col[i * 3 + 2] = baseCol.b * brightness;
    }

    return [pos, col, sz];
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors, 3]} />
        <bufferAttribute attach="attributes-size"     args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={1.4}
        sizeAttenuation={false}
        transparent
        opacity={0.88}
        depthWrite={false}
      />
    </points>
  );
}
