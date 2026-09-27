/**
 * MissionTimeline.jsx – NASA/JPL Eyes-Style Playback & Milestone Scrubber.
 *
 * Implements:
 *   - Replay control (↺ REPLAY)
 *   - Mission Timestamp (FEB 18, 2021 | UTC) + Mission Elapsed Time (MET T+ / T-)
 *   - Play / Pause toggle (▶ / ⏸)
 *   - Playback speed selectors (0.5×, 1×, 5×, 10×, 50×)
 *   - 13 interconnected EDL flight milestone nodes
 *   - Visual state indicators: COMPLETED (cyan), ACTIVE (glowing orange/amber), PENDING (dim)
 *   - Continuous connecting scrubber line with real-time progression indicator
 *   - Click-to-scrub to jump directly to any flight milestone
 */

import React, { useRef, useEffect, useState } from 'react';
import { EDL_MILESTONES, detectMilestone } from '../simulation/missionEvents.js';

function formatHMS(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function MissionTimeline({
  simStateRef,
  running = false,
  timeScale = 50,
  onTogglePlay,
  onReset,
  onTimeScaleChange,
  onSelectMilestone,
}) {
  const scrollContainerRef = useRef(null);
  const [hoveredMilestone, setHoveredMilestone] = useState(null);

  const s = simStateRef?.current;
  const activeMilestone = detectMilestone(s);
  const activeIndex = EDL_MILESTONES.findIndex((m) => m.id === activeMilestone.id);

  // Auto-scroll timeline to keep active milestone visible
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const activeEl = scrollContainerRef.current.children[activeIndex];
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeIndex]);

  // Mission Elapsed Time (MET) and UTC Timestamp calculation
  const elapsed = s?.elapsed || 0;
  // Atmospheric entry interface is around elapsed = 1800s. Real landing was ~20:55:03 UTC.
  const entryUtcBase = new Date(Date.UTC(2021, 1, 18, 20, 48, 0)).getTime();
  const currentUtcDate = new Date(entryUtcBase + Math.max(0, elapsed - 1800) * 1000);
  const utcHours = String(currentUtcDate.getUTCHours()).padStart(2, '0');
  const utcMinutes = String(currentUtcDate.getUTCMinutes()).padStart(2, '0');
  const utcSeconds = String(currentUtcDate.getUTCSeconds()).padStart(2, '0');
  const utcTimeStr = `${utcHours}:${utcMinutes}:${utcSeconds} UTC`;

  const metStr = elapsed < 1800
    ? `T- ${formatHMS(1800 - elapsed)}`
    : `T+ ${formatHMS(elapsed - 1800)}`;

  const speeds = [0.5, 1, 5, 10, 50];

  return (
    <div
      className="hud-panel mission-timeline"
      style={{
        position: 'absolute',
        bottom: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100vw - 32px)',
        maxWidth: '1360px',
        padding: '8px 16px',
        zIndex: 22,
        fontFamily: 'var(--font-ui)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.75), 0 0 1px rgba(255, 255, 255, 0.2) inset',
      }}
    >
      {/* ── TOP BAR: REPLAY, TIMESTAMP, PLAY/PAUSE, SPEED ─────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '8px',
          paddingBottom: '6px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Left: Replay & Real Mission Timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onReset && (
            <button
              onClick={onReset}
              title="Restart EDL Simulation (R)"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '4px',
                padding: '4px 10px',
                color: '#f8fafc',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 229, 255, 0.15)';
                e.currentTarget.style.borderColor = '#00e5ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
              }}
            >
              <span style={{ fontSize: '12px' }}>↺</span>
              <span>REPLAY</span>
            </button>
          )}

          {/* Mission Timestamp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
            <span style={{ color: '#94a3b8', fontWeight: 600 }}>FEB 18, 2021</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>|</span>
            <span className="font-mono-numbers" style={{ color: '#f8fafc', fontWeight: 600 }}>
              {utcTimeStr}
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>|</span>
            <span
              className="font-mono-numbers"
              style={{
                color: elapsed >= 1800 ? '#ffaa66' : '#00e5ff',
                fontWeight: 700,
              }}
            >
              MET {metStr}
            </span>
          </div>
        </div>

        {/* Center: Active Phase Title */}
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#00e5ff',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ color: '#ffaa66' }}>PHASE {activeIndex + 1}/{EDL_MILESTONES.length}:</span>
          <span>{activeMilestone.title}</span>
        </div>

        {/* Right: Play/Pause & Speed Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              title={running ? 'Pause (Space)' : 'Play (Space)'}
              style={{
                background: running ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 119, 34, 0.25)',
                border: `1px solid ${running ? '#00e5ff' : '#ff7722'}`,
                borderRadius: '4px',
                padding: '4px 10px',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{running ? '⏸ PAUSE' : '▶ PLAY'}</span>
            </button>
          )}

          {/* Speed Selectors */}
          {onTimeScaleChange && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              {speeds.map((spd) => {
                const isSelected = Math.abs(timeScale - spd) < 0.1;
                return (
                  <button
                    key={spd}
                    onClick={() => onTimeScaleChange(spd)}
                    title={`Playback Speed: ${spd}×`}
                    style={{
                      background: isSelected ? 'rgba(0, 229, 255, 0.35)' : 'transparent',
                      color: isSelected ? '#00e5ff' : '#94a3b8',
                      border: 'none',
                      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '3px 7px',
                      fontSize: '9px',
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    {spd}×
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM RIBBON: 13 MILESTONE NODES WITH PROGRESS BAR ──────────── */}
      <div
        ref={scrollContainerRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '2px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0, 229, 255, 0.25) transparent',
          position: 'relative',
        }}
      >
        {EDL_MILESTONES.map((m, idx) => {
          const isCompleted = idx < activeIndex;
          const isActive = idx === activeIndex;

          let badgeBg = 'rgba(255, 255, 255, 0.02)';
          let badgeBorder = 'rgba(255, 255, 255, 0.08)';
          let textColor = '#64748b';
          let altColor = '#475569';

          if (isCompleted) {
            badgeBg = 'rgba(0, 229, 255, 0.07)';
            badgeBorder = 'rgba(0, 229, 255, 0.30)';
            textColor = '#00e5ff';
            altColor = '#38bdf8';
          } else if (isActive) {
            badgeBg = 'rgba(255, 119, 34, 0.22)';
            badgeBorder = '#ff7722';
            textColor = '#ffffff';
            altColor = '#fed7aa';
          }

          const altDisplay = m.altKm > 1 ? `${m.altKm} km` : `${(m.altKm * 1000).toFixed(0)} m`;

          return (
            <button
              key={m.id}
              data-milestone={m.id}
              onClick={() => onSelectMilestone(m.id)}
              onMouseEnter={() => setHoveredMilestone(m)}
              onMouseLeave={() => setHoveredMilestone(null)}
              title={`${m.title} (~${altDisplay}) - Click to jump`}
              style={{
                flex: '0 0 auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                background: badgeBg,
                border: `1px solid ${badgeBorder}`,
                borderRadius: '5px',
                padding: '5px 8px',
                cursor: 'pointer',
                textAlign: 'left',
                minWidth: '100px',
                boxShadow: isActive ? '0 0 12px rgba(255, 119, 34, 0.4)' : 'none',
                transform: isActive ? 'scale(1.02)' : 'none',
                transition: 'all 0.15s ease',
                outline: 'none',
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '9px',
                  color: textColor,
                  fontWeight: 700,
                }}
              >
                <span>{isCompleted ? '✓' : isActive ? '▶' : `${idx + 1}.`}</span>
                <span style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)' }}>{m.title}</span>
              </div>
              <div
                className="font-mono-numbers"
                style={{
                  fontSize: '8px',
                  opacity: 0.85,
                  color: altColor,
                  marginTop: '1px',
                }}
              >
                {altDisplay}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
