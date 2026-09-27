import * as THREE from 'three';
import {
  JEZERO_TARGET_X,
  JEZERO_TARGET_Z,
  MARS_RADIUS,
  RENDER_SCALE,
  ROVER_WHEEL_CONTACT_Y,
} from '../simulation/physics/constants.js';
import { getTerrainHeight } from '../simulation/landingSite/terrain.js';

const radius = MARS_RADIUS * RENDER_SCALE;
const anchorX = JEZERO_TARGET_X * RENDER_SCALE;
const anchorZ = JEZERO_TARGET_Z * RENDER_SCALE;
const anchorY = Math.sqrt(Math.max(0, radius * radius - anchorX * anchorX - anchorZ * anchorZ)) - radius;

const up = new THREE.Vector3(anchorX, anchorY + radius, anchorZ).normalize();
const east = new THREE.Vector3(up.y, -up.x, 0).normalize();
const north = new THREE.Vector3().crossVectors(east, up).normalize();
const origin = new THREE.Vector3(anchorX, anchorY, anchorZ);
const rotation = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(east, up, north),
);
const inverseRotation = rotation.clone().invert();

export const MARS_SURFACE_FRAME = { origin, east, up, north, rotation, inverseRotation, anchorY };

const WHEEL_CLEARANCE_RENDER = -ROVER_WHEEL_CONTACT_Y * RENDER_SCALE;

export function getLandingSurfaceRenderHeight(xMeters, zMeters) {
  return getTerrainHeight(xMeters, zMeters) * RENDER_SCALE;
}

export function surfaceToWorld(x, y, z, target = new THREE.Vector3()) {
  return target.copy(origin)
    .addScaledVector(east, x)
    .addScaledVector(up, y)
    .addScaledVector(north, z);
}

export function worldToSurface(position, target = new THREE.Vector3()) {
  return target.copy(position).sub(origin).applyQuaternion(inverseRotation);
}

/**
 * Sticky visual frame so the vehicle never chatters between Cartesian orbit
 * space and the Jezero surface basis at a hard altitude threshold.
 */
export function shouldUseSurfaceFrame(state) {
  if (!state) return false;
  const alt = Number.isFinite(state.altitude) ? state.altitude : Infinity;
  const landed = !!(state.grounded || state.phase === 'LANDED' || state.roverSettled);
  if (landed || alt < 60000) {
    state._useSurfaceFrame = true;
  } else if (alt > 100000) {
    state._useSurfaceFrame = false;
  }
  return !!state._useSurfaceFrame;
}

/**
 * Close-range camera distances are authored in kilometers (1 unit = 1 km).
 * Once the vehicle is in the surface frame at terminal altitude, those
 * distances must be converted with RENDER_SCALE or the 3 m rover is 5–16 km
 * off-camera. Sticky to avoid frame-to-frame scale reversals.
 */
export function shouldUseMetricCamera(state) {
  // Always true: the 3m Perseverance rover is modeled in 1:1 meters (scaled by RENDER_SCALE)
  // across all flight phases, so camera offsets are consistently framed in meters.
  if (state) state._useMetricCamera = true;
  return true;
}

/**
 * Authoritative rover/vehicle local-up height in the Jezero surface frame
 * (render units). Wheel-contact fitting may replace this after sampling.
 */
export function getVehicleSurfaceLocalY(state, fittedLocalY) {
  if (Number.isFinite(fittedLocalY)) return fittedLocalY;
  if (state && Number.isFinite(state._renderedLocalY)) return state._renderedLocalY;
  const physX = state.x || 0;
  const physZ = state.z || 0;
  const landingRefX = state.guidanceRefX !== undefined ? state.guidanceRefX : JEZERO_TARGET_X;
  const landingRefZ = state.guidanceRefZ !== undefined ? state.guidanceRefZ : JEZERO_TARGET_Z;
  const groundY = getLandingSurfaceRenderHeight(physX - landingRefX, physZ - landingRefZ);
  const isLanded = state.phase === 'LANDED' || state.grounded || state.roverSettled;
  if (isLanded) return groundY + WHEEL_CLEARANCE_RENDER;
  const radarAlt = Number.isFinite(state.radarAltitude)
    ? Math.max(0, state.radarAltitude)
    : Math.max(0, state.altitude || 0);
  return groundY + WHEEL_CLEARANCE_RENDER + radarAlt * RENDER_SCALE;
}

/**
 * ONE world-position writer for the vehicle. Camera, lights, and Lander
 * must all call this instead of mixing Cartesian Y with surfaceToWorld.
 */
export function writeVehicleWorldPosition(state, target, fittedLocalY) {
  const physX = state.x || 0;
  const physZ = state.z || 0;
  const altitude = Number.isFinite(state.altitude) ? state.altitude : (state.y ?? 0);
  const landingRefX = state.guidanceRefX !== undefined ? state.guidanceRefX : JEZERO_TARGET_X;
  const landingRefZ = state.guidanceRefZ !== undefined ? state.guidanceRefZ : JEZERO_TARGET_Z;

  if (shouldUseSurfaceFrame(state)) {
    const localY = getVehicleSurfaceLocalY(state, fittedLocalY);
    return surfaceToWorld(
      (physX - landingRefX) * RENDER_SCALE,
      localY,
      (physZ - landingRefZ) * RENDER_SCALE,
      target,
    );
  }

  const renderY = (Number.isFinite(state.y) ? state.y : altitude) * RENDER_SCALE;
  return target.set(physX * RENDER_SCALE, renderY, physZ * RENDER_SCALE);
}
