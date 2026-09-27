/**
 * LandingSiteGrid.jsx – Subtle technical landing safety grid, scanning wave, and target markers.
 *
 * Requirements (item 9):
 *   - Subtle scanning effect over the terrain during analysis
 *   - Proportional target markers (matching landing clearance footprint, not kilometers wide)
 *   - UNSAFE TARGET: crisp technical red marker on terrain with beacon
 *   - SAFE TARGET: clean green/cyan target ring + highlighted circular landing zone
 *   - Cells follow the shared MOLA/procedural render-height sampler
 *   - Technical, semi-transparent aesthetic (not overwhelming the Martian terrain)
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RENDER_SCALE, JEZERO_TARGET_X, JEZERO_TARGET_Z } from '../simulation/physics/constants.js';
import { getLandingSurfaceRenderHeight, MARS_SURFACE_FRAME } from './marsSurfaceFrame.js';

const CELL_GAP          = 0.88;
const GRID_VISUAL_LIFT  = 0.000003; // 3 mm lift above terrain

function terrainRenderPos(physX, physZ) {
  const rx = physX * RENDER_SCALE;
  const rz = physZ * RENDER_SCALE;
  const ry = getLandingSurfaceRenderHeight(physX, physZ) + GRID_VISUAL_LIFT;
  return [rx, ry, rz];
}

export default function LandingSiteGrid({ simStateRef }) {
  const groupRef         = useRef();
  const scanRingRef      = useRef();
  const initBeaconRef    = useRef();
  const selectBeaconRef  = useRef();
  const landingZoneRef   = useRef();

  useFrame(() => {
    if (!groupRef.current) return;
    const s = simStateRef?.current;
    const alt = s?.altitude ?? 0;
    const isTerminalOrLanded =
      s?.phase === 'LANDED' ||
      s?.phase === 'TOUCHDOWN' ||
      s?.phase === 'SKY_CRANE' ||
      s?.phase === 'FLYAWAY' ||
      s?.phase === 'SURFACE_OPS' ||
      s?.grounded;

    if (!s?.landingSiteAnalysis || isTerminalOrLanded || alt < 350 || alt > 7000) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    // Smooth fade between 1200m and 350m so grid seamlessly disappears before touchdown
    const fade = Math.min(1.0, Math.max(0.0, (alt - 350) / 850));

    // Anchor group to fixed Jezero landing site datum
    const refX = (s?.guidanceRefX !== undefined ? s.guidanceRefX : JEZERO_TARGET_X) * RENDER_SCALE;
    const refZ = (s?.guidanceRefZ !== undefined ? s.guidanceRefZ : JEZERO_TARGET_Z) * RENDER_SCALE;
    groupRef.current.position.copy(MARS_SURFACE_FRAME.origin);
    groupRef.current.quaternion.copy(MARS_SURFACE_FRAME.rotation);

    const t = performance.now() * 0.001;

    // Expanding technical scan ring animation (expanding from 0 to 100m radius)
    if (scanRingRef.current) {
      const scanPhase = (t * 0.5) % 1.0; // 2-second loop
      const scanRadius = scanPhase * 0.12; // up to 120m in render units
      scanRingRef.current.scale.set(scanRadius, scanRadius, 1);
      if (scanRingRef.current.material) {
        scanRingRef.current.material.opacity = (1.0 - scanPhase) * 0.45 * fade;
      }
    }

    if (safeMat) safeMat.opacity = 0.32 * fade;
    if (cautionMat) cautionMat.opacity = 0.28 * fade;
    if (unsafeMat) unsafeMat.opacity = 0.35 * fade;

    // Pulse markers subtly
    if (initBeaconRef.current) {
      const p = 1.0 + Math.sin(t * 3.5) * 0.08;
      initBeaconRef.current.scale.set(p, 1, p);
    }
    if (selectBeaconRef.current) {
      const p = 1.0 + Math.cos(t * 2.8) * 0.06;
      selectBeaconRef.current.scale.set(p, 1, p);
    }
    if (landingZoneRef.current) {
      const p = 1.0 + Math.sin(t * 2.0) * 0.04;
      landingZoneRef.current.scale.set(p, p, 1);
    }
  });

  const analysis   = simStateRef?.current?.landingSiteAnalysis;
  const grid       = analysis?.grid || [];
  const initTarget = analysis?.initialTarget;
  const selTarget  = analysis?.selectedTarget;

  // ── Merged cell geometry for high performance ────────────────────────────
  const { safeGeo, cautionGeo, unsafeGeo } = useMemo(() => {
    if (grid.length === 0) return { safeGeo: null, cautionGeo: null, unsafeGeo: null };

    const cellPhysSize = 10.0;
    const cellRenderW  = cellPhysSize * RENDER_SCALE * CELL_GAP;

    const buildGeo = (cells) => {
      if (cells.length === 0) return null;
      const geo   = new THREE.BufferGeometry();
      const verts = [];
      const idxs  = [];
      let   base  = 0;

      for (const cell of cells) {
        const [cx, cy, cz] = terrainRenderPos(cell.x, cell.z);
        const hw = cellRenderW / 2;

        verts.push(
          cx - hw, cy, cz - hw,
          cx + hw, cy, cz - hw,
          cx + hw, cy, cz + hw,
          cx - hw, cy, cz + hw
        );
        idxs.push(base, base + 1, base + 2, base, base + 2, base + 3);
        base += 4;
      }

      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(idxs);
      geo.computeVertexNormals();
      return geo;
    };

    return {
      safeGeo:    buildGeo(grid.filter(c => c.status === 'SAFE')),
      cautionGeo: buildGeo(grid.filter(c => c.status === 'CAUTION')),
      unsafeGeo:  buildGeo(grid.filter(c => c.status === 'UNSAFE')),
    };
  }, [grid]);

  // Subtle, semi-transparent technical grid materials
  const safeMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#00e676', transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false,
  }), []);

  const cautionMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ffd600', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
  }), []);

  const unsafeMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ff1744', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
  }), []);

  const initPos = initTarget ? terrainRenderPos(initTarget.x, initTarget.z) : null;
  const selPos  = selTarget  ? terrainRenderPos(selTarget.x,  selTarget.z)  : null;

  return (
    <group ref={groupRef} visible={false}>
      {/* Dynamic expanding scan wave centered at origin */}
      <mesh
        ref={scanRingRef}
        position={[0, GRID_VISUAL_LIFT + 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.95, 1.0, 64]} />
        <meshBasicMaterial
          color="#00e5ff"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Safety Classification Cells */}
      {safeGeo    && <mesh geometry={safeGeo}    material={safeMat}    />}
      {cautionGeo && <mesh geometry={cautionGeo} material={cautionMat} />}
      {unsafeGeo  && <mesh geometry={unsafeGeo}  material={unsafeMat}  />}

      {/* ── Initial Target Marker (UNSAFE / HAZARD REJECTED) ─────────── */}
      {initPos && (
        <group ref={initBeaconRef} position={initPos}>
          {/* Ground hazard ring (proportioned to ~24m diameter = 0.024 render units) */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.015, 0.024, 32]} />
            <meshBasicMaterial color="#ff1744" side={THREE.DoubleSide} transparent opacity={0.90} />
          </mesh>
          {/* Hazard cross */}
          <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
            <planeGeometry args={[0.003, 0.038]} />
            <meshBasicMaterial color="#ff1744" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 4]}>
            <planeGeometry args={[0.003, 0.038]} />
            <meshBasicMaterial color="#ff1744" side={THREE.DoubleSide} />
          </mesh>
          {/* Slender vertical beacon ray (visible from altitude) */}
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.001, 0.001, 0.30, 8]} />
            <meshBasicMaterial color="#ff3344" transparent opacity={0.75} />
          </mesh>
        </group>
      )}

      {/* ── Selected Target Marker (AUTONOMOUSLY SELECTED / SAFE) ─────── */}
      {selPos && (
        <group ref={selectBeaconRef} position={selPos}>
          {/* Highlighted safe landing footprint circle (~20m radius) */}
          <mesh ref={landingZoneRef} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.018, 0.028, 48]} />
            <meshBasicMaterial
              color="#00e676"
              side={THREE.DoubleSide}
              transparent
              opacity={0.85}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Bullseye target center disc */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.007, 24]} />
            <meshBasicMaterial color="#00e676" side={THREE.DoubleSide} transparent opacity={0.90} />
          </mesh>
          {/* Reticle tick marks */}
          <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.002, 0.046]} />
            <meshBasicMaterial color="#00e676" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <planeGeometry args={[0.002, 0.046]} />
            <meshBasicMaterial color="#00e676" side={THREE.DoubleSide} />
          </mesh>
          {/* Slender vertical safe beacon ray */}
          <mesh position={[0, 0.20, 0]}>
            <cylinderGeometry args={[0.0012, 0.0012, 0.40, 8]} />
            <meshBasicMaterial color="#00ff88" transparent opacity={0.85} />
          </mesh>
        </group>
      )}
    </group>
  );
}
