/**
 * ExplorationModePanel.jsx — Post-Landing Rover Exploration Mode UI
 *
 * Activates automatically after phase === 'LANDED'.
 * Provides:
 *   - Camera preset switcher (6 cinematic presets + free-orbit)
 *   - Smooth animated cinematic tour mode
 *   - Rover status and mission stats info panel
 *   - Keyboard shortcuts for each preset
 *
 * Architecture contract:
 *   - Does NOT touch EDL physics / integrator / CameraDirector internal logic.
 *   - CameraDirector reads `cameraMode` string from parent. This panel
 *     calls `onCameraChange(presetId)` which sets that string in SimulationCanvas.
 *   - Preset IDs handled here map to new cases added in CameraDirector's useFrame.
 */

import React, { useState, useEffect } from 'react';

// ─── Rover Fact Cards (shown in the info panel) ───────────────────────────────
const ROVER_FACTS = [
  { label: 'Mission', value: 'Mars 2020 / Perseverance', icon: '🚀' },
  { label: 'Landing Site', value: 'Jezero Crater, Mars', icon: '📍' },
  { label: 'Landing Date', value: 'Feb 18, 2021 — 20:55 UTC', icon: '📅' },
  { label: 'Mass', value: '1,025 kg', icon: '⚖️' },
  { label: 'Power Source', value: 'MMRTG (110W)', icon: '⚡' },
  { label: 'Primary Science', value: 'Astrobiology & Sample Caching', icon: '🔬' },
  { label: 'Top Speed', value: '~4.2 cm/s autonomous', icon: '💨' },
  { label: 'Arm Reach', value: '2.1 m, 5-DOF', icon: '🦾' },
];

export default function ExplorationModePanel({ isActive, simStateRef }) {
  const [showInfo, setShowInfo] = useState(true);
  const [factIndex, setFactIndex] = useState(0);

  // ── Fact carousel auto-advance ──────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const factTimer = setInterval(() => {
      setFactIndex((i) => (i + 1) % ROVER_FACTS.length);
    }, 4200);
    return () => clearInterval(factTimer);
  }, [isActive]);

  // ── Keyboard shortcut for info panel ───────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setShowInfo((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isActive]);

  if (!isActive) return null;

  const currentFact = ROVER_FACTS[factIndex];
  const s = simStateRef?.current;

  // Elapsed mission time since landing (rough seconds counter)
  const elapsedSec = s?.elapsed ?? 0;
  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const ss = Math.floor(sec % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  return (
    <>
      {/* ── Exploration Mode Header Banner ───────────────────────────────── */}
      <div
        className="hud-panel"
        style={{
          position: 'absolute',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, rgba(0,20,10,0.92) 0%, rgba(10,26,18,0.92) 100%)',
          border: '1px solid rgba(0,230,120,0.45)',
          borderRadius: '10px',
          padding: '8px 20px',
          color: '#e2e8f0',
          fontFamily: 'monospace',
          fontSize: '12px',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 0 24px rgba(0,230,120,0.15)',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: '#00e676', fontWeight: 'bold', fontSize: '13px', letterSpacing: '0.12em' }}>
          🟢 SURFACE OPERATIONS
        </span>
        <span style={{ color: '#94a3b8', fontSize: '10px' }}>|</span>
        <span style={{ color: '#94a3b8', fontSize: '11px' }}>PERSEVERANCE ROVER · JEZERO CRATER · MARS</span>
        <span style={{ color: '#94a3b8', fontSize: '10px' }}>|</span>
        <span style={{ color: '#64ffda', fontSize: '11px', fontWeight: 'bold' }}>
          T+ {formatTime(elapsedSec)}
        </span>
        <button
          onClick={() => setShowInfo((v) => !v)}
          style={{
            background: showInfo ? 'rgba(0,230,120,0.18)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${showInfo ? 'rgba(0,230,120,0.5)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: '5px',
            color: showInfo ? '#00e676' : '#64748b',
            fontSize: '10px',
            fontFamily: 'monospace',
            padding: '3px 8px',
            cursor: 'pointer',
            letterSpacing: '0.06em',
          }}
        >
          [I] INFO
        </button>
      </div>

      {/* ── Rover Info Panel ─────────────────────────────────────────────── */}
      {showInfo && (
        <div
          className="hud-panel"
          style={{
            position: 'absolute',
            top: '130px',
            right: '18px',
            background: 'linear-gradient(180deg, rgba(5,12,22,0.95) 0%, rgba(8,20,14,0.92) 100%)',
            border: '1px solid rgba(0,230,120,0.28)',
            borderRadius: '10px',
            padding: '14px 16px',
            color: '#e2e8f0',
            fontFamily: 'monospace',
            fontSize: '12px',
            zIndex: 200,
            minWidth: '240px',
            maxWidth: '280px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            userSelect: 'none',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(0,230,120,0.2)',
          }}>
            <span style={{ color: '#00e676', fontWeight: 'bold', fontSize: '11px', letterSpacing: '0.10em' }}>
              🤖 ROVER STATUS
            </span>
            <button
              onClick={() => setShowInfo(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#475569',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '0 2px',
                lineHeight: 1,
              }}
              title="Close info panel [I]"
            >×</button>
          </div>

          {/* Mission Status */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              background: 'rgba(0,230,120,0.08)',
              borderRadius: '6px',
              border: '1px solid rgba(0,230,120,0.18)',
            }}>
              <span style={{ fontSize: '20px' }}>✅</span>
              <div>
                <div style={{ color: '#00e676', fontSize: '11px', fontWeight: 'bold' }}>TOUCHDOWN NOMINAL</div>
                <div style={{ color: '#64748b', fontSize: '10px', marginTop: '1px' }}>
                  All systems operational
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry from sim state */}
          {s && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: '#475569', fontSize: '9px', letterSpacing: '0.10em', marginBottom: '6px' }}>
                SURFACE TELEMETRY
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                {[
                  { key: 'Fuel', value: `${Math.round(s.fuelMass ?? 0)} kg` },
                  { key: 'G-Force', value: `${(s.gForce ?? 0).toFixed(2)} g` },
                  { key: 'Speed', value: `${(s.speed ?? 0).toFixed(1)} m/s` },
                  { key: 'Altitude', value: `${(s.altitude ?? 0).toFixed(1)} m` },
                ].map(({ key, value }) => (
                  <div key={key} style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '4px',
                    padding: '5px 8px',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ color: '#475569', fontSize: '9px' }}>{key}</div>
                    <div style={{ color: '#64ffda', fontSize: '12px', fontWeight: 'bold', marginTop: '2px' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scrolling fact card */}
          <div style={{
            padding: '9px 10px',
            background: 'rgba(0,100,255,0.06)',
            borderRadius: '6px',
            border: '1px solid rgba(100,150,255,0.15)',
            marginBottom: '10px',
            minHeight: '52px',
            transition: 'opacity 0.4s ease',
          }}>
            <div style={{ color: '#7986cb', fontSize: '9px', marginBottom: '4px', letterSpacing: '0.08em' }}>
              {currentFact.icon} {currentFact.label.toUpperCase()}
            </div>
            <div style={{ color: '#c5cae9', fontSize: '12px', fontWeight: 'bold' }}>
              {currentFact.value}
            </div>
          </div>

          {/* Science objectives */}
          <div style={{ color: '#475569', fontSize: '9px', letterSpacing: '0.08em', marginBottom: '6px' }}>
            PRIMARY SCIENCE OBJECTIVES
          </div>
          {[
            { icon: '🔬', text: 'Search for signs of ancient microbial life' },
            { icon: '🪨', text: 'Collect and cache rock & sediment samples' },
            { icon: '🌬️', text: 'MOXIE: In-situ oxygen production test' },
            { icon: '🚁', text: 'Ingenuity helicopter technology demo' },
          ].map(({ icon, text }) => (
            <div key={text} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              marginBottom: '5px',
              fontSize: '10px',
              color: '#64748b',
              lineHeight: '1.4',
            }}>
              <span style={{ flexShrink: 0 }}>{icon}</span>
              <span>{text}</span>
            </div>
          ))}

        </div>
      )}
    </>
  );
}
