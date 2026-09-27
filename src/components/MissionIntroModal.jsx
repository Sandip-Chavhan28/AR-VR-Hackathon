/**
 * MissionIntroModal.jsx – Cinematic Mission Introduction & Briefing Screen.
 *
 * Implements:
 *   - Full-viewport fixed overlay with deep space radial backdrop blur
 *   - Perfectly centered mission briefing card with responsive sizing
 *   - Overview of vehicle specs, entry conditions, and Jezero Crater target
 *   - Flight Director Interaction Guide (timeline, cameras, TRN, stripcharts, audio)
 *   - Unlocks Web Audio API on primary user click to comply with browser autoplay policies
 *   - Accessible dismiss controls: Initialize button, Enter key, or close ✕
 *   - High z-index (1000) capturing all interactions while open
 */

import React, { useEffect, useRef } from 'react';

export default function MissionIntroModal({ isOpen, onStartMission }) {
  const initBtnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Auto-focus the initialize button for keyboard accessibility
    const timer = setTimeout(() => {
      if (initBtnRef.current) {
        initBtnRef.current.focus();
      }
    }, 50);

    const handleKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onStartMission();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onStartMission]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'radial-gradient(ellipse at center, rgba(6, 14, 28, 0.95) 0%, rgba(1, 2, 8, 0.98) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        pointerEvents: 'auto',
        animation: 'intro-overlay-fade-in 0.25s ease-out forwards',
      }}
    >
      <div
        className="hud-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(740px, calc(100vw - 48px))',
          maxWidth: '740px',
          maxHeight: 'min(860px, calc(100vh - 48px), calc(100dvh - 48px))',
          overflowY: 'auto',
          padding: '28px 32px',
          border: '1px solid rgba(0, 229, 255, 0.4)',
          borderRadius: '12px',
          background: 'rgba(5, 12, 24, 0.97)',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.95), 0 0 35px rgba(0, 229, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          cursor: 'default',
          animation: 'intro-card-zoom-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#00e5ff',
                boxShadow: '0 0 10px #00e5ff',
              }}
            />
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.16em',
                color: '#00e5ff',
                textTransform: 'uppercase',
              }}
            >
              NASA / JPL MARS EDL INTERACTIVE MISSION
            </span>
          </div>

          <button
            onClick={onStartMission}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '4px',
              lineHeight: 1,
            }}
            title="Close briefing and start"
          >
            ✕
          </button>
        </div>

        {/* Main Title */}
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#ffffff',
            lineHeight: 1.15,
            marginBottom: '8px',
          }}
        >
          PERSEVERANCE ENTRY, DESCENT &amp; LANDING
        </h1>

        <p
          style={{
            fontSize: '13px',
            color: '#94a3b8',
            lineHeight: 1.5,
            marginBottom: '18px',
          }}
        >
          Experience the harrowing <strong style={{ color: '#f0f4f8' }}>"Seven Minutes of Terror"</strong>: an autonomous
          aerospace sequence decelerating a 1,025&nbsp;kg vehicle from 19,400&nbsp;km/h (Mach 24) in orbital space to a
          soft touchdown on Mars using supersonic parachutes, Terrain-Relative Navigation, and the Sky Crane rocket system.
        </p>

        {/* Mission Specs Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '10px',
            marginBottom: '18px',
          }}
        >
          <SpecCard
            label="TARGET SITE"
            value="Jezero Crater"
            detail="18.38° N, 77.58° E"
          />
          <SpecCard
            label="ENTRY SPEED"
            value="5,400 m/s"
            detail="Mach 24 Hypersonic"
          />
          <SpecCard
            label="PEAK HEAT FLUX"
            value="182 W/cm²"
            detail="PICA-X Protection"
          />
          <SpecCard
            label="NAVIGATION"
            value="LVS / TRN Divert"
            detail="Autonomous Hazard Scan"
          />
        </div>

        {/* Interaction & Keyboard Shortcuts */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            padding: '12px 14px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: '#ffaa66',
              marginBottom: '8px',
              textTransform: 'uppercase',
            }}
          >
            FLIGHT DIRECTOR INTERACTION GUIDE
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: '8px',
              fontSize: '11px',
              color: '#cbd5e1',
            }}
          >
            <div>
              <kbd style={kbdStyle}>Space</kbd> Play / Pause Flight
            </div>
            <div>
              <kbd style={kbdStyle}>1–8</kbd> Switch Camera Angles
            </div>
            <div>
              <kbd style={kbdStyle}>T</kbd> Lander Vision System (TRN)
            </div>
            <div>
              <kbd style={kbdStyle}>G</kbd> Live Telemetry Stripcharts
            </div>
            <div>
              <kbd style={kbdStyle}>Timeline</kbd> Scrub to Any Milestone
            </div>
            <div>
              <kbd style={kbdStyle}>M</kbd> Mute / Unmute Mission Audio
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
          <button
            ref={initBtnRef}
            onClick={onStartMission}
            style={{
              background: 'linear-gradient(135deg, #ff7722 0%, #e65100 100%)',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              padding: '12px 28px',
              fontSize: '12.5px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(255, 119, 34, 0.45)',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              outline: 'none',
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            onFocus={(e) => (e.currentTarget.style.boxShadow = '0 0 0 2px #00e5ff, 0 4px 18px rgba(255, 119, 34, 0.6)')}
            onBlur={(e) => (e.currentTarget.style.boxShadow = '0 4px 18px rgba(255, 119, 34, 0.45)')}
          >
            <span>INITIALIZE MISSION SIMULATION</span>
            <span>➔</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SpecCard({ label, value, detail }) {
  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '6px',
        padding: '10px',
      }}
    >
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '1px' }}>
        {value}
      </div>
      <div style={{ fontSize: '10px', color: '#94a3b8' }}>{detail}</div>
    </div>
  );
}

const kbdStyle = {
  background: 'rgba(255, 255, 255, 0.12)',
  border: '1px solid rgba(255, 255, 255, 0.25)',
  borderRadius: '4px',
  padding: '1px 5px',
  fontSize: '10px',
  fontWeight: 700,
  color: '#00e5ff',
  marginRight: '6px',
  fontFamily: 'var(--font-mono)',
};
