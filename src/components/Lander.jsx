/**
 * Lander.jsx – High-Fidelity Multi-Body Staged Spacecraft for Mars EDL Simulation.
 *
 * Implements:
 *   - Autonomous Physical Staging:
 *       1. Cruise Stage Separation (before entry interface): separates and tumbles away
 *       2. Aeroshell & Backshell Assembly:
 *          • 70-degree spherical-cone Heat Shield with Sutton-Graves incandescent thermal glow & EntryPlasmaFX
 *          • Faceted Backshell cone with RCS reaction control thrusters & supersonic parachute mortar pack
 *       3. Heat Shield Jettison (~8 km): shield detaches and tumbles downwards under Mars gravity & drag,
 *          uncovering Terminal Descent Radar (TDR) array and Lander Vision System (LVS) optical cameras
 *       4. Backshell & Parachute Jettison (~1.8 km): backshell & chute drift away upward/backward,
 *          unveiling the Sky Crane powered descent stage and rover assembly
 *       5. Powered Descent: 8 canted hydrazine Mars Landing Engines (MLEs) ignite with dynamic shock plumes
 *       6. Sky Crane Rover Lowering: 4 endpoint-aligned bridle cables deploy the rover to the surface
 *       7. Touchdown Confirmed: cables severed, Sky Crane flies away, rover rests firmly on Martian terrain
 *   - Authentic Autonomous Flight Attitude Alignment:
 *       • Orbit / Cruise: nose along orbital velocity
 *       • Deorbit Burn: retrograde orientation facing velocity
 *       • Atmospheric Entry / Parachute: blunt heat shield base oriented into supersonic oncoming airstream
 *       • Powered Descent: upright vertical alignment
 *       • Touchdown / Surface Operations: kinematic alignment to local terrain slope (pitch & roll)
 *   - Procedural Mars 2020 Perseverance Rover (RoverModel):
 *       • Warm Electronics Box (WEB) chassis with titanium deck & gold MLI thermal foil
 *       • 6 Articulated wheels with chevron traction grousers, titanium spokes, drive hubs
 *       • Rocker-Bogie kinematic suspension with differential cross-bar
 *       • Remote Sensing Mast (RSM) with SuperCam, Mastcam-Z stereo zoom cameras, Navcams, MEDA
 *       • Steerable High-Gain Antenna (HGA) dish & Low-Gain Antenna (LGA) spire
 *       • 5-DOF Articulated Robotic Arm with science turret (SHERLOC, PIXL, WATSON, rock drill)
 *       • Multi-Mission Radioisotope Thermoelectric Generator (MMRTG) with 8 graphite fins
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RENDER_SCALE, ORBIT_ALTITUDE, JEZERO_TARGET_X, JEZERO_TARGET_Z } from '../simulation/physics/constants.js';
import {
  getLandingSurfaceRenderHeight,
  MARS_SURFACE_FRAME,
  surfaceToWorld,
  shouldUseSurfaceFrame,
} from './marsSurfaceFrame.js';
import Parachute from './Parachute';
import EntryPlasmaFX from './EntryPlasmaFX';
import RoverModel, { ROVER_BRIDLE_LUGS, ROVER_WHEEL_CONTACT_Y, ROVER_WHEEL_COORDS } from './RoverModel';
import { appendTrajectoryPosition, rebaseTrajectoryPath, writeInterpolatedVehicleWorldPosition } from './vehicleRenderFrame.js';

// Canted MLE descent rocket engine clusters (4 corners, canted outwards at 20 deg)
const MLE_ENGINE_CONFIGS = [
  { x:  0.62, z:  0.62, rotZ:  0.35, rotX: -0.35 },
  { x: -0.62, z:  0.62, rotZ: -0.35, rotX: -0.35 },
  { x:  0.62, z: -0.62, rotZ:  0.35, rotX:  0.35 },
  { x: -0.62, z: -0.62, rotZ: -0.35, rotX:  0.35 },
];

const SKY_CRANE_CABLE_LENGTH = 7.5;
const CRUISE_SEPARATION_SECONDS = 2.4;
const HEAT_SHIELD_SEPARATION_SECONDS = 2.0;
const CRUISE_RELEASE_IMPULSE_MPS = 12;
const HEAT_SHIELD_RELEASE_IMPULSE_MPS = 10;
const SKY_CRANE_ATTACHMENTS = [
  { x: -0.58, z: 0.58 },
  { x: 0.58, z: 0.58 },
  { x: -0.58, z: -0.58 },
  { x: 0.58, z: -0.58 },
];

export default function Lander({ simStateRef, accumRef, trajectoryPathRef, onSeparationLabel, viewMode = 'normal', explodedFactor = 0.0, selectedComponent }) {
  const mainGroupRef         = useRef();
  const attachedCruiseRef    = useRef();
  const driftingCruiseRef    = useRef();
  const cruiseSeparationVisual = useRef({
    started: false,
    completed: false,
    progress: 0,
    elapsed: 0,
    lastSimTime: 0,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    impulse: new THREE.Vector3(),
    orientation: new THREE.Quaternion(),
  });
  const heatShieldSeparationVisual = useRef({
    started: false,
    completed: false,
    progress: 0,
    elapsed: 0,
    lastSimTime: 0,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    impulse: new THREE.Vector3(),
    gravity: new THREE.Vector3(),
    orientation: new THREE.Quaternion(),
  });
  const attachedShieldRef    = useRef();
  const fallingShieldRef     = useRef();
  const attachedBackshellRef = useRef();
  const driftingBackshellRef = useRef();
  const descentStageRef      = useRef();
  const flyawayDescentRef    = useRef();
  const roverGroupRef        = useRef();
  const tetherCablesRef      = useRef();
  const bridleCableRefs      = useRef([]);
  const deorbitEngineRef     = useRef();
  const mainPlumeRef         = useRef();
  const descentPlumesRef     = useRef([]);
  const cruiseAeroshellRef   = useRef();  // Full-scale aeroshell capsule (MARS_ORBIT / DEORBIT_BURN / COAST_TO_ENTRY)

  // Surface debris refs (distant authentic crash locations)
  const heatShieldDebrisRef  = useRef();
  const backshellDebrisRef   = useRef();
  const descentCrashRef      = useRef();

  // PERFORMANCE: preallocated objects — reused every frame, zero heap allocation
  const _q  = useRef(new THREE.Quaternion());
  const _qWorld = useRef(new THREE.Quaternion());
  const _v  = useRef(new THREE.Vector3());
  const _surfacePosition = useRef(new THREE.Vector3());
  const _wheelLocalPosition = useRef(new THREE.Vector3());
  const _cableDirection = useRef(new THREE.Vector3());
  const _cableUp = useRef(new THREE.Vector3(0, 1, 0));
  const _cruiseStageLocalOffset = useRef(new THREE.Vector3(0, 2.15 * RENDER_SCALE, 0));
  const _heatShieldAttachedPosition = useRef(new THREE.Vector3());
  const _heatShieldLocalOffset = useRef(new THREE.Vector3(0, -0.52 * RENDER_SCALE, 0));
  const _up = useRef(new THREE.Vector3(0, 1, 0));
  const _euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const _lastUseSurface = useRef(null);
  const _wheelOffsets = useRef({ FL: 0, FR: 0, ML: 0, MR: 0, RL: 0, RR: 0 });
  const _rockerBogieAngles = useRef({ rockerL: 0, rockerR: 0, bogieL: 0, bogieR: 0, diffBar: 0 });

  // Materials
  // Authentic NASA Mars 2020 thermal protection ceramic tile composite (never washes out to white)
  const backshellMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#8c7760', metalness: 0.15, roughness: 0.82,
  }), []);

  const darkEngineMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#222326', metalness: 0.95, roughness: 0.15,
  }), []);

  const mastMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#c2cbd5', metalness: 0.75, roughness: 0.28,
  }), []);

  const heatShieldMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a1818',
    roughness: 0.75,
    metalness: 0.12,
    emissive: new THREE.Color('#000000'),
    emissiveIntensity: 0,
  }), []);

  const tankMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#a0a8b4',
    metalness: 0.85,
    roughness: 0.25,
  }), []);

  const plumeMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ff6600',
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  const plumeCoreMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ffe099',
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  const radarDishMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#dcdcdc', metalness: 0.8, roughness: 0.2,
  }), []);

  const solarPanelMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#173a63', metalness: 0.82, roughness: 0.22,
    emissive: '#061324', emissiveIntensity: 0.35,
  }), []);

  const cableMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#cbd5e1',
  }), []);

  // Per-frame physics synchronization
  useFrame((_, delta) => {
    if (!mainGroupRef.current) return;
    const s = simStateRef?.current;
    if (!s) return;

    const isLanded = s.phase === 'LANDED' || s.grounded;
    const isPowered = s.phase === 'POWERED_DESCENT' || s.phase === 'SAFE_APPROACH' || !!s.enginesActive;
    const isSkyCrane = !!s.skyCraneActive || s.phase === 'SAFE_APPROACH';
    const loweringProgress = s.skyCraneLoweringProgress || 0;
    const cableExtension = s.skyCraneActive && !s.cablesReleased
      ? loweringProgress * SKY_CRANE_CABLE_LENGTH
      : 0;

    // ── 1. Main Spacecraft Position & Ground Alignment ───────────────────────
    const physX = s.x || 0;
    const physZ = s.z || 0;
    const physY = Number.isFinite(s.altitude) ? s.altitude : (s.y ?? ORBIT_ALTITUDE);
    const physicalBodyAltitude = physY - cableExtension;
    const landingRefX = s.guidanceRefX !== undefined ? s.guidanceRefX : JEZERO_TARGET_X;
    const landingRefZ = s.guidanceRefZ !== undefined ? s.guidanceRefZ : JEZERO_TARGET_Z;

    // Sample 6 wheel contact points on the local Jezero terrain (1 unit = 1 meter)
    let sumGroundY = 0;
    const wheelElevs = ROVER_WHEEL_COORDS.map((wh) => {
      const h = getLandingSurfaceRenderHeight((physX + wh.x) - landingRefX, (physZ + wh.z) - landingRefZ);
      sumGroundY += h;
      return { id: wh.id, h, x: wh.x, z: wh.z };
    });

    const meanGroundY = sumGroundY / ROVER_WHEEL_COORDS.length;
    // Ground Y position for the rover origin so wheels contact terrain exactly
    let roverLandedY = meanGroundY - ROVER_WHEEL_CONTACT_Y * RENDER_SCALE;

    let renderY;
    let terrainPitch = 0;
    let terrainRoll = 0;

    const isSettling = s.touchdownState === 'SETTLING' || s.touchdownState === 'FIRST_CONTACT';

    if (isLanded || isSettling) {
      // Calculate terrain slope pitch: Front wheels (FL, FR) vs Rear wheels (RL, RR)
      const hFront = 0.5 * (wheelElevs[0].h + wheelElevs[1].h);
      const hRear  = 0.5 * (wheelElevs[4].h + wheelElevs[5].h);
      terrainPitch = Math.atan2(hFront - hRear, 2.10 * RENDER_SCALE);

      // Calculate terrain slope roll: Right wheels (FR, MR, RR) vs Left wheels (FL, ML, RL)
      const hRight = (1 / 3) * (wheelElevs[1].h + wheelElevs[3].h + wheelElevs[5].h);
      const hLeft  = (1 / 3) * (wheelElevs[0].h + wheelElevs[2].h + wheelElevs[4].h);
      terrainRoll = -Math.atan2(hRight - hLeft, 2.30 * RENDER_SCALE);
      _euler.current.set(terrainPitch, 0, terrainRoll, 'YXZ');
      _q.current.setFromEuler(_euler.current);

      // Fit the rover origin and suspension so wheels rest cleanly on the terrain.
      const offsets = _wheelOffsets.current;
      const transformedContacts = [];
      let maxRootY = -Infinity;
      for (const wh of wheelElevs) {
        const contact = _wheelLocalPosition.current
          .set(wh.x * RENDER_SCALE, ROVER_WHEEL_CONTACT_Y * RENDER_SCALE, wh.z * RENDER_SCALE)
          .applyQuaternion(_q.current);
        const ground = getLandingSurfaceRenderHeight(
          (physX - landingRefX) + contact.x / RENDER_SCALE,
          (physZ - landingRefZ) + contact.z / RENDER_SCALE,
        );
        transformedContacts.push({ id: wh.id, localY: contact.y, ground });
        const neededY = ground - contact.y;
        if (neededY > maxRootY) maxRootY = neededY;
      }
      const fittedRootY = maxRootY;
      renderY = isLanded ? fittedRootY : physicalBodyAltitude * RENDER_SCALE;
      for (const contact of transformedContacts) {
        const suspensionMeters = (contact.ground - renderY - contact.localY) / RENDER_SCALE;
        offsets[contact.id] = Math.max(-0.06, Math.min(0.06, suspensionMeters));
      }
      roverLandedY = fittedRootY;

      // Authentic Rocker-Bogie kinematic articulation angles (radians)
      const bogieL = Math.atan2(wheelElevs[2].h - wheelElevs[4].h, 0.93 * RENDER_SCALE);
      const bogieR = Math.atan2(wheelElevs[3].h - wheelElevs[5].h, 0.93 * RENDER_SCALE);
      const bogiePivotH_L = (wheelElevs[2].h + wheelElevs[4].h) * 0.5;
      const bogiePivotH_R = (wheelElevs[3].h + wheelElevs[5].h) * 0.5;
      const rockerL = Math.atan2(wheelElevs[0].h - bogiePivotH_L, 1.40 * RENDER_SCALE);
      const rockerR = Math.atan2(wheelElevs[1].h - bogiePivotH_R, 1.40 * RENDER_SCALE);
      const diffBar = (rockerL - rockerR) * 0.5;

      _rockerBogieAngles.current.bogieL = Math.max(-0.25, Math.min(0.25, bogieL));
      _rockerBogieAngles.current.bogieR = Math.max(-0.25, Math.min(0.25, bogieR));
      _rockerBogieAngles.current.rockerL = Math.max(-0.22, Math.min(0.22, rockerL));
      _rockerBogieAngles.current.rockerR = Math.max(-0.22, Math.min(0.22, rockerR));
      _rockerBogieAngles.current.diffBar = Math.max(-0.15, Math.min(0.15, diffBar));
    } else {
      renderY = physicalBodyAltitude * RENDER_SCALE;

      // Reset suspension offsets and rocker-bogie angles in flight
      const offsets = _wheelOffsets.current;
      offsets.FL = 0; offsets.FR = 0; offsets.ML = 0; offsets.MR = 0; offsets.RL = 0; offsets.RR = 0;
      _rockerBogieAngles.current.bogieL = 0;
      _rockerBogieAngles.current.bogieR = 0;
      _rockerBogieAngles.current.rockerL = 0;
      _rockerBogieAngles.current.rockerR = 0;
      _rockerBogieAngles.current.diffBar = 0;
    }

    const renderBodyY = (body) => renderY + ((body?.y ?? s.y ?? 0) - (s.y ?? 0)) * RENDER_SCALE;
    const useSurface = shouldUseSurfaceFrame(s);

    // Cache rendered local Y on sim state for camera and lighting synchronization
    s._renderedLocalY = renderY;

    // Single world-position owner: simulation state → one surface/cartesian conversion.
    writeInterpolatedVehicleWorldPosition(
      s,
      accumRef,
      _surfacePosition.current,
      (isLanded || isSettling || useSurface) ? renderY : undefined,
    );
    mainGroupRef.current.position.copy(_surfacePosition.current);
    if (useSurface && _lastUseSurface.current === false) {
      rebaseTrajectoryPath(trajectoryPathRef, mainGroupRef.current.position);
    }
    appendTrajectoryPosition(trajectoryPathRef, mainGroupRef.current.position);

    if (typeof window !== 'undefined') {
      window.__EDL_LANDER_DEBUG__ = {
        isLanded,
        roverLandedY,
        renderY,
        meanGroundY,
        physX,
        physY,
        physZ,
        landingRefX,
        landingRefZ,
        mainGroupPosY: mainGroupRef.current.position.y,
        mainGroupWorld: mainGroupRef.current.position.toArray(),
        wheelElevs,
      };
    }

    // ── 2. Attitude Orientation (copy, never slerp — slerp lagged position) ──
    if (useSurface) {
      _euler.current.set(isLanded || isSettling ? terrainPitch : 0, 0, isLanded || isSettling ? terrainRoll : 0, 'YXZ');
      _q.current.setFromEuler(_euler.current);
      _qWorld.current.copy(MARS_SURFACE_FRAME.rotation).multiply(_q.current);
      mainGroupRef.current.quaternion.copy(_qWorld.current);
    } else {
      const speed = Math.hypot(s.vx, s.vy, s.vz);
      if (speed > 1e-3) {
        _v.current.set(s.vx / speed, s.vy / speed, s.vz / speed);

        if (s.phase === 'DEORBIT_BURN') {
          _q.current.setFromUnitVectors(_up.current.set(0, -1, 0), _v.current);
        } else if (
          s.phase === 'ATMOSPHERIC_ENTRY' ||
          s.phase === 'PARACHUTE_DESCENT' ||
          s.phase === 'AUTONOMOUS_TARGET_REALIGNMENT' ||
          s.phase === 'TERMINAL_DESCENT'
        ) {
          _q.current.setFromUnitVectors(_up.current.set(0, -1, 0), _v.current);
        } else if (s.phase === 'POWERED_DESCENT' || s.phase === 'SAFE_APPROACH') {
          _q.current.identity();
        } else {
          _q.current.setFromUnitVectors(_up.current.set(1, 0, 0), _v.current);
        }
        mainGroupRef.current.quaternion.copy(_q.current);
      }
    }
    _lastUseSurface.current = useSurface;

    // ── 3. Heat Shield Visuals & Staging ────────────────────────────────────
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

    // ── 4. Cruise Stage Staging ──────────────────────────────────────────────
    const isCruiseSep = !!s.cruiseStageSeparated;
    const isPreEntry = s.phase === 'MARS_ORBIT' || s.phase === 'DEORBIT_BURN' || s.phase === 'COAST_TO_ENTRY';
    const cruiseVisual = cruiseSeparationVisual.current;
    const isCruiseAttached = isPreEntry && !isCruiseSep && !isLanded;
    if (attachedCruiseRef.current) {
      attachedCruiseRef.current.visible = isCruiseAttached;
    }
    if (driftingCruiseRef.current) {
      if (!isCruiseSep) {
        cruiseVisual.started = false;
        cruiseVisual.completed = false;
        cruiseVisual.progress = 0;
        cruiseVisual.elapsed = 0;
        cruiseVisual.lastSimTime = 0;
        driftingCruiseRef.current.visible = false;
      } else {
        const renderTime = s.elapsed + Math.max(0, accumRef?.current || 0);
        if (cruiseVisual.started && renderTime < cruiseVisual.lastSimTime) {
          cruiseVisual.started = false;
          cruiseVisual.completed = false;
          cruiseVisual.progress = 0;
          cruiseVisual.elapsed = 0;
        }

        const canStartCruiseSeparation = s.phase === 'COAST_TO_ENTRY' && !isLanded;
        if (!cruiseVisual.started && canStartCruiseSeparation) {
          _cruiseStageLocalOffset.current
            .set(0, 2.15 * RENDER_SCALE, 0)
            .applyQuaternion(mainGroupRef.current.quaternion);
          cruiseVisual.position.copy(mainGroupRef.current.position).add(_cruiseStageLocalOffset.current);
          cruiseVisual.orientation.copy(mainGroupRef.current.quaternion);
          cruiseVisual.velocity.set(s.vx || 0, s.vy || 0, s.vz || 0);
          if (useSurface) cruiseVisual.velocity.applyQuaternion(MARS_SURFACE_FRAME.rotation);
          cruiseVisual.velocity.multiplyScalar(RENDER_SCALE);
          cruiseVisual.impulse.copy(_cruiseStageLocalOffset.current)
            .normalize()
            .multiplyScalar(CRUISE_RELEASE_IMPULSE_MPS * RENDER_SCALE);
          cruiseVisual.elapsed = 0;
          cruiseVisual.progress = 0;
          cruiseVisual.lastSimTime = renderTime;
          cruiseVisual.started = true;
          cruiseVisual.completed = false;
          onSeparationLabel?.('CRUISE STAGE SEPARATING');
          if (attachedCruiseRef.current) attachedCruiseRef.current.visible = false;
        }

        if (cruiseVisual.started) {
          const simDelta = Math.max(0, renderTime - cruiseVisual.lastSimTime);
          cruiseVisual.lastSimTime = renderTime;
          const impulseDelta = Math.min(simDelta, Math.max(0, CRUISE_SEPARATION_SECONDS - cruiseVisual.elapsed));
          cruiseVisual.velocity.addScaledVector(cruiseVisual.impulse, impulseDelta / CRUISE_SEPARATION_SECONDS);
          cruiseVisual.position.addScaledVector(cruiseVisual.velocity, simDelta);
          cruiseVisual.elapsed += simDelta;
          cruiseVisual.progress = Math.min(1, cruiseVisual.elapsed / CRUISE_SEPARATION_SECONDS);

          if (cruiseVisual.progress >= 1 && !cruiseVisual.completed) {
            cruiseVisual.completed = true;
            onSeparationLabel?.('CRUISE STAGE JETTISONED');
          }

          driftingCruiseRef.current.visible = true;
          driftingCruiseRef.current.position.copy(cruiseVisual.position);
          driftingCruiseRef.current.quaternion.copy(cruiseVisual.orientation);
          driftingCruiseRef.current.rotateX(cruiseVisual.elapsed * 0.08);
          driftingCruiseRef.current.rotateZ(cruiseVisual.elapsed * 0.05);
        }
      }
    }

    // Deorbit engine bell: only visible during deorbit burn or orbit before Cruise Stage separation
    if (deorbitEngineRef.current) {
      deorbitEngineRef.current.visible = (s.phase === 'DEORBIT_BURN' || s.phase === 'MARS_ORBIT') && !isCruiseSep && !isLanded;
    }

    // ── 5. Heat Shield Jettison Staging ──────────────────────────────────────
    const isShieldSep = !!s.heatShieldSeparated;
    const isBackshellSep = !!s.backshellSeparated;
    const showCruiseAeroshell = !isLanded && !isShieldSep && !isBackshellSep && (isPreEntry || viewMode === 'capsule');
    // Heat shield is attached from orbit all the way through until it is jettisoned during descent
    const isShieldAttached = !isShieldSep && !isLanded && !isPowered && !showCruiseAeroshell && !isPreEntry;
    if (attachedShieldRef.current) {
      attachedShieldRef.current.visible = isShieldAttached;
    }
    if (fallingShieldRef.current) {
      const visual = heatShieldSeparationVisual.current;
      const renderTime = s.elapsed + Math.max(0, accumRef?.current || 0);
      const atShieldJettisonPhase = s.phase === 'PARACHUTE_DESCENT' && (s.altitude || 0) > 5000 && (s.altitude || 0) <= 9000;
      const separationEventActive = isShieldSep && (
        Number.isFinite(s.heatShieldSepTime) || atShieldJettisonPhase
      );

      if (!isShieldSep) {
        visual.started = false;
        visual.completed = false;
        visual.progress = 0;
        visual.elapsed = 0;
        visual.lastSimTime = 0;
        fallingShieldRef.current.visible = false;
      } else {
        if (visual.started && renderTime < visual.lastSimTime) {
          visual.started = false;
          visual.completed = false;
          visual.progress = 0;
          visual.elapsed = 0;
        }

        if (!visual.started && separationEventActive) {
          visual.started = true;
          visual.completed = false;
          visual.progress = 0;
          visual.elapsed = 0;
          visual.lastSimTime = renderTime;
          _heatShieldLocalOffset.current
            .set(0, -0.52 * RENDER_SCALE, 0)
            .applyQuaternion(mainGroupRef.current.quaternion);
          _heatShieldAttachedPosition.current
            .copy(mainGroupRef.current.position)
            .add(_heatShieldLocalOffset.current);
          visual.position.copy(_heatShieldAttachedPosition.current);
          visual.orientation.copy(mainGroupRef.current.quaternion);
          visual.velocity.set(s.vx || 0, s.vy || 0, s.vz || 0);
          if (useSurface) visual.velocity.applyQuaternion(MARS_SURFACE_FRAME.rotation);
          visual.velocity.multiplyScalar(RENDER_SCALE);
          visual.impulse.copy(_heatShieldLocalOffset.current)
            .normalize()
            .multiplyScalar(HEAT_SHIELD_RELEASE_IMPULSE_MPS * RENDER_SCALE);
          if (useSurface) {
            visual.gravity.copy(MARS_SURFACE_FRAME.up).multiplyScalar(-3.71 * RENDER_SCALE);
          } else {
            visual.gravity.set(0, -3.71 * RENDER_SCALE, 0);
          }
          onSeparationLabel?.('HEAT SHIELD SEPARATING');
        }

        if (visual.started) {
          const simDelta = Math.max(0, renderTime - visual.lastSimTime);
          visual.lastSimTime = renderTime;
          const impulseDelta = Math.min(simDelta, Math.max(0, HEAT_SHIELD_SEPARATION_SECONDS - visual.elapsed));
          visual.velocity.addScaledVector(visual.impulse, impulseDelta / HEAT_SHIELD_SEPARATION_SECONDS);
          visual.velocity.addScaledVector(visual.gravity, simDelta);
          visual.position.addScaledVector(visual.velocity, simDelta);
          visual.elapsed += simDelta;
          visual.progress = Math.min(1, visual.elapsed / HEAT_SHIELD_SEPARATION_SECONDS);

          if (visual.progress >= 1 && !visual.completed) {
            visual.completed = true;
            onSeparationLabel?.('HEAT SHIELD JETTISONED');
          }

          fallingShieldRef.current.visible = true;
          fallingShieldRef.current.position.copy(visual.position);
          fallingShieldRef.current.quaternion.copy(visual.orientation);
          fallingShieldRef.current.rotateX(visual.elapsed * 0.11);
          fallingShieldRef.current.rotateZ(visual.elapsed * 0.07);
        } else {
          fallingShieldRef.current.visible = false;
        }
      }
    }

    // ── 6. Backshell & Parachute Staging ─────────────────────────────────────
    // Backshell is attached from orbit all the way through until it separates at ~1.8 km
    // Hide during orbit/coast (cruise aeroshell handles those phases), show from entry onward
    const isBackshellAttached = !isBackshellSep && !isLanded && !isPowered && !isPreEntry && !showCruiseAeroshell;
    if (attachedBackshellRef.current) {
      attachedBackshellRef.current.visible = isBackshellAttached;
    }
    if (driftingBackshellRef.current) {
      const sepT = s.backshellSepTime !== undefined ? Math.max(0, s.elapsed - s.backshellSepTime) : 999;
      // Visible immediately after separation as parachute lifts up and recedes aft for ~5.0 seconds
      // Strictly hidden once it recedes or when vehicle is descending into terminal phases (< 500m)
      if (isBackshellSep && sepT < 5.0 && !isLanded && (s.altitude || 0) > 500) {
        const riseDist = 0.52 + (2.5 * sepT) + (0.75 * sepT * sepT);
        driftingBackshellRef.current.visible = true;
        driftingBackshellRef.current.position.set(
          (physX * RENDER_SCALE) - (1.1 * sepT),
          renderY + riseDist,
          (physZ * RENDER_SCALE) - (0.6 * sepT)
        );
        // Gentle aerodynamically stabilized drift rotation
        driftingBackshellRef.current.rotation.z = Math.sin((s.elapsed || 0) * 0.8) * 0.08;
        driftingBackshellRef.current.rotation.x = Math.cos((s.elapsed || 0) * 0.6) * 0.06;
      } else {
        driftingBackshellRef.current.visible = false;
      }
    }

    // ── 6b. Cruise Aeroshell Capsule ─────────────────────────────────────────
    if (cruiseAeroshellRef.current) {
      cruiseAeroshellRef.current.visible = showCruiseAeroshell;
    }

    // ── 7. Sky Crane Rover Lowering on Bridle Cables ─────────────────────────
    const isLowering = isSkyCrane && loweringProgress > 0 && !s.cablesReleased && !isLanded;

    if (roverGroupRef.current) {
      roverGroupRef.current.visible = isBackshellSep || isPowered || isSkyCrane || isLanded;
      roverGroupRef.current.position.set(0, 0, 0);
    }

    if (descentStageRef.current) {
      descentStageRef.current.visible = (isBackshellSep || isPowered || isSkyCrane) && !isLanded && !s.cablesReleased;
      if (isLowering) {
        // Descent stage hovers above rover as bridle cables unspool
        descentStageRef.current.position.y = 0.38 + cableExtension;
      } else {
        descentStageRef.current.position.y = 0.38;
      }
    }

    if (tetherCablesRef.current) {
      tetherCablesRef.current.visible = isLowering && !isLanded && !s.cablesReleased;
      if (isLowering) {
        for (let i = 0; i < ROVER_BRIDLE_LUGS.length; i++) {
          const cable = bridleCableRefs.current[i];
          if (!cable) continue;
          const lug = ROVER_BRIDLE_LUGS[i];
          const attachment = SKY_CRANE_ATTACHMENTS[i];
          const dx = attachment.x - lug.x;
          const dy = 0.34 + cableExtension - lug.y;
          const dz = attachment.z - lug.z;
          const length = Math.hypot(dx, dy, dz);
          _cableDirection.current.set(dx / length, dy / length, dz / length);
          cable.position.set(
            (lug.x + attachment.x) * 0.5,
            (lug.y + 0.34 + cableExtension) * 0.5,
            (lug.z + attachment.z) * 0.5,
          );
          cable.quaternion.setFromUnitVectors(_cableUp.current, _cableDirection.current);
          cable.scale.y = length;
        }
      }
    }

    // ── 8. Descent Stage Flyaway ─────────────────────────────────────────────
    if (flyawayDescentRef.current) {
      // The descent stage performs its powerful flyaway climb immediately following touchdown.
      // Accelerates up and away with tilted retro-rockets, crashing at a safe distant site (> 6.5s).
      const flyawayTime = s.elapsed - (s.touchdownTime ?? s.elapsed);
      const isActivelyFlying = s.descentStageFlyaway && (flyawayTime >= 0 && flyawayTime < 6.5);

      if (isActivelyFlying) {
        flyawayDescentRef.current.visible = true;
        const t = flyawayTime;
        // Starts at the descent-stage hover altitude above the rover and accelerates away.
        const climbY = ((0.38 + SKY_CRANE_CABLE_LENGTH) + (3.2 * t) + (1.4 * t * t)) * RENDER_SCALE;
        const driftX = ((2.2 * t) + (0.95 * t * t)) * RENDER_SCALE;
        const driftZ = ((1.6 * t) + (0.75 * t * t)) * RENDER_SCALE;

        surfaceToWorld(
          (physX - landingRefX) * RENDER_SCALE + driftX,
          renderY + climbY,
          (physZ - landingRefZ) * RENDER_SCALE + driftZ,
          flyawayDescentRef.current.position,
        );
        flyawayDescentRef.current.rotation.set(0.32, (flyawayDescentRef.current.rotation.y || 0) + delta * 0.8, -0.45);
      } else {
        flyawayDescentRef.current.visible = false;
      }
    }

    // ── 9. Engine Plumes ─────────────────────────────────────────────────────
    if (mainPlumeRef.current) {
      if (s.phase === 'DEORBIT_BURN' && s.enginesActive) {
        mainPlumeRef.current.visible = true;
        const flicker = 1.0 + Math.sin(performance.now() * 0.035) * 0.25;
        mainPlumeRef.current.scale.set(1.0, flicker, 1.0);
      } else {
        mainPlumeRef.current.visible = false;
      }
    }

    if (descentPlumesRef.current) {
      const showDescentPlume = (isPowered || isSkyCrane) && s.enginesActive && !isLanded;
      const throttle = s.throttle !== undefined ? s.throttle : (s.phase === 'SAFE_APPROACH' ? 0.65 : 0.85);
      const t = performance.now() * 0.045;
      const flicker = 0.90 + Math.sin(t * 1.5) * 0.22 + Math.cos(t * 3.7) * 0.12;
      const plumeLen = Math.max(0.20, (0.35 + throttle * 1.35) * flicker);
      const plumeWidth = Math.max(0.40, (0.50 + throttle * 0.80));
      for (const p of descentPlumesRef.current) {
        if (p) {
          p.visible = showDescentPlume;
          if (showDescentPlume) {
            p.scale.set(plumeWidth, plumeLen, plumeWidth);
          }
        }
      }
    }

    // ── 10. Surface Operations Debris ─────────────────────────────────────────
    if (heatShieldDebrisRef.current) heatShieldDebrisRef.current.visible = false;
    if (backshellDebrisRef.current) backshellDebrisRef.current.visible = false;
    if (descentCrashRef.current) {
      const flyawayTime = s.elapsed - (s.touchdownTime ?? s.elapsed);
      if (s.grounded && s.touchdownTime !== undefined && flyawayTime >= 6.5) {
        descentCrashRef.current.visible = true;
        surfaceToWorld(
          ((physX - landingRefX) + 52.0) * RENDER_SCALE,
          meanGroundY + 0.1 * RENDER_SCALE,
          ((physZ - landingRefZ) + 40.0) * RENDER_SCALE,
          descentCrashRef.current.position,
        );
      } else {
        descentCrashRef.current.visible = false;
      }
    }
  });

  return (
    <>
      {/* ── MAIN VEHICLE ASSEMBLY ─────────────────────────────────────────── */}
      <group
        ref={mainGroupRef}
        position={[0, ORBIT_ALTITUDE * RENDER_SCALE, 0]}
        scale={[RENDER_SCALE, RENDER_SCALE, RENDER_SCALE]}
      >

        {/* ── A. ROVER INTERNAL ASSEMBLY (Lowers during Sky Crane) ──────── */}
        <group ref={roverGroupRef}>
          <RoverModel
            viewMode={viewMode}
            explodedFactor={explodedFactor}
            selectedComponent={selectedComponent}
            wheelOffsets={_wheelOffsets.current}
            rockerBogieAngles={_rockerBogieAngles.current}
          />
        </group>

        {/* ── A2. CRUISE AEROSHELL CAPSULE (Orbit / Coast phases only) ───── */}
        {/* Properly-scaled 4.5m-diameter aeroshell that fully encloses the rover. */}
        {/* Matches real Mars 2020: upper backshell cone + 70° spherical-cone heat shield. */}
        <group ref={cruiseAeroshellRef} visible={false}>
          {/* === UPPER BACKSHELL CONE (cream-white aluminum structure) === */}
          <mesh position={[0, 0.55, 0]} material={backshellMaterial} castShadow>
            <coneGeometry args={[2.18, 2.05, 48]} />
          </mesh>
          {/* Backshell apex cap (rounded top) */}
          <mesh position={[0, 1.60, 0]} material={backshellMaterial}>
            <sphereGeometry args={[0.28, 24, 16]} />
          </mesh>
          {/* Structural ribbing bands on backshell */}
          {[0.0, 0.42, 0.82].map((yOff, i) => (
            <mesh key={`bsrib-${i}`} position={[0, yOff - 0.2, 0]} material={backshellMaterial}>
              <torusGeometry args={[2.18 - yOff * 0.48, 0.032, 8, 48]} />
            </mesh>
          ))}
          {/* Parachute mortar pack (small cylinder on top-back of backshell) */}
          <mesh position={[0.25, 1.30, 0.55]} material={darkEngineMaterial}>
            <cylinderGeometry args={[0.12, 0.14, 0.22, 12]} />
          </mesh>
          {/* RCS thruster clusters (4x around backshell equator) */}
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
            <mesh
              key={`rcscrz-${i}`}
              position={[Math.cos(angle) * 1.85, 0.18, Math.sin(angle) * 1.85]}
              rotation={[0, -angle, 0]}
              material={darkEngineMaterial}
            >
              <boxGeometry args={[0.09, 0.09, 0.14]} />
            </mesh>
          ))}

          {/* === SEPARATION RING (adapter between backshell and heat shield) === */}
          <mesh position={[0, -0.48, 0]} material={darkEngineMaterial}>
            <cylinderGeometry args={[2.20, 2.20, 0.08, 48]} />
          </mesh>
          {/* Structural clampband bolts */}
          {Array.from({ length: 16 }, (_, i) => {
            const angle = (i / 16) * Math.PI * 2;
            return (
              <mesh
                key={`bolt-${i}`}
                position={[Math.cos(angle) * 2.22, -0.48, Math.sin(angle) * 2.22]}
                material={darkEngineMaterial}
              >
                <boxGeometry args={[0.05, 0.10, 0.05]} />
              </mesh>
            );
          })}

          {/* === LOWER HEAT SHIELD — 70° spherical-cone (dark charred PICA ablator) === */}
          {/* The sphere is clipped to form the blunt heat-shield cap: phi 0 → ~75° */}
          <mesh position={[0, -0.52, 0]} material={heatShieldMaterial} castShadow>
            <sphereGeometry args={[2.20, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.40]} />
          </mesh>
          {/* Heat shield rim flange (matching outer cone edge) */}
          <mesh position={[0, -0.52, 0]} material={heatShieldMaterial}>
            <torusGeometry args={[2.13, 0.055, 8, 48]} />
          </mesh>
          {/* PICA tile grid lines (4 radial + 4 circumferential bands) */}
          {Array.from({ length: 4 }, (_, ri) => {
            const angle = (ri / 4) * Math.PI * 2;
            return (
              <mesh
                key={`tile-${ri}`}
                position={[Math.cos(angle) * 0.9, -0.85, Math.sin(angle) * 0.9]}
                rotation={[0, -angle, 0.3]}
                material={darkEngineMaterial}
              >
                <boxGeometry args={[0.025, 0.025, 1.6]} />
              </mesh>
            );
          })}
        </group>

        {/* ── B. TETHER BRIDLE CABLES (Active during Sky Crane) ─────────── */}
        <group ref={tetherCablesRef} visible={false}>
          {ROVER_BRIDLE_LUGS.map((lug, index) => (
            <mesh key={lug.id} ref={(mesh) => { bridleCableRefs.current[index] = mesh; }} material={cableMaterial}>
              <cylinderGeometry args={[0.006, 0.006, 1, 6]} />
            </mesh>
          ))}
        </group>

        {/* ── C. SKY CRANE POWERED DESCENT STAGE ─────────────────────────── */}
        <group ref={descentStageRef} visible={false}>
          <mesh position={[0, 0.38, 0]} material={darkEngineMaterial}>
            <cylinderGeometry args={[0.82, 0.82, 0.08, 8]} />
          </mesh>
          <mesh position={[0.35, 0.48, 0]} material={tankMaterial}>
            <sphereGeometry args={[0.18, 16, 16]} />
          </mesh>
          <mesh position={[-0.35, 0.48, 0]} material={tankMaterial}>
            <sphereGeometry args={[0.18, 16, 16]} />
          </mesh>
          {MLE_ENGINE_CONFIGS.map((eng, idx) => (
            <group key={idx} position={[eng.x, 0.22, eng.z]} rotation={[eng.rotX, 0, eng.rotZ]}>
              <mesh material={darkEngineMaterial} castShadow>
                <coneGeometry args={[0.11, 0.26, 12]} />
              </mesh>
              <group
                ref={(el) => (descentPlumesRef.current[idx] = el)}
                visible={false}
                position={[0, -0.13, 0]}
              >
                <mesh position={[0, -0.65, 0]} material={plumeMaterial}>
                  <coneGeometry args={[0.28, 1.3, 16]} />
                </mesh>
                <mesh position={[0, -0.40, 0]} material={plumeCoreMaterial}>
                  <coneGeometry args={[0.13, 0.8, 12]} />
                </mesh>
              </group>
            </group>
          ))}
        </group>

        {/* ── D. ATTACHED HEAT SHIELD — 70° spherical-cone (Jettisons ~8 km) ── */}
        {/* Scaled to radius 2.18 to fully enclose the rover during entry.          */}
        <group ref={attachedShieldRef}>
          {/* Main heat shield dome (70-degree blunt-body spherical-cone PICA surface) */}
          <mesh position={[0, -0.52, 0]} material={heatShieldMaterial} castShadow>
            <sphereGeometry args={[2.20, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.40]} />
          </mesh>
          {/* Outer rim flange ring */}
          <mesh position={[0, -0.52, 0]} material={heatShieldMaterial}>
            <torusGeometry args={[2.13, 0.055, 8, 48]} />
          </mesh>
          {/* Flat cylindrical shoulder section */}
          <mesh position={[0, -0.48, 0]} material={heatShieldMaterial}>
            <cylinderGeometry args={[2.20, 2.20, 0.08, 48]} />
          </mesh>
          <EntryPlasmaFX simStateRef={simStateRef} />
        </group>

        {/* ── E. ATTACHED BACKSHELL & PARACHUTE (Separates ~1.8 km) ─────── */}
        {/* Scaled to radius 2.18 to fully enclose the rover during parachute phase. */}
        <group ref={attachedBackshellRef}>
          {/* Opaque backshell keeps the rover enclosed through parachute descent. */}
          <mesh position={[0, 0.55, 0]} material={backshellMaterial} castShadow>
            <coneGeometry args={[2.18, 2.05, 48]} />
          </mesh>
          {/* Apex rounded cap */}
          <mesh position={[0, 1.60, 0]} material={backshellMaterial}>
            <sphereGeometry args={[0.28, 24, 16]} />
          </mesh>
          {/* Parachute mortar pack */}
          <mesh position={[0.25, 1.30, 0.55]} material={darkEngineMaterial}>
            <cylinderGeometry args={[0.12, 0.14, 0.22, 12]} />
          </mesh>
          {/* RCS thruster pods (4x) */}
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
            <mesh
              key={`rcs-${i}`}
              position={[Math.cos(angle) * 1.85, 0.18, Math.sin(angle) * 1.85]}
              rotation={[0, -angle, 0]}
              material={darkEngineMaterial}
            >
              <boxGeometry args={[0.09, 0.09, 0.14]} />
            </mesh>
          ))}
          <Parachute simStateRef={simStateRef} />
        </group>

        {/* ── F. ATTACHED CRUISE STAGE (Separates before entry) ─────────── */}
        {/* Positioned atop the properly-scaled aeroshell (y ~1.6 from top of backshell) */}
        <group ref={attachedCruiseRef} position={[0, 2.15, 0]}>
          {/* Solar panel disk */}
          <mesh material={solarPanelMaterial}>
            <cylinderGeometry args={[2.65, 2.65, 0.10, 48]} />
          </mesh>
          {/* Central structural ring */}
          <mesh material={darkEngineMaterial} position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.78, 0.78, 0.14, 16]} />
          </mesh>
          {/* Star-tracker mast */}
          <mesh position={[1.10, 0.38, 0.52]} material={mastMaterial}>
            <cylinderGeometry args={[0.04, 0.04, 0.72, 8]} />
          </mesh>
          {/* HGA dish */}
          <mesh position={[1.10, 0.75, 0.52]} material={radarDishMaterial}>
            <cylinderGeometry args={[0.22, 0.02, 0.05, 16]} />
          </mesh>
          {/* Solar panel ribs (4 spokes) */}
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
            <mesh
              key={`rib-${i}`}
              position={[Math.cos(angle) * 1.35, 0, Math.sin(angle) * 1.35]}
              rotation={[0, -angle, 0]}
              material={solarPanelMaterial}
            >
              <boxGeometry args={[2.50, 0.06, 0.20]} />
            </mesh>
          ))}
        </group>

        {/* ── G. DEORBIT MAIN ENGINE BELL & PLUME (Hidden after separation) */}
        <group ref={deorbitEngineRef} visible={false}>
          <mesh position={[0, -0.52, 0]} material={darkEngineMaterial} castShadow>
            <coneGeometry args={[0.24, 0.42, 16]} />
          </mesh>
          <group ref={mainPlumeRef} visible={false} position={[0, -0.82, 0]}>
            <mesh position={[0, -0.5, 0]} material={plumeMaterial}>
              <coneGeometry args={[0.32, 1.2, 12]} />
            </mesh>
            <mesh position={[0, -0.35, 0]} material={plumeCoreMaterial}>
              <coneGeometry args={[0.16, 0.75, 8]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ── SEPARATED BODY 1: Jettisoned Falling Heat Shield ──────────────── */}
      <group ref={fallingShieldRef} visible={false} scale={[RENDER_SCALE, RENDER_SCALE, RENDER_SCALE]}>
        <mesh material={heatShieldMaterial} castShadow>
          <sphereGeometry args={[2.20, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.40]} />
        </mesh>
        <mesh material={heatShieldMaterial}>
          <torusGeometry args={[2.13, 0.055, 6, 32]} />
        </mesh>
        <mesh position={[0, 0.04, 0]} material={heatShieldMaterial}>
          <cylinderGeometry args={[2.20, 2.20, 0.08, 48]} />
        </mesh>
      </group>

      {/* ── SEPARATED BODY 2: Jettisoned Drifting Backshell & Parachute ───── */}
      <group ref={driftingBackshellRef} visible={false} scale={[RENDER_SCALE, RENDER_SCALE, RENDER_SCALE]}>
        <mesh material={backshellMaterial} castShadow>
          <coneGeometry args={[2.18, 2.05, 32]} />
        </mesh>
        <Parachute simStateRef={simStateRef} isJettisoned={true} />
      </group>

      {/* ── SEPARATED BODY 3: Jettisoned Drifting Cruise Stage ─────────────── */}
      <group ref={driftingCruiseRef} visible={false} scale={[RENDER_SCALE, RENDER_SCALE, RENDER_SCALE]}>
        <mesh material={solarPanelMaterial}>
          <cylinderGeometry args={[2.65, 2.65, 0.10, 32]} />
        </mesh>
        <mesh material={darkEngineMaterial} position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.78, 0.78, 0.14, 16]} />
        </mesh>
        <mesh position={[1.10, 0.38, 0.52]} material={mastMaterial}>
          <cylinderGeometry args={[0.04, 0.04, 0.72, 8]} />
        </mesh>
      </group>

      {/* ── SEPARATED BODY 4: Sky Crane Flyaway Descent Stage ─────────────── */}
      <group ref={flyawayDescentRef} visible={false} scale={[RENDER_SCALE, RENDER_SCALE, RENDER_SCALE]}>
        <mesh material={darkEngineMaterial}>
          <cylinderGeometry args={[0.82, 0.82, 0.08, 8]} />
        </mesh>
        <mesh position={[0.35, 0.1, 0]} material={tankMaterial}>
          <sphereGeometry args={[0.18, 16, 16]} />
        </mesh>
        <mesh position={[-0.35, 0.1, 0]} material={tankMaterial}>
          <sphereGeometry args={[0.18, 16, 16]} />
        </mesh>
        {MLE_ENGINE_CONFIGS.map((eng, idx) => (
          <group key={`flyaway-plume-${idx}`} position={[eng.x, -0.15, eng.z]} rotation={[eng.rotX, 0, eng.rotZ]}>
            <mesh position={[0, -0.65, 0]} material={plumeMaterial}>
              <coneGeometry args={[0.28, 1.3, 16]} />
            </mesh>
            <mesh position={[0, -0.40, 0]} material={plumeCoreMaterial}>
              <coneGeometry args={[0.13, 0.8, 12]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ── SURFACE OPERATIONS DEBRIS (Resting at Distant Locations) ──────── */}
      <group ref={heatShieldDebrisRef} visible={false}>
        <mesh rotation={[0.4, 0.8, 0.3]} material={heatShieldMaterial}>
          <cylinderGeometry args={[0.96, 0.72, 0.18, 24]} />
        </mesh>
      </group>

      <group ref={backshellDebrisRef} visible={false}>
        <mesh rotation={[Math.PI / 2, 0, 0.4]} material={backshellMaterial}>
          <coneGeometry args={[0.96, 0.95, 24]} />
        </mesh>
      </group>

      <group ref={descentCrashRef} visible={false} scale={[RENDER_SCALE, RENDER_SCALE, RENDER_SCALE]}>
        <mesh rotation={[0.2, 0.4, 0.8]} material={darkEngineMaterial}>
          <boxGeometry args={[0.9, 0.3, 0.9]} />
        </mesh>
      </group>
    </>
  );
}
