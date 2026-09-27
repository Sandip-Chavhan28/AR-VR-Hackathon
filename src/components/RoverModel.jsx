/**
 * RoverModel.jsx – Authentic High-Fidelity Procedural Mars 2020 Perseverance Rover for Three.js.
 *
 * Engineering Reference: NASA/JPL Mars 2020 Perseverance Rover Specifications
 *   - Overall Dimensions: Length ~3.0m, Width ~2.7m, Height ~2.2m
 *   - Wheels: 6 wheels, 52.5 cm diameter, 48 curved chevron traction grousers/cleats per wheel
 *   - Suspension: Rocker-Bogie kinematic architecture with differential cross-bar
 *   - Steering: 4 corner steering pivots (FL, FR, RL, RR) with steering actuators
 *   - Chassis: Warm Electronics Box (WEB) with beveled body & golden MLI thermal belly
 *   - Equipment Deck: Titanium plating, calibration targets, Hazcams, bridle lugs
 *   - Mast: Remote Sensing Mast (RSM) with SuperCam laser telescope & dual Mastcam-Z stereo zoom cameras
 *   - Antennas: Steerable High-Gain Antenna (HGA) dish & Low-Gain Antenna (LGA) omni spire
 *   - Power: Multi-Mission Radioisotope Thermoelectric Generator (MMRTG) with 8 graphite radiator fins
 *   - Robotic Arm: 5-DOF ~2.1m articulated arm with heavy science turret (coring drill, PIXL, SHERLOC, WATSON)
 *   - Modes: Normal, Cutaway/X-Ray (internal avionics visible), Exploded View (subassembly separation)
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import {
  ROVER_WHEEL_CONTACT_Y,
  ROVER_WHEEL_DIAMETER,
  ROVER_WHEEL_WIDTH,
  ROVER_WHEEL_COORDS,
} from '../simulation/physics/constants.js';

// ── ENGINEERING DIMENSIONS & RE-EXPORTS ──────────────────────────────────────
export {
  ROVER_WHEEL_CONTACT_Y,
  ROVER_WHEEL_DIAMETER,
  ROVER_WHEEL_WIDTH,
  ROVER_WHEEL_COORDS,
};

// Sky Crane 4-Point Bridle Cable Attachment Hardpoints on Rover Deck
export const ROVER_BRIDLE_LUGS = [
  { id: 'FL', x: -0.45, y: 0.235, z:  0.55 },
  { id: 'FR', x:  0.45, y: 0.235, z:  0.55 },
  { id: 'AL', x: -0.40, y: 0.235, z: -0.65 },
  { id: 'AR', x:  0.40, y: 0.235, z: -0.65 },
];

/**
 * Procedural Geometry Generator for 48 Curved Chevron Traction Grousers.
 * Precomputes all 48 cleats into a single compact BufferGeometry (1 draw call per wheel).
 */
function createWheelGrouserGeometry() {
  const NUM_CLEATS = 48;
  const R_BASE = 0.2625;        // Outer rim radius
  const H_CLEAT = 0.016;        // Radial height of grouser cleat
  const T_CLEAT = 0.007;        // Tangential thickness
  const W_HALF = 0.11;          // Half-width across wheel tread (total width 0.22m)
  const SWEEP_Z = 0.022;        // Chevron V-sweep

  const positions = [];
  const normals = [];
  const indices = [];

  let vertOffset = 0;

  for (let i = 0; i < NUM_CLEATS; i++) {
    const phi = (i / NUM_CLEATS) * Math.PI * 2;
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);

    // Radial normal vector (Y, Z plane)
    const nrY = cosP;
    const nrZ = sinP;

    // Tangent vector along rim circumference
    const tgY = -sinP;
    const tgZ = cosP;

    // Chevron has 3 points across wheel width:
    // Left edge (x = -W_HALF), Center apex (x = 0), Right edge (x = +W_HALF)
    // Left Wing (x from -W_HALF to 0):
    // 8 vertices of the swept box
    const x0 = -W_HALF;
    const x1 = 0.0;
    const zOffset0 = -SWEEP_Z;
    const zOffset1 = 0.0;

    // Vertices for left wing:
    // Bottom inner vertices (at R_BASE)
    const v0 = [x0, (R_BASE) * nrY + (zOffset0 - T_CLEAT * 0.5) * tgY, (R_BASE) * nrZ + (zOffset0 - T_CLEAT * 0.5) * tgZ];
    const v1 = [x0, (R_BASE) * nrY + (zOffset0 + T_CLEAT * 0.5) * tgY, (R_BASE) * nrZ + (zOffset0 + T_CLEAT * 0.5) * tgZ];
    const v2 = [x1, (R_BASE) * nrY + (zOffset1 + T_CLEAT * 0.5) * tgY, (R_BASE) * nrZ + (zOffset1 + T_CLEAT * 0.5) * tgZ];
    const v3 = [x1, (R_BASE) * nrY + (zOffset1 - T_CLEAT * 0.5) * tgY, (R_BASE) * nrZ + (zOffset1 - T_CLEAT * 0.5) * tgZ];

    // Top outer vertices (at R_BASE + H_CLEAT)
    const v4 = [x0, (R_BASE + H_CLEAT) * nrY + (zOffset0 - T_CLEAT * 0.5) * tgY, (R_BASE + H_CLEAT) * nrZ + (zOffset0 - T_CLEAT * 0.5) * tgZ];
    const v5 = [x0, (R_BASE + H_CLEAT) * nrY + (zOffset0 + T_CLEAT * 0.5) * tgY, (R_BASE + H_CLEAT) * nrZ + (zOffset0 + T_CLEAT * 0.5) * tgZ];
    const v6 = [x1, (R_BASE + H_CLEAT) * nrY + (zOffset1 + T_CLEAT * 0.5) * tgY, (R_BASE + H_CLEAT) * nrZ + (zOffset1 + T_CLEAT * 0.5) * tgZ];
    const v7 = [x1, (R_BASE + H_CLEAT) * nrY + (zOffset1 - T_CLEAT * 0.5) * tgY, (R_BASE + H_CLEAT) * nrZ + (zOffset1 - T_CLEAT * 0.5) * tgZ];

    // Push 8 vertices
    const baseIndexL = vertOffset;
    const lVerts = [v0, v1, v2, v3, v4, v5, v6, v7];
    for (const v of lVerts) {
      positions.push(v[0], v[1], v[2]);
      normals.push(nrY * 0.2, nrY, nrZ); // approximate radial normal
    }
    vertOffset += 8;

    // 6 faces (12 triangles) for Left Wing
    const lIndices = [
      // Top face
      baseIndexL + 4, baseIndexL + 5, baseIndexL + 6,  baseIndexL + 4, baseIndexL + 6, baseIndexL + 7,
      // Front face
      baseIndexL + 1, baseIndexL + 5, baseIndexL + 6,  baseIndexL + 1, baseIndexL + 6, baseIndexL + 2,
      // Back face
      baseIndexL + 0, baseIndexL + 3, baseIndexL + 7,  baseIndexL + 0, baseIndexL + 7, baseIndexL + 4,
      // Left outer cap
      baseIndexL + 0, baseIndexL + 4, baseIndexL + 5,  baseIndexL + 0, baseIndexL + 5, baseIndexL + 1,
    ];
    indices.push(...lIndices);

    // Right Wing (x from 0 to +W_HALF)
    const rx0 = 0.0;
    const rx1 = W_HALF;
    const rzOffset0 = 0.0;
    const rzOffset1 = -SWEEP_Z;

    const rv0 = [rx0, (R_BASE) * nrY + (rzOffset0 - T_CLEAT * 0.5) * tgY, (R_BASE) * nrZ + (rzOffset0 - T_CLEAT * 0.5) * tgZ];
    const rv1 = [rx0, (R_BASE) * nrY + (rzOffset0 + T_CLEAT * 0.5) * tgY, (R_BASE) * nrZ + (rzOffset0 + T_CLEAT * 0.5) * tgZ];
    const rv2 = [rx1, (R_BASE) * nrY + (rzOffset1 + T_CLEAT * 0.5) * tgY, (R_BASE) * nrZ + (rzOffset1 + T_CLEAT * 0.5) * tgZ];
    const rv3 = [rx1, (R_BASE) * nrY + (rzOffset1 - T_CLEAT * 0.5) * tgY, (R_BASE) * nrZ + (rzOffset1 - T_CLEAT * 0.5) * tgZ];

    const rv4 = [rx0, (R_BASE + H_CLEAT) * nrY + (rzOffset0 - T_CLEAT * 0.5) * tgY, (R_BASE + H_CLEAT) * nrZ + (rzOffset0 - T_CLEAT * 0.5) * tgZ];
    const rv5 = [rx0, (R_BASE + H_CLEAT) * nrY + (rzOffset0 + T_CLEAT * 0.5) * tgY, (R_BASE + H_CLEAT) * nrZ + (rzOffset0 + T_CLEAT * 0.5) * tgZ];
    const rv6 = [rx1, (R_BASE + H_CLEAT) * nrY + (rzOffset1 + T_CLEAT * 0.5) * tgY, (R_BASE + H_CLEAT) * nrZ + (rzOffset1 + T_CLEAT * 0.5) * tgZ];
    const rv7 = [rx1, (R_BASE + H_CLEAT) * nrY + (rzOffset1 - T_CLEAT * 0.5) * tgY, (R_BASE + H_CLEAT) * nrZ + (rzOffset1 - T_CLEAT * 0.5) * tgZ];

    const baseIndexR = vertOffset;
    const rVerts = [rv0, rv1, rv2, rv3, rv4, rv5, rv6, rv7];
    for (const v of rVerts) {
      positions.push(v[0], v[1], v[2]);
      normals.push(nrY * 0.2, nrY, nrZ);
    }
    vertOffset += 8;

    const rIndices = [
      // Top face
      baseIndexR + 4, baseIndexR + 5, baseIndexR + 6,  baseIndexR + 4, baseIndexR + 6, baseIndexR + 7,
      // Front face
      baseIndexR + 1, baseIndexR + 5, baseIndexR + 6,  baseIndexR + 1, baseIndexR + 6, baseIndexR + 2,
      // Back face
      baseIndexR + 0, baseIndexR + 3, baseIndexR + 7,  baseIndexR + 0, baseIndexR + 7, baseIndexR + 4,
      // Right outer cap
      baseIndexR + 2, baseIndexR + 6, baseIndexR + 7,  baseIndexR + 2, baseIndexR + 7, baseIndexR + 3,
    ];
    indices.push(...rIndices);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

export default function RoverModel({
  viewMode = 'normal',            // 'normal' | 'cutaway' | 'exploded'
  explodedFactor = 0.0,           // 0.0 (compact) to 1.0 (fully exploded)
  steeringAngles = { FL: 0, FR: 0, RL: 0, RR: 0 }, // Steering angles in radians
  wheelOffsets = null,            // Optional { FL, FR, ML, MR, RL, RR } vertical suspension offsets in meters
  wheelRotation = 0,              // Axle roll rotation in radians
  rockerBogieAngles = null,       // Optional { rockerL, rockerR, bogieL, bogieR, diffBar } articulation angles
  onSelectComponent,
  selectedComponent,
}) {
  const isCutaway = viewMode === 'cutaway';
  const isExploded = viewMode === 'exploded';
  const ef = isExploded ? Math.max(0.1, explodedFactor || 0.65) : 0.0;

  // ── 1. AUTHENTIC AEROSPACE PBR MATERIALS ────────────────────────────────────
  const mats = useMemo(() => {
    return {
      // Authentic Titanium-honeycomb equipment deck plate with dark slate-grey finish (never washes out to white)
      deck: new THREE.MeshStandardMaterial({
        color: '#464f5d',
        metalness: 0.50,
        roughness: 0.60,
        transparent: isCutaway,
        opacity: isCutaway ? 0.32 : 1.0,
      }),
      // Cutaway chassis frame
      chassisFrame: new THREE.MeshStandardMaterial({
        color: '#334155',
        metalness: 0.85,
        roughness: 0.25,
      }),
      // Avionics internal boxes
      avionicsBox: new THREE.MeshStandardMaterial({
        color: '#1e293b',
        metalness: 0.70,
        roughness: 0.30,
      }),
      batteryPack: new THREE.MeshStandardMaterial({
        color: '#1d4ed8',
        metalness: 0.60,
        roughness: 0.40,
      }),
      // Titanium struts & linkages
      titanium: new THREE.MeshStandardMaterial({
        color: '#475569',
        metalness: 0.82,
        roughness: 0.28,
      }),
      // Dark composite structural fixtures
      darkComposite: new THREE.MeshStandardMaterial({
        color: '#1e2229',
        metalness: 0.45,
        roughness: 0.50,
      }),
      // Gold Multi-Layer Insulation (MLI) thermal belly foil
      goldFoil: new THREE.MeshStandardMaterial({
        color: '#d4a024',
        metalness: 0.88,
        roughness: 0.22,
        transparent: isCutaway,
        opacity: isCutaway ? 0.25 : 1.0,
      }),
      // Metallic aerospace aluminum (wheel bodies, rims, grousers)
      wheelAluminum: new THREE.MeshStandardMaterial({
        color: '#828e9e',
        metalness: 0.82,
        roughness: 0.30,
      }),
      wheelRim: new THREE.MeshStandardMaterial({
        color: '#2d3748',
        metalness: 0.88,
        roughness: 0.22,
      }),
      hubBrass: new THREE.MeshStandardMaterial({
        color: '#94a3b8',
        metalness: 0.90,
        roughness: 0.18,
      }),
      // Masthead & camera bodies
      mastBody: new THREE.MeshStandardMaterial({
        color: '#e2e8f0',
        metalness: 0.50,
        roughness: 0.35,
      }),
      // Optical anti-reflective glass lenses
      lensDark: new THREE.MeshStandardMaterial({
        color: '#050811',
        metalness: 0.95,
        roughness: 0.05,
      }),
      superCamOptic: new THREE.MeshStandardMaterial({
        color: '#0284c7',
        emissive: '#0369a1',
        emissiveIntensity: 0.45,
        metalness: 0.92,
        roughness: 0.08,
      }),
      // High-gain antenna dish
      antennaDish: new THREE.MeshStandardMaterial({
        color: '#f1f5f9',
        metalness: 0.55,
        roughness: 0.35,
      }),
      // MMRTG graphite radiator fins
      mmrtgGraphite: new THREE.MeshStandardMaterial({
        color: '#181c22',
        metalness: 0.40,
        roughness: 0.60,
      }),
      // Science turret metal
      turretMetal: new THREE.MeshStandardMaterial({
        color: '#334155',
        metalness: 0.80,
        roughness: 0.22,
      }),
      // Calibration targets
      calibRed: new THREE.MeshBasicMaterial({ color: '#ef4444' }),
      calibGreen: new THREE.MeshBasicMaterial({ color: '#22c55e' }),
      calibBlue: new THREE.MeshBasicMaterial({ color: '#3b82f6' }),
      calibWhite: new THREE.MeshBasicMaterial({ color: '#f8fafc' }),
      calibYellow: new THREE.MeshBasicMaterial({ color: '#eab308' }),
    };
  }, [isCutaway]);

  // ── 2. PRECOMPUTED GEOMETRIES ───────────────────────────────────────────────
  const geoms = useMemo(() => {
    // 48 Curved Chevron Traction Grousers (precalculated single buffer)
    const grouserCleats = createWheelGrouserGeometry();

    // Wheel drum (diameter = 0.525m -> radius = 0.2625m, width = 0.24m)
    const tireDrum = new THREE.CylinderGeometry(0.2625, 0.2625, 0.24, 32, 1, true);
    tireDrum.rotateZ(Math.PI / 2);

    // Inboard & Outboard Rim Sidewalls
    const rimWallL = new THREE.RingGeometry(0.16, 0.2625, 32);
    rimWallL.rotateY(Math.PI / 2);
    const rimWallR = new THREE.RingGeometry(0.16, 0.2625, 32);
    rimWallR.rotateY(-Math.PI / 2);

    // Wheel Hub
    const hub = new THREE.CylinderGeometry(0.085, 0.085, 0.26, 20);
    hub.rotateZ(Math.PI / 2);

    // Curved titanium flexure spoke
    const spoke = new THREE.CylinderGeometry(0.007, 0.007, 0.19, 8);

    // Steering actuator knuckle
    const steerActuator = new THREE.CylinderGeometry(0.048, 0.048, 0.14, 16);

    return {
      grouserCleats,
      tireDrum,
      rimWallL,
      rimWallR,
      hub,
      spoke,
      steerActuator,
      chassisBody: new THREE.BoxGeometry(1.30, 0.36, 1.85),
      deckPlate: new THREE.BoxGeometry(1.36, 0.02, 1.90),
      bellyPan: new THREE.BoxGeometry(1.22, 0.22, 1.70),
      suspensionTube: new THREE.CylinderGeometry(0.024, 0.024, 1.0, 10),
    };
  }, []);

  // 6 spiral curved spoke angles per wheel
  const spokeAngles = useMemo(() => [
    0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3,
  ], []);
  const wheelMountRefs = useRef([]);
  const steeringRefs = useRef([]);
  const axleRefs = useRef([]);
  const rockerRefs = useRef([]);
  const bogieRefs = useRef([]);
  const differentialRef = useRef();

  useFrame(() => {
    for (let i = 0; i < ROVER_WHEEL_COORDS.length; i++) {
      const wheel = ROVER_WHEEL_COORDS[i];
      const suspension = wheelOffsets?.[wheel.id] || 0;
      const mount = wheelMountRefs.current[i];
      if (mount) {
        const explodeX = wheel.x > 0 ? ef * 0.55 : -ef * 0.55;
        mount.position.set(wheel.x + explodeX, -0.2775 + suspension, wheel.z);
      }
      const steering = steeringRefs.current[i];
      if (steering) steering.rotation.y = wheel.steerable ? (steeringAngles?.[wheel.id] || 0) : 0;
      const axle = axleRefs.current[i];
      if (axle) axle.rotation.x = wheelRotation;
    }

    const angles = rockerBogieAngles;
    if (differentialRef.current) differentialRef.current.rotation.z = angles?.diffBar || 0;
    if (rockerRefs.current[0]) rockerRefs.current[0].rotation.x = angles?.rockerL || 0;
    if (rockerRefs.current[1]) rockerRefs.current[1].rotation.x = angles?.rockerR || 0;
    if (bogieRefs.current[0]) bogieRefs.current[0].rotation.x = angles?.bogieL || 0;
    if (bogieRefs.current[1]) bogieRefs.current[1].rotation.x = angles?.bogieR || 0;
  });

  return (
    <group name="RoverRoot">

      {/* ── 1. MAIN CHASSIS: WARM ELECTRONICS BOX (WEB) ────────────────────── */}
      <group name="MainChassis">
        {/* Upper chassis main body */}
        <mesh position={[0, 0.06, 0.02]} geometry={geoms.chassisBody} material={mats.deck} castShadow receiveShadow />

        {/* Rover Equipment Deck (RED) Titanium Top Deck Plate with perimeter lip */}
        <mesh position={[0, 0.245, 0.02]} geometry={geoms.deckPlate} material={mats.deck} receiveShadow />

        {/* Gold MLI Thermal Insulation Belly Pan (faceted lower hull) */}
        <mesh position={[0, -0.16, 0.00]} geometry={geoms.bellyPan} material={mats.goldFoil} castShadow />

        {/* Tapered bottom keel structure */}
        <mesh position={[0, -0.28, -0.05]} material={mats.goldFoil}>
          <boxGeometry args={[0.95, 0.08, 1.40]} />
        </mesh>

        {/* Radiator Louver Vents on Left & Right Flanks */}
        <mesh position={[-0.66, 0.06, -0.20]} material={mats.darkComposite}>
          <boxGeometry args={[0.02, 0.18, 0.65]} />
        </mesh>
        <mesh position={[0.66, 0.06, -0.20]} material={mats.darkComposite}>
          <boxGeometry args={[0.02, 0.18, 0.65]} />
        </mesh>

        {/* RIMFAX Ground-Penetrating Radar Antenna (aft underbelly plate) */}
        <group position={[0, -0.32, -0.72]} rotation={[0.18, 0, 0]}>
          <mesh material={mats.darkComposite}>
            <boxGeometry args={[0.55, 0.025, 0.30]} />
          </mesh>
          <mesh position={[0, -0.015, 0]} material={mats.titanium}>
            <boxGeometry args={[0.48, 0.012, 0.24]} />
          </mesh>
        </group>

        {/* Sample Caching System (SCS) Underside Carousel Access Hatch */}
        <group position={[0, -0.28, 0.42]}>
          <mesh material={mats.turretMetal}>
            <cylinderGeometry args={[0.18, 0.18, 0.04, 20]} />
          </mesh>
          <mesh position={[0, -0.022, 0]} material={mats.darkComposite}>
            <cylinderGeometry args={[0.09, 0.09, 0.01, 16]} />
          </mesh>
        </group>

        {/* Front Hazcams (Dual Stereo Pair on Front Bulkhead) */}
        <group position={[-0.42, 0.00, 0.96]} rotation={[0.44, 0, 0]}>
          <mesh material={mats.darkComposite}>
            <boxGeometry args={[0.15, 0.07, 0.06]} />
          </mesh>
          <mesh position={[-0.045, 0, 0.032]} material={mats.lensDark}>
            <cylinderGeometry args={[0.020, 0.020, 0.02, 12]} />
          </mesh>
          <mesh position={[0.045, 0, 0.032]} material={mats.lensDark}>
            <cylinderGeometry args={[0.020, 0.020, 0.02, 12]} />
          </mesh>
        </group>
        <group position={[0.42, 0.00, 0.96]} rotation={[0.44, 0, 0]}>
          <mesh material={mats.darkComposite}>
            <boxGeometry args={[0.15, 0.07, 0.06]} />
          </mesh>
          <mesh position={[-0.045, 0, 0.032]} material={mats.lensDark}>
            <cylinderGeometry args={[0.020, 0.020, 0.02, 12]} />
          </mesh>
          <mesh position={[0.045, 0, 0.032]} material={mats.lensDark}>
            <cylinderGeometry args={[0.020, 0.020, 0.02, 12]} />
          </mesh>
        </group>

        {/* Rear Hazcams (Stereo Pair on Aft Bulkhead) */}
        <group position={[0, 0.06, -0.92]} rotation={[-0.45, Math.PI, 0]}>
          <mesh material={mats.darkComposite}>
            <boxGeometry args={[0.16, 0.07, 0.06]} />
          </mesh>
          <mesh position={[-0.048, 0, 0.032]} material={mats.lensDark}>
            <cylinderGeometry args={[0.020, 0.020, 0.02, 12]} />
          </mesh>
          <mesh position={[0.048, 0, 0.032]} material={mats.lensDark}>
            <cylinderGeometry args={[0.020, 0.020, 0.02, 12]} />
          </mesh>
        </group>

        {/* Top Deck Radiometric Calibration Target with Sundial Gnomon Post */}
        <group position={[-0.22, 0.258, -0.42]}>
          <mesh material={mats.darkComposite}>
            <cylinderGeometry args={[0.08, 0.08, 0.012, 20]} />
          </mesh>
          <mesh position={[-0.028, 0.008, -0.028]} material={mats.calibRed}>
            <cylinderGeometry args={[0.016, 0.016, 0.006, 10]} />
          </mesh>
          <mesh position={[0.028, 0.008, -0.028]} material={mats.calibGreen}>
            <cylinderGeometry args={[0.016, 0.016, 0.006, 10]} />
          </mesh>
          <mesh position={[-0.028, 0.008, 0.028]} material={mats.calibBlue}>
            <cylinderGeometry args={[0.016, 0.016, 0.006, 10]} />
          </mesh>
          <mesh position={[0.028, 0.008, 0.028]} material={mats.calibYellow}>
            <cylinderGeometry args={[0.016, 0.016, 0.006, 10]} />
          </mesh>
          {/* Central shadow post / gnomon */}
          <mesh position={[0, 0.035, 0]} material={mats.titanium}>
            <cylinderGeometry args={[0.004, 0.004, 0.06, 8]} />
          </mesh>
        </group>

        {/* 4 Sky Crane Bridle Cable Hoist Lugs (heavy-duty titanium attachment points) */}
        {ROVER_BRIDLE_LUGS.map((lug) => (
          <mesh key={lug.id} position={[lug.x, lug.y, lug.z]} material={mats.titanium}>
            <cylinderGeometry args={[0.028, 0.028, 0.045, 10]} />
          </mesh>
        ))}

        {/* Internal Structural Frame & Avionics (Visible in Cutaway & Exploded View) */}
        {(isCutaway || isExploded) && (
          <group name="InternalAvionics" position={[0, 0.06 + ef * 0.25, 0.02]}>
            {/* Structural aluminum honeycomb internal bulkheads */}
            <mesh material={mats.chassisFrame}>
              <boxGeometry args={[1.20, 0.30, 0.03]} />
            </mesh>
            <mesh position={[0, 0, 0.45]} material={mats.chassisFrame}>
              <boxGeometry args={[1.20, 0.30, 0.03]} />
            </mesh>
            <mesh position={[0, 0, -0.45]} material={mats.chassisFrame}>
              <boxGeometry args={[1.20, 0.30, 0.03]} />
            </mesh>
            {/* RAD750 Primary Radiation-Hardened Flight Computer */}
            <mesh position={[-0.30, 0.02, 0.15]} material={mats.avionicsBox}>
              <boxGeometry args={[0.35, 0.22, 0.40]} />
            </mesh>
            {/* Lithium-ion Rechargeable Battery Pack */}
            <mesh position={[0.30, 0.00, -0.15]} material={mats.batteryPack}>
              <boxGeometry args={[0.32, 0.24, 0.45]} />
            </mesh>
            {/* Power Distribution Unit (PDU) & UHF Transceiver */}
            <mesh position={[0, 0.04, -0.10]} material={mats.avionicsBox}>
              <boxGeometry args={[0.38, 0.16, 0.28]} />
            </mesh>
          </group>
        )}
      </group>


      {/* ── 2. REMOTE SENSING MAST (RSM) ────────────────────────────────────── */}
      <group
        name="RemoteSensingMast"
        position={[-0.48, 0.245 + ef * 0.40, 0.58 + ef * 0.25]}
      >
        {/* Mast Mount Pedestal on Front-Left Deck */}
        <mesh position={[0, 0.04, 0]} material={mats.darkComposite}>
          <cylinderGeometry args={[0.075, 0.088, 0.09, 16]} />
        </mesh>

        {/* Main Vertical Tubular Titanium Mast Pylon */}
        <mesh position={[0, 0.62, 0]} material={mats.mastBody} castShadow>
          <cylinderGeometry args={[0.042, 0.048, 1.10, 16]} />
        </mesh>

        {/* Diagonal Gusset Support Brace to Deck */}
        <mesh position={[0.12, 0.30, -0.09]} rotation={[0.32, 0, -0.38]} material={mats.titanium}>
          <cylinderGeometry args={[0.016, 0.016, 0.65, 8]} />
        </mesh>

        {/* Masthead Sensor Assembly Gimbal Head (Azimuth & Elevation) */}
        <group position={[0, 1.20, 0]}>
          {/* Central yolk gimbal box */}
          <mesh material={mats.mastBody} castShadow>
            <boxGeometry args={[0.26, 0.17, 0.20]} />
          </mesh>

          {/* SuperCam Laser Telescope Assembly (center top) */}
          <group position={[0, 0.05, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            {/* Main telescope barrel */}
            <mesh material={mats.darkComposite}>
              <cylinderGeometry args={[0.052, 0.056, 0.16, 20]} />
            </mesh>
            {/* Blue sapphire coated optical aperture lens */}
            <mesh position={[0, 0.082, 0]} material={mats.superCamOptic}>
              <circleGeometry args={[0.045, 20]} />
            </mesh>
            {/* Laser emitter collar & acoustic microphone */}
            <mesh position={[0, 0.04, 0.065]} material={mats.titanium}>
              <cylinderGeometry args={[0.012, 0.012, 0.04, 10]} />
            </mesh>
          </group>

          {/* Mastcam-Z Stereo Zoom Dual Cameras (Left & Right Eyes) */}
          <group position={[-0.10, -0.01, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh material={mats.darkComposite}>
              <cylinderGeometry args={[0.032, 0.034, 0.13, 16]} />
            </mesh>
            <mesh position={[0, 0.066, 0]} material={mats.lensDark}>
              <circleGeometry args={[0.026, 16]} />
            </mesh>
          </group>
          <group position={[0.10, -0.01, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh material={mats.darkComposite}>
              <cylinderGeometry args={[0.032, 0.034, 0.13, 16]} />
            </mesh>
            <mesh position={[0, 0.066, 0]} material={mats.lensDark}>
              <circleGeometry args={[0.026, 16]} />
            </mesh>
          </group>

          {/* Navcams Stereo Pair (below Mastcam-Z) */}
          <mesh position={[-0.06, -0.065, 0.11]} rotation={[Math.PI / 2, 0, 0]} material={mats.lensDark}>
            <cylinderGeometry args={[0.016, 0.016, 0.03, 12]} />
          </mesh>
          <mesh position={[0.06, -0.065, 0.11]} rotation={[Math.PI / 2, 0, 0]} material={mats.lensDark}>
            <cylinderGeometry args={[0.016, 0.016, 0.03, 12]} />
          </mesh>

          {/* MEDA Wind Sensor Booms (Boom 1 lateral, Boom 2 forward) */}
          <mesh position={[-0.20, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.titanium}>
            <cylinderGeometry args={[0.006, 0.006, 0.18, 6]} />
          </mesh>
          <mesh position={[-0.29, 0.02, 0]} material={mats.darkComposite}>
            <cylinderGeometry args={[0.016, 0.016, 0.03, 8]} />
          </mesh>
          <mesh position={[0, 0.02, 0.20]} rotation={[Math.PI / 2, 0, 0]} material={mats.titanium}>
            <cylinderGeometry args={[0.006, 0.006, 0.16, 6]} />
          </mesh>
          <mesh position={[0, 0.02, 0.28]} material={mats.darkComposite}>
            <cylinderGeometry args={[0.016, 0.016, 0.03, 8]} />
          </mesh>
        </group>
      </group>


      {/* ── 3. HIGH-GAIN & LOW-GAIN ANTENNAS ─────────────────────────────────── */}
      <group
        name="HighGainAntenna"
        position={[0.42, 0.245 + ef * 0.30, -0.42 - ef * 0.30]}
      >
        <mesh position={[0, 0.05, 0]} material={mats.darkComposite}>
          <cylinderGeometry args={[0.05, 0.06, 0.10, 16]} />
        </mesh>
        {/* 2-axis azimuth-elevation gimbal drive */}
        <group position={[0, 0.15, 0]} rotation={[0.38, 0.30, 0]}>
          <mesh position={[0, 0.06, 0]} material={mats.titanium}>
            <cylinderGeometry args={[0.022, 0.022, 0.12, 10]} />
          </mesh>
          {/* Hexagonal/Parabolic Dish Reflector */}
          <group position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh material={mats.antennaDish} castShadow>
              <cylinderGeometry args={[0.24, 0.04, 0.045, 20]} />
            </mesh>
            {/* Feed horn tripod */}
            <mesh position={[0, 0.06, 0]} material={mats.darkComposite}>
              <cylinderGeometry args={[0.018, 0.018, 0.07, 10]} />
            </mesh>
            <mesh position={[0, 0.095, 0]} material={mats.titanium}>
              <coneGeometry args={[0.024, 0.035, 12]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Low-Gain Antenna (LGA) omnidirectional spire */}
      <group name="LowGainAntenna" position={[0.54, 0.245, -0.68]}>
        <mesh position={[0, 0.20, 0]} material={mats.titanium}>
          <cylinderGeometry args={[0.008, 0.016, 0.40, 10]} />
        </mesh>
        <mesh position={[0, 0.40, 0]} material={mats.darkComposite}>
          <sphereGeometry args={[0.018, 10, 10]} />
        </mesh>
      </group>


      {/* ── 4. MMRTG NUCLEAR POWER GENERATOR ─────────────────────────────────── */}
      <group
        name="MMRTG"
        position={[0, 0.10, -0.92 - ef * 0.45]}
        rotation={[0.35, 0, 0]}
      >
        {/* Tubular Titanium Support Truss */}
        <mesh position={[-0.18, -0.08, 0.10]} rotation={[-0.32, 0, 0.25]} material={mats.titanium}>
          <cylinderGeometry args={[0.018, 0.018, 0.28, 8]} />
        </mesh>
        <mesh position={[0.18, -0.08, 0.10]} rotation={[-0.32, 0, -0.25]} material={mats.titanium}>
          <cylinderGeometry args={[0.018, 0.018, 0.28, 8]} />
        </mesh>

        {/* Central Cylindrical Generator Core */}
        <mesh material={mats.mmrtgGraphite} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.17, 0.58, 20]} />
        </mesh>

        {/* 8 Radial Graphite Cooling / Radiator Fins (tip-to-tip span 64 cm) */}
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i / 8) * Math.PI;
          return (
            <group key={`mmrtg-fin-${i}`} rotation={[0, 0, angle]}>
              <mesh material={mats.mmrtgGraphite} castShadow>
                <boxGeometry args={[0.62, 0.016, 0.54]} />
              </mesh>
            </group>
          );
        })}

        {/* Rounded End Domes */}
        <mesh position={[0, 0, -0.30]} material={mats.darkComposite}>
          <sphereGeometry args={[0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        </mesh>
        <mesh position={[0, 0, 0.30]} rotation={[Math.PI, 0, 0]} material={mats.darkComposite}>
          <sphereGeometry args={[0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        </mesh>
      </group>


      {/* ── 5. 5-DOF ROBOTIC ARM & SCIENCE TURRET (~2.1m Reach) ──────────────── */}
      <group
        name="RoboticArm"
        position={[0.48 + ef * 0.35, 0.245, 0.68 + ef * 0.40]}
      >
        {/* Shoulder Azimuth Pedestal on Front-Right Deck */}
        <mesh position={[0, 0.05, 0]} material={mats.darkComposite}>
          <cylinderGeometry args={[0.075, 0.088, 0.10, 16]} />
        </mesh>

        {/* Shoulder Joint & Upper Arm Boom (stowed across front bulkhead in cradle) */}
        <group position={[0, 0.10, 0]} rotation={[0.08, -0.38, -0.12]}>
          <mesh material={mats.turretMetal}>
            <sphereGeometry args={[0.055, 14, 14]} />
          </mesh>
          <mesh position={[-0.24, -0.10, 0.18]} rotation={[0.42, 0, 1.15]} material={mats.titanium}>
            <cylinderGeometry args={[0.030, 0.030, 0.58, 12]} />
          </mesh>

          {/* Elbow Joint & Forearm Boom */}
          <group position={[-0.45, -0.20, 0.32]} rotation={[-0.22, 0.78, 0]}>
            <mesh material={mats.turretMetal}>
              <cylinderGeometry args={[0.048, 0.048, 0.09, 12]} />
            </mesh>
            <mesh position={[0.16, -0.05, 0.10]} rotation={[0.22, 0, -1.05]} material={mats.titanium}>
              <cylinderGeometry args={[0.028, 0.028, 0.48, 12]} />
            </mesh>

            {/* 3-Axis Wrist Joint & Science Turret (docked securely in travel latch) */}
            <group position={[0.35, -0.10, 0.18]} rotation={[0.32, -0.25, 0]}>
              {/* Heavy Turret Structural Housing */}
              <mesh material={mats.turretMetal} castShadow>
                <boxGeometry args={[0.20, 0.15, 0.20]} />
              </mesh>

              {/* Rotary Percussive Coring Drill Mechanism */}
              <group position={[0.08, -0.03, 0.10]} rotation={[Math.PI / 2, 0, 0]}>
                {/* Motor housing */}
                <mesh material={mats.turretMetal}>
                  <cylinderGeometry args={[0.042, 0.042, 0.20, 16]} />
                </mesh>
                {/* Drill chuck & carbide-tipped coring bit */}
                <mesh position={[0, 0.12, 0]} material={mats.titanium}>
                  <cylinderGeometry args={[0.014, 0.022, 0.08, 10]} />
                </mesh>
                {/* Contact stabilizer tines */}
                <mesh position={[-0.03, 0.13, 0]} material={mats.titanium}>
                  <boxGeometry args={[0.006, 0.07, 0.006]} />
                </mesh>
                <mesh position={[0.03, 0.13, 0]} material={mats.titanium}>
                  <boxGeometry args={[0.006, 0.07, 0.006]} />
                </mesh>
              </group>

              {/* PIXL (Planetary Instrument for X-ray Lithochemistry) Head */}
              <group position={[-0.08, 0.03, 0.09]}>
                <mesh material={mats.darkComposite}>
                  <boxGeometry args={[0.065, 0.09, 0.10]} />
                </mesh>
                <mesh position={[0, -0.025, 0.052]} material={mats.lensDark}>
                  <circleGeometry args={[0.018, 12]} />
                </mesh>
              </group>

              {/* SHERLOC Deep-UV Spectrometer & WATSON Context Imager */}
              <group position={[0, 0.08, -0.02]}>
                <mesh material={mats.turretMetal}>
                  <boxGeometry args={[0.13, 0.065, 0.13]} />
                </mesh>
                {/* WATSON camera barrel with LED illuminator ring */}
                <mesh position={[0, 0.045, 0.045]} material={mats.lensDark}>
                  <cylinderGeometry args={[0.016, 0.016, 0.03, 10]} />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>


      {/* ── 6. ROCKER-BOGIE KINEMATIC SUSPENSION ─────────────────────────────── */}
      <group name="RockerBogieSuspension">
        {/* Front Transverse Differential Cross-Bar */}
        <group ref={differentialRef} position={[0, 0.20, 0.82]} rotation={[0, 0, (rockerBogieAngles && rockerBogieAngles.diffBar) || 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={mats.titanium}>
            <cylinderGeometry args={[0.022, 0.022, 1.30, 10]} />
          </mesh>
          <mesh material={mats.darkComposite}>
            <boxGeometry args={[0.10, 0.10, 0.10]} />
          </mesh>
          {/* Left & Right connecting tie-rod linkages to rockers */}
          <mesh position={[-0.64, -0.14, -0.18]} rotation={[0.42, 0, -0.32]} material={mats.titanium}>
            <cylinderGeometry args={[0.014, 0.014, 0.42, 8]} />
          </mesh>
          <mesh position={[0.64, -0.14, -0.18]} rotation={[0.42, 0, 0.32]} material={mats.titanium}>
            <cylinderGeometry args={[0.014, 0.014, 0.42, 8]} />
          </mesh>
        </group>

        {/* ── LEFT ROCKER & BOGIE ASSEMBLY ─────────────────────────────────── */}
        <group
          ref={(node) => { rockerRefs.current[0] = node; }}
          name="LeftRockerAssembly"
          position={[-0.66 - ef * 0.45, 0.02, 0.12]}
          rotation={[(rockerBogieAngles && rockerBogieAngles.rockerL) || 0, 0, 0]}
        >
          {/* Main Rocker Pivot Bearing on WEB chassis */}
          <mesh rotation={[0, 0, Math.PI / 2]} material={mats.darkComposite}>
            <cylinderGeometry args={[0.055, 0.055, 0.10, 16]} />
          </mesh>
          {/* Forward rocker arm to front wheel knuckle */}
          <mesh position={[-0.24, -0.08, 0.46]} rotation={[0.42, 0.22, 0]} material={mats.titanium} castShadow>
            <cylinderGeometry args={[0.026, 0.026, 1.08, 10]} />
          </mesh>
          {/* Aft rocker arm to bogie pivot */}
          <mesh position={[-0.10, -0.07, -0.27]} rotation={[-0.45, 0.20, 0]} material={mats.titanium} castShadow>
            <cylinderGeometry args={[0.026, 0.026, 0.62, 10]} />
          </mesh>

          {/* Left Bogie Pivot Joint & Arms (Center / Rear) */}
          <group ref={(node) => { bogieRefs.current[0] = node; }} position={[-0.20, -0.14, -0.54]} rotation={[(rockerBogieAngles && rockerBogieAngles.bogieL) || 0, 0, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={mats.darkComposite}>
              <cylinderGeometry args={[0.045, 0.045, 0.08, 14]} />
            </mesh>
            {/* Bogie forward arm to middle wheel */}
            <mesh position={[-0.14, -0.07, 0.21]} rotation={[0.38, 0.20, 0]} material={mats.titanium}>
              <cylinderGeometry args={[0.024, 0.024, 0.58, 8]} />
            </mesh>
            {/* Bogie aft arm to rear wheel knuckle */}
            <mesh position={[-0.14, -0.07, -0.26]} rotation={[-0.40, 0.20, 0]} material={mats.titanium}>
              <cylinderGeometry args={[0.024, 0.024, 0.68, 8]} />
            </mesh>
          </group>
        </group>

        {/* ── RIGHT ROCKER & BOGIE ASSEMBLY ────────────────────────────────── */}
        <group
          ref={(node) => { rockerRefs.current[1] = node; }}
          name="RightRockerAssembly"
          position={[0.66 + ef * 0.45, 0.02, 0.12]}
          rotation={[(rockerBogieAngles && rockerBogieAngles.rockerR) || 0, 0, 0]}
        >
          {/* Main Rocker Pivot Bearing */}
          <mesh rotation={[0, 0, Math.PI / 2]} material={mats.darkComposite}>
            <cylinderGeometry args={[0.055, 0.055, 0.10, 16]} />
          </mesh>
          {/* Forward rocker arm */}
          <mesh position={[0.24, -0.08, 0.46]} rotation={[0.42, -0.22, 0]} material={mats.titanium} castShadow>
            <cylinderGeometry args={[0.026, 0.026, 1.08, 10]} />
          </mesh>
          {/* Aft rocker arm */}
          <mesh position={[0.10, -0.07, -0.27]} rotation={[-0.45, -0.20, 0]} material={mats.titanium} castShadow>
            <cylinderGeometry args={[0.026, 0.026, 0.62, 10]} />
          </mesh>

          {/* Right Bogie Pivot Joint & Arms */}
          <group ref={(node) => { bogieRefs.current[1] = node; }} position={[0.20, -0.14, -0.54]} rotation={[(rockerBogieAngles && rockerBogieAngles.bogieR) || 0, 0, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={mats.darkComposite}>
              <cylinderGeometry args={[0.045, 0.045, 0.08, 14]} />
            </mesh>
            {/* Bogie forward arm to middle wheel */}
            <mesh position={[0.14, -0.07, 0.21]} rotation={[0.38, -0.20, 0]} material={mats.titanium}>
              <cylinderGeometry args={[0.024, 0.024, 0.58, 8]} />
            </mesh>
            {/* Bogie aft arm to rear wheel knuckle */}
            <mesh position={[0.14, -0.07, -0.26]} rotation={[-0.40, -0.20, 0]} material={mats.titanium}>
              <cylinderGeometry args={[0.024, 0.024, 0.68, 8]} />
            </mesh>
          </group>
        </group>
      </group>


      {/* ── 7. SIX DETAILED 48-GROUSER ARTICULATED WHEELS ───────────────────── */}
      <group name="SixWheels">
        {ROVER_WHEEL_COORDS.map((wh, index) => {
          const steerRot = wh.steerable ? (steeringAngles[wh.id] || 0) : 0;
          const explodeX = wh.x > 0 ? ef * 0.55 : -ef * 0.55;
          const suspY = (wheelOffsets && typeof wheelOffsets[wh.id] === 'number') ? wheelOffsets[wh.id] : 0;

          return (
            <group
              ref={(node) => { wheelMountRefs.current[index] = node; }}
              key={wh.id}
              name={wh.name}
              position={[wh.x + explodeX, -0.2775 + suspY, wh.z]}
            >
              {/* Corner Steering Actuator Pivot (FL, FR, RL, RR) */}
              {wh.steerable && (
                <group position={[0, 0.16, 0]}>
                  <mesh geometry={geoms.steerActuator} material={mats.darkComposite} />
                  <mesh position={[0, 0.08, 0]} material={mats.titanium}>
                    <boxGeometry args={[0.07, 0.05, 0.07]} />
                  </mesh>
                </group>
              )}

              {/* Rotatable Wheel Assembly (Steering pivot around vertical Y) */}
              <group ref={(node) => { steeringRefs.current[index] = node; }} rotation={[0, steerRot, 0]}>
                {/* Axle Rolling Rotation around X */}
                <group ref={(node) => { axleRefs.current[index] = node; }} rotation={[wheelRotation, 0, 0]}>
                  {/* 1. Outer Aluminum Cylindrical Tire Drum (Radius = 0.2625m, Width = 0.24m) */}
                  <mesh geometry={geoms.tireDrum} material={mats.wheelAluminum} castShadow receiveShadow />

                  {/* 2. Inboard & Outboard Flanged Rim Sidewalls */}
                  <mesh position={[-0.118, 0, 0]} geometry={geoms.rimWallL} material={mats.wheelRim} />
                  <mesh position={[ 0.118, 0, 0]} geometry={geoms.rimWallR} material={mats.wheelRim} />

                  {/* 3. Central Planetary Drive Motor Hub & Axle Cap */}
                  <mesh geometry={geoms.hub} material={mats.hubBrass} />
                  <mesh position={[wh.x > 0 ? 0.135 : -0.135, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.titanium}>
                    <cylinderGeometry args={[0.045, 0.045, 0.025, 16]} />
                  </mesh>

                  {/* 4. Six Curved Titanium Flexure Shock-Absorbing Spokes */}
                  {spokeAngles.map((angle, sIdx) => {
                    const rSpoke = 0.135;
                    const spY = Math.cos(angle) * rSpoke;
                    const spZ = Math.sin(angle) * rSpoke;
                    const sideX = wh.x > 0 ? 0.115 : -0.115;
                    return (
                      <group key={`spoke-${sIdx}`} position={[sideX, spY, spZ]} rotation={[angle + 0.35, 0, 0]}>
                        <mesh geometry={geoms.spoke} material={mats.titanium} />
                      </group>
                    );
                  })}

                  {/* 5. EXACTLY 48 CURVED CHEVRON TRACTION GROUSERS / CLEATS */}
                  <mesh geometry={geoms.grouserCleats} material={mats.wheelAluminum} castShadow receiveShadow />
                </group>
              </group>
            </group>
          );
        })}
      </group>

    </group>
  );
}
