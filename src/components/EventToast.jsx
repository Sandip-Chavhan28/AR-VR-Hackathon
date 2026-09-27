/**
 * EventToast.jsx – Cinematic Center-Top HUD Mission Event Callout Banner.
 *
 * Implements:
 *   - Bold NASA Eyes-style mission milestone announcements
 *   - Auto-fade after 4.5 seconds with animation
 *   - Telemetry status callout & stage indicator
 */

import React, { useEffect, useState, useRef } from 'react';

export default function EventToast({ activeMilestone }) {
  const [visible, setVisible] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const timerRef = useRef(null);
  const lastIdRef = useRef(null);

  useEffect(() => {
    if (!activeMilestone || activeMilestone.id === lastIdRef.current) return;
    lastIdRef.current = activeMilestone.id;

    // Build event callout text based on milestone
    let callout = {
      title: activeMilestone.title.toUpperCase(),
      subtitle: activeMilestone.desc,
      altStr: activeMilestone.altKm > 1 ? `${activeMilestone.altKm} KM` : `${(activeMilestone.altKm * 1000).toFixed(0)} M`,
      badge: activeMilestone.badge,
      color: activeMilestone.id === 'TOUCHDOWN' ? '#00e676' : activeMilestone.id === 'PEAK_HEATING' ? '#ff3d3d' : '#ff7722',
    };

    setCurrentEvent(callout);
    setVisible(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, 4500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeMilestone]);

  if (!visible || !currentEvent) return null;

  return (
    <div
      className="toast-animate-in"
      style={{
        position: 'absolute',
        top: '68px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        className="hud-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '10px 20px',
          background: 'rgba(5, 12, 24, 0.88)',
          border: `1px solid ${currentEvent.color}`,
          boxShadow: `0 8px 30px rgba(0, 0, 0, 0.7), 0 0 20px ${currentEvent.color}40`,
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: currentEvent.color,
            boxShadow: `0 0 10px ${currentEvent.color}`,
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.14em',
                color: '#ffffff',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {currentEvent.title}
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: currentEvent.color,
                background: 'rgba(255,255,255,0.08)',
                padding: '1px 6px',
                borderRadius: '3px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              ALT {currentEvent.altStr}
            </span>
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#cbd5e1',
              fontFamily: 'var(--font-ui)',
              marginTop: '1px',
            }}
          >
            {currentEvent.subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}
