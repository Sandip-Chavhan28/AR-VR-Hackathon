/**
 * DiagnosticsOverlay.jsx – Real-Time Developer Diagnostics HUD.
 *
 * Toggled via 'D' key shortcut:
 *   - FPS counter & frame time
 *   - Renderer resolution & DPR
 *   - WebGL Context status & GPU vendor
 *   - Current EDL State machine phase
 *   - Simulation elapsed time & time scale
 *   - Vehicle Position (X, Y, Z meters & render units)
 *   - Altitude, velocity vector, ground speed, Mach
 *   - Camera Mode, Camera XYZ, Camera Target XYZ, Distance to vehicle
 *   - Scene object count & active lights
 */

import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RENDER_SCALE, JEZERO_TARGET_X, JEZERO_TARGET_Z } from '../simulation/physics/constants.js';
import { getTerrainSourceInfo } from '../simulation/landingSite/terrain.js';
import { writeVehicleWorldPosition } from './marsSurfaceFrame.js';

export default function DiagnosticsOverlay({
  isOpen,
  simStateRef,
  cameraRef,
  cameraMode,
  webGLStatsRef,
}) {
  const [diag, setDiag] = useState(null);
  const lastSampleTimeRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;

    let animId;
    const updateDiag = () => {
      const now = performance.now();
      // Throttle React state updates to 10Hz (every 100ms) to eliminate React re-render lag
      if (now - lastSampleTimeRef.current >= 100) {
        lastSampleTimeRef.current = now;

        const s = simStateRef?.current;
        const cam = cameraRef?.current;
        const stats = webGLStatsRef?.current || {};

        const physX = s?.x || 0;
        const physY = Number.isFinite(s?.altitude) ? s.altitude : (s?.y || 0);
        const physZ = s?.z || 0;
        const tgtX = (s?.guidanceRefX !== undefined ? s.guidanceRefX : JEZERO_TARGET_X) + (s?.landingSiteAnalysis?.selectedTarget?.x || 0);
        const tgtZ = (s?.guidanceRefZ !== undefined ? s.guidanceRefZ : JEZERO_TARGET_Z) + (s?.landingSiteAnalysis?.selectedTarget?.z || 0);
        const dx = physX - tgtX;
        const dz = physZ - tgtZ;
        const groundDist = Math.hypot(dx, dz);
        const altM = Math.max(0, s?.radarAltitude !== undefined ? s.radarAltitude : (s?.altitude || 0));
        const distTarget = s?.grounded ? (s?.landingError || 0) : Math.hypot(groundDist, altM);

        const vHoriz = Math.hypot(s?.vx || 0, s?.vz || 0);
        const vVert = s?.verticalVelocity !== undefined ? s.verticalVelocity : (s?.vy || 0);

        const vehicleWorldPos = new THREE.Vector3();
        if (s) writeVehicleWorldPosition(s, vehicleWorldPos);
        const distToVehicle = cam && s ? cam.position.distanceTo(vehicleWorldPos) : 0;

        const wheelContacts = s?.wheelContacts || {};
        const wheelNames = ['FL', 'FR', 'ML', 'MR', 'RL', 'RR'];
        const wheelContactString = wheelNames.map(id => `${id}:${wheelContacts[id] ? 'OK' : '--'}`).join(' ');

        setDiag({
          fps: stats.fps || 60,
          frameTimeMs: stats.frameTimeMs || 16.6,
          drawCalls: stats.drawCalls || 0,
          triangles: stats.triangles || 0,
          geometries: stats.geometries || 0,
          textures: stats.textures || 0,
          width: window.innerWidth,
          height: window.innerHeight,
          dpr: window.devicePixelRatio || 1,
          phase: s?.phase || 'UNKNOWN',
          elapsed: s?.elapsed || 0,
          timeScale: s?.timeScale || 1,
          mode: s?.mode || 'DEMO',
          x: physX,
          y: physY,
          z: physZ,
          alt: s?.altitude || 0,
          radarAlt: s?.radarAltitude !== undefined ? s.radarAltitude : (s?.altitude || 0),
          radarLocked: !!s?.radarLocked,
          speed: s?.speed || 0,
          vHoriz,
          vVert,
          distTarget,
          throttle: s?.throttle || 0,
          thrust: s?.enginesActive ? (s?.thrust || 32000) * (s?.throttle || 1.0) : 0,
          grounded: !!s?.grounded,
          mach: s?.mach || 0,
          camX: cam ? cam.position.x : 0,
          camY: cam ? cam.position.y : 0,
          camZ: cam ? cam.position.z : 0,
          camMode: cameraMode,
          distToVehicle,
          heatShieldSep: !!s?.heatShieldSeparated,
          backshellSep: !!s?.backshellSeparated,
          chuteState: s?.parachuteState || 'PACKED',
          enginesActive: !!s?.enginesActive,
          fuel: s?.fuel || 0,
          terrain: getTerrainSourceInfo(),
          writer: 'integrator.js (stepSimulation: semi-implicit Euler)',
          // 6-Wheel Terrain Contact & Suspension Telemetry
          wheelContactCount: s?.wheelContactCount || 0,
          wheelContactSummary: `${s?.wheelContactCount || 0}/6 (${wheelContactString})`,
          wheelClearance: s?.wheelClearance !== undefined ? s.wheelClearance : (s?.minWheelClearance || 0),
          roverBodyHeight: s?.roverBodyAltitude !== undefined ? s.roverBodyAltitude : (s?.radarAltitude || 0),
          roverSettled: !!s?.roverSettled,
          touchdownStage: s?.touchdownState || (s?.grounded ? 'SURFACE_OPERATIONS' : 'APPROACH'),
          cableState: s?.cablesReleased ? 'RELEASED / CUT' : (s?.skyCraneActive ? 'TETHER EXTENDED' : 'RETRACTED'),
          flyawayActive: !!s?.descentStageFlyaway,
        });
      }

      animId = requestAnimationFrame(updateDiag);
    };

    animId = requestAnimationFrame(updateDiag);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, simStateRef, cameraRef, cameraMode, webGLStatsRef]);

  if (!isOpen || !diag) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '70px',
        left: '32px',
        zIndex: 999,
        background: 'rgba(3, 7, 18, 0.90)',
        border: '1px solid #00e5ff',
        borderRadius: '6px',
        padding: '12px 16px',
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '11px',
        lineHeight: 1.45,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 0 20px rgba(0, 229, 255, 0.25)',
        pointerEvents: 'none',
        userSelect: 'none',
        maxWidth: '420px',
      }}
    >
      <div style={{ color: '#00e5ff', fontWeight: 800, marginBottom: '6px', letterSpacing: '0.1em' }}>
        [DEVELOPER FLIGHT DIAGNOSTICS — PRESS D TO HIDE]
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '3px 8px' }}>
        <span style={{ color: '#94a3b8' }}>PERF / FPS:</span>
        <span style={{ color: diag.fps >= 50 ? '#00e676' : diag.fps >= 30 ? '#ffaa66' : '#ff4444', fontWeight: 700 }}>
          {diag.fps} FPS ({diag.frameTimeMs.toFixed(1)} ms)
        </span>

        <span style={{ color: '#94a3b8' }}>DRAW CALLS / TRIS:</span>
        <span style={{ color: '#38bdf8', fontWeight: 600 }}>
          {diag.drawCalls} calls | {diag.triangles.toLocaleString()} triangles
        </span>

        <span style={{ color: '#94a3b8' }}>GPU MEMORY:</span>
        <span>{diag.geometries} geometries | {diag.textures} textures</span>

        <span style={{ color: '#94a3b8' }}>RESOLUTION:</span>
        <span>{diag.width}×{diag.height} @ {diag.dpr}x DPR</span>

        <span style={{ color: '#94a3b8' }}>EDL STATE:</span>
        <span style={{ color: '#ffaa66', fontWeight: 700 }}>{diag.phase}</span>

        <span style={{ color: '#94a3b8' }}>TERRAIN SOURCE:</span>
        <span style={{ color: diag.terrain.loaded ? '#00e676' : '#ffaa66', fontWeight: 700 }}>
          {diag.terrain.source} | {diag.terrain.samples.toLocaleString()} samples
        </span>
        {diag.terrain.loaded && (
          <>
            <span style={{ color: '#94a3b8' }}>MOLA PRODUCT:</span>
            <span>{diag.terrain.product}</span>
            <span style={{ color: '#94a3b8' }}>MOLA ELEVATION:</span>
            <span>{diag.terrain.minimumMeters} to {diag.terrain.maximumMeters} m | anchor {diag.terrain.anchorMeters.toFixed(0)} m</span>
          </>
        )}

        <span style={{ color: '#94a3b8' }}>SIM TIME / SCALE:</span>
        <span>{diag.elapsed.toFixed(1)}s (at {diag.timeScale}× [{diag.mode}])</span>

        <span style={{ color: '#94a3b8' }}>VEHICLE POS (M):</span>
        <span>X: {diag.x.toFixed(0)}, Y: {diag.y.toFixed(0)}, Z: {diag.z.toFixed(0)}</span>

        <span style={{ color: '#94a3b8' }}>ALTITUDE / SPEED:</span>
        <span>{(diag.alt / 1000).toFixed(2)} km | {diag.speed.toFixed(1)} m/s (M {diag.mach.toFixed(2)})</span>

        <span style={{ color: '#94a3b8' }}>RADAR ALT (AGL):</span>
        <span style={{ color: diag.radarLocked ? '#00e676' : '#94a3b8', fontWeight: 600 }}>
          {diag.radarAlt > 1000 ? `${(diag.radarAlt / 1000).toFixed(2)} km` : `${diag.radarAlt.toFixed(1)} m`} {diag.radarLocked ? '[LOCKED]' : '[SEARCHING]'}
        </span>

        <span style={{ color: '#94a3b8' }}>V-VERT / V-HORIZ:</span>
        <span>{diag.vVert.toFixed(1)} m/s (vertical) | {diag.vHoriz.toFixed(1)} m/s (lateral)</span>

        <span style={{ color: '#94a3b8' }}>DIST TO TARGET:</span>
        <span style={{ color: '#00e676', fontWeight: 700 }}>
          {diag.distTarget > 1000 ? `${(diag.distTarget / 1000).toFixed(2)} km` : `${diag.distTarget.toFixed(1)} m`}
        </span>

        <span style={{ color: '#94a3b8' }}>THROTTLE / THRUST:</span>
        <span style={{ color: diag.enginesActive ? '#ffaa66' : '#94a3b8' }}>
          {(diag.throttle * 100).toFixed(0)}% | {diag.thrust.toFixed(0)} N {diag.enginesActive ? '[FIRING]' : '[OFF]'}
        </span>

        <span style={{ color: '#94a3b8' }}>TOUCHDOWN STATE:</span>
        <span style={{ color: diag.grounded ? '#00e676' : '#38bdf8', fontWeight: 700 }}>
          {diag.grounded ? 'TOUCHDOWN CONFIRMED (SURFACE)' : 'AIRBORNE DESCENT'}
        </span>

        <span style={{ color: '#94a3b8' }}>POSITION WRITER:</span>
        <span style={{ color: '#facc15' }}>{diag.writer}</span>

        <span style={{ color: '#94a3b8' }}>CAMERA MODE:</span>
        <span style={{ color: '#38bdf8' }}>{diag.camMode}</span>

        <span style={{ color: '#94a3b8' }}>CAMERA POS:</span>
        <span>[{diag.camX.toFixed(1)}, {diag.camY.toFixed(1)}, {diag.camZ.toFixed(1)}]</span>

        <span style={{ color: '#94a3b8' }}>DIST TO VEHICLE:</span>
        <span style={{ color: '#00e676', fontWeight: 700 }}>{diag.distToVehicle.toFixed(2)} units</span>

        <span style={{ color: '#94a3b8' }}>HEAT SHIELD / CHUTE:</span>
        <span>{diag.heatShieldSep ? 'JETTISONED' : 'ATTACHED'} | {diag.chuteState}</span>

        <span style={{ color: '#94a3b8' }}>BACKSHELL / PROP:</span>
        <span>{diag.backshellSep ? 'RELEASED' : 'ATTACHED'} | {diag.fuel.toFixed(1)} kg</span>

        {/* 6-Wheel Terrain Contact Telemetry */}
        <span style={{ color: '#00e5ff', gridColumn: 'span 2', fontWeight: 700, marginTop: '4px', borderTop: '1px solid rgba(0,229,255,0.3)', paddingTop: '4px' }}>
          [6-WHEEL SURFACE CONTACT & SUSPENSION]
        </span>

        <span style={{ color: '#94a3b8' }}>TOUCHDOWN STAGE:</span>
        <span style={{ color: diag.grounded ? '#00e676' : '#ffaa66', fontWeight: 700 }}>
          {diag.touchdownStage}
        </span>

        <span style={{ color: '#94a3b8' }}>WHEEL CONTACTS:</span>
        <span style={{ color: diag.wheelContactCount >= 4 ? '#00e676' : diag.wheelContactCount > 0 ? '#ffaa66' : '#94a3b8', fontWeight: 700 }}>
          {diag.wheelContactSummary}
        </span>

        <span style={{ color: '#94a3b8' }}>WHEEL CLEARANCE:</span>
        <span style={{ color: diag.wheelClearance <= 0.05 ? '#00e676' : '#38bdf8' }}>
          {diag.wheelClearance.toFixed(3)} m (min clearance)
        </span>

        <span style={{ color: '#94a3b8' }}>ROVER BODY HEIGHT:</span>
        <span>{diag.roverBodyHeight.toFixed(2)} m</span>

        <span style={{ color: '#94a3b8' }}>ROVER SETTLED:</span>
        <span style={{ color: diag.roverSettled ? '#00e676' : '#94a3b8', fontWeight: 700 }}>
          {diag.roverSettled ? 'YES (6-WHEEL RIGID EQUILIBRIUM)' : 'NO (AIRBORNE / TRANSIENT)'}
        </span>

        <span style={{ color: '#94a3b8' }}>CABLE STATE:</span>
        <span style={{ color: diag.cableState.includes('RELEASED') ? '#00e676' : '#ffaa66' }}>
          {diag.cableState}
        </span>
      </div>
    </div>
  );
}