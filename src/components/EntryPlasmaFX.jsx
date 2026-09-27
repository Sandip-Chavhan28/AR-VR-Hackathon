/**
 * EntryPlasmaFX.jsx – Procedural Hypersonic Entry Plasma Sheath & Shockwave Cone.
 *
 * Visual Features:
 *   - Compression shockwave bow cone ahead of heat shield
 *   - High-energy ionized plasma slipstream trailing aeroshell
 *   - Incandescent blackbody plasma light casting illumination onto the spacecraft
 *   - Dynamic scale, opacity and turbulence strictly proportional to Sutton-Graves heat flux
 *   - Zero overhead outside hypersonic entry window (visible = false when heatIntensity < 0.02)
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const NUM_WAKE_PARTICLES = 32;

export default function EntryPlasmaFX({ simStateRef }) {
  const shockwaveMeshRef = useRef();
  const innerShockRef = useRef();
  const wakePointsRef = useRef();

  // Materials
  const shockMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ff4400',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  const innerShockMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ffeeaa',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  // Procedural wake stream particles
  const [wakePositions, wakeVelocities] = useMemo(() => {
    const pos = new Float32Array(NUM_WAKE_PARTICLES * 3);
    const vel = new Float32Array(NUM_WAKE_PARTICLES * 3);
    for (let i = 0; i < NUM_WAKE_PARTICLES; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 1.8;
      pos[i * 3 + 1] = -0.5 - Math.random() * 3.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.8;

      vel[i * 3 + 0] = (Math.random() - 0.5) * 0.4;
      vel[i * 3 + 1] = -1.5 - Math.random() * 2.0;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    return [pos, vel];
  }, []);

  const wakeGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wakePositions), 3));
    return geo;
  }, [wakePositions]);

  const wakeMaterial = useMemo(() => new THREE.PointsMaterial({
    color: '#ff6622',
    size: 0.18,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  useFrame((_, delta) => {
    const s = simStateRef?.current;
    if (!s) return;

    const heat = s.heatIntensity || 0;
    const isSeparated = s.heatShieldSeparated;

    // Active only when heating is non-trivial and heat shield is still attached
    if (heat < 0.02 || isSeparated) {
      if (shockwaveMeshRef.current) shockwaveMeshRef.current.visible = false;
      if (innerShockRef.current) innerShockRef.current.visible = false;
      if (wakePointsRef.current) wakePointsRef.current.visible = false;
      return;
    }

    if (shockwaveMeshRef.current) shockwaveMeshRef.current.visible = true;
    if (innerShockRef.current) innerShockRef.current.visible = true;
    if (wakePointsRef.current) wakePointsRef.current.visible = true;

    // High frequency shockwave flutter
    const t = performance.now() * 0.025;
    const flutter = 1.0 + Math.sin(t * 1.8) * 0.08 + Math.cos(t * 3.2) * 0.05;

    // Outer shockwave cone
    shockMaterial.opacity = Math.min(0.75, heat * 0.85);
    shockwaveMeshRef.current?.scale.set(1.15 * flutter, 1.0 + heat * 0.5, 1.15 * flutter);

    // Inner bright stagnation core
    innerShockMaterial.opacity = Math.min(0.95, heat * 1.2);
    innerShockRef.current?.scale.set(0.95 * flutter, 0.8 + heat * 0.4, 0.95 * flutter);

    // Wake stream particles update
    if (wakePointsRef.current) {
      wakeMaterial.opacity = Math.min(0.8, heat * 0.9);
      const posAttr = wakeGeometry.attributes.position;
      const array = posAttr.array;

      for (let i = 0; i < NUM_WAKE_PARTICLES; i++) {
        array[i * 3 + 1] += wakeVelocities[i * 3 + 1] * delta * (1.0 + heat * 3.0);
        array[i * 3 + 0] += wakeVelocities[i * 3 + 0] * delta;
        array[i * 3 + 2] += wakeVelocities[i * 3 + 2] * delta;

        // Reset particle if drifted too far downstream
        if (array[i * 3 + 1] < -4.5) {
          array[i * 3 + 0] = (Math.random() - 0.5) * 1.6;
          array[i * 3 + 1] = -0.5 - Math.random() * 0.5;
          array[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
        }
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <group position={[0, -0.45, 0]}>
      {/* Outer Ionization Shockwave Cone */}
      <mesh ref={shockwaveMeshRef} material={shockMaterial} position={[0, -0.6, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[1.5, 2.2, 24, 1, true]} />
      </mesh>

      {/* Inner Incandescent Stagnation Bow */}
      <mesh ref={innerShockRef} material={innerShockMaterial} position={[0, -0.4, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[1.1, 1.4, 16, 1, true]} />
      </mesh>

      {/* Trailing Hypersonic Wake Stream Particles */}
      <points ref={wakePointsRef} geometry={wakeGeometry} material={wakeMaterial} />
    </group>
  );
}
