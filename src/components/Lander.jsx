/**
 * Lander.jsx – Physics-driven 3D spacecraft with deorbit engine plume and glowing heat shield.
 *
 * Visual Features:
 *   - Position updated directly each frame via ref (zero React re-render overhead)
 *   - Deorbit engine plume: active during deorbit burn, pulsing flame cone
 *   - Heat shield: base aeroshell with dynamic emissive glow scaling with Sutton-Graves heat flux
 *   - Autonomous attitude orientation:
 *       • MARS_ORBIT: aligns with orbital velocity vector
 *       • DEORBIT_BURN: pitches retrograde (engine bells facing velocity)
 *       • ATMOSPHERIC_ENTRY: heat shield faces into oncoming airflow
 *   - LANDED state: lander uprights and leg contact points rest on terrain surface
 *
 * Coordinate contract:
 *   Physics y = altitude above Mars datum (metres).
 *   Render  y = physics_y * RENDER_SCALE  (1 Three.js unit = 1 km).
 *   Mars surface datum: physics y = 0  →  render y = 0.
 *
 * Lander geometry (local space, Y-up):
 *   +Y top:   sensor mast tip  ≈ +1.2
 *   Body ctr: 0
 *   -Y base:  heat shield       ≈ -0.525
 *   Foot pad centres:           ≈ -0.75  (local Y)
 *   Foot pad bottom contact:    ≈ -0.775 (local Y, half pad thickness 0.025)
 *
 *   → LEG_CONTACT_OFFSET = 0.775 render units (positive → amount to lift body above surface)
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RENDER_SCALE, ORBIT_ALTITUDE } from '../simulation/physics/constants.js';
import { getTerrainHeight } from '../simulation/landingSite/terrain.js';
import { ELEV_EXAGGERATION } from './MarsSurface.jsx';
import Parachute from './Parachute';

// Distance from group origin (body centre) to the bottom of the foot pads (render units)
const LEG_CONTACT_OFFSET = 0.775;

// Leg configurations: symmetric outward spread
const LEG_CONFIGS = [
  { x:  0.8, z:  0.8, rotZ:  0.55, rotX: -0.55 },
  { x: -0.8, z:  0.8, rotZ: -0.55, rotX: -0.55 },
  { x:  0.8, z: -0.8, rotZ:  0.55, rotX:  0.55 },
  { x: -0.8, z: -0.8, rotZ: -0.55, rotX:  0.55 },
];

// ELEV_EXAGGERATION imported from MarsSurface.jsx (single source of truth)

export default function Lander({ simStateRef }) {
  const groupRef           = useRef();
  const plumeRef           = useRef();
  const heatShieldMeshRef  = useRef();
  const heatLightRef       = useRef();

  // Materials
  const bodyMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#d0d8e2', metalness: 0.7, roughness: 0.3,
  }), []);

  const legMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#8a9099', metalness: 0.5, roughness: 0.5,
  }), []);

  const engineMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#333333', metalness: 0.9, roughness: 0.2,
  }), []);

  const mastMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#c8d0d8', metalness: 0.7, roughness: 0.3,
  }), []);

  // Heat shield material (dynamic emissive color & intensity)
  const heatShieldMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a1818',
    roughness: 0.6,
    metalness: 0.2,
    emissive: new THREE.Color('#000000'),
    emissiveIntensity: 0,
  }), []);

  // Engine plume flame material
  const plumeMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ff8822',
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
  }), []);

  const plumeCoreMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
  }), []);

  // Per-frame physics sync
  useFrame(() => {
    if (!groupRef.current) return;
    const s = simStateRef?.current;
    if (!s) return;

    // ── Position ────────────────────────────────────────────────────────────
    const physX = s.x || 0;
    const physZ = s.z || 0;
    const physY = s.y !== undefined ? s.y : ORBIT_ALTITUDE;

    let renderY = physY * RENDER_SCALE;

    if (s.phase === 'LANDED' || s.grounded) {
      // ── LANDED: contact point must rest on terrain surface ───────────────
      // 1. Sample terrain elevation at the lander's XZ physics coords (metres)
      const terrainElevM = getTerrainHeight(physX, physZ);
      // 2. Convert terrain elevation to render units WITH the same exaggeration
      //    that MarsSurface uses so both mesh and lander agree.
      const terrainRenderY = terrainElevM * RENDER_SCALE * ELEV_EXAGGERATION;
      // 3. Lander body centre = terrain surface + leg contact offset
      renderY = terrainRenderY + LEG_CONTACT_OFFSET;
    }

    groupRef.current.position.set(
      physX * RENDER_SCALE,
      renderY,
      physZ * RENDER_SCALE,
    );

    // ── Attitude orientation ─────────────────────────────────────────────
    if (s.phase === 'LANDED' || s.grounded) {
      // Upright: Y-axis points up, no rotation
      groupRef.current.quaternion.slerp(new THREE.Quaternion(), 0.08);
    } else {
      const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy + s.vz * s.vz);
      if (speed > 1e-3) {
        const velDir = new THREE.Vector3(s.vx, s.vy, s.vz).normalize();

        if (s.phase === 'DEORBIT_BURN') {
          const retroDir = velDir.clone().negate();
          const targetQuat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            retroDir
          );
          groupRef.current.quaternion.slerp(targetQuat, 0.1);
        } else if (s.phase === 'ATMOSPHERIC_ENTRY' || s.phase === 'PARACHUTE_DESCENT') {
          const targetQuat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, -1, 0),
            velDir
          );
          groupRef.current.quaternion.slerp(targetQuat, 0.1);
        } else {
          // Orbit flight: align nose forward along velocity
          const targetQuat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(1, 0, 0),
            velDir
          );
          groupRef.current.quaternion.slerp(targetQuat, 0.05);
        }
      }
    }

    // ── Deorbit Engine Plume Visuals ─────────────────────────────────────
    if (plumeRef.current) {
      if (s.enginesActive) {
        plumeRef.current.visible = true;
        const t = performance.now() * 0.03;
        const flicker = 1.0 + Math.sin(t) * 0.25;
        plumeRef.current.scale.set(1.0, flicker, 1.0);
      } else {
        plumeRef.current.visible = false;
      }
    }

    // ── Heat Shield Glow Visuals ─────────────────────────────────────────
    const intensity = s.heatIntensity || 0;
    if (heatShieldMaterial) {
      if (intensity > 0.01) {
        if (intensity < 0.4) {
          heatShieldMaterial.emissive.setRGB(intensity * 2.5, intensity * 0.5, 0);
          heatShieldMaterial.emissiveIntensity = intensity * 2.0;
        } else {
          heatShieldMaterial.emissive.setRGB(1.0, 0.3 + intensity * 0.6, intensity * 0.4);
          heatShieldMaterial.emissiveIntensity = 1.5 + intensity * 2.5;
        }
      } else {
        heatShieldMaterial.emissive.setRGB(0, 0, 0);
        heatShieldMaterial.emissiveIntensity = 0;
      }
    }

    if (heatLightRef.current) {
      heatLightRef.current.intensity = intensity * 3.5;
    }
  });

  return (
    <group ref={groupRef} position={[0, ORBIT_ALTITUDE * RENDER_SCALE, 0]}>
      {/* Main fuselage body */}
      <mesh material={bodyMaterial} castShadow>
        <boxGeometry args={[1.2, 0.8, 1.2]} />
      </mesh>

      {/* Heat Shield (base plate facing underside / entry direction) */}
      <mesh
        ref={heatShieldMeshRef}
        position={[0, -0.45, 0]}
        material={heatShieldMaterial}
        castShadow
      >
        <cylinderGeometry args={[0.95, 0.75, 0.15, 16]} />
      </mesh>

      {/* Plasma ionization light beneath heat shield */}
      <pointLight
        ref={heatLightRef}
        position={[0, -0.8, 0]}
        color="#ff6611"
        intensity={0}
        distance={20}
      />

      {/* Deorbit Main Engine Bell */}
      <mesh position={[0, -0.65, 0]} material={engineMaterial} castShadow>
        <coneGeometry args={[0.3, 0.5, 12]} />
      </mesh>

      {/* Engine Exhaust Plume (visible during DEORBIT_BURN) */}
      <group ref={plumeRef} visible={false} position={[0, -0.9, 0]}>
        {/* Outer flame cone */}
        <mesh position={[0, -0.6, 0]} material={plumeMaterial}>
          <coneGeometry args={[0.35, 1.3, 12]} />
        </mesh>
        {/* Inner bright core */}
        <mesh position={[0, -0.4, 0]} material={plumeCoreMaterial}>
          <coneGeometry args={[0.18, 0.8, 8]} />
        </mesh>
        {/* Plume thrust point light */}
        <pointLight position={[0, -0.6, 0]} color="#ff7722" intensity={4} distance={25} />
      </group>

      {/* Avionics / Sensor Mast (top center) */}
      <mesh position={[0, 0.75, 0]} material={mastMaterial} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 6]} />
      </mesh>

      {/* Sensor Head */}
      <mesh position={[0, 1.1, 0]} material={mastMaterial} castShadow>
        <sphereGeometry args={[0.1, 8, 8]} />
      </mesh>

      {/* Solar/Telemetry Antenna Dish */}
      <mesh position={[0.4, 0.5, -0.4]} rotation={[0.4, 0.2, 0]} material={mastMaterial}>
        <cylinderGeometry args={[0.2, 0.02, 0.05, 12]} />
      </mesh>

      {/* Four Landing Legs
          Each leg: starts at body edge (0.7 × normalized outward), angled down.
          Pad centre: at 1.1 × normalized outward, y = -0.75 (render).
          Pad bottom: y = -0.775 (pad half-thickness 0.025).
          → LEG_CONTACT_OFFSET = 0.775 (matches constant above) */}
      {LEG_CONFIGS.map((leg, i) => (
        <mesh
          key={i}
          position={[leg.x * 0.7, -0.3, leg.z * 0.7]}
          rotation={[leg.rotX, 0, leg.rotZ]}
          material={legMaterial}
          castShadow
        >
          <cylinderGeometry args={[0.04, 0.04, 1.1, 6]} />
        </mesh>
      ))}

      {/* Foot Pads — bottom face sits at y = -0.75 - 0.025 = -0.775 */}
      {LEG_CONFIGS.map((leg, i) => (
        <mesh
          key={`pad-${i}`}
          position={[leg.x * 1.1, -0.75, leg.z * 1.1]}
          material={legMaterial}
          castShadow
        >
          <cylinderGeometry args={[0.12, 0.12, 0.05, 8]} />
        </mesh>
      ))}

      {/* Supersonic Parachute System (Phase 3A) */}
      <Parachute simStateRef={simStateRef} />
    </group>
  );
}
