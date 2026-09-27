/**
 * OrbitalTrajectory.jsx – Visualizes 3D orbital path and entry trajectory.
 *
 * Visual elements:
 *   - Circular parking orbit at 250 km (cyan/blue #00e5ff)
 *   - Entry interface boundary ring at 125 km (faint orange #ff8844)
 *   - Spacecraft dynamic path trail (color-coded by phase)
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function OrbitalTrajectory({ simStateRef, trajectoryPathRef, visible = true }) {
  const trailLineRef = useRef();
  const trajectoryPathGroupRef = useRef();
  const observedPath = useRef(null);
  const observedRevision = useRef(-1);

  // The sole path line is backed by the exact rendered rover-root history.
  const trailGeometry = useMemo(() => {
    return new THREE.BufferGeometry();
  }, []);

  useFrame(() => {
    const s = simStateRef?.current;
    if (!s || !trailLineRef.current) return;
    const path = trajectoryPathRef?.current;
    if (path) {
      if (trajectoryPathGroupRef.current) {
        if (path.origin) trajectoryPathGroupRef.current.position.set(path.origin.x, path.origin.y, path.origin.z);
        else trajectoryPathGroupRef.current.position.set(0, 0, 0);
      }

      const attribute = trailGeometry.getAttribute('position');
      if (observedPath.current !== path || attribute?.array !== path.positions) {
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(path.positions, 3));
        observedPath.current = path;
        observedRevision.current = -1;
      }

      if (observedRevision.current !== path.revision) {
        const attribute = trailGeometry.attributes.position;
        if (path.count > 0) {
          if (path.fullUpdate) attribute.addUpdateRange(0, path.count * 3);
          else attribute.addUpdateRange(path.lastUpdateStart, path.lastUpdateCount);
        }
        trailGeometry.attributes.position.needsUpdate = true;
        trailGeometry.setDrawRange(0, path.count);
        observedRevision.current = path.revision;
        path.fullUpdate = false;
      }
    }

    if (trailLineRef.current.material) {
      const phaseColors = {
        MARS_ORBIT: '#00e5ff',
        DEORBIT_BURN: '#ff6600',
        COAST_TO_ENTRY: '#ffaa00',
        ATMOSPHERIC_ENTRY: '#ff3300',
        PARACHUTE_DESCENT: '#cc44ff',
        AUTONOMOUS_TARGET_REALIGNMENT: '#cc44ff',
        POWERED_DESCENT: '#ff8844',
        SAFE_APPROACH: '#ffaa66',
        LANDED: '#55ee88',
      };
      const color = phaseColors[s.phase];
      if (color) trailLineRef.current.material.color.set(color);
    }
  });

  return (
    <group visible={visible}>
      {/* The path geometry is relative to the exact first rendered rover position. */}
      <group ref={trajectoryPathGroupRef}>
        <line ref={trailLineRef} geometry={trailGeometry}>
          <lineBasicMaterial
            color="#00e5ff"
            transparent
            opacity={0.85}
            linewidth={2}
          />
        </line>
      </group>
    </group>
  );
}
