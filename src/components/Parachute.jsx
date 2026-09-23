/**
 * Parachute.jsx – Procedural supersonic disk-gap-band parachute with post-landing deflation.
 *
 * States:
 *   PACKED      → invisible
 *   DEPLOYING   → canopy inflates smoothly from deploymentProgress (0→1)
 *   DEPLOYED    → full canopy with aerodynamic flutter in wind
 *   LANDED      → slow visual deflation: canopy collapses sideways over ~10 s
 *
 * Note: the physics parachuteState is not modified here — only the visual is changed.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const NUM_LINES        = 8;
const CANOPY_RADIUS    = 2.4;
const SUSPENSION_HEIGHT= 4.2;

// Visual deflation time constant (seconds from LANDED moment to fully collapsed)
const DEFLATION_DURATION = 10.0;

export default function Parachute({ simStateRef }) {
  const parachuteGroupRef    = useRef();
  const canopyMeshRef        = useRef();
  const innerCanopyMeshRef   = useRef();
  const linesMeshRef         = useRef();

  // Track when LANDED phase first detected (for deflation timer)
  const landedSince = useRef(null);

  // Procedural suspension lines (apex → canopy rim)
  const linesGeometry = useMemo(() => {
    const positions = [];
    const apex = new THREE.Vector3(0, 0.4, 0);
    for (let i = 0; i < NUM_LINES; i++) {
      const angle = (i / NUM_LINES) * Math.PI * 2;
      positions.push(apex.x, apex.y, apex.z);
      positions.push(
        Math.cos(angle) * CANOPY_RADIUS,
        SUSPENSION_HEIGHT,
        Math.sin(angle) * CANOPY_RADIUS
      );
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geom;
  }, []);

  // Materials
  const canopyMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ff5511', roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide,
  }), []);
  const innerCanopyMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff', roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide,
  }), []);
  const linesMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: '#f0f4f8', transparent: true, opacity: 0.85, linewidth: 1,
  }), []);

  useFrame((_, delta) => {
    if (!parachuteGroupRef.current) return;
    const s = simStateRef?.current;
    if (!s) return;

    const progress = s.parachuteDeploymentProgress || 0;
    const pState   = s.parachuteState || 'PACKED';
    const phase    = s.phase || '';
    const isLanded = phase === 'LANDED' || s.grounded;

    // ── PACKED or not yet deploying ──────────────────────────────────────
    if (pState === 'PACKED' || progress <= 0.001) {
      parachuteGroupRef.current.visible = false;
      landedSince.current = null;
      return;
    }

    parachuteGroupRef.current.visible = true;

    if (!isLanded) {
      // Reset deflation timer whenever we're not landed
      landedSince.current = null;
    }

    // ── LANDED: visual deflation ─────────────────────────────────────────
    if (isLanded) {
      if (landedSince.current === null) landedSince.current = 0;
      landedSince.current += delta;

      // deflation ratio: 0 = fully inflated, 1 = fully collapsed
      const deflation = Math.min(1.0, landedSince.current / DEFLATION_DURATION);

      // Canopy collapses: X/Z shrink inward, Y squashes down
      const scaleX  = progress * (1.0 - deflation * 0.85);
      const scaleY  = Math.max(0.05, progress * (1.0 - deflation));
      const scaleZ  = scaleX;

      canopyMeshRef.current?.scale.set(scaleX, scaleY, scaleZ);
      if (innerCanopyMeshRef.current) {
        innerCanopyMeshRef.current.scale.set(scaleX * 0.98, scaleY * 0.98, scaleZ * 0.98);
      }
      if (linesMeshRef.current) {
        linesMeshRef.current.scale.set(scaleX, scaleY, scaleZ);
        // Tip lines sideways as canopy falls
        linesMeshRef.current.rotation.z = deflation * 0.7;
        linesMeshRef.current.rotation.x = deflation * 0.3;
      }
      // Fade canopy opacity as it deflates
      if (canopyMaterial.transparent !== true) canopyMaterial.transparent = true;
      canopyMaterial.opacity      = Math.max(0.1, 1.0 - deflation * 0.75);
      innerCanopyMaterial.opacity = Math.max(0.05, 1.0 - deflation * 0.85);
      return;
    }

    // ── DEPLOYING / DEPLOYED: normal inflation ───────────────────────────
    // Restore opacity in case we re-run (shouldn't happen but be safe)
    canopyMaterial.opacity      = 1.0;
    innerCanopyMaterial.opacity = 1.0;
    if (linesMeshRef.current) {
      linesMeshRef.current.rotation.set(0, 0, 0);
    }

    const scaleX = Math.max(0.05, progress);
    const scaleY = Math.max(0.10, Math.sin(progress * Math.PI * 0.5));
    const scaleZ = scaleX;

    canopyMeshRef.current?.scale.set(scaleX, scaleY, scaleZ);
    if (innerCanopyMeshRef.current) {
      innerCanopyMeshRef.current.scale.set(scaleX * 0.98, scaleY * 0.98, scaleZ * 0.98);
    }
    if (linesMeshRef.current) {
      linesMeshRef.current.scale.set(scaleX, scaleY, scaleZ);
    }

    // Aerodynamic flutter once fully deployed
    if (canopyMeshRef.current && progress > 0.3) {
      const t = performance.now() * 0.005;
      canopyMeshRef.current.rotation.x = Math.sin(t * 1.8) * 0.04 * (1.1 - progress * 0.3);
      canopyMeshRef.current.rotation.z = Math.cos(t * 2.2) * 0.04 * (1.1 - progress * 0.3);
    }
  });

  return (
    <group ref={parachuteGroupRef} position={[0, 0.9, 0]} visible={false}>
      {/* Suspension Lines */}
      <lineSegments ref={linesMeshRef} geometry={linesGeometry} material={linesMaterial} />

      {/* Canopy dome */}
      <group position={[0, SUSPENSION_HEIGHT, 0]}>
        {/* Outer orange canopy */}
        <mesh ref={canopyMeshRef} material={canopyMaterial} rotation={[Math.PI, 0, 0]} castShadow>
          <sphereGeometry args={[CANOPY_RADIUS, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
        </mesh>
        {/* Inner white lining */}
        <mesh ref={innerCanopyMeshRef} material={innerCanopyMaterial} rotation={[Math.PI, 0, 0]}>
          <sphereGeometry args={[CANOPY_RADIUS * 0.98, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.47]} />
        </mesh>
        {/* Vent ring apex */}
        <mesh position={[0, CANOPY_RADIUS * 0.48, 0]}>
          <torusGeometry args={[0.35, 0.06, 8, 16]} />
          <meshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}
