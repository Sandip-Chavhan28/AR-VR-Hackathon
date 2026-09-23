/**
 * SimulationCanvas.jsx – Cinematic Three.js Mars EDL Simulation Canvas.
 *
 * Requirements (items 1, 2, 3, 10, 11, 12, 15, 18, 19, 20):
 *   - Controlled exposure (0.52) + ACESFilmic + sRGB output prevents washed-out Mars
 *   - Cinematic Mars lighting: single Martian sun, low ambient, terminator clearly visible
 *   - MARS_ORBIT camera: Mars occupies 55–75% of screen, spacecraft clearly visible off-center
 *   - Dynamic phase-adaptive camera distances (spacecraft never becomes a tiny dot)
 *   - LANDED camera: low cinematic ground-level orbit, lander occupies 25–35% of viewport,
 *     landing legs visibly resting on terrain, Mars terrain filling lower half
 *   - Camera anti-clipping: safeClamp ensures camera never penetrates Mars or terrain
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import MarsSurface from './MarsSurface';
import MarsGlobe from './MarsGlobe';
import Lander from './Lander';
import OrbitalTrajectory from './OrbitalTrajectory';
import LandingSiteGrid from './LandingSiteGrid';
import StarField from './StarField';
import DebugHUD from './DebugHUD';
import { createInitialState, tickSimulation } from '../simulation/simulationState.js';
import { RENDER_SCALE, ORBIT_ALTITUDE, MARS_RADIUS } from '../simulation/physics/constants.js';
import { getTerrainHeight } from '../simulation/landingSite/terrain.js';
import { ELEV_EXAGGERATION } from './MarsSurface.jsx';

const LEG_CONTACT_OFFSET = 0.775;

// ---------------------------------------------------------------------------
// 1. Renderer Configuration
// ---------------------------------------------------------------------------
function RendererConfig() {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.toneMapping         = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.52; // Preserves dark rusty red detail, prevents blowout
    gl.outputColorSpace    = THREE.SRGBColorSpace;
    gl.shadowMap.enabled   = true;
    gl.shadowMap.type      = THREE.PCFSoftShadowMap;
    scene.background       = new THREE.Color(0x01010a); // Deep blue-black space
  }, [gl, scene]);
  return null;
}

// ---------------------------------------------------------------------------
// 2. Physics Runner
// ---------------------------------------------------------------------------
function PhysicsRunner({ simStateRef, accumRef }) {
  useFrame((_, delta) => {
    tickSimulation(simStateRef.current, delta, accumRef);
  });
  return null;
}

// ---------------------------------------------------------------------------
// Helpers: Lander Visual Coordinates
// ---------------------------------------------------------------------------
function getLanderRenderY(s) {
  if (!s) return ORBIT_ALTITUDE * RENDER_SCALE;
  if (s.phase === 'LANDED' || s.grounded) {
    const elevM = getTerrainHeight(s.x || 0, s.z || 0);
    return elevM * RENDER_SCALE * ELEV_EXAGGERATION + LEG_CONTACT_OFFSET;
  }
  return (s.y !== undefined ? s.y : ORBIT_ALTITUDE) * RENDER_SCALE;
}


// ---------------------------------------------------------------------------
// 3. TrackingCamera – Adaptive Cinematic Camera
// ---------------------------------------------------------------------------
function TrackingCamera({ simStateRef, cameraMode }) {
  const { camera } = useThree();
  const freeCamAngle = useRef({ theta: 0.3, phi: 0.4, radius: 25 });
  const isDragging   = useRef(false);
  const prevMouse    = useRef({ x: 0, y: 0 });
  const landedAngle  = useRef(0);
  const wasLanded    = useRef(false);

  useEffect(() => {
    camera.fov  = 46;
    camera.near = 0.2;
    camera.far  = 35000;
    camera.updateProjectionMatrix();
  }, [camera]);

  // Free camera mouse controls
  useEffect(() => {
    const down = (e) => {
      if (cameraMode === 'FREE') {
        isDragging.current = true;
        prevMouse.current = { x: e.clientX, y: e.clientY };
      }
    };
    const move = (e) => {
      if (!isDragging.current || cameraMode !== 'FREE') return;
      freeCamAngle.current.theta -= (e.clientX - prevMouse.current.x) * 0.005;
      freeCamAngle.current.phi = Math.max(
        0.05,
        Math.min(Math.PI - 0.05, freeCamAngle.current.phi + (e.clientY - prevMouse.current.y) * 0.005)
      );
      prevMouse.current = { x: e.clientX, y: e.clientY };
    };
    const up = () => { isDragging.current = false; };
    const wheel = (e) => {
      if (cameraMode === 'FREE') {
        freeCamAngle.current.radius = Math.max(
          2.5,
          Math.min(500, freeCamAngle.current.radius + e.deltaY * 0.06)
        );
      }
    };
    window.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('wheel', wheel, { passive: true });
    return () => {
      window.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('wheel', wheel);
    };
  }, [cameraMode]);

  useFrame((_, delta) => {
    const s = simStateRef.current;
    if (!s) return;

    const physX    = s.x || 0;
    const physZ    = s.z || 0;
    const phase    = s.phase || 'MARS_ORBIT';
    const isLanded = phase === 'LANDED' || s.grounded;

    const lx = physX * RENDER_SCALE;
    const ly = getLanderRenderY(s);
    const lz = physZ * RENDER_SCALE;
    if (!isFinite(lx) || !isFinite(ly) || !isFinite(lz)) return;

    const MARS_R_RENDER = MARS_RADIUS * RENDER_SCALE;
    const marsCy = -MARS_R_RENDER;

    // Safety: prevent camera clipping into Mars spherical body
    const safeClamp = (tx, ty, tz) => {
      const dx = tx;
      const dy = ty - marsCy;
      const dz = tz;
      const d = Math.hypot(dx, dy, dz) || 1e-6;
      const minD = MARS_R_RENDER + 0.15; // Maintain at least 150m clearance above Mars sphere
      if (d < minD) {
        const f = minD / d;
        tx = dx * f;
        ty = marsCy + dy * f;
        tz = dz * f;
      }
      return [tx, ty, tz];
    };

    const altKm = (s.altitude || 0) / 1000;

    // ── Helper: Altitude/State-based Dynamic Camera Distance ───────────
    const getAdaptiveDistance = (altitudeKm, currentPhase) => {
      if (currentPhase === 'LANDED') return 3.4;
      if (currentPhase === 'MARS_ORBIT') return 8.5;    // Spacecraft clearly visible & prominent
      if (currentPhase === 'DEORBIT_BURN') return 6.5;  // Move camera closer during burn

      // Continuous altitude-based distance during descent:
      if (altitudeKm > 125) {
        // High altitude coast (250 km -> 125 km): 6.5 -> 5.2
        const t = Math.max(0, Math.min(1, (altitudeKm - 125) / (250 - 125)));
        return 5.2 + t * (6.5 - 5.2);
      }
      if (altitudeKm > 10) {
        // Atmospheric entry (125 km -> 10 km): 5.2 -> 4.0
        const t = Math.max(0, Math.min(1, (altitudeKm - 10) / (125 - 10)));
        return 4.0 + t * (5.2 - 4.0);
      }
      if (altitudeKm > 1.5) {
        // Parachute descent (10 km -> 1.5 km): 4.0 -> 3.4
        const t = Math.max(0, Math.min(1, (altitudeKm - 1.5) / (10 - 1.5)));
        return 3.4 + t * (4.0 - 3.4);
      }
      // Final descent (1.5 km -> 0 km): 3.4 -> 3.0
      const t = Math.max(0, Math.min(1, altitudeKm / 1.5));
      return 3.0 + t * (3.4 - 3.0);
    };

    // Radial local "UP" vector from Mars center to the spacecraft
    const rdx = lx;
    const rdy = ly - marsCy;
    const rdz = lz;
    const rDist = Math.hypot(rdx, rdy, rdz) || 1e-6;
    const upX = rdx / rDist;
    const upY = rdy / rDist;
    const upZ = rdz / rDist;

    // ── LANDED: Close Cinematic Ground-Level Orbit ───────────────────────
    if (isLanded) {
      if (!wasLanded.current) {
        wasLanded.current = true;
      }
      landedAngle.current += delta * 0.05; // Smooth slow orbit pan

      // Two orthogonal surface tangent vectors relative to local up
      let t1X = -upZ, t1Y = 0, t1Z = upX;
      const t1Len = Math.hypot(t1X, t1Y, t1Z);
      if (t1Len > 1e-4) {
        t1X /= t1Len; t1Y /= t1Len; t1Z /= t1Len;
      } else {
        t1X = 1; t1Y = 0; t1Z = 0;
      }
      const t2X = upY * t1Z - upZ * t1Y;
      const t2Y = upZ * t1X - upX * t1Z;
      const t2Z = upX * t1Y - upY * t1X;

      const LAND_R = 3.4;
      const LAND_H = 0.60;

      const cosA = Math.cos(landedAngle.current);
      const sinA = Math.sin(landedAngle.current);

      let tx = lx + (t1X * cosA + t2X * sinA) * LAND_R + upX * LAND_H;
      let ty = ly + (t1Y * cosA + t2Y * sinA) * LAND_R + upY * LAND_H;
      let tz = lz + (t1Z * cosA + t2Z * sinA) * LAND_R + upZ * LAND_H;
      [tx, ty, tz] = safeClamp(tx, ty, tz);

      const smoothF = 1.0 - Math.exp(-5.0 * delta);
      camera.position.x += (tx - camera.position.x) * smoothF;
      camera.position.y += (ty - camera.position.y) * smoothF;
      camera.position.z += (tz - camera.position.z) * smoothF;

      // Look directly at spacecraft body center on Mars surface
      camera.lookAt(lx + upX * 0.1, ly + upY * 0.1, lz + upZ * 0.1);
      return;
    }
    wasLanded.current = false;

    // ── CHASE CAMERA: Altitude-Adaptive Dynamic Distance ─────────────────
    if (cameraMode === 'CHASE') {
      const targetDist = Math.max(3.0, Math.min(10.0, getAdaptiveDistance(altKm, phase)));

      // Flight velocity unit vector
      const speed = Math.hypot(s.vx, s.vy, s.vz) || 1e-6;
      const vxN = s.vx / speed;
      const vyN = s.vy / speed;
      const vzN = s.vz / speed;

      // Sideways vector: cross(velocity, radial_up)
      let sideX = vyN * upZ - vzN * upY;
      let sideY = vzN * upX - vxN * upZ;
      let sideZ = vxN * upY - vyN * upX;
      const sideLen = Math.hypot(sideX, sideY, sideZ);
      if (sideLen > 1e-4) {
        sideX /= sideLen; sideY /= sideLen; sideZ /= sideLen;
      } else {
        sideX = 0; sideY = 0; sideZ = 1;
      }

      // 3/4 elevated chase position relative to the CURRENT spacecraft world position:
      // - Behind flight path: -V * (targetDist * 0.70)
      // - Elevated radially outward into space: +up * (targetDist * 0.48)
      // - Offset to the side for 3/4 view: +side * (targetDist * 0.35)
      const backDist = targetDist * 0.70;
      const upDist   = targetDist * 0.48;
      const sideDist = targetDist * 0.35;

      let tx = lx - vxN * backDist + upX * upDist + sideX * sideDist;
      let ty = ly - vyN * backDist + upY * upDist + sideY * sideDist;
      let tz = lz - vzN * backDist + upZ * upDist + sideZ * sideDist;

      // Keep camera outside Mars sphere
      [tx, ty, tz] = safeClamp(tx, ty, tz);

      // Frame-rate independent smooth damping
      const smoothFactor = 1.0 - Math.exp(-7.5 * delta);
      camera.position.x += (tx - camera.position.x) * smoothFactor;
      camera.position.y += (ty - camera.position.y) * smoothFactor;
      camera.position.z += (tz - camera.position.z) * smoothFactor;

      // Look target: ALWAYS the current spacecraft world position
      const lookUpOff = phase === 'PARACHUTE_DESCENT' ? 0.45 : 0.0;
      camera.lookAt(lx + upX * lookUpOff, ly + upY * lookUpOff, lz + upZ * lookUpOff);

    } else if (cameraMode === 'ORBIT_OVERVIEW') {
      const overviewDist = altKm > 100 ? 500 : altKm > 20 ? 200 : 45;
      const elevAngle = 0.52;
      let tx = lx - Math.cos(elevAngle) * overviewDist * 0.4;
      let ty = ly + Math.sin(elevAngle) * overviewDist * 0.6;
      let tz = lz + overviewDist;
      [tx, ty, tz] = safeClamp(tx, ty, tz);

      camera.position.x += (tx - camera.position.x) * 0.05;
      camera.position.y += (ty - camera.position.y) * 0.05;
      camera.position.z += (tz - camera.position.z) * 0.05;
      camera.lookAt(lx, ly, lz);

    } else if (cameraMode === 'FREE') {
      const { theta, phi, radius } = freeCamAngle.current;
      let tx = lx + radius * Math.sin(phi) * Math.sin(theta);
      let ty = ly + radius * Math.cos(phi);
      let tz = lz + radius * Math.sin(phi) * Math.cos(theta);
      [tx, ty, tz] = safeClamp(tx, ty, tz);

      camera.position.x += (tx - camera.position.x) * 0.15;
      camera.position.y += (ty - camera.position.y) * 0.15;
      camera.position.z += (tz - camera.position.z) * 0.15;
      camera.lookAt(lx, ly, lz);
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// 4. SceneLighting – Authentic Single-Sun Mars Illumination
// ---------------------------------------------------------------------------
function SceneLighting() {
  return (
    <>
      {/* Primary Martian Sun: warm off-white, dramatic angle creating visible terminator */}
      <directionalLight
        position={[350, 500, 180]}
        intensity={1.35}
        color="#ffe8d6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={5000}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0002}
        shadow-normalBias={0.04}
      />
      {/* Faint ambient: prevents pitch-black shadows while keeping night side deep rust-brown */}
      <ambientLight intensity={0.045} color="#220904" />
      {/* Subtle sky/ground bounce */}
      <hemisphereLight
        skyColor="#04020a"
        groundColor="#2d0f06"
        intensity={0.18}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// 5. Main Simulation Canvas Component
// ---------------------------------------------------------------------------
export default function SimulationCanvas() {
  const simStateRef  = useRef(createInitialState());
  const accumRef     = useRef(0);
  const [running, setRunning]       = useState(false);
  const [cameraMode, setCameraMode] = useState('CHASE');

  const handleStart  = useCallback(() => { simStateRef.current.running = true; setRunning(true); }, []);
  const handleReset  = useCallback(() => {
    simStateRef.current = createInitialState(); accumRef.current = 0; setRunning(false);
  }, []);
  const handleTriggerDeorbit = useCallback(() => {
    if (simStateRef.current) {
      simStateRef.current.triggerDeorbit = true;
      simStateRef.current.running = true;
      setRunning(true);
    }
  }, []);
  const handleCameraChange = useCallback((mode) => setCameraMode(mode), []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Mission Banner */}
      <div style={{
        position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, pointerEvents: 'none', textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          background: 'rgba(5, 8, 18, 0.85)',
          border: '1px solid rgba(184, 90, 56, 0.45)',
          borderRadius: '8px', padding: '6px 24px',
          letterSpacing: '0.15em', fontSize: '11px', color: '#d4793a',
          textTransform: 'uppercase', backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.85)',
        }}>
          🚀 Mars EDL Simulator — Autonomous Entry &amp; Landing
        </div>
      </div>

      <DebugHUD
        simStateRef={simStateRef}
        running={running}
        cameraMode={cameraMode}
        onStart={handleStart}
        onReset={handleReset}
        onTriggerDeorbit={handleTriggerDeorbit}
        onCameraChange={handleCameraChange}
      />

      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 2]}
        style={{ background: '#01010a' }}
      >
        <RendererConfig />
        <PhysicsRunner simStateRef={simStateRef} accumRef={accumRef} />
        <TrackingCamera simStateRef={simStateRef} cameraMode={cameraMode} />
        <SceneLighting />
        <StarField />
        <MarsGlobe />
        <OrbitalTrajectory simStateRef={simStateRef} />
        <MarsSurface />
        <LandingSiteGrid simStateRef={simStateRef} />
        <Lander simStateRef={simStateRef} />
      </Canvas>
    </div>
  );
}
