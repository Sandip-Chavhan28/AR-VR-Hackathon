/**
 * MartianDustFX.jsx – Localized Rover Wheel-Contact Dust FX.
 *
 * Visual Features:
 *   - Briefly active after the integrator reports first wheel contact
 *   - Six small puffs follow their individual terrain contact heights
 *   - Subtle wind drift and a 3.5-second fade
 *   - No pre-touchdown cloud or large radial blast
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RENDER_SCALE, JEZERO_TARGET_X, JEZERO_TARGET_Z } from '../simulation/physics/constants.js';
import { ROVER_WHEEL_COORDS } from './RoverModel';
import { getLandingSurfaceRenderHeight, MARS_SURFACE_FRAME, surfaceToWorld } from './marsSurfaceFrame.js';

const NUM_DUST = 42;

export default function MartianDustFX({ simStateRef }) {
  const groupRef = useRef();
  const dustPointsRef = useRef();
  const dustRingMeshRef = useRef();
  const wheelPuffMeshRef = useRef();

  // Procedural particles
  const [positions, velocities, ages] = useMemo(() => {
    const pos = new Float32Array(NUM_DUST * 3);
    const vel = new Float32Array(NUM_DUST * 3);
    const ag = new Float32Array(NUM_DUST);

    for (let i = 0; i < NUM_DUST; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = (0.35 + Math.random() * 0.6) * RENDER_SCALE;
      pos[i * 3 + 0] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = (0.02 + Math.random() * 0.10) * RENDER_SCALE;
      pos[i * 3 + 2] = Math.sin(angle) * radius;

      const speed = (0.08 + Math.random() * 0.22) * RENDER_SCALE;
      vel[i * 3 + 0] = Math.cos(angle) * speed;
      vel[i * 3 + 1] = (0.03 + Math.random() * 0.10) * RENDER_SCALE;
      vel[i * 3 + 2] = Math.sin(angle) * speed;

      ag[i] = Math.random();
    }
    return [pos, vel, ag];
  }, []);

  const dustGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    return geo;
  }, [positions]);

  const dustMaterial = useMemo(() => new THREE.PointsMaterial({
    color: '#b85a38',
    size: 2.5,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }), []);

  const ringMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#8b3d22',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  // Merged geometry for all 6 localized wheel-touchdown regolith puffs (1 draw call)
  const wheelPuffGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = [];
    const indices = [];
    let vertIdx = 0;

    ROVER_WHEEL_COORDS.forEach((wh) => {
      const cx = wh.x * RENDER_SCALE;
      const cz = wh.z * RENDER_SCALE;
      const r = 0.0007;
      const segs = 16;
      const center = vertIdx++;
      positions.push(cx, 0.000002, cz);

      for (let s = 0; s <= segs; s++) {
        const theta = (s / segs) * Math.PI * 2;
        positions.push(cx + Math.cos(theta) * r, 0.000002, cz + Math.sin(theta) * r);
        if (s > 0) {
          indices.push(center, vertIdx - 1, vertIdx);
        }
        vertIdx++;
      }
    });

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    return geo;
  }, []);

  const wheelPuffMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#b85a38',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);

  useFrame((_, delta) => {
    const s = simStateRef?.current;
    if (!s || !groupRef.current) return;

    const isLanded = s.grounded || s.phase === 'LANDED';
    const isTouchdownTrigger = !!s.touchdownDustTrigger || s.touchdownState === 'FIRST_CONTACT' || s.touchdownState === 'SETTLING';
    const contactTimestamp = s.firstContactTime ?? s.settlingStartTime ?? s.touchdownTime;
    const settleTime = isTouchdownTrigger || isLanded
      ? (Number.isFinite(contactTimestamp) ? s.elapsed - contactTimestamp : -1)
      : -1;
    const isSettling = settleTime >= 0 && settleTime < 3.5;

    if (!isSettling) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;

    // Anchor group to terrain surface underneath the lander
    const landingRefX = s.guidanceRefX !== undefined ? s.guidanceRefX : JEZERO_TARGET_X;
    const landingRefZ = s.guidanceRefZ !== undefined ? s.guidanceRefZ : JEZERO_TARGET_Z;
    const localX = (s.x || 0) - landingRefX;
    const localZ = (s.z || 0) - landingRefZ;
    const py = getLandingSurfaceRenderHeight(localX, localZ);
    surfaceToWorld(
      localX * RENDER_SCALE,
      py + 0.000005,
      localZ * RENDER_SCALE,
      groupRef.current.position,
    );
    groupRef.current.quaternion.copy(MARS_SURFACE_FRAME.rotation);

    const puffPositions = wheelPuffGeometry.attributes.position;
    let puffVertex = 0;
    for (const wheel of ROVER_WHEEL_COORDS) {
      const wheelY = getLandingSurfaceRenderHeight(localX + wheel.x, localZ + wheel.z) - py + 0.000004;
      for (let point = 0; point <= 16; point++) {
        puffPositions.array[puffVertex * 3 + 1] = wheelY;
        puffVertex++;
      }
    }
    puffPositions.needsUpdate = true;

    // Intensity: scales with proximity during descent, bursts and fades smoothly after touchdown
    const fade = Math.max(0, 1.0 - settleTime / 3.5);
    const activeIntensity = fade * 0.45;
    const ringScale = 0.4 + (settleTime / 3.5) * 0.8;

    if (dustRingMeshRef.current) {
      dustRingMeshRef.current.scale.set(ringScale, ringScale, 1);
      ringMaterial.opacity = activeIntensity * 0.18;
    }

    if (dustPointsRef.current) {
      dustMaterial.opacity = activeIntensity * 0.48;
      const posAttr = dustGeometry.attributes.position;
      const arr = posAttr.array;

      const wx = (s.wind?.x || 0) * 0.003 * RENDER_SCALE;
      const wz = (s.wind?.z || 0) * 0.003 * RENDER_SCALE;

      for (let i = 0; i < NUM_DUST; i++) {
        ages[i] += delta;
        if (ages[i] > 1.0) {
          ages[i] = 0;
          const angle = Math.random() * Math.PI * 2;
          const radius = (0.35 + Math.random() * 0.6) * RENDER_SCALE;
          arr[i * 3 + 0] = Math.cos(angle) * radius;
          arr[i * 3 + 1] = 0.02 * RENDER_SCALE;
          arr[i * 3 + 2] = Math.sin(angle) * radius;
        } else {
          arr[i * 3 + 0] += (velocities[i * 3 + 0] + wx) * delta;
          arr[i * 3 + 1] += velocities[i * 3 + 1] * delta;
          arr[i * 3 + 2] += (velocities[i * 3 + 2] + wz) * delta;
        }
      }
      posAttr.needsUpdate = true;
    }

    // Localized 6-wheel regolith contact puffs during touchdown settlement
    if (wheelPuffMeshRef.current) {
      if (isSettling) {
        wheelPuffMeshRef.current.visible = true;
        wheelPuffMaterial.opacity = fade * 0.28;
        const sP = 1.0 + (settleTime / 3.5) * 0.8;
        wheelPuffMeshRef.current.scale.set(sP, 1, sP);
      } else {
        wheelPuffMeshRef.current.visible = false;
      }
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Faint, localized ground dust halo */}
      <mesh ref={dustRingMeshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.45 * RENDER_SCALE, 1.4 * RENDER_SCALE, 24]} />
        {ringMaterial && <primitive object={ringMaterial} attach="material" />}
      </mesh>

      {/* Billowing Dust Particles */}
      <points ref={dustPointsRef} geometry={dustGeometry} material={dustMaterial} />

      {/* Localized 6-Wheel Regolith Touchdown Dust Puffs */}
      <mesh ref={wheelPuffMeshRef} geometry={wheelPuffGeometry} material={wheelPuffMaterial} rotation={[-Math.PI / 2, 0, 0]} visible={false} />
    </group>
  );
}
