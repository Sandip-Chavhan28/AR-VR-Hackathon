/**
 * DebugHUD.jsx – Real-time telemetry overlay for Mars Orbit, Deorbit Burn, and Atmospheric Entry.
 *
 * Displays:
 *   - MISSION PHASE badge
 *   - Altitude (km)
 *   - Velocity (m/s)
 *   - Vertical Velocity (m/s)
 *   - Orbital Velocity (m/s)
 *   - Dynamic Pressure (Pa)
 *   - Heat Flux (W/cm²)
 *   - G-Force (G)
 *   - Fuel remaining (kg and %)
 *   - Delta-V Delivered (m/s)
 *   - Burn Status (OFF / BURNING)
 *   - Camera Mode Selector (CHASE / ORBIT / FREE)
 *   - Start / Reset / Manual Deorbit controls
 *
 * Polled at 10 Hz (100 ms) to avoid React re-renders in the physics loop.
 */

import React, { useState, useEffect, useRef } from 'react';
import { PROPELLANT_MASS } from '../simulation/physics/constants.js';

const fmt = (v, decimals = 1) =>
  typeof v === 'number' && !isNaN(v) ? v.toFixed(decimals) : '—';

const fmtSci = (v) => {
  if (typeof v !== 'number' || isNaN(v)) return '—';
  return v.toExponential(2);
};

function HUDRow({ label, value, unit = '', highlight = false, alert = false }) {
  let color = '#e2d5c3';
  if (alert) color = '#ff5544';
  else if (highlight) color = '#ffcc44';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '2px 0',
        borderBottom: '1px solid rgba(255,140,50,0.08)',
        color,
      }}
    >
      <span style={{ fontSize: '10px', letterSpacing: '0.08em', opacity: 0.75 }}>
        {label}
      </span>
      <span style={{ fontSize: '11px', fontWeight: 600, marginLeft: '8px', fontVariantNumeric: 'tabular-nums' }}>
        {value}{unit && <span style={{ fontSize: '9px', opacity: 0.65, marginLeft: '3px' }}>{unit}</span>}
      </span>
    </div>
  );
}

export default function DebugHUD({
  simStateRef,
  running,
  cameraMode,
  onStart,
  onReset,
  onTriggerDeorbit,
  onCameraChange,
}) {
  const [snap, setSnap] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const s = simStateRef.current;
      if (!s) return;

      // Compute orbital (tangential) speed component
      const rx = s.x || 0;
      const ry = (s.y || 0) + 3389500;
      const rz = s.z || 0;
      const r = Math.sqrt(rx * rx + ry * ry + rz * rz);
      const vr = (s.vx * rx + s.vy * ry + s.vz * rz) / r;
      const vTangential = Math.sqrt(Math.max(0, s.speed * s.speed - vr * vr));

      const wind = s.wind || { x: 0, y: 0, z: 0 };
      const windSpeed = Math.sqrt(wind.x * wind.x + wind.y * wind.y + wind.z * wind.z);
      const sensors = s.sensors || {};

      setSnap({
        altitude: s.altitude,
        altitudeKm: (s.altitude / 1000),
        sensorAltitudeKm: (sensors.altitude !== undefined ? sensors.altitude : s.altitude) / 1000,
        speed: s.speed,
        sensorSpeed: sensors.speed !== undefined ? sensors.speed : s.speed,
        verticalVelocity: s.verticalVelocity,
        sensorVerticalVelocity: sensors.verticalVelocity !== undefined ? sensors.verticalVelocity : s.verticalVelocity,
        relativeSpeed: s.relativeSpeed !== undefined ? s.relativeSpeed : s.speed,
        groundSpeed: s.groundSpeed !== undefined ? s.groundSpeed : s.speed,
        orbitalVelocity: vTangential,
        vx: s.vx,
        vy: s.vy,
        vz: s.vz,
        ax: s.ax,
        ay: s.ay,
        az: s.az,
        rho: s.rho,
        q: s.q,
        sensorQ: sensors.q !== undefined ? sensors.q : s.q,
        heatFlux: s.heatFlux || 0,
        heatFluxWcm2: (s.heatFlux || 0) / 10000,
        heatIntensity: s.heatIntensity || 0,
        gForce: s.gForce,
        phase: s.phase,
        fuel: s.fuel !== undefined ? s.fuel : PROPELLANT_MASS,
        fuelPct: s.fuel !== undefined ? (s.fuel / PROPELLANT_MASS) * 100 : 100,
        mass: s.mass,
        deliveredDeltaV: s.deliveredDeltaV || 0,
        targetDeltaV: s.targetDeltaV || 125,
        enginesActive: s.enginesActive || false,
        burnDuration: s.burnDuration || 0,
        orbitTime: s.orbitTime || 0,
        grounded: s.grounded,
        elapsed: s.elapsed,
        wind,
        windSpeed,
        parachuteState: s.parachuteState || 'PACKED',
        parachuteDeploymentProgress: s.parachuteDeploymentProgress || 0,
        landingSiteAnalysis: s.landingSiteAnalysis || null,
      });
    }, 100);


    return () => clearInterval(intervalRef.current);
  }, [simStateRef]);

  const panelStyle = {
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '255px',
    background: 'rgba(5, 14, 26, 0.90)',
    border: '1px solid rgba(255,140,50,0.35)',
    borderRadius: '8px',
    padding: '12px 14px',
    fontFamily: "'Courier New', Courier, monospace",
    backdropFilter: 'blur(10px)',
    zIndex: 20,
    boxShadow: '0 4px 28px rgba(0,0,0,0.6)',
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto',
  };

  const sectionHeaderStyle = {
    fontSize: '9px',
    letterSpacing: '0.16em',
    color: '#ff9944',
    textTransform: 'uppercase',
    marginTop: '9px',
    marginBottom: '3px',
    borderBottom: '1px solid rgba(255,140,50,0.2)',
    paddingBottom: '2px',
  };

  const buttonStyle = (active, color = '#55ee88', bg = 'rgba(60,200,100,0.18)') => ({
    flex: 1,
    padding: '5px 0',
    fontSize: '10px',
    letterSpacing: '0.08em',
    fontFamily: "'Courier New', Courier, monospace",
    background: active ? 'rgba(255,100,30,0.25)' : bg,
    border: `1px solid ${active ? 'rgba(255,100,30,0.5)' : 'rgba(255,255,255,0.15)'}`,
    color: active ? '#ff7733' : color,
    borderRadius: '4px',
    cursor: 'pointer',
    textTransform: 'uppercase',
    transition: 'all 0.15s ease',
  });

  const phaseColorMap = {
    MARS_ORBIT: '#00e5ff',
    DEORBIT_BURN: '#ff7700',
    COAST_TO_ENTRY: '#ffaa00',
    ATMOSPHERIC_ENTRY: '#ff3311',
    PARACHUTE_DESCENT: '#cc44ff',
    LANDED: '#55ee88',
  };

  const currentPhaseColor = snap?.phase ? phaseColorMap[snap.phase] || '#ffaa44' : '#00e5ff';


  return (
    <div style={panelStyle}>
      {/* Title */}
      <div style={{ fontSize: '11px', letterSpacing: '0.15em', color: '#ffaa55', textTransform: 'uppercase', marginBottom: '8px' }}>
        ◈ Mission Telemetry
      </div>

      {/* Primary Simulation Controls */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '6px' }}>
        {!running ? (
          <button id="sim-start-btn" style={buttonStyle(false, '#55ee88', 'rgba(60,200,100,0.2)')} onClick={onStart}>
            ▶ Start
          </button>
        ) : (
          <button id="sim-pause-btn" style={buttonStyle(true, '#ffaa44', 'rgba(255,100,30,0.2)')} onClick={onReset}>
            ■ Pause
          </button>
        )}
        <button id="sim-reset-btn" style={buttonStyle(false, '#99aaff', 'rgba(100,120,180,0.2)')} onClick={onReset}>
          ↺ Reset
        </button>
      </div>

      {/* Manual Deorbit Trigger (Active in MARS_ORBIT) */}
      {snap?.phase === 'MARS_ORBIT' && (
        <button
          id="trigger-deorbit-btn"
          style={{
            ...buttonStyle(false, '#ff9933', 'rgba(255,120,30,0.2)'),
            width: '100%',
            marginBottom: '6px',
            border: '1px solid rgba(255,120,30,0.5)',
            fontWeight: 600,
          }}
          onClick={onTriggerDeorbit}
        >
          🔥 Fire Deorbit Burn Now
        </button>
      )}

      {/* Camera Mode Selector */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '9px', letterSpacing: '0.1em', opacity: 0.65, marginBottom: '3px', color: '#ffaa55' }}>
          CAMERA VIEW
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['CHASE', 'ORBIT_OVERVIEW', 'FREE'].map((mode) => (
            <button
              key={mode}
              style={{
                ...buttonStyle(cameraMode === mode),
                padding: '4px 0',
                fontSize: '8.5px',
                color: cameraMode === mode ? '#00e5ff' : '#aaa',
                background: cameraMode === mode ? 'rgba(0,229,255,0.2)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${cameraMode === mode ? 'rgba(0,229,255,0.6)' : 'rgba(255,255,255,0.1)'}`,
              }}
              onClick={() => onCameraChange(mode)}
            >
              {mode === 'ORBIT_OVERVIEW' ? 'ORBIT' : mode}
            </button>
          ))}
        </div>
      </div>

      {/* Phase Badge */}
      <div style={{
        textAlign: 'center',
        padding: '5px 0',
        marginBottom: '6px',
        background: `rgba(0,0,0,0.35)`,
        border: `1px solid ${currentPhaseColor}`,
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.14em',
        color: currentPhaseColor,
        textShadow: `0 0 10px ${currentPhaseColor}`,
      }}>
        {snap?.phase ?? 'MARS_ORBIT'}
      </div>

      {/* Telemetry Sections */}
      {snap && (
        <>
          {/* Parachute System */}
          <div style={sectionHeaderStyle}>Parachute System</div>
          <HUDRow
            label="CHUTE STATUS"
            value={
              snap.parachuteState === 'DEPLOYING'
                ? `DEPLOYING ${(snap.parachuteDeploymentProgress * 100).toFixed(0)}%`
                : snap.parachuteState
            }
            highlight={snap.parachuteState === 'DEPLOYING'}
            alert={snap.parachuteState === 'DEPLOYED'}
          />

          {/* Landing Site & Hazard Analysis (Phase 3B-1) */}
          <div style={sectionHeaderStyle}>Landing Site Analysis</div>
          <HUDRow
            label="ANALYSIS STATUS"
            value={snap.landingSiteAnalysis ? snap.landingSiteAnalysis.status : (snap.phase === 'PARACHUTE_DESCENT' ? 'ANALYZING...' : 'STANDBY')}
            highlight={!!snap.landingSiteAnalysis}
          />
          {snap.landingSiteAnalysis && (
            <>
              <HUDRow
                label="INITIAL TARGET"
                value={`(${fmt(snap.landingSiteAnalysis.initialTarget.x, 0)}, ${fmt(snap.landingSiteAnalysis.initialTarget.z, 0)})`}
                unit="m"
              />
              <HUDRow
                label="INITIAL STATUS"
                value={snap.landingSiteAnalysis.initialTargetStatus}
                alert={snap.landingSiteAnalysis.initialTargetStatus === 'UNSAFE'}
                highlight={snap.landingSiteAnalysis.initialTargetStatus === 'SAFE'}
              />
              {snap.landingSiteAnalysis.rejectionReason && (
                <div style={{ fontSize: '8.5px', color: '#ff6644', margin: '2px 0 4px', fontStyle: 'italic', lineHeight: 1.2 }}>
                  ⚠ {snap.landingSiteAnalysis.rejectionReason}
                </div>
              )}
              <HUDRow
                label="SELECTED TARGET"
                value={`(${fmt(snap.landingSiteAnalysis.selectedTarget.x, 0)}, ${fmt(snap.landingSiteAnalysis.selectedTarget.z, 0)})`}
                unit="m"
                highlight
              />
              <HUDRow
                label="TARGET CHANGED"
                value={snap.landingSiteAnalysis.targetChanged ? 'YES' : 'NO'}
                alert={snap.landingSiteAnalysis.targetChanged}
              />
              <HUDRow
                label="SELECTED SCORE"
                value={fmt(snap.landingSiteAnalysis.selectedTargetScore, 1)}
                unit="/100"
                highlight
              />
              <HUDRow
                label="SAFE ZONE COUNT"
                value={`${snap.landingSiteAnalysis.safeZoneCount} cells`}
              />
              <HUDRow
                label="ANALYSIS RADIUS"
                value={`${fmt(snap.landingSiteAnalysis.analysisRadius, 0)} m`}
              />
            </>
          )}

          {/* Mission Control Decision Log */}
          {snap.landingSiteAnalysis?.decisionLog && snap.landingSiteAnalysis.decisionLog.length > 0 && (
            <>
              <div style={sectionHeaderStyle}>Mission Control Log</div>
              <div style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(85,238,136,0.25)',
                borderRadius: '4px',
                padding: '4px 6px',
                fontSize: '8px',
                lineHeight: 1.3,
                color: '#88ddaa',
                maxHeight: '90px',
                overflowY: 'auto',
                fontFamily: "'Courier New', Courier, monospace",
              }}>
                {snap.landingSiteAnalysis.decisionLog.map((log, i) => (
                  <div key={i} style={{ marginBottom: '2px' }}>{log}</div>
                ))}
              </div>
            </>
          )}


          {/* Altitude: True vs Sensor */}
          <div style={sectionHeaderStyle}>Altitude & Descent</div>
          <HUDRow label="ALTITUDE (TRUE)" value={fmt(snap.altitudeKm, 2)} unit="km" highlight />
          <HUDRow label="ALTITUDE (SENSOR)" value={fmt(snap.sensorAltitudeKm, 2)} unit="km" />
          <HUDRow label="VERTICAL Vᵣ (TRUE)" value={fmt(snap.verticalVelocity, 1)} unit="m/s" alert={snap.verticalVelocity < -200} />
          <HUDRow label="VERTICAL Vᵣ (SENSOR)" value={fmt(snap.sensorVerticalVelocity, 1)} unit="m/s" />

          {/* Speed: True vs Sensor vs Wind */}
          <div style={sectionHeaderStyle}>Speed & Dynamics</div>
          <HUDRow label="VELOCITY (TRUE)" value={fmt(snap.speed, 1)} unit="m/s" highlight />
          <HUDRow label="VELOCITY (SENSOR)" value={fmt(snap.sensorSpeed, 1)} unit="m/s" />
          <HUDRow label="REL AIRSPEED" value={fmt(snap.relativeSpeed, 1)} unit="m/s" highlight />
          <HUDRow label="GROUND SPEED" value={fmt(snap.groundSpeed, 1)} unit="m/s" />
          <HUDRow label="ORBITAL V" value={fmt(snap.orbitalVelocity, 1)} unit="m/s" />

          {/* Atmosphere & Environmental Wind */}
          <div style={sectionHeaderStyle}>Environment & Wind</div>
          <HUDRow label="WIND SPEED" value={fmt(snap.windSpeed, 1)} unit="m/s" highlight={snap.windSpeed > 5} />
          <HUDRow label="WIND [X, Y, Z]" value={`${fmt(snap.wind.x, 1)}, ${fmt(snap.wind.y, 1)}, ${fmt(snap.wind.z, 1)}`} unit="m/s" />
          <HUDRow label="DENSITY ρ" value={fmtSci(snap.rho)} unit="kg/m³" />
          <HUDRow label="DYN PRESS q" value={fmt(snap.q, 0)} unit="Pa" highlight={snap.q > 500} />
          <HUDRow
            label="HEAT FLUX"
            value={fmt(snap.heatFluxWcm2, 1)}
            unit="W/cm²"
            highlight={snap.heatFluxWcm2 > 10}
            alert={snap.heatFluxWcm2 > 100}
          />
          <HUDRow label="G-FORCE" value={fmt(snap.gForce, 2)} unit="g" alert={snap.gForce > 4.5} />

          {/* Propulsion / Deorbit Status */}
          <div style={sectionHeaderStyle}>Deorbit Propulsion</div>
          <HUDRow
            label="BURN STATUS"
            value={snap.enginesActive ? 'BURNING' : 'OFF'}
            highlight={snap.enginesActive}
            alert={snap.enginesActive}
          />
          <HUDRow label="DELTA-V" value={`${fmt(snap.deliveredDeltaV, 1)} / ${fmt(snap.targetDeltaV, 0)}`} unit="m/s" />
          <HUDRow label="FUEL REMAINING" value={`${fmt(snap.fuel, 1)} kg (${fmt(snap.fuelPct, 1)}%)`} highlight={snap.enginesActive} />
          <HUDRow label="BURN DURATION" value={fmt(snap.burnDuration, 1)} unit="s" />

          {/* Simulation Timers */}
          <div style={sectionHeaderStyle}>Mission Clock</div>
          <HUDRow label="MET (ELAPSED)" value={fmt(snap.elapsed, 1)} unit="s" />
          <HUDRow label="TOTAL MASS" value={fmt(snap.mass, 0)} unit="kg" />
        </>
      )}
    </div>
  );
}
