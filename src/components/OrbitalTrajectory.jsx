/**
 * OrbitalTrajectory.jsx – Visualizes 3D orbital path and entry trajectory.
 *
 * Visual elements:
 *   - Circular parking orbit at 250 km (cyan/blue #00e5ff)
 *   - Entry interface boundary ring at 125 km (faint orange #ff8844)
 *   - Spacecraft dynamic path trail (color-coded by phase)
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  MARS_RADIUS,
  ORBIT_ALTITUDE,
  ENTRY_INTERFACE_ALTITUDE,
  RENDER_SCALE,
} from '../simulation/physics/constants.js';
import { generateParkingOrbitPoints } from '../simulation/physics/orbit.js';

const MAX_TRAIL_POINTS = 300;

export default function OrbitalTrajectory({ simStateRef }) {
  const trailLineRef = useRef();
  const trailPositions = useRef(new Float32Array(MAX_TRAIL_POINTS * 3));
  const trailCount = useRef(0);
  const lastAddPos = useRef(new THREE.Vector3());
  const currentPos = useRef(new THREE.Vector3());

  // 1. Static Circular Parking Orbit Ring (250 km)
  const parkingOrbitGeometry = useMemo(() => {
    const points = generateParkingOrbitPoints(ORBIT_ALTITUDE, 180);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(points, 3));
    return geom;
  }, []);

  // 2. Entry Interface Altitude Ring (125 km)
  const entryInterfaceGeometry = useMemo(() => {
    const points = generateParkingOrbitPoints(ENTRY_INTERFACE_ALTITUDE, 180);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(points, 3));
    return geom;
  }, []);

  // 3. Dynamic Spacecraft Trajectory Trail
  const trailGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(trailPositions.current, 3));
    geom.setDrawRange(0, 0);
    return geom;
  }, []);

  // Update dynamic trail every frame
  useFrame(() => {
    const s = simStateRef?.current;
    if (!s || !trailLineRef.current) return;

    currentPos.current.set(
      s.x * RENDER_SCALE,
      (Number.isFinite(s.altitude) ? s.altitude : s.y) * RENDER_SCALE,
      s.z * RENDER_SCALE
    );

    // Only append point if moved noticeably (> 0.3 units)
    if (currentPos.current.distanceTo(lastAddPos.current) > 0.3) {
      lastAddPos.current.copy(currentPos.current);

      const array = trailPositions.current;
      const count = trailCount.current;

      if (count < MAX_TRAIL_POINTS) {
        array[count * 3 + 0] = currentPos.current.x;
        array[count * 3 + 1] = currentPos.current.y;
        array[count * 3 + 2] = currentPos.current.z;
        trailCount.current += 1;
      } else {
        // Shift points left to make room
        for (let i = 0; i < (MAX_TRAIL_POINTS - 1) * 3; i++) {
          array[i] = array[i + 3];
        }
        const lastIdx = (MAX_TRAIL_POINTS - 1) * 3;
        array[lastIdx + 0] = currentPos.current.x;
        array[lastIdx + 1] = currentPos.current.y;
        array[lastIdx + 2] = currentPos.current.z;
      }

      trailGeometry.attributes.position.needsUpdate = true;
      trailGeometry.setDrawRange(0, trailCount.current);

      // Color-code the trail based on current flight phase
      if (trailLineRef.current.material) {
        if (s.phase === 'MARS_ORBIT') {
          trailLineRef.current.material.color.set('#00e5ff'); // Cyan
        } else if (s.phase === 'DEORBIT_BURN') {
          trailLineRef.current.material.color.set('#ff6600'); // Orange
        } else if (s.phase === 'COAST_TO_ENTRY') {
          trailLineRef.current.material.color.set('#ffaa00'); // Amber
        } else if (s.phase === 'ATMOSPHERIC_ENTRY') {
          trailLineRef.current.material.color.set('#ff3300'); // Fiery red-orange
        } else if (s.phase === 'PARACHUTE_DESCENT') {
          trailLineRef.current.material.color.set('#cc44ff'); // Vibrant magenta/purple
        } else if (s.phase === 'LANDED') {
          trailLineRef.current.material.color.set('#55ee88'); // Green
        }
      }

    }
  });

  // Reset trail on simulation reset
  useEffect(() => {
    trailCount.current = 0;
    if (trailGeometry) {
      trailGeometry.setDrawRange(0, 0);
    }
  }, [simStateRef]);

  return (
    <group>
      {/* 250 km Parking Orbit (Cyan) */}
      <line geometry={parkingOrbitGeometry}>
        <lineBasicMaterial
          color="#00e5ff"
          transparent
          opacity={0.45}
          linewidth={1}
        />
      </line>

      {/* 125 km Entry Interface Boundary (Subtle Orange) */}
      <line geometry={entryInterfaceGeometry}>
        <lineBasicMaterial
          color="#ff8844"
          transparent
          opacity={0.2}
          linewidth={1}
        />
      </line>

      {/* Dynamic Flight Trajectory Trail */}
      <line ref={trailLineRef} geometry={trailGeometry}>
        <lineBasicMaterial
          color="#00e5ff"
          transparent
          opacity={0.85}
          linewidth={2}
        />
      </line>
    </group>
  );
}
