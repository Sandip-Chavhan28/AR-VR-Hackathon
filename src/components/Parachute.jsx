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

const NUM_LINES         = 16;
const CANOPY_RADIUS     = 3.2;
const SUSPENSION_HEIGHT = 7.0;

// Visual deflation time constant (seconds from LANDED moment to fully collapsed)
const DEFLATION_DURATION = 10.0;

export default function Parachute({ simStateRef, isJettisoned = false }) {
  const parachuteGroupRef    = useRef();
  const canopyMeshRef        = useRef();
  const linesMeshRef         = useRef();

  // Track when LANDED phase first detected (for deflation timer)
  const landedSince = useRef(null);

  // A shallow lathed gore gives the DGB canopy a real bowl profile instead of a sphere cap.
  const canopyProfile = useMemo(() => [
    new THREE.Vector2(0.06, 0.78),
    new THREE.Vector2(0.72, 0.72),
    new THREE.Vector2(1.55, 0.52),
    new THREE.Vector2(2.35, 0.22),
    new THREE.Vector2(CANOPY_RADIUS, 0),
  ], []);

  // Procedural suspension lines (apex -> canopy rim)
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
  const canopyMaterials = useMemo(() => [
    new THREE.MeshStandardMaterial({ color: '#e64b1a', roughness: 0.78, metalness: 0.05, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: '#f2eee4', roughness: 0.86, metalness: 0.02, side: THREE.DoubleSide }),
  ], []);
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
    const isSep    = !!s.backshellSeparated;

    // Visibility rules based on staging
    if (!isJettisoned && isSep) {
      parachuteGroupRef.current.visible = false;
      return;
    }
    if (isJettisoned && !isSep) {
      parachuteGroupRef.current.visible = false;
      return;
    }

    // ── PACKED or not yet deploying ──────────────────────────────────────
    if (pState === 'PACKED') {
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
      if (linesMeshRef.current) {
        linesMeshRef.current.scale.set(scaleX, scaleY, scaleZ);
        // Tip lines sideways as canopy falls
        linesMeshRef.current.rotation.z = deflation * 0.7;
        linesMeshRef.current.rotation.x = deflation * 0.3;
      }
      // Fade canopy opacity as it deflates
      canopyMaterials.forEach((material) => {
        material.transparent = true;
        material.opacity = Math.max(0.1, 1.0 - deflation * 0.75);
      });
      return;
    }

    // ── DEPLOYING / DEPLOYED: progressive extraction & inflation ─────────────
    canopyMaterials.forEach((material) => {
      material.transparent = false;
      material.opacity = 1.0;
    });
    if (linesMeshRef.current) {
      linesMeshRef.current.rotation.set(0, 0, 0);
    }

    // Stage 1: Line unspooling (progress 0.0 -> 0.35)
    // Stage 2: Canopy radial billowing & full inflation (progress 0.35 -> 1.0)
    const lineExtension = Math.min(1.0, Math.max(0.08, progress * 2.8));
    const canopyRadial = progress < 0.25
      ? 0.08 + progress * 0.3
      : Math.pow(progress, 1.35);
    const canopySquash = Math.max(0.12, Math.sin(progress * Math.PI * 0.5));

    const scaleX = Math.max(0.05, canopyRadial);
    const scaleY = canopySquash;
    const scaleZ = scaleX;

    canopyMeshRef.current?.scale.set(scaleX, scaleY, scaleZ);
    if (linesMeshRef.current) {
      linesMeshRef.current.scale.set(scaleX, lineExtension, scaleZ);
    }

    // Aerodynamic flutter and atmospheric wind reaction
    if (canopyMeshRef.current && progress > 0.2) {
      const t = performance.now() * 0.005;
      const windDriftX = (s.wind?.x || 0) * 0.003;
      const windDriftZ = (s.wind?.z || 0) * 0.003;
      canopyMeshRef.current.rotation.x = Math.sin(t * 1.8) * 0.035 * (1.1 - progress * 0.25) + windDriftZ;
      canopyMeshRef.current.rotation.z = Math.cos(t * 2.2) * 0.035 * (1.1 - progress * 0.25) + windDriftX;
    }
  });

  return (
    <group ref={parachuteGroupRef} position={[0, 0.9, 0]} scale={1.25} visible={false}>
      {/* Suspension Lines */}
      <lineSegments ref={linesMeshRef} geometry={linesGeometry} material={linesMaterial} />

      {/* Alternating DGB gore panels with a visible gap between each panel */}
      <group position={[0, SUSPENSION_HEIGHT, 0]}>
        <group ref={canopyMeshRef}>
          {Array.from({ length: NUM_LINES }, (_, index) => {
            const panelAngle = (index / NUM_LINES) * Math.PI * 2;
            const panelGap = 0.018;
            const panelWidth = (Math.PI * 2 / NUM_LINES) - panelGap;
            return (
              <mesh
                key={`gore-${index}`}
                geometry={new THREE.LatheGeometry(canopyProfile, 8, panelAngle + panelGap * 0.5, panelWidth)}
                material={canopyMaterials[index % 2]}
                rotation={[Math.PI, 0, 0]}
                castShadow
              />
            );
          })}
        </group>
        <mesh position={[0, 0.78, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.23, 0.055, 8, 24]} />
          <meshStandardMaterial color="#f2eee4" metalness={0.15} roughness={0.65} />
        </mesh>
      </group>
    </group>
  );
}
