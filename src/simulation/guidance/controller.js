/**
 * guidance/controller.js – Proportional lateral guidance controller for Stage 3B-2.
 *
 * Coordinate systems:
 *   - state.x, state.z : GLOBAL physics coordinates (meters from simulation origin).
 *     At parachute deploy: state.x ≈ 3,336,876 m (orbital arc position), state.z ≈ 0.
 *   - selectedTarget.x, selectedTarget.z : LOCAL terrain-grid coordinates (meters),
 *     representing horizontal offset from the landing zone reference point.
 *   - state.guidanceRefX, state.guidanceRefZ : Global physics coords recorded once at
 *     the moment guidance initialises (= state.x/z at parachute deploy).
 *   - Global target = (guidanceRefX + selectedTarget.x,  guidanceRefZ + selectedTarget.z)
 *
 * This guarantees:
 *   1. selectedTarget.x = 88 m → spacecraft moves 88 m horizontally in X.
 *   2. Zero teleportation: only ax/az are modified.
 *   3. Vertical physics (ay), parachute drag, and wind remain unchanged.
 *
 * Algorithm (AUTONOMOUS_TARGET_REALIGNMENT phase):
 *   err     = globalTarget – currentPosition               (position error)
 *   dist    = |err|                                        (scalar distance)
 *   desVel  = clamp(GUIDANCE_GAIN · dist, v_max) · err/dist (desired lateral velocity)
 *   velErr  = desVel – currentLateralVelocity              (velocity error)
 *   accel   = clamp(GUIDANCE_VELOCITY_GAIN · velErr, a_max) (bounded guidance accel)
 *
 * Algorithm (SAFE_APPROACH phase):
 *   Damps horizontal velocity:  accel = clamp(-APPROACH_DAMPING_GAIN · vel, a_max)
 */

import {
  MAX_GUIDANCE_ACCELERATION,
  MAX_HORIZONTAL_GUIDANCE_SPEED,
  GUIDANCE_GAIN,
  GUIDANCE_VELOCITY_GAIN,
  TARGET_CAPTURE_RADIUS,
  APPROACH_DAMPING_GAIN,
} from './constants.js';
import { JEZERO_TARGET_X, JEZERO_TARGET_Y, JEZERO_TARGET_Z, MARS_RADIUS } from '../physics/constants.js';

// ---------------------------------------------------------------------------
// Exported helper: target distance in global coords
// ---------------------------------------------------------------------------

/**
 * Compute the current distance (metres) between the spacecraft
 * and the selected safe landing target.
 *
 * Returns Infinity if guidance reference or target are not yet initialised.
 *
 * @param {object} state  Simulation state.
 * @returns {number}
 */
export function getTargetDistance(state) {
  const analysis = state.landingSiteAnalysis;
  const refX = state.guidanceRefX !== undefined ? state.guidanceRefX : JEZERO_TARGET_X;
  const refY = state.guidanceRefY !== undefined ? state.guidanceRefY : JEZERO_TARGET_Y;
  const refZ = state.guidanceRefZ !== undefined ? state.guidanceRefZ : JEZERO_TARGET_Z;
  const offX = analysis?.selectedTarget?.x || 0;
  const offZ = analysis?.selectedTarget?.z || 0;

  const globalTgtX = refX + offX;
  const globalTgtY = refY;
  const globalTgtZ = refZ + offZ;

  const dx = (state.x || 0) - globalTgtX;
  const dy = (state.y !== undefined ? state.y : refY) - globalTgtY;
  const dz = (state.z || 0) - globalTgtZ;

  return Math.hypot(dx, dy, dz);
}

// ---------------------------------------------------------------------------
// Exported helper: true landing accuracy error
// ---------------------------------------------------------------------------

/**
 * Compute landing error (metres) = distance from spacecraft to selected target
 * at the moment of touchdown.
 *
 * @param {object} state  Simulation state (called when grounded).
 * @returns {number|null}  Landing error in metres, or null if unavailable.
 */
export function calculateLandingError(state) {
  const analysis = state.landingSiteAnalysis;
  const refX = state.guidanceRefX !== undefined ? state.guidanceRefX : JEZERO_TARGET_X;
  const refY = state.guidanceRefY !== undefined ? state.guidanceRefY : JEZERO_TARGET_Y;
  const refZ = state.guidanceRefZ !== undefined ? state.guidanceRefZ : JEZERO_TARGET_Z;
  const offX = analysis?.selectedTarget?.x || 0;
  const offZ = analysis?.selectedTarget?.z || 0;

  const globalTgtX = refX + offX;
  const globalTgtY = refY;
  const globalTgtZ = refZ + offZ;

  const dx = (state.x || 0) - globalTgtX;
  const dy = (state.y !== undefined ? state.y : refY) - globalTgtY;
  const dz = (state.z || 0) - globalTgtZ;

  return Math.hypot(dx, dy, dz);
}

// ---------------------------------------------------------------------------
// Core guidance computation
// ---------------------------------------------------------------------------

/**
 * Compute lateral guidance acceleration for the current physics step.
 *
 * Decomposes guidance onto the local surface tangent vector and crossrange.
 * The radial component (along local UP) is identically zero, decoupling lateral
 * guidance from vertical descent and preventing fight with aerodynamic drag.
 *
 * Returns { ax: number, ay: number, az: number } ready to be ADDED to net acceleration.
 *
 * @param {object} state  Simulation state (mutated by reference; no mutation here).
 * @returns {{ ax: number, ay: number, az: number }}
 */
export function computeGuidance(state) {
  const phase = state.phase;

  // Local spherical coordinate frame & surface tangent basis
  const rx = state.x || 0;
  const ry = (state.y !== undefined ? state.y : (state.altitude || 0)) + MARS_RADIUS;
  const rz = state.z || 0;
  const rSph = Math.hypot(rx, ry, rz) || 1e-6;

  const upX = rx / rSph;
  const upY = ry / rSph;
  const upZ = rz / rSph;

  // Surface tangent unit vector (downrange along orbit)
  const tanX = -upY;
  const tanY = upX;

  // ── SAFE_APPROACH: damp horizontal velocity (tangent & crossrange) to stop at target ──
  if (phase === 'SAFE_APPROACH') {
    const vTan = (state.vx || 0) * tanX + (state.vy || 0) * tanY;
    const vCross = state.vz || 0;

    let dampAccTan = -APPROACH_DAMPING_GAIN * vTan;
    let dampAccCross = -APPROACH_DAMPING_GAIN * vCross;

    const mag = Math.hypot(dampAccTan, dampAccCross);
    if (mag > MAX_GUIDANCE_ACCELERATION) {
      const scale = MAX_GUIDANCE_ACCELERATION / mag;
      dampAccTan *= scale;
      dampAccCross *= scale;
    }
    return {
      ax: dampAccTan * tanX,
      ay: dampAccTan * tanY,
      az: dampAccCross,
    };
  }

  // ── AUTONOMOUS_TARGET_REALIGNMENT: proportional + velocity guidance ────
  if (phase !== 'AUTONOMOUS_TARGET_REALIGNMENT') {
    return { ax: 0, ay: 0, az: 0 };
  }

  const analysis = state.landingSiteAnalysis;
  if (!analysis || !analysis.selectedTarget) return { ax: 0, ay: 0, az: 0 };
  const refX = state.guidanceRefX !== undefined ? state.guidanceRefX : JEZERO_TARGET_X;
  const refY = state.guidanceRefY !== undefined ? state.guidanceRefY : JEZERO_TARGET_Y;
  const refZ = state.guidanceRefZ !== undefined ? state.guidanceRefZ : JEZERO_TARGET_Z;

  // Global target position
  const globalTgtX = refX + analysis.selectedTarget.x;
  const globalTgtY = refY;
  const globalTgtZ = refZ + analysis.selectedTarget.z;

  // Position error vector
  const errX = globalTgtX - (state.x || 0);
  const errY = globalTgtY - (state.y !== undefined ? state.y : refY);
  const errZ = globalTgtZ - (state.z || 0);

  // Error projected onto local tangent basis
  const errTan = errX * tanX + errY * tanY;
  const errCross = errZ;

  const horizDist = Math.hypot(errTan, errCross);
  if (horizDist < 1e-3) return { ax: 0, ay: 0, az: 0 };

  // Desired lateral speed: proportional to horizontal distance, capped at max
  const desiredSpeed = Math.min(GUIDANCE_GAIN * horizDist, MAX_HORIZONTAL_GUIDANCE_SPEED);

  // Desired lateral velocity components along tangent and crossrange
  const desVTan = desiredSpeed * (errTan / horizDist);
  const desVCross = desiredSpeed * (errCross / horizDist);

  // Current lateral velocity components
  const vTan = (state.vx || 0) * tanX + (state.vy || 0) * tanY;
  const vCross = state.vz || 0;

  // Velocity error
  const velErrTan = desVTan - vTan;
  const velErrCross = desVCross - vCross;

  // Guidance acceleration
  let gAccTan = GUIDANCE_VELOCITY_GAIN * velErrTan;
  let gAccCross = GUIDANCE_VELOCITY_GAIN * velErrCross;

  // Clamp magnitude to MAX_GUIDANCE_ACCELERATION
  const accelMag = Math.hypot(gAccTan, gAccCross);
  if (accelMag > MAX_GUIDANCE_ACCELERATION) {
    const scale = MAX_GUIDANCE_ACCELERATION / accelMag;
    gAccTan *= scale;
    gAccCross *= scale;
  }

  // Decompose purely onto tangent and crossrange — zero radial component
  return {
    ax: gAccTan * tanX,
    ay: gAccTan * tanY,
    az: gAccCross,
  };
}
