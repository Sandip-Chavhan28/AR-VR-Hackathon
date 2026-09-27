/**
 * FlightDirectorHUD.jsx – Faithful NASA/JPL Mars 2020 Eyes EDL Interface.
 *
 * Implements:
 *   1. TOP-LEFT MISSION BRANDING:
 *       • "MARS 2020 | ENTRY DESCENT LANDING" in clean vertical hierarchy
 *   2. TOP-CENTER STATUS:
 *       • "PRE-LANDING SIMULATION" subtle uppercase pill badge
 *   3. TOP-RIGHT ABOUT:
 *       • Circular (i) info button opening minimal mission briefing
 *   4. LEFT-SIDE MISSION STORYTELLING PANEL:
 *       • Large thin typography event heading (e.g. "PARACHUTE DEPLOY")
 *       • Primary 3 Telemetry metrics with instant Metric ⇄ Imperial conversion
 *       • Factual aerospace narrative description for each event
 *       • Dynamic countdown: "Touchdown in: HH:MM:SS"
 *       • Next phase lookahead: "Next phase: [NAME] in MM:SS"
 *   5. LOWER-LEFT INTERACTION CUE:
 *       • "Scroll for next phase ↓" with animated bouncing cue
 *   6. RIGHT-SIDE COMPACT NAVIGATION CONTROLS:
 *       • Zoom In (+), Zoom Out (-), Reset/Focus (⟲), Auto Camera (AUTO)
 *       • Fullscreen (⛶), Unit Toggle (METRIC ⇄ IMPERIAL)
 *       • Deep Technical Telemetry Drawer toggle (📊)
 *       • DEMO vs REALISTIC mode toggle
 *   7. DEEP TECHNICAL TELEMETRY DRAWER:
 *       • Live Mach, dynamic pressure, G-force bar, Sutton-Graves heat flux,
 *         propellant gauge, pitch/roll, and subsystems status
 */

import React, { useState, useEffect, useRef } from 'react';
import { PROPELLANT_MASS } from '../simulation/physics/constants.js';
import { detectMilestone, EDL_MILESTONES } from '../simulation/missionEvents.js';

export const CAMERA_PRESETS = [
  {
    id: 'FREE',
    label: 'FREE ORBIT',
    icon: '🎮',
    shortcut: 'F',
    cameraMode: 'FREE',
  },
  {
    id: 'EXPLORE_FRONT',
    label: 'FRONT PROFILE',
    icon: '🔭',
    shortcut: '1',
    cameraMode: 'EXPLORE_FRONT',
  },
  {
    id: 'EXPLORE_HIGH',
    label: 'AERIAL OVERVIEW',
    icon: '🛸',
    shortcut: '2',
    cameraMode: 'EXPLORE_HIGH',
  },
  {
    id: 'EXPLORE_LOW',
    label: 'GROUND LEVEL',
    icon: '📷',
    shortcut: '3',
    cameraMode: 'EXPLORE_LOW',
  },
  {
    id: 'EXPLORE_REAR',
    label: 'REAR / MMRTG',
    icon: '⚛️',
    shortcut: '4',
    cameraMode: 'EXPLORE_REAR',
  },
  {
    id: 'EXPLORE_DRAMATIC',
    label: 'CINEMATIC ORBIT',
    icon: '🎬',
    shortcut: '5',
    cameraMode: 'EXPLORE_DRAMATIC',
  },
  {
    id: 'EXPLORE_TOUR',
    label: 'AUTO TOUR',
    icon: '🚀',
    shortcut: 'T',
    cameraMode: 'EXPLORE_TOUR',
  },
];

function isCameraPresetActive(preset, cameraMode) {
  if (!cameraMode) return false;
  if (cameraMode === 'AUTO') return false;
  if (preset.cameraMode === cameraMode) return true;
  if (preset.id === 'FREE' && (cameraMode === 'FREE' || cameraMode === 'EXPLORE_FREE')) return true;
  if (preset.id === 'EXPLORE_DRAMATIC' && cameraMode === 'GROUND_TOUCHDOWN') return true;
  return false;
}

export default function FlightDirectorHUD({
  simStateRef,
  running,
  cameraMode,
  timeScale,
  units = 'metric',
  mode = 'DEMO',
  isPresentationMode = false,
  onTogglePlay,
  onReset,
  onTimeScaleChange,
  onCameraChange,
  onSelectMilestone,
  onToggleUnits,
  onToggleMode,
  onToggleTRN,
  onToggleGraphs,
  trajectoryVisible = true,
  onToggleTrajectory,
  roverInspectionOpen = false,
  onToggleRoverInspection,
  onCloseRoverInspection,
  onOpenInfo,
  trnOpen,
  graphsOpen,
  isMuted,
  onToggleMute,
}) {
  const [snap, setSnap] = useState(null);
  const [telemetryDrawerOpen, setTelemetryDrawerOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef(null);
  const viewBtnRef = useRef(null);
  const intervalRef = useRef(null);

  // Close View Selector on click outside or ESC key; support preset shortcuts when menu open
  useEffect(() => {
    if (!viewMenuOpen) return;

    const handleClickOutside = (e) => {
      if (
        viewMenuRef.current &&
        !viewMenuRef.current.contains(e.target) &&
        viewBtnRef.current &&
        !viewBtnRef.current.contains(e.target)
      ) {
        setViewMenuOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setViewMenuOpen(false);
        return;
      }

      const key = e.key.toUpperCase();
      const preset = CAMERA_PRESETS.find((p) => p.shortcut === key);
      if (preset) {
        e.preventDefault();
        onCameraChange(preset.cameraMode);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewMenuOpen, onCameraChange]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const s = simStateRef.current;
      if (!s) return;

      const milestone = detectMilestone(s);
      const fuelVal = s.fuel !== undefined ? s.fuel : PROPELLANT_MASS;
      const fuelPct = (fuelVal / PROPELLANT_MASS) * 100;

      // True physical distance to landing target (3D slant range to Jezero Crater datum)
      const tgtX = (s.guidanceRefX !== undefined ? s.guidanceRefX : 513808.0) + (s.landingSiteAnalysis?.selectedTarget?.x || 0);
      const tgtZ = (s.guidanceRefZ !== undefined ? s.guidanceRefZ : 0.0) + (s.landingSiteAnalysis?.selectedTarget?.z || 0);
      const dx = (s.x || 0) - tgtX;
      const dz = (s.z || 0) - tgtZ;
      const groundDist = Math.hypot(dx, dz);
      const effAlt = Math.max(0, s.radarAltitude !== undefined ? s.radarAltitude : (s.altitude || 0));
      const distTargetM = s.grounded ? (s.landingError || 0) : Math.hypot(groundDist, effAlt);

      setSnap({
        altitude: s.altitude || 0,
        altitudeKm: (s.altitude || 0) / 1000,
        radarAltitude: s.radarAltitude !== undefined ? s.radarAltitude : (s.altitude || 0),
        speed: s.speed || 0,
        mach: s.mach || (s.speed || 0) / 225,
        verticalVelocity: s.verticalVelocity || 0,
        distTargetM,
        gForce: s.gForce || 0,
        q: s.q || 0,
        heatFluxWcm2: (s.heatFlux || 0) / 10000,
        fuel: fuelVal,
        fuelPct,
        enginesActive: !!s.enginesActive,
        heatShieldSeparated: !!s.heatShieldSeparated,
        radarLocked: !!s.radarLocked,
        trnActive: !!s.trnActive,
        backshellSeparated: !!s.backshellSeparated,
        skyCraneActive: !!s.skyCraneActive,
        cruiseStageSeparated: !!s.cruiseStageSeparated,
        parachuteState: s.parachuteState || 'PACKED',
        phase: s.phase || 'MARS_ORBIT',
        milestone,
        grounded: !!s.grounded,
        elapsed: s.elapsed || 0,
        landingError: s.landingError,
        decisionLog: s.landingSiteAnalysis?.decisionLog || [],
      });
    }, 100);

    return () => clearInterval(intervalRef.current);
  }, [simStateRef]);

  if (!snap) return null;

  const m = snap.milestone;
  const isLanded = snap.grounded || snap.phase === 'LANDED';

  // Physical ETA to touchdown calculation (never reaches 0 until physical touchdown occurs)
  let estSecondsLeft = 0;
  if (!isLanded) {
    if (snap.altitude <= 0.6) {
      estSecondsLeft = 0;
    } else if (snap.altitude <= 2500) {
      // In terminal powered descent / sky crane
      const vDown = Math.max(0.75, -snap.verticalVelocity);
      if (snap.skyCraneActive || snap.altitude <= 30) {
        estSecondsLeft = Math.max(1, Math.round(snap.altitude / 0.75));
      } else {
        // Powered descent from ~1800m down to 25m, then 33s of sky crane
        estSecondsLeft = Math.max(1, Math.round((snap.altitude - 25) / Math.max(5.0, vDown) + 33));
      }
    } else if (snap.altitude <= 10000) {
      // Parachute descent from 10km to 1.8km (~115s) + powered descent (~45s) + sky crane (33s)
      const vDown = Math.max(15, -snap.verticalVelocity);
      estSecondsLeft = Math.max(1, Math.round((snap.altitude - 1800) / vDown + 78));
    } else {
      // Entry / coast / orbit
      estSecondsLeft = Math.max(1, Math.round(1915 - snap.elapsed));
    }
  }

  const cdH = String(Math.floor(estSecondsLeft / 3600)).padStart(2, '0');
  const cdM = String(Math.floor((estSecondsLeft % 3600) / 60)).padStart(2, '0');
  const cdS = String(Math.floor(estSecondsLeft % 60)).padStart(2, '0');
  const countdownStr = `${cdH}:${cdM}:${cdS}`;

  // Unit conversions
  let distStr = '';
  let altStr = '';
  let velStr = '';

  if (units === 'metric') {
    distStr = snap.distTargetM > 1000
      ? `${(snap.distTargetM / 1000).toFixed(1)} km`
      : `${snap.distTargetM.toFixed(0)} m`;
    altStr = snap.altitudeKm > 1
      ? `${snap.altitudeKm.toFixed(1)} km`
      : `${snap.altitude.toFixed(0)} m`;
    velStr = `${(snap.speed * 3.6).toFixed(0)} km/h`;
  } else {
    // Imperial
    const distMiles = snap.distTargetM * 0.000621371;
    distStr = distMiles >= 1.0 ? `${distMiles.toFixed(1)} mi` : `${(snap.distTargetM * 3.28084).toFixed(0)} ft`;
    const altFeet = snap.altitude * 3.28084;
    altStr = altFeet > 5280 ? `${(altFeet / 5280).toFixed(1)} mi` : `${altFeet.toFixed(0)} ft`;
    velStr = `${(snap.speed * 2.23694).toFixed(0)} mph`;
  }

  // Navigation handlers
  const handleNextMilestone = () => {
    const curIdx = EDL_MILESTONES.findIndex((item) => item.id === m.id);
    if (curIdx < EDL_MILESTONES.length - 1) {
      onSelectMilestone(EDL_MILESTONES[curIdx + 1].id);
    }
  };

  const handlePrevMilestone = () => {
    const curIdx = EDL_MILESTONES.findIndex((item) => item.id === m.id);
    if (curIdx > 0) {
      onSelectMilestone(EDL_MILESTONES[curIdx - 1].id);
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <>
      {/* ── TOP-LEFT BRANDING (NASA Eyes Style) ───────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          left: '32px',
          zIndex: 25,
          pointerEvents: 'auto',
          userSelect: 'none',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '0.22em',
              color: '#ffffff',
              textTransform: 'uppercase',
            }}
          >
            MARS
          </div>
          <div
            style={{
              fontSize: '9px',
              fontWeight: 600,
              letterSpacing: '0.2em',
              color: 'rgba(255, 255, 255, 0.7)',
              textTransform: 'uppercase',
              marginTop: '6px',
            }}
          >
            ENTRY DESCENT LANDING
          </div>
        </div>
      </div>

      {/* ── TOP-CENTER SUBTLE STATUS ──────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 25,
          pointerEvents: 'none',
          userSelect: 'none',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div
          style={{
            background: 'rgba(5, 10, 20, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            padding: '5px 16px',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isLanded ? '#00e676' : '#ff7722',
              boxShadow: `0 0 8px ${isLanded ? '#00e676' : '#ff7722'}`,
            }}
          />
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: '#cbd5e1',
              textTransform: 'uppercase',
            }}
          >
            {isLanded ? 'MISSION SUCCESS — SURFACE OPERATIONS' : 'PRE-LANDING SIMULATION'}
          </span>
        </div>
      </div>

      {/* ── TOP-RIGHT INFO & SETTINGS ─────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          right: '32px',
          zIndex: 25,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {/* Presentation mode badge */}
        {isPresentationMode && (
          <div
            style={{
              background: 'rgba(0, 229, 255, 0.2)',
              border: '1px solid #00e5ff',
              borderRadius: '4px',
              padding: '3px 8px',
              fontSize: '9px',
              fontWeight: 700,
              color: '#00e5ff',
            }}
          >
            PRESENTATION MODE (P)
          </div>
        )}

        {/* Mission-Control Audio Control */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          title={isMuted ? 'Unmute Mission Audio (M)' : 'Mute Mission Audio (M)'}
          style={{
            height: '32px',
            padding: '0 12px',
            borderRadius: '16px',
            background: isMuted ? 'rgba(45, 12, 12, 0.85)' : 'rgba(6, 32, 20, 0.85)',
            border: isMuted ? '1px solid rgba(255, 60, 60, 0.45)' : '1px solid rgba(0, 230, 118, 0.45)',
            color: isMuted ? '#ff5252' : '#00e676',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.15s ease',
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: '12px' }}>{isMuted ? '🔇' : '🔊'}</span>
          <span>{isMuted ? 'MUTED' : 'SOUND ON'}</span>
        </button>

        {/* Info (i) button */}
        <button
          onClick={onOpenInfo}
          title="Mission Information"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'rgba(5, 10, 20, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 800,
            fontFamily: 'serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.15s ease',
          }}
        >
          i
        </button>
      </div>

      {/* ── LEFT-SIDE MISSION STORYTELLING PANEL (NASA Eyes Layout) ────── */}
      <div
        style={{
          position: 'absolute',
          top: '110px',
          left: '32px',
          width: '320px',
          zIndex: 20,
          pointerEvents: 'none',
          userSelect: 'none',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {/* Event Title */}
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 300,
            letterSpacing: '0.04em',
            color: '#ffffff',
            margin: '0 0 16px 0',
            lineHeight: 1.15,
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
          }}
        >
          {m.title}
        </h1>

        {/* Primary 3 Telemetry Metrics */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '18px',
            paddingBottom: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '0.06em' }}>
              distance from landing site
            </span>
            <span
              className="font-mono-numbers"
              style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}
            >
              {distStr}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '11px', color: snap.radarLocked ? '#00e676' : '#94a3b8', letterSpacing: '0.06em' }}>
              {snap.radarLocked ? 'radar altitude (AGL)' : 'altitude'}
            </span>
            <span
              className="font-mono-numbers"
              style={{ fontSize: '15px', fontWeight: 600, color: snap.radarLocked ? '#00e676' : '#f8fafc' }}
            >
              {snap.radarLocked
                ? (units === 'metric'
                    ? (snap.radarAltitude > 1000
                        ? `${(snap.radarAltitude / 1000).toFixed(1)} km`
                        : (snap.radarAltitude < 50
                            ? `${snap.radarAltitude.toFixed(1)} m`
                            : `${snap.radarAltitude.toFixed(0)} m`))
                    : (snap.radarAltitude * 3.28084 > 5280
                        ? `${((snap.radarAltitude * 3.28084) / 5280).toFixed(1)} mi`
                        : `${(snap.radarAltitude * 3.28084).toFixed(0)} ft`))
                : altStr}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '0.06em' }}>
              velocity
            </span>
            <span
              className="font-mono-numbers"
              style={{ fontSize: '15px', fontWeight: 600, color: '#00e5ff' }}
            >
              {velStr}
            </span>
          </div>
        </div>

        {/* Narrative Description */}
        <p
          style={{
            fontSize: '12px',
            lineHeight: 1.6,
            color: 'rgba(255, 255, 255, 0.85)',
            margin: '0 0 20px 0',
            fontWeight: 400,
            textShadow: '0 1px 4px rgba(0, 0, 0, 0.8)',
          }}
        >
          {m.narrative || m.description}
        </p>

        {/* Countdown to Touchdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '14px' }}>
          <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {isLanded ? 'MISSION STATUS' : 'TOUCHDOWN ETA:'}
          </span>
          <span
            className="font-mono-numbers"
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: isLanded ? '#00e676' : '#ffaa66',
              letterSpacing: '0.05em',
            }}
          >
            {isLanded ? 'TOUCHDOWN CONFIRMED' : countdownStr}
          </span>
        </div>

        {/* Next Phase Indicator */}
        {!isLanded && m.nextMilestone && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              NEXT PHASE:
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>
              {m.nextMilestone}
              {m.timeToNextSec > 0 && (
                <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: '6px' }}>
                  in {Math.floor(m.timeToNextSec / 60)}m {m.timeToNextSec % 60}s
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── LOWER-LEFT INTERACTION: "Scroll for next phase ↓" ─────────── */}
      {!isPresentationMode && (
        <div
          style={{
            position: 'absolute',
            bottom: '95px',
            left: '32px',
            zIndex: 25,
            pointerEvents: 'none',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'rgba(255, 255, 255, 0.75)',
            fontFamily: 'var(--font-ui)',
            fontSize: '11px',
            letterSpacing: '0.08em',
            transition: 'color 0.2s ease',
          }}
        >
          <span>Scroll for next phase</span>
          <span style={{ fontSize: '14px', animation: 'bounceDown 1.5s infinite' }}>↓</span>
        </div>
      )}

      {/* ── RIGHT-SIDE NAVIGATION CONTROLS (NASA Eyes Vertical Stack) ─── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: '24px',
          transform: 'translateY(-50%)',
          zIndex: 25,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {/* Zoom In */}
        <button
          onClick={() => onCameraChange('ZOOM_IN')}
          title="Zoom In"
          className="hud-ctrl-btn"
          style={rightBtnStyle}
        >
          +
        </button>

        {/* Zoom Out */}
        <button
          onClick={() => onCameraChange('ZOOM_OUT')}
          title="Zoom Out"
          className="hud-ctrl-btn"
          style={rightBtnStyle}
        >
          −
        </button>

        {/* Reset Camera Focus */}
        <button
          onClick={() => onCameraChange('CHASE')}
          title="Reset Camera Target (1)"
          className="hud-ctrl-btn"
          style={rightBtnStyle}
        >
          ⟲
        </button>

        {/* Auto Camera Toggle */}
        <button
          onClick={() => onCameraChange(cameraMode === 'AUTO' ? 'CHASE' : 'AUTO')}
          title="Toggle Auto Event-Driven Camera"
          className="hud-ctrl-btn"
          style={{
            ...rightBtnStyle,
            fontSize: '9px',
            fontWeight: 800,
            color: cameraMode === 'AUTO' ? '#00e5ff' : '#cbd5e1',
            border: cameraMode === 'AUTO' ? '1px solid #00e5ff' : rightBtnStyle.border,
          }}
        >
          AUTO
        </button>

        {/* Fullscreen */}
        <button
          onClick={handleToggleFullscreen}
          title="Toggle Fullscreen"
          className="hud-ctrl-btn"
          style={rightBtnStyle}
        >
          ⛶
        </button>

        {/* Unit Toggle: Metric vs Imperial */}
        <button
          onClick={onToggleUnits}
          title="Toggle Units (U): Metric (km, m/s) / Imperial (mi, mph)"
          className="hud-ctrl-btn"
          style={{
            ...rightBtnStyle,
            fontSize: '8px',
            fontWeight: 800,
            padding: '2px',
          }}
        >
          {units === 'metric' ? 'KM' : 'MI'}
        </button>

        {/* Technical Telemetry Drawer Toggle */}
        <button
          onClick={() => {
            const opening = !telemetryDrawerOpen;
            setTelemetryDrawerOpen(opening);
            if (opening) onCloseRoverInspection?.();
          }}
          title="Toggle Deep Technical Telemetry Drawer"
          className="hud-ctrl-btn"
          style={{
            ...rightBtnStyle,
            fontSize: '11px',
            color: telemetryDrawerOpen ? '#00e5ff' : '#cbd5e1',
          }}
        >
          📊
        </button>

        {/* Rover Inspection panel toggle */}
        <button
          onClick={() => {
            if (!roverInspectionOpen) setTelemetryDrawerOpen(false);
            onToggleRoverInspection?.();
          }}
          title="Open or close Rover Inspection"
          aria-label="Rover Inspection"
          aria-expanded={roverInspectionOpen}
          aria-controls="rover-inspection-panel"
          className="hud-ctrl-btn"
          style={{
            ...rightBtnStyle,
            width: '40px',
            padding: '2px',
            flexDirection: 'column',
            gap: 0,
            fontSize: '5px',
            lineHeight: '5px',
            fontWeight: 800,
            color: roverInspectionOpen ? '#ff8c00' : '#cbd5e1',
            border: roverInspectionOpen ? '1px solid #ff8c00' : '1px solid rgba(255, 140, 0, 0.35)',
            background: roverInspectionOpen ? 'rgba(255, 140, 0, 0.15)' : 'rgba(5, 10, 20, 0.8)',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '8px', lineHeight: '9px' }}>🔭</span>
          <span>ROVER</span>
          <span>INSPECTION</span>
        </button>

        {/* Trajectory path visibility only; path collection remains active. */}
        <button
          onClick={onToggleTrajectory}
          title={`Trajectory line ${trajectoryVisible ? 'ON' : 'OFF'} (toggle visibility)`}
          aria-label={`Trajectory line ${trajectoryVisible ? 'on' : 'off'}`}
          aria-pressed={trajectoryVisible}
          className="hud-ctrl-btn"
          style={{
            ...rightBtnStyle,
            width: '40px',
            flexDirection: 'column',
            gap: '1px',
            fontSize: '8px',
            fontWeight: 800,
            color: trajectoryVisible ? '#00e5ff' : '#94a3b8',
            border: trajectoryVisible ? '1px solid #00e5ff' : rightBtnStyle.border,
          }}
        >
          <span>PATH</span>
          <span style={{ fontSize: '6px' }}>{trajectoryVisible ? 'ON' : 'OFF'}</span>
        </button>

        {/* Mode: Demo vs Realistic */}
        <button
          onClick={onToggleMode}
          title="Toggle Guidance Mode: DEMO (Controlled Flight) / REALISTIC (Wind & Sensor Noise)"
          className="hud-ctrl-btn"
          style={{
            ...rightBtnStyle,
            fontSize: '8px',
            fontWeight: 700,
            color: mode === 'DEMO' ? '#00e676' : '#ffaa66',
          }}
        >
          {mode}
        </button>

        {/* Camera / View Selector Toggle */}
        <button
          ref={viewBtnRef}
          onClick={() => setViewMenuOpen((prev) => !prev)}
          title="Select Camera / View Angle"
          className="hud-ctrl-btn"
          style={{
            ...rightBtnStyle,
            fontSize: '7.5px',
            fontWeight: 800,
            color: viewMenuOpen ? '#00e5ff' : '#cbd5e1',
            border: viewMenuOpen ? '1px solid #00e5ff' : rightBtnStyle.border,
            flexDirection: 'column',
            gap: '1px',
            lineHeight: 1,
            padding: '2px',
            boxShadow: viewMenuOpen ? '0 0 10px rgba(0, 229, 255, 0.35)' : 'none',
          }}
        >
          <span style={{ fontSize: '9px', lineHeight: 1 }}>👁</span>
          <span style={{ fontSize: '7px', letterSpacing: '0.5px' }}>VIEW</span>
        </button>
      </div>

      {/* ── CAMERA / VIEW SELECTOR POPUP MENU ─── */}
      {viewMenuOpen && (
        <div
          ref={viewMenuRef}
          className="hud-panel"
          style={{
            position: 'absolute',
            top: '50%',
            right: '68px',
            transform: 'translateY(-50%)',
            width: '230px',
            maxHeight: 'calc(100vh - 60px)',
            overflowY: 'auto',
            background: 'rgba(5, 12, 22, 0.95)',
            border: '1px solid rgba(0, 229, 255, 0.35)',
            borderRadius: '6px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 229, 255, 0.15)',
            backdropFilter: 'blur(12px)',
            zIndex: 35,
            fontFamily: 'monospace',
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(0, 229, 255, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#00e5ff' }}>👁</span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: '#00e5ff',
                  textTransform: 'uppercase',
                }}
              >
                CAMERA / VIEW
              </span>
            </div>
            <button
              onClick={() => setViewMenuOpen(false)}
              title="Close (ESC)"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '0 2px',
                lineHeight: 1,
              }}
              className="hud-ctrl-btn"
            >
              ✕
            </button>
          </div>

          {/* Preset Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
            {CAMERA_PRESETS.map((preset) => {
              const active = isCameraPresetActive(preset, cameraMode);
              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    onCameraChange(preset.cameraMode);
                  }}
                  title={`${preset.label}\nShortcut: [${preset.shortcut}]`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '8px 12px',
                    background: active
                      ? 'linear-gradient(90deg, rgba(0, 229, 255, 0.2) 0%, rgba(0, 229, 255, 0.05) 100%)'
                      : 'transparent',
                    border: 'none',
                    borderLeft: active ? '3px solid #00e5ff' : '3px solid transparent',
                    color: active ? '#00e5ff' : '#cbd5e1',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    boxShadow: active ? 'inset 0 0 12px rgba(0, 229, 255, 0.15)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cbd5e1';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }}>{preset.icon}</span>
                    <span style={{ fontWeight: active ? 700 : 500, letterSpacing: '0.05em' }}>
                      {preset.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '9px',
                      color: active ? '#00e5ff' : '#64748b',
                      background: active ? 'rgba(0, 229, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                      padding: '2px 5px',
                      borderRadius: '3px',
                      border: `1px solid ${active ? 'rgba(0, 229, 255, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                      fontFamily: 'monospace',
                    }}
                  >
                    [{preset.shortcut}]
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DEEP TECHNICAL TELEMETRY DRAWER (Collapsible Right Side) ──── */}
      {telemetryDrawerOpen && (
        <aside
          className="hud-panel"
          style={{
            position: 'absolute',
            top: '80px',
            right: '72px',
            width: '260px',
            padding: '14px',
            zIndex: 24,
            maxHeight: 'calc(100vh - 180px)',
            overflowY: 'auto',
            fontFamily: 'var(--font-ui)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', color: '#ffaa66' }}>
              TECHNICAL FLIGHT TELEMETRY
            </span>
            <button
              onClick={() => setTelemetryDrawerOpen(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <TechRow label="AIRSPEED" value={`Mach ${snap.mach.toFixed(2)}`} />
            <TechRow label="DYNAMIC PRESSURE (q)" value={`${snap.q.toFixed(0)} Pa`} />
            <TechRow label="VERTICAL VELOCITY" value={`${snap.verticalVelocity.toFixed(1)} m/s`} />
            <TechRow label="DECELERATION" value={`${snap.gForce.toFixed(2)} G`} warn={snap.gForce > 4.5} />
            <TechRow label="STAGNATION HEAT FLUX" value={`${snap.heatFluxWcm2.toFixed(1)} W/cm²`} />
            <TechRow label="HEAT SHIELD" status={snap.heatShieldSeparated ? 'JETTISONED' : 'ATTACHED'} />
            <TechRow label="RADAR ALTIMETER" status={snap.radarLocked ? 'LOCKED' : 'SEARCHING'} active={snap.radarLocked} />
            <TechRow label="TERRAIN RELATIVE NAV" status={snap.trnActive ? 'LOCKED' : 'STANDBY'} active={snap.trnActive} />
            <TechRow label="DESCENT THRUSTERS" status={snap.enginesActive ? 'FIRING' : 'OFF'} active={snap.enginesActive} />
            <TechRow label="PARACHUTE STATE" status={snap.parachuteState} active={snap.parachuteState === 'DEPLOYED'} />
          </div>

          {/* Propellant Gauge */}
          <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '4px' }}>
              <span style={{ color: '#94a3b8' }}>HYDRAZINE PROPELLANT</span>
              <span className="font-mono-numbers" style={{ color: snap.fuelPct < 15 ? '#ff3d3d' : '#00e676', fontWeight: 700 }}>
                {snap.fuel.toFixed(0)} kg ({snap.fuelPct.toFixed(0)}%)
              </span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(0, 0, 0, 0.5)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, snap.fuelPct))}%`,
                  height: '100%',
                  background: snap.fuelPct < 15 ? '#ff3d3d' : '#00e676',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>

          {/* Camera Selector */}
          <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              CAMERA PERSPECTIVES (1–8):
            </span>
            <select
              value={cameraMode}
              onChange={(e) => onCameraChange(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.6)',
                color: '#00e5ff',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                borderRadius: '4px',
                padding: '4px 6px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              <option value="CHASE">1. 3/4 VELOCITY CHASE</option>
              <option value="HEAT_SHIELD_CAM">2. HEAT SHIELD / PLASMA</option>
              <option value="PARACHUTE_LOOKUP">3. PARACHUTE LOOK-UP</option>
              <option value="TRN_NADIR">4. TRN OPTICAL NADIR</option>
              <option value="POWERED_DESCENT">5. POWERED DESCENT CLOSE</option>
              <option value="GROUND_TOUCHDOWN">6. GROUND TOUCHDOWN ORBIT</option>
              <option value="ORBIT_OVERVIEW">7. MACRO ORBIT OVERVIEW</option>
              <option value="FREE">8. INTERACTIVE FREE ORBIT</option>
            </select>
          </div>

          {/* Subsystem Toggles */}
          <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
            <button
              onClick={onToggleTRN}
              style={{
                flex: 1,
                background: trnOpen ? 'rgba(0, 229, 255, 0.2)' : 'rgba(0, 0, 0, 0.5)',
                border: '1px solid #00e5ff',
                borderRadius: '4px',
                color: '#00e5ff',
                padding: '4px 0',
                fontSize: '9px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              TRN CAM
            </button>
            <button
              onClick={onToggleGraphs}
              style={{
                flex: 1,
                background: graphsOpen ? 'rgba(0, 229, 255, 0.2)' : 'rgba(0, 0, 0, 0.5)',
                border: '1px solid #00e5ff',
                borderRadius: '4px',
                color: '#00e5ff',
                padding: '4px 0',
                fontSize: '9px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              GRAPHS
            </button>
          </div>
        </aside>
      )}
    </>
  );
}

const rightBtnStyle = {
  width: '40px',
  height: '32px',
  background: 'rgba(5, 10, 20, 0.8)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '4px',
  color: '#cbd5e1',
  fontSize: '14px',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  backdropFilter: 'blur(8px)',
  transition: 'all 0.15s ease',
};

function TechRow({ label, value, status, active = false, warn = false }) {
  let valColor = '#f8fafc';
  if (warn) valColor = '#ff3d3d';
  if (status) {
    valColor = active ? '#00e676' : '#64748b';
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2px 0' }}>
      <span style={{ fontSize: '9px', color: '#94a3b8' }}>{label}</span>
      <span className="font-mono-numbers" style={{ fontSize: '10px', fontWeight: 600, color: valColor }}>
        {status || value}
      </span>
    </div>
  );
}
