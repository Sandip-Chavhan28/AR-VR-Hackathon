/**
 * WorldLabels.jsx – NASA Eyes Floating 3D Spatial World Labels.
 *
 * Direct DOM updates via requestAnimationFrame:
 *   - Anchored to Perseverance Rover, Jezero Crater Target, Heat Shield,
 *     Backshell & Parachute, and Descent Stage Flyaway.
 *   - Smooth distance-based opacity fading and frustum culling.
 *   - Sleek aerospace waypoint markers with connecting tick lines.
 *   - ZERO React state re-rendering (prevents 60Hz DOM reconciliation churn).
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RENDER_SCALE, ORBIT_ALTITUDE, JEZERO_TARGET_X, JEZERO_TARGET_Z } from '../simulation/physics/constants.js';
import { getLandingSurfaceRenderHeight, surfaceToWorld } from './marsSurfaceFrame.js';

const LABEL_DEFS = [
  { id: 'rover', color: '#00e5ff' },
  { id: 'target', color: '#00e676' },
  { id: 'heatshield', color: '#ffaa66' },
  { id: 'backshell', color: '#cbd5e1' },
  { id: 'descentstage', color: '#ff7722' },
];

export default function WorldLabels({ simStateRef, cameraRef }) {
  const containerRef = useRef(null);
  const tempVec = useRef(new THREE.Vector3());

  // Direct element references
  const elemRefs = useRef({
    rover: { root: null, title: null, sub: null, lastTitle: '', lastSub: '' },
    target: { root: null, title: null, sub: null, lastTitle: '', lastSub: '' },
    heatshield: { root: null, title: null, sub: null, lastTitle: '', lastSub: '' },
    backshell: { root: null, title: null, sub: null, lastTitle: '', lastSub: '' },
    descentstage: { root: null, title: null, sub: null, lastTitle: '', lastSub: '' },
  });

  useEffect(() => {
    let animId;

    const updateLabels = () => {
      const s = simStateRef?.current;
      const cam = cameraRef?.current;

      if (!s || !cam) {
        animId = requestAnimationFrame(updateLabels);
        return;
      }

      const physX = s.x || 0;
      const physZ = s.z || 0;
      const physY = Number.isFinite(s.altitude) ? s.altitude : (s.y ?? ORBIT_ALTITUDE);
      const isLanded = s.phase === 'LANDED' || s.grounded;
      const altKm = (s.altitude || 0) / 1000;
      const closeLandingPhase = s.phase === 'POWERED_DESCENT' || s.phase === 'SAFE_APPROACH' || s.phase === 'LANDED';
      const landingRefX = s.guidanceRefX !== undefined ? s.guidanceRefX : JEZERO_TARGET_X;
      const landingRefZ = s.guidanceRefZ !== undefined ? s.guidanceRefZ : JEZERO_TARGET_Z;

      const projectPoint = (wx, wy, wz) => {
        tempVec.current.set(wx, wy, wz);
        const dist = cam.position.distanceTo(tempVec.current);
        tempVec.current.project(cam);

        // Check if point is in front of camera
        if (tempVec.current.z < 1.0) {
          const sx = (tempVec.current.x * 0.5 + 0.5) * window.innerWidth;
          const sy = (-tempVec.current.y * 0.5 + 0.5) * window.innerHeight;
          // Clamp to screen boundaries with padding
          if (sx >= 30 && sx <= window.innerWidth - 30 && sy >= 30 && sy <= window.innerHeight - 30) {
            return { sx, sy, dist, visible: true };
          }
        }
        return { visible: false };
      };

      const setDomLabel = (id, visible, p, title, sub, opacity = 1.0) => {
        const item = elemRefs.current[id];
        if (!item || !item.root) return;

        if (!visible) {
          item.root.style.display = 'none';
          return;
        }

        item.root.style.display = 'flex';
        item.root.style.transform = `translate3d(${p.sx.toFixed(1)}px, ${p.sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
        item.root.style.opacity = opacity.toFixed(2);

        if (title !== item.lastTitle) {
          item.title.textContent = title;
          item.lastTitle = title;
        }
        if (item.sub && sub !== item.lastSub) {
          item.sub.textContent = sub;
          item.lastSub = sub;
        }
      };

      // 1. Perseverance Rover
      if (altKm < 15.0) {
        let roverY = physY * RENDER_SCALE;
        let roverPosition;
        if (isLanded) {
          roverY = getLandingSurfaceRenderHeight(physX - landingRefX, physZ - landingRefZ) + 0.8 * RENDER_SCALE;
          roverPosition = surfaceToWorld(
            (physX - landingRefX) * RENDER_SCALE,
            roverY + 0.8 * RENDER_SCALE,
            (physZ - landingRefZ) * RENDER_SCALE,
            tempVec.current,
          );
        }
        const p = isLanded
          ? projectPoint(roverPosition.x, roverPosition.y, roverPosition.z)
          : projectPoint(physX * RENDER_SCALE, roverY + 0.8, physZ * RENDER_SCALE);
        if (p.visible && p.dist < 800) {
          const opacity = Math.min(1.0, Math.max(0.2, (500 - p.dist) / 400));
          const title = isLanded ? 'PERSEVERANCE ROVER' : 'MARS 2020 EDL VEHICLE';
          const sub = isLanded ? 'SURFACE TOUCHDOWN' : `ALT ${(s.altitude || 0).toFixed(0)} m`;
          setDomLabel('rover', true, p, title, sub, opacity);
        } else {
          setDomLabel('rover', false);
        }
      } else {
        setDomLabel('rover', false);
      }

      // 2. Jezero Crater Landing Target
      if (!closeLandingPhase && altKm < 15.0) {
        const offX = s.landingSiteAnalysis?.selectedTarget?.x || 28;
        const offZ = s.landingSiteAnalysis?.selectedTarget?.z || 16;
        const tgtX = landingRefX + offX;
        const tgtZ = landingRefZ + offZ;
        const tgtElev = getLandingSurfaceRenderHeight(offX, offZ);
        const targetPosition = surfaceToWorld(offX * RENDER_SCALE, tgtElev + 0.5 * RENDER_SCALE, offZ * RENDER_SCALE, tempVec.current);
        const p = projectPoint(targetPosition.x, targetPosition.y, targetPosition.z);
        if (p.visible && p.dist < 1000) {
          const opacity = Math.min(1.0, Math.max(0.15, (800 - p.dist) / 600));
          setDomLabel('target', true, p, 'JEZERO CRATER TARGET', 'SAFE LANDING ZONE', opacity);
        } else {
          setDomLabel('target', false);
        }
      } else {
        setDomLabel('target', false);
      }

      // 3. Heat Shield Location (Falling or on ground)
      if (!closeLandingPhase && s.heatShieldSeparated && altKm < 12.0) {
        let hsX = physX + 1150;
        let hsZ = physZ - 380;
        let hsY = getLandingSurfaceRenderHeight(hsX - landingRefX, hsZ - landingRefZ) + 0.3 * RENDER_SCALE;
        if (!isLanded && s.heatShieldPos) {
          hsX = s.heatShieldPos.x;
          hsY = (physY + (s.heatShieldPos.y - (s.y || 0))) * RENDER_SCALE;
          hsZ = s.heatShieldPos.z;
        }
        const p = projectPoint(hsX * RENDER_SCALE, hsY + 0.4, hsZ * RENDER_SCALE);
        if (p.visible && p.dist < 900) {
          setDomLabel('heatshield', true, p, 'HEAT SHIELD', isLanded ? 'IMPACT LOCATION' : 'JETTISONED', 0.85);
        } else {
          setDomLabel('heatshield', false);
        }
      } else {
        setDomLabel('heatshield', false);
      }

      // 4. Backshell & Parachute Location
      if (!closeLandingPhase && s.backshellSeparated && altKm < 5.0) {
        let bsX = physX - 850;
        let bsZ = physZ + 480;
        let bsY = getLandingSurfaceRenderHeight(bsX - landingRefX, bsZ - landingRefZ) + 0.5 * RENDER_SCALE;
        if (!isLanded && s.backshellPos) {
          bsX = s.backshellPos.x;
          bsY = (physY + (s.backshellPos.y - (s.y || 0))) * RENDER_SCALE;
          bsZ = s.backshellPos.z;
        }
        const p = projectPoint(bsX * RENDER_SCALE, bsY + 0.4, bsZ * RENDER_SCALE);
        if (p.visible && p.dist < 800) {
          setDomLabel('backshell', true, p, 'BACKSHELL & CHUTE', isLanded ? 'SURFACE IMPACT' : 'RELEASED', 0.85);
        } else {
          setDomLabel('backshell', false);
        }
      } else {
        setDomLabel('backshell', false);
      }

      // 5. Descent Stage (Flyaway or Crash)
      if (s.descentStageFlyaway && s.descentStagePos && altKm < 3.0) {
        let dsX = isLanded ? physX + 680 : s.descentStagePos.x;
        let dsZ = isLanded ? physZ + 410 : s.descentStagePos.z;
        let dsY = isLanded
          ? getLandingSurfaceRenderHeight(680, 410) + 0.3 * RENDER_SCALE
          : (physY + (s.descentStagePos.y - (s.y || 0))) * RENDER_SCALE;
        const p = projectPoint(dsX * RENDER_SCALE, dsY + 0.4, dsZ * RENDER_SCALE);
        if (p.visible && p.dist < 1200) {
          setDomLabel('descentstage', true, p, 'DESCENT STAGE', isLanded ? 'CRASH SITE' : 'FLYAWAY TRAJECTORY', 0.9);
        } else {
          setDomLabel('descentstage', false);
        }
      } else {
        setDomLabel('descentstage', false);
      }

      animId = requestAnimationFrame(updateLabels);
    };

    animId = requestAnimationFrame(updateLabels);
    return () => cancelAnimationFrame(animId);
  }, [simStateRef, cameraRef]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 15,
        overflow: 'hidden',
      }}
    >
      {LABEL_DEFS.map((def) => (
        <div
          key={def.id}
          ref={(node) => {
            if (elemRefs.current[def.id]) {
              elemRefs.current[def.id].root = node;
              if (node) {
                elemRefs.current[def.id].title = node.querySelector('.wl-title');
                elemRefs.current[def.id].sub = node.querySelector('.wl-sub');
              }
            }
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'none',
            flexDirection: 'column',
            alignItems: 'center',
            willChange: 'transform, opacity',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {/* Tag Card */}
          <div
            style={{
              background: 'rgba(5, 10, 20, 0.82)',
              border: `1px solid ${def.color}`,
              borderRadius: '3px',
              padding: '3px 8px',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: `0 0 10px ${def.color}40`,
              whiteSpace: 'nowrap',
            }}
          >
            <span
              className="wl-title"
              style={{
                fontSize: '9px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: def.color,
                textTransform: 'uppercase',
              }}
            />
            <span
              className="wl-sub"
              style={{
                fontSize: '8px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                color: '#94a3b8',
                opacity: 0.9,
              }}
            />
          </div>

          {/* Connecting Vertical Pointer & Target Dot */}
          <div
            style={{
              width: '1px',
              height: '14px',
              background: `linear-gradient(to bottom, ${def.color}, transparent)`,
            }}
          />
          <div
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: def.color,
              boxShadow: `0 0 6px ${def.color}`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
