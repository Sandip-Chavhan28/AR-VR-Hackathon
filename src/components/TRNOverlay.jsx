/**
 * TRNOverlay.jsx – Terrain-Relative Navigation (TRN) & Lander Vision System (LVS) HUD.
 *
 * Implements:
 *   - Downward optical camera simulation with landmark tracking crosshairs
 *   - Visual 21×21 safety hazard classification grid
 *   - Initial hazardous landing target rejection callout
 *   - Autonomous divert vector to safe candidate landing site
 *   - Landmark matching statistics (landmarks tracked, covariance, confidence %)
 *   - Collapsible / expandable aerospace PiP HUD widget
 */

import React, { useState } from 'react';

const TRACKED_FEATURES = [
  { id: 'FT-01', x: 24, z: 15, label: 'CRATER ALPHA RIM', quality: 0.98 },
  { id: 'FT-02', x: -35, z: 42, label: 'BOULDER FIELD NW', quality: 0.94 },
  { id: 'FT-03', x: 50, z: 45, label: 'RIDGE ESCARPMENT', quality: 0.91 },
  { id: 'FT-04', x: 88, z: 86, label: 'SAFE BASIN ALPHA', quality: 0.99 },
  { id: 'FT-05', x: -60, z: -20, label: 'CRATER BETA RIM', quality: 0.88 },
  { id: 'FT-06', x: 12, z: -55, label: 'REGOLITH BED S', quality: 0.95 },
];

export default function TRNOverlay({ simStateRef, isOpen, onClose }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const s = simStateRef?.current;
  const analysis = s?.landingSiteAnalysis;
  const initTarget = analysis?.initialTarget;
  const selTarget = analysis?.selectedTarget;

  if (!isOpen) return null;

  const confidence = s?.radarLocked ? (s?.trnActive ? 99.4 : 88.2) : (s?.altitude < 10000 ? 64.0 : 0.0);
  const statusText = s?.trnActive
    ? 'TARGET LOCKED (AUTONOMOUS DIVERT ACTIVE)'
    : s?.radarLocked
    ? 'ACQUIRING TERRAIN MAP...'
    : 'STANDBY (AWAITING RADAR LOCK)';

  return (
    <div
      className="hud-panel"
      style={{
        position: 'absolute',
        bottom: '150px',
        left: '20px',
        width: isExpanded ? '460px' : '285px',
        zIndex: 25,
        fontFamily: 'var(--font-ui)',
        color: '#cce6f4',
        maxHeight: 'calc(100vh - 170px)',
        overflowY: 'auto',
        transition: 'width 0.25s ease-in-out',
        border: '1px solid rgba(0, 229, 255, 0.4)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.85), 0 0 16px rgba(0, 229, 255, 0.12)',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'rgba(0, 229, 255, 0.12)',
          borderBottom: '1px solid rgba(0, 229, 255, 0.25)',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: '#00e5ff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: s?.trnActive ? '#00e676' : '#ffd600',
              boxShadow: s?.trnActive ? '0 0 6px #00e676' : '0 0 6px #ffd600',
            }}
          />
          <span>LANDER VISION SYSTEM (LVS / TRN)</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'none',
              border: 'none',
              color: '#00e5ff',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            {isExpanded ? '▼' : '▲'}
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#ff3d3d',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Downward Optical Camera Viewport */}
      <div
        className="scanlines"
        style={{
          position: 'relative',
          width: '100%',
          height: isExpanded ? '240px' : '150px',
          background: 'radial-gradient(circle, #1c110b 0%, #0d0604 100%)',
          borderBottom: '1px solid rgba(0, 229, 255, 0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Optical Nadir Reticle Center */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '40px',
            height: '40px',
            border: '1px dashed rgba(0, 229, 255, 0.6)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '1px', background: 'rgba(0, 229, 255, 0.15)' }} />
        <div style={{ position: 'absolute', left: '50%', top: '0', bottom: '0', width: '1px', background: 'rgba(0, 229, 255, 0.15)' }} />

        {/* Synthetic Feature Tracking Landmarks */}
        {TRACKED_FEATURES.map((ft) => {
          const mapX = 50 + (ft.x / 180) * 40;
          const mapZ = 50 + (ft.z / 180) * 40;
          return (
            <div
              key={ft.id}
              style={{
                position: 'absolute',
                top: `${mapZ}%`,
                left: `${mapX}%`,
                transform: 'translate(-50%, -50%)',
                fontSize: '8px',
                color: ft.id === 'FT-04' ? '#00e676' : '#00e5ff',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span style={{ fontSize: '10px' }}>✛</span>
              {isExpanded && <span style={{ marginLeft: '3px', opacity: 0.85 }}>{ft.id}</span>}
            </div>
          );
        })}

        {/* Initial Rejected Target (Red Box) */}
        {initTarget && (
          <div
            style={{
              position: 'absolute',
              top: `${50 + (initTarget.z / 180) * 40}%`,
              left: `${50 + (initTarget.x / 180) * 40}%`,
              transform: 'translate(-50%, -50%)',
              border: '1px solid #ff3d3d',
              padding: '2px 4px',
              fontSize: '8px',
              color: '#ff3d3d',
              background: 'rgba(255, 61, 61, 0.25)',
              borderRadius: '2px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            HAZARD REJECTED
          </div>
        )}

        {/* Autonomously Selected Safe Target (Green Target) */}
        {selTarget && (
          <div
            style={{
              position: 'absolute',
              top: `${50 + (selTarget.z / 180) * 40}%`,
              left: `${50 + (selTarget.x / 180) * 40}%`,
              transform: 'translate(-50%, -50%)',
              border: '1px solid #00e676',
              padding: '2px 4px',
              fontSize: '8px',
              color: '#00e676',
              background: 'rgba(0, 230, 118, 0.25)',
              borderRadius: '2px',
              fontFamily: 'var(--font-mono)',
              boxShadow: '0 0 10px rgba(0, 230, 118, 0.5)',
            }}
          >
            ◎ SAFE TARGET ({selTarget.safetyScore.toFixed(0)})
          </div>
        )}

        {/* Camera HUD Telemetry Overlay */}
        <div
          className="font-mono-numbers"
          style={{
            position: 'absolute',
            bottom: '6px',
            left: '8px',
            fontSize: '9px',
            color: '#00e5ff',
            opacity: 0.85,
          }}
        >
          FPS: 30 Hz | EXP: 1.2ms | CORR: 441 CELLS
        </div>
      </div>

      {/* Diagnostics / Status Block */}
      <div style={{ padding: '10px 12px', fontSize: '9px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>NAV CONFIDENCE:</span>
          <span
            className="font-mono-numbers"
            style={{ color: confidence > 90 ? '#00e676' : '#ffd600', fontWeight: 600, fontSize: '10px' }}
          >
            {confidence.toFixed(1)}%
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>LANDMARKS MATCHED:</span>
          <span className="font-mono-numbers" style={{ color: '#00e5ff', fontWeight: 600, fontSize: '10px' }}>
            38 / 40
          </span>
        </div>
        {selTarget && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>DIVERT VECTOR:</span>
            <span className="font-mono-numbers" style={{ color: '#00e676', fontWeight: 600 }}>
              ΔX: +{(selTarget.x - (initTarget?.x || 0)).toFixed(0)}m | ΔZ: +{(selTarget.z - (initTarget?.z || 0)).toFixed(0)}m
            </span>
          </div>
        )}
        <div style={{ marginTop: '3px', fontSize: '9px', color: s?.trnActive ? '#00e676' : '#ffd600', letterSpacing: '0.06em' }}>
          {statusText}
        </div>
      </div>
    </div>
  );
}
