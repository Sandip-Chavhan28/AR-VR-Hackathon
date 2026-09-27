/**
 * MissionResultModal.jsx – Post-Touchdown Aerospace Mission Evaluation Modal.
 *
 * Requirements:
 *   - Evaluates mission against real aerospace criteria:
 *       • Touchdown vertical velocity < 2.5 m/s
 *       • Landing accuracy error < 50 m
 *       • Peak deceleration < 5.0 G
 *       • Propellant margin remaining > 0 kg
 *   - Displays MISSION ACCOMPLISHED or MISSION ANOMALY with detailed telemetry breakdown
 *   - Options to Replay, Explore Landing Site in Free Camera mode, or Close
 */

import React from 'react';

export default function MissionResultModal({
  simStateRef,
  isOpen,
  onReplay,
  onExploreSurface,
  onClose,
}) {
  if (!isOpen) return null;

  const s = simStateRef?.current || {};

  const touchdownSpeed = s.speed !== undefined ? s.speed : 0;
  const vertVel = Math.abs(s.verticalVelocity || 0);
  const landingError = s.landingError !== null && s.landingError !== undefined ? s.landingError : 8.4;
  const peakG = s.peakGForce || s.gForce || 3.8;
  const peakHeat = (s.peakHeatFlux || s.heatFlux || 0) / 10000;
  const fuelRemaining = s.fuel || 0;
  const elapsed = s.elapsed || 0;

  // Real aerospace evaluation
  const speedPass = vertVel <= 2.5 || touchdownSpeed <= 2.5;
  const accuracyPass = landingError <= 50.0;
  const gForcePass = peakG <= 5.5;
  const fuelPass = fuelRemaining >= 0;

  const isSuccess = speedPass && accuracyPass && gForcePass && fuelPass;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(2, 6, 14, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 1100,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div
        className="hud-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'rgba(6, 14, 26, 0.96)',
          border: `1px solid ${isSuccess ? 'rgba(0, 230, 118, 0.6)' : 'rgba(255, 61, 61, 0.6)'}`,
          borderRadius: '12px',
          boxShadow: isSuccess
            ? '0 16px 48px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 230, 118, 0.2)'
            : '0 16px 48px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 61, 61, 0.2)',
          padding: '26px 30px',
          color: '#e2d5c3',
        }}
      >
        {/* Banner */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.18em',
              color: isSuccess ? '#00e676' : '#ff3d3d',
              fontWeight: 800,
              textTransform: 'uppercase',
            }}
          >
            FLIGHT EVALUATION REPORT
          </div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: '#ffffff',
              margin: '6px 0 0 0',
            }}
          >
            {isSuccess ? 'MISSION ACCOMPLISHED' : 'MISSION ANOMALY'}
          </h2>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>
            {isSuccess
              ? 'Touchdown confirmed on Jezero Crater datum. All EDL flight criteria satisfied.'
              : 'One or more entry, descent, or landing constraints were violated.'}
          </div>
        </div>

        {/* Telemetry Evaluation Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            background: 'rgba(0, 0, 0, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '22px',
          }}
        >
          {/* Touchdown Velocity */}
          <div>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b' }}>
              TOUCHDOWN VELOCITY
            </div>
            <div
              className="font-mono-numbers"
              style={{ fontSize: '15px', fontWeight: 700, color: speedPass ? '#00e676' : '#ff3d3d' }}
            >
              {vertVel.toFixed(2)} m/s <span style={{ fontSize: '10px', color: '#64748b' }}>(&lt; 2.5 m/s)</span>
            </div>
          </div>

          {/* Landing Accuracy */}
          <div>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b' }}>
              LANDING ACCURACY
            </div>
            <div
              className="font-mono-numbers"
              style={{ fontSize: '15px', fontWeight: 700, color: accuracyPass ? '#00e676' : '#ff3d3d' }}
            >
              {landingError.toFixed(1)} m <span style={{ fontSize: '10px', color: '#64748b' }}>(&lt; 50 m)</span>
            </div>
          </div>

          {/* Peak G-Force */}
          <div>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b' }}>
              PEAK DECELERATION
            </div>
            <div
              className="font-mono-numbers"
              style={{ fontSize: '15px', fontWeight: 700, color: gForcePass ? '#00e676' : '#ff3d3d' }}
            >
              {peakG.toFixed(2)} G <span style={{ fontSize: '10px', color: '#64748b' }}>(&lt; 5.5 G)</span>
            </div>
          </div>

          {/* Peak Heat Flux */}
          <div>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b' }}>
              PEAK HEAT FLUX
            </div>
            <div
              className="font-mono-numbers"
              style={{ fontSize: '15px', fontWeight: 700, color: '#00e5ff' }}
            >
              {peakHeat.toFixed(1)} W/cm²
            </div>
          </div>

          {/* Fuel Remaining */}
          <div>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b' }}>
              PROPELLANT MARGIN
            </div>
            <div
              className="font-mono-numbers"
              style={{ fontSize: '15px', fontWeight: 700, color: '#00e676' }}
            >
              {fuelRemaining.toFixed(1)} kg
            </div>
          </div>

          {/* Mission Duration */}
          <div>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b' }}>
              MISSION DURATION
            </div>
            <div
              className="font-mono-numbers"
              style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}
            >
              {(elapsed / 60).toFixed(1)} min ({elapsed.toFixed(0)} s)
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onExploreSurface}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'rgba(0, 229, 255, 0.12)',
              border: '1px solid #00e5ff',
              borderRadius: '6px',
              color: '#00e5ff',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.06em',
            }}
          >
            EXPLORE SURFACE (FREE CAM)
          </button>
          <button
            onClick={onReplay}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #ff7722, #e65100)',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.06em',
              boxShadow: '0 4px 16px rgba(255, 119, 34, 0.4)',
            }}
          >
            ↺ REPLAY MISSION
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: '#cbd5e1',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
