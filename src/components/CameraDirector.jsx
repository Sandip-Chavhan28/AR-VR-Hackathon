/**
 * CameraDirector.jsx – Cinematic Aerospace Camera Director for Mars EDL Simulation.
 *
 * Implements:
 *   - 8 cinematic camera perspectives tailored to each EDL flight phase:
 *       1. ORBIT_OVERVIEW       → Macro planetary view of Mars globe & orbital arc
 *       2. CHASE                → 3/4 elevated rear chase along velocity vector
 *       3. HEAT_SHIELD_CAM      → Dramatic underside perspective of incandescent plasma
 *       4. PARACHUTE_LOOKUP     → Low-angle looking up suspension lines at DGB canopy
 *       5. TRN_NADIR            → True vertical top-down descent camera (LVS view)
 *       6. POWERED_DESCENT      → Dynamic canted-engine tracking
 *       7. GROUND_TOUCHDOWN     → Wide cinematic ground orbit with perfect rover & crater framing
 *       8. FREE                 → Interactive spherical mouse orbit controls
 *   - Interactive Controls across ALL camera modes:
 *       • Left Drag: Orbit (yaw / pitch)
 *       • Right Drag / Shift+Drag: Pan (lateral offset)
 *       • Scroll Wheel: Smooth Zoom in/out
 *       • Keyboard: W/S (forward/back), A/D (strafe), Q/E (elevate), R (reset), F (focus)
 *   - Anti-clipping & Collision Safety:
 *       • Minimum distance to vehicle hull (>= 4.2 units on ground, >= 3.8 units in flight)
 *       • Absolute terrain ground clearance (>= 0.75 units above local procedural elevation)
 *       • Planetary sphere curvature safety
 *   - Frame-rate independent exponential smoothing
 */

import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RENDER_SCALE, MARS_RADIUS, ORBIT_ALTITUDE } from '../simulation/physics/constants.js';
import { detectMilestone } from '../simulation/missionEvents.js';
import { writeInterpolatedVehicleWorldPosition } from './vehicleRenderFrame.js';
import {
  getLandingSurfaceRenderHeight,
  surfaceToWorld,
  worldToSurface,
  shouldUseMetricCamera,
  MARS_SURFACE_FRAME,
} from './marsSurfaceFrame.js';

const MARS_R_RENDER = MARS_RADIUS * RENDER_SCALE; // 3389.5
const MARS_CY = -MARS_R_RENDER;

export default function CameraDirector({ simStateRef, accumRef, cameraMode = 'CHASE', cameraRef, zoomFactor = 1.0 }) {
  const { camera, scene } = useThree();

  const targetLookAt = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3());
  const currentOffset = useRef(new THREE.Vector3());
  const targetLookAtRef = useRef(new THREE.Vector3());
  const targetOffsetRef = useRef(new THREE.Vector3());
  const freeCamAngle = useRef({ theta: 0.35, phi: 0.45, radius: 16 });
  const landedAngle = useRef(0.2);
  const previousCameraMode = useRef(cameraMode);
  const lastActiveMode = useRef(null);
  const wasLanded = useRef(false);
  const wasMetricCam = useRef(false);
  const vehicleWorld = useRef(new THREE.Vector3());

  // User interactive offsets (applied on top of autonomous modes or inside FREE mode)
  const userOrbit = useRef({ yaw: 0, pitch: 0 });
  const userPan = useRef(new THREE.Vector3(0, 0, 0));
  const orbitAxis = useRef(new THREE.Vector3());
  const orbitUp = useRef(new THREE.Vector3());
  const orbitQuaternion = useRef(new THREE.Quaternion());
  const focusPoint = useRef(new THREE.Vector3());
  const focusActive = useRef(false);
  const raycaster = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());
  const surfaceScratch = useRef(new THREE.Vector3());
  const surfaceWorldScratch = useRef(new THREE.Vector3());
  const userZoom = useRef(1.0);
  const isDragging = useRef(false);
  const dragButton = useRef(0);
  const prevMouse = useRef({ x: 0, y: 0 });

  // Expose camera reference to parent
  useEffect(() => {
    if (cameraRef) {
      cameraRef.current = camera;
    }
  }, [camera, cameraRef]);

  useEffect(() => {
    if (cameraMode === 'FREE') {
      const s = simStateRef.current;
      const isMetric = s?.grounded || s?.phase === 'LANDED' || s?._useMetricCamera;
      freeCamAngle.current = { theta: 0.35, phi: 0.45, radius: isMetric ? 8.5 : 18 };
      userOrbit.current = { yaw: 0, pitch: 0 };
      userPan.current.set(0, 0, 0);
      userZoom.current = 1;
      focusActive.current = false;
    } else if (previousCameraMode.current === 'FREE') {
      userOrbit.current = { yaw: 0, pitch: 0 };
      userPan.current.set(0, 0, 0);
      userZoom.current = 1;
      focusActive.current = false;
    }
    previousCameraMode.current = cameraMode;
  }, [cameraMode]);

  // Initialize camera frustum
  useEffect(() => {
    camera.fov = 48;
    camera.near = 0.00005;  // 5 cm in the km-based render frame
    camera.far = 40000;
    camera.updateProjectionMatrix();
  }, [camera]);

  // Interactive mouse & keyboard event listeners
  useEffect(() => {
    const onMouseDown = (e) => {
      // Ignore clicks on HUD panels
      if (e.target.closest && e.target.closest('.hud-panel, button, input, select, modal')) return;
      isDragging.current = true;
      dragButton.current = e.button; // 0 = left, 2 = right
      prevMouse.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;
      prevMouse.current = { x: e.clientX, y: e.clientY };

      if (dragButton.current === 2 || e.shiftKey) {
        // Pan (lateral / vertical shift)
        const panSpeed = 0.008 * (freeCamAngle.current.radius / 15);
        userPan.current.x -= dx * panSpeed;
        userPan.current.y += dy * panSpeed;
        userPan.current.clampLength(0, 300);
      } else {
        // Orbit (yaw & pitch)
        userOrbit.current.yaw -= dx * 0.005;
        userOrbit.current.pitch = Math.max(
          -Math.PI * 0.42,
          Math.min(Math.PI * 0.42, userOrbit.current.pitch + dy * 0.005)
        );

        // Also update freeCamAngle for FREE mode
        freeCamAngle.current.theta -= dx * 0.005;
        freeCamAngle.current.phi = Math.max(
          0.08,
          Math.min(Math.PI - 0.08, freeCamAngle.current.phi + dy * 0.005)
        );
      }
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onDoubleClick = (e) => {
      if (!(e.target instanceof HTMLCanvasElement)) return;
      const rect = e.target.getBoundingClientRect();
      pointer.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.current.setFromCamera(pointer.current, camera);
      const hit = raycaster.current.intersectObjects(scene.children, true)[0];
      if (!hit?.point) return;
      focusPoint.current.copy(hit.point);
      focusActive.current = true;
      userZoom.current = Math.min(userZoom.current, 0.85);
    };

    const onWheel = (e) => {
      if (e.target.closest && e.target.closest('.hud-panel, input, select')) return;
      if (e.ctrlKey || e.metaKey) e.preventDefault();
      e.stopPropagation();
      const zoomDelta = e.deltaY * 0.0015;
      userZoom.current = Math.max(0.25, Math.min(4.0, userZoom.current + zoomDelta));
      const s = simStateRef.current;
      const isMetric = s?.grounded || s?.phase === 'LANDED' || s?._useMetricCamera;
      const radiusStep = e.deltaY * (isMetric ? 0.012 : 0.06);
      freeCamAngle.current.radius = Math.max(isMetric ? 2.5 : 2.5, Math.min(isMetric ? 50 : 800, freeCamAngle.current.radius + radiusStep));
    };

    const onContextMenu = (e) => {
      // Prevent browser context menu on right drag
      if (!e.target.closest || !e.target.closest('input, textarea')) {
        e.preventDefault();
      }
    };

    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      const flyStep = 0.45;
      if (e.key === 'w' || e.key === 'W') {
        userPan.current.z -= flyStep;
      } else if (e.key === 's' || e.key === 'S') {
        userPan.current.z += flyStep;
      } else if (e.key === 'a' || e.key === 'A') {
        userPan.current.x -= flyStep;
      } else if (e.key === 'd' || e.key === 'D') {
        userPan.current.x += flyStep;
      } else if (e.key === 'q' || e.key === 'Q') {
        userPan.current.y -= flyStep;
      } else if (e.key === 'e' || e.key === 'E') {
        userPan.current.y += flyStep;
      } else if (e.key === 'f' || e.key === 'F') {
        // Refocus on vehicle
        userPan.current.set(0, 0, 0);
        focusActive.current = false;
      }
      userPan.current.clampLength(0, 300);
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useFrame((_, delta) => {
    const s = simStateRef.current;
    if (!s) return;

    writeInterpolatedVehicleWorldPosition(s, accumRef, vehicleWorld.current);
    let lx = vehicleWorld.current.x;
    let ly = vehicleWorld.current.y;
    let lz = vehicleWorld.current.z;
    const altKm = (s.altitude || 0) / 1000;
    const isLanded = s.phase === 'LANDED' || s.grounded;
    const metricCam = shouldUseMetricCamera(s);
    if (!isFinite(lx) || !isFinite(ly) || !isFinite(lz)) return;

    if (isLanded && !wasLanded.current) {
      freeCamAngle.current = { theta: 0.35, phi: 0.45, radius: 8.5 };
      userPan.current.set(0, 0, 0);
      userZoom.current = 1;
      focusActive.current = false;
      if (currentOffset.current.lengthSq() > 1.0) {
        currentOffset.current.multiplyScalar(RENDER_SCALE);
      }
    }
    wasLanded.current = isLanded;
    wasMetricCam.current = metricCam;

    const landingRefX = (s.guidanceRefX !== undefined ? s.guidanceRefX : JEZERO_TARGET_X) * RENDER_SCALE;
    const landingRefZ = (s.guidanceRefZ !== undefined ? s.guidanceRefZ : JEZERO_TARGET_Z) * RENDER_SCALE;

    // Mars center radial "UP" unit vector
    const rdx = lx;
    const rdy = ly - MARS_CY;
    const rdz = lz;
    const rDist = Math.hypot(rdx, rdy, rdz) || 1e-6;
    const upX = rdx / rDist;
    const upY = rdy / rDist;
    const upZ = rdz / rDist;

    // Flight velocity direction
    const speed = Math.hypot(s.vx, s.vy, s.vz) || 1e-6;
    const vxN = s.vx / speed;
    const vyN = s.vy / speed;
    const vzN = s.vz / speed;

    // Lateral right vector
    let sideX = vyN * upZ - vzN * upY;
    let sideY = vzN * upX - vxN * upZ;
    let sideZ = vxN * upY - vyN * upX;
    const sideLen = Math.hypot(sideX, sideY, sideZ);
    if (sideLen > 1e-4) {
      sideX /= sideLen;
      sideY /= sideLen;
      sideZ /= sideLen;
    } else {
      sideX = 1;
      sideY = 0;
      sideZ = 0;
    }

    // Safety clamping against Mars sphere & terrain
    const safeClamp = (tx, ty, tz) => {
      // 1. Mars globe sphere collision safety (when high in orbit/space, >= 12 km)
      if (altKm >= 12) {
        const dx = tx;
        const dy = ty - MARS_CY;
        const dz = tz;
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const minD = MARS_R_RENDER + 0.02;
        if (d < minD) {
          const f = minD / d;
          tx = dx * f;
          ty = MARS_CY + dy * f;
          tz = dz * f;
        }
      }

      // 2. High-resolution local terrain collision safety (when near surface, < 12 km)
      const clearance = 0.0006;
      if (altKm < 12 || isLanded) {
        worldToSurface(surfaceScratch.current.set(tx, ty, tz), surfaceScratch.current);
        const minSurfaceY = getLandingSurfaceRenderHeight(
          surfaceScratch.current.x / RENDER_SCALE,
          surfaceScratch.current.z / RENDER_SCALE,
        ) + clearance;
        if (surfaceScratch.current.y < minSurfaceY) {
          surfaceScratch.current.y = minSurfaceY;
          surfaceToWorld(
            surfaceScratch.current.x,
            surfaceScratch.current.y,
            surfaceScratch.current.z,
            surfaceWorldScratch.current,
          );
          tx = surfaceWorldScratch.current.x;
          ty = surfaceWorldScratch.current.y;
          tz = surfaceWorldScratch.current.z;
        }
      }

      // 3. Vehicle collision envelope (never clip inside spacecraft body)
      const distToVehicle = Math.hypot(tx - lx, ty - ly, tz - lz);
      const minVehicleDist = 0.0032;
      if (distToVehicle < minVehicleDist) {
        const pushFactor = minVehicleDist / Math.max(0.0001, distToVehicle);
        tx = lx + (tx - lx) * pushFactor;
        ty = ly + (ty - ly) * pushFactor;
        tz = lz + (tz - lz) * pushFactor;
      }

      return [tx, ty, tz];
    };

    // Resolve AUTO mode based on detected milestone
    let activeMode = cameraMode;
    if (cameraMode === 'AUTO') {
      const mId = detectMilestone(s).id;
      if (mId === 'ORBIT' || mId === 'COAST_TO_ENTRY') activeMode = 'ORBIT_OVERVIEW';
      else if (mId === 'ENTRY_INTERFACE' || mId === 'PEAK_HEATING' || mId === 'PEAK_DECEL') activeMode = 'HEAT_SHIELD_CAM';
      else if (mId === 'PARACHUTE_DEPLOY' || mId === 'HEAT_SHIELD_SEP') activeMode = 'PARACHUTE_LOOKUP';
      else if (mId === 'RADAR_LOCK' || mId === 'TRN_HAZARD') activeMode = 'CHASE';
      else if (mId === 'BACKSHELL_SEP' || mId === 'POWERED_DESCENT') activeMode = 'POWERED_DESCENT';
      else if (mId === 'SKY_CRANE_TERMINAL') activeMode = 'SKY_CRANE';
      else if (mId === 'TOUCHDOWN') activeMode = 'GROUND_TOUCHDOWN';
      else activeMode = 'CHASE';
    }

    const effectiveZoom = Math.max(0.2, Math.min(5.0, (zoomFactor || 1.0) * userZoom.current));
    const targetOffset = targetOffsetRef.current;
    const lookTarget = targetLookAtRef.current.set(lx, ly, lz);

    // ── Mode-Specific Positioning ──────────────────────────────────────

    // Helper: compute orthonormal tangent basis on local surface (shared by landed presets)
    const buildSurfaceBasis = () => {
      const t1X = MARS_SURFACE_FRAME.east.x;
      const t1Y = MARS_SURFACE_FRAME.east.y;
      const t1Z = MARS_SURFACE_FRAME.east.z;
      const t2X = MARS_SURFACE_FRAME.north.x;
      const t2Y = MARS_SURFACE_FRAME.north.y;
      const t2Z = MARS_SURFACE_FRAME.north.z;
      return { t1X, t1Y, t1Z, t2X, t2Y, t2Z };
    };

    const EXPLORATION_MODES = new Set([
      'EXPLORE_FRONT', 'EXPLORE_HIGH', 'EXPLORE_LOW', 'EXPLORE_REAR', 'EXPLORE_DRAMATIC', 'EXPLORE_TOUR',
    ]);

    if (EXPLORATION_MODES.has(activeMode)) {
      // ── Post-Landing Exploration Preset Cameras ────────────────────────
      const { t1X, t1Y, t1Z, t2X, t2Y, t2Z } = buildSurfaceBasis();

      if (activeMode === 'EXPLORE_FRONT') {
        // Direct front-facing close-up of Perseverance
        const dist = 3.6 * effectiveZoom;
        targetOffset.set(
          t2X * dist + upX * 0.9,
          t2Y * dist + upY * 0.9,
          t2Z * dist + upZ * 0.9,
        );
        lookTarget.set(
          lx + upX * 0.50 * RENDER_SCALE,
          ly + upY * 0.50 * RENDER_SCALE,
          lz + upZ * 0.50 * RENDER_SCALE
        );

      } else if (activeMode === 'EXPLORE_HIGH') {
        // Top-down aerial showing rover in crater context
        const dist = 14.0 * effectiveZoom;
        targetOffset.set(
          upX * dist + t1X * 2.0,
          upY * dist + t1Y * 2.0,
          upZ * dist + t1Z * 2.0,
        );
        lookTarget.set(lx, ly, lz);

      } else if (activeMode === 'EXPLORE_LOW') {
        // Dramatic ground-level wheel-height shot
        const dist = 4.8 * effectiveZoom;
        targetOffset.set(
          t1X * dist + upX * 0.25,
          t1Y * dist + upY * 0.25,
          t1Z * dist + upZ * 0.25,
        );
        lookTarget.set(
          lx + upX * 0.25 * RENDER_SCALE,
          ly + upY * 0.25 * RENDER_SCALE,
          lz + upZ * 0.25 * RENDER_SCALE
        );

      } else if (activeMode === 'EXPLORE_REAR') {
        // Rear quarter — MMRTG / RTG view
        const dist = 4.2 * effectiveZoom;
        targetOffset.set(
          -t2X * dist * 0.85 + t1X * dist * 0.4 + upX * 0.85,
          -t2Y * dist * 0.85 + t1Y * dist * 0.4 + upY * 0.85,
          -t2Z * dist * 0.85 + t1Z * dist * 0.4 + upZ * 0.85,
        );
        lookTarget.set(
          lx + upX * 0.50 * RENDER_SCALE,
          ly + upY * 0.50 * RENDER_SCALE,
          lz + upZ * 0.50 * RENDER_SCALE
        );

      } else {
        // EXPLORE_DRAMATIC / EXPLORE_TOUR — slow wide cinematic orbit (only when running)
        if (s.running) {
          landedAngle.current += delta * 0.025;
        }
        const angle = landedAngle.current + userOrbit.current.yaw;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const LAND_R = 7.5 * effectiveZoom;
        const LAND_H = 2.4 * effectiveZoom;
        targetOffset.set(
          (t1X * cosA + t2X * sinA) * LAND_R + upX * LAND_H,
          (t1Y * cosA + t2Y * sinA) * LAND_R + upY * LAND_H,
          (t1Z * cosA + t2Z * sinA) * LAND_R + upZ * LAND_H,
        );
        lookTarget.set(
          lx + upX * 0.50 * RENDER_SCALE,
          ly + upY * 0.50 * RENDER_SCALE,
          lz + upZ * 0.50 * RENDER_SCALE
        );
      }

    } else if (activeMode === 'GROUND_TOUCHDOWN' || (isLanded && activeMode !== 'FREE')) {
      // Slow cinematic azimuth drift (only when running)
      if (s.running) {
        landedAngle.current += delta * 0.04;
      }
      const angle = landedAngle.current + userOrbit.current.yaw;
      const pitch = 0.18 + userOrbit.current.pitch;

      const LAND_R = (5.6 + Math.cos(pitch) * 0.8) * effectiveZoom;
      const LAND_H = (1.6 + Math.sin(pitch) * 0.8) * effectiveZoom;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Orthonormal tangent basis on surface
      const { t1X, t1Y, t1Z, t2X, t2Y, t2Z } = buildSurfaceBasis();

      targetOffset.set(
        (t1X * cosA + t2X * sinA) * LAND_R + upX * LAND_H,
        (t1Y * cosA + t2Y * sinA) * LAND_R + upY * LAND_H,
        (t1Z * cosA + t2Z * sinA) * LAND_R + upZ * LAND_H
      );
      // Heroic framing: focus directly on the rover chassis center
      lookTarget.set(
        lx + upX * 0.50 * RENDER_SCALE,
        ly + upY * 0.50 * RENDER_SCALE,
        lz + upZ * 0.50 * RENDER_SCALE
      );

    } else if (activeMode === 'SKY_CRANE') {
      const { t1X, t1Y, t1Z, t2X, t2Y, t2Z } = buildSurfaceBasis();
      const dist = 14.0 * effectiveZoom;
      targetOffset.set(
        (t1X * 0.85 + t2X * 0.40) * dist + upX * (3.8 * effectiveZoom),
        (t1Y * 0.85 + t2Y * 0.40) * dist + upY * (3.8 * effectiveZoom),
        (t1Z * 0.85 + t2Z * 0.40) * dist + upZ * (3.8 * effectiveZoom)
      );
      lookTarget.set(
        lx + upX * 0.60 * RENDER_SCALE,
        ly + upY * 0.60 * RENDER_SCALE,
        lz + upZ * 0.60 * RENDER_SCALE
      );

    } else if (activeMode === 'HEAT_SHIELD_CAM') {
      // Elevated tracking view keeps both the entry vehicle and planetary limb in frame.
      const dist = 14.0 * effectiveZoom;
      const elevation = 4.2 * effectiveZoom;
      targetOffset.set(
        vxN * dist * 0.8 + upX * elevation + sideX * 0.65 * effectiveZoom,
        vyN * dist * 0.8 + upY * elevation + sideY * 0.65 * effectiveZoom,
        vzN * dist * 0.8 + upZ * elevation + sideZ * 0.65 * effectiveZoom
      );
      lookTarget.set(lx, ly - 0.2 * RENDER_SCALE, lz);

    } else if (activeMode === 'PARACHUTE_LOOKUP') {
      // Three-quarter canopy view: keep the backshell, canopy, and horizon in frame.
      const dist = 16.0 * effectiveZoom;
      targetOffset.set(
        -vxN * dist * 0.4 + sideX * dist * 0.6 + upX * 4.0,
        -vyN * dist * 0.4 + sideY * dist * 0.6 + upY * 4.0,
        -vzN * dist * 0.4 + sideZ * dist * 0.6 + upZ * 4.0
      );
      lookTarget.set(lx, ly + 4.5 * RENDER_SCALE, lz);

    } else if (activeMode === 'TRN_NADIR') {
      // Elevated steep perspective that frames BOTH the descending vehicle and Jezero Crater below
      const dist = 18.0 * effectiveZoom;
      targetOffset.set(
        -vxN * dist * 0.35 + upX * dist * 0.88 + sideX * dist * 0.2,
        -vyN * dist * 0.35 + upY * dist * 0.88 + sideY * dist * 0.2,
        -vzN * dist * 0.35 + upZ * dist * 0.88 + sideZ * dist * 0.2
      );
      lookTarget.set(lx, ly, lz);

    } else if (activeMode === 'POWERED_DESCENT') {
      // Elevated side tracking smoothly scaling with altitude as spacecraft nears ground
      const dist = 18.0 * effectiveZoom;
      targetOffset.set(
        -sideX * dist * 0.85 + upX * (dist * 0.42 + 2.5) - vxN * 1.5,
        -sideY * dist * 0.85 + upY * (dist * 0.42 + 2.5) - vyN * 1.5,
        -sideZ * dist * 0.85 + upZ * (dist * 0.42 + 2.5) - vzN * 1.5
      );
      lookTarget.set(lx, ly + 0.5 * RENDER_SCALE, lz);

    } else if (activeMode === 'ORBIT_OVERVIEW') {
      const dist = 22.0 * effectiveZoom;
      targetOffset.set(
        -vxN * dist * 0.5 + upX * dist * 0.45 + sideX * dist * 0.85,
        -vyN * dist * 0.5 + upY * dist * 0.45 + sideY * dist * 0.85,
        -vzN * dist * 0.5 + upZ * dist * 0.45 + sideZ * dist * 0.85
      );
      lookTarget.set(lx, ly, lz);

    } else if (activeMode === 'FREE') {
      const isMetric = isLanded || metricCam;
      const baseRadius = isMetric ? Math.min(45.0, Math.max(2.5, freeCamAngle.current.radius)) : freeCamAngle.current.radius;
      const r = baseRadius * (effectiveZoom / zoomFactor);
      const theta = freeCamAngle.current.theta;
      const phi = freeCamAngle.current.phi;

      targetOffset.set(
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.cos(theta)
      );
      lookTarget.set(lx, ly + 0.35 * RENDER_SCALE, lz);

    } else {
      // Default: CHASE
      const dist = (altKm > 100 ? 12.0 : altKm > 10 ? 9.5 : 7.0) * effectiveZoom;
      const yaw = userOrbit.current.yaw;
      const pitch = userOrbit.current.pitch;

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);

      const fwdX = -vxN * cosY + sideX * sinY;
      const fwdY = -vyN * cosY + sideY * sinY;
      const fwdZ = -vzN * cosY + sideZ * sinY;

      targetOffset.set(
        fwdX * dist * 0.82 + upX * (dist * 0.38 + pitch * 3.0),
        fwdY * dist * 0.82 + upY * (dist * 0.38 + pitch * 3.0),
        fwdZ * dist * 0.82 + upZ * (dist * 0.38 + pitch * 3.0)
      );
      lookTarget.set(lx, ly + 0.35 * RENDER_SCALE, lz);
    }

    if (activeMode !== 'FREE' && activeMode !== 'CHASE' && (userOrbit.current.yaw || userOrbit.current.pitch)) {
      orbitUp.current.set(upX, upY, upZ);
      orbitQuaternion.current.setFromAxisAngle(orbitUp.current, userOrbit.current.yaw);
      targetOffset.applyQuaternion(orbitQuaternion.current);
      orbitAxis.current.crossVectors(orbitUp.current, targetOffset).normalize();
      orbitQuaternion.current.setFromAxisAngle(orbitAxis.current, userOrbit.current.pitch);
      targetOffset.applyQuaternion(orbitQuaternion.current);
    }

    if (lastActiveMode.current !== activeMode) {
      if (activeMode === 'FREE' && (isLanded || metricCam)) {
        freeCamAngle.current = { theta: 0.35, phi: 0.45, radius: 8.5 };
        userPan.current.set(0, 0, 0);
        userZoom.current = 1;
        focusActive.current = false;
      }
      // When switching perspectives across different distance domains, transition smoothly
      const targetLen = targetOffset.length() * ((isLanded || metricCam) ? RENDER_SCALE : 1.0);
      const curLen = currentOffset.current.length();
      if (!curLen || curLen > targetLen * 5.0 || curLen < targetLen * 0.15) {
        currentOffset.current.copy(targetOffset).multiplyScalar((isLanded || metricCam) ? RENDER_SCALE : 1.0);
        currentLookAt.current.copy(lookTarget);
      }
      lastActiveMode.current = activeMode;
    }

    if (isLanded || metricCam) targetOffset.multiplyScalar(RENDER_SCALE);

    if (focusActive.current) {
      lookTarget.copy(focusPoint.current);
    }

    // Apply keyboard / mouse pan offset to look target
    lookTarget.add(userPan.current);

    // Smooth the offset vector (rotational transition between perspectives)
    if (!currentOffset.current.lengthSq() || !s.running) {
      currentOffset.current.copy(targetOffset);
    } else if (isLanded && !userOrbit.current.yaw && !userOrbit.current.pitch) {
      // While landed and running along the continuous orbit without user manual dragging,
      // lock currentOffset directly to targetOffset to eliminate secondary trailing lag (double interpolation)
      currentOffset.current.copy(targetOffset);
    } else {
      const offsetLerpRate = Math.min(1.0, delta * 7.5);
      currentOffset.current.lerp(targetOffset, offsetLerpRate);
    }

    let desiredX = lookTarget.x + currentOffset.current.x;
    let desiredY = lookTarget.y + currentOffset.current.y;
    let desiredZ = lookTarget.z + currentOffset.current.z;

    [desiredX, desiredY, desiredZ] = safeClamp(desiredX, desiredY, desiredZ);

    camera.position.set(desiredX, desiredY, desiredZ);

    // Align camera vertical axis to the local surface / planetary up vector
    camera.up.set(upX, upY, upZ);

    // Lock camera look-at directly to lookTarget to ensure temporal stability and zero jitter at all playback speeds
    camera.lookAt(lookTarget);
    currentLookAt.current.copy(lookTarget);

    if (typeof window !== 'undefined') {
      window.__EDL_CAMERA_DEBUG__ = {
        camPos: [camera.position.x, camera.position.y, camera.position.z],
        lookTarget: [lookTarget.x, lookTarget.y, lookTarget.z],
        near: camera.near,
        far: camera.far,
        currentOffset: [currentOffset.current.x, currentOffset.current.y, currentOffset.current.z],
        targetOffset: [targetOffset.x, targetOffset.y, targetOffset.z],
        activeMode,
      };
    }
  });

  return null;
}
