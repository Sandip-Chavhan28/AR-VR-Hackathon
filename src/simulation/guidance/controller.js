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

// ---------------------------------------------------------------------------
// Exported helper: target distance in global coords
// ---------------------------------------------------------------------------

/**
 * Compute the current horizontal distance (metres) between the spacecraft
 * and the selected safe landing target.
 *
 * Returns Infinity if guidance reference or target are not yet initialised.
 *
 * @param {object} state  Simulation state.
 * @returns {number}
 */
export function getTargetDistance(state) {
  const analysis = state.landingSiteAnalysis;
  if (!analysis || !analysis.selectedTarget) return Infinity;
  if (state.guidanceRefX === undefined || state.guidanceRefZ === undefined) return Infinity;

  const globalTgtX = state.guidanceRefX + analysis.selectedTarget.x;
  const globalTgtZ = state.guidanceRefZ + analysis.selectedTarget.z;

  return Math.hypot(state.x - globalTgtX, state.z - globalTgtZ);
}

// ---------------------------------------------------------------------------
// Exported helper: true landing accuracy error
// ---------------------------------------------------------------------------

/**
 * Compute landing error (metres) = distance from spacecraft to selected target
 * at the moment of touchdown.
 *
 * NOTE: uses the guidance reference frame, so the error is in local
 *       terrain-coordinate space (not global) which is exactly what landing
 *       accuracy means.
 *
 * @param {object} state  Simulation state (called when grounded).
 * @returns {number|null}  Landing error in metres, or null if unavailable.
 */
export function calculateLandingError(state) {
  const analysis = state.landingSiteAnalysis;
  if (!analysis || !analysis.selectedTarget) return null;
  if (state.guidanceRefX === undefined || state.guidanceRefZ === undefined) return null;

  const globalTgtX = state.guidanceRefX + analysis.selectedTarget.x;
  const globalTgtZ = state.guidanceRefZ + analysis.selectedTarget.z;

  return Math.hypot(state.x - globalTgtX, state.z - globalTgtZ);
}

// ---------------------------------------------------------------------------
// Core guidance computation
// ---------------------------------------------------------------------------

/**
 * Compute lateral guidance acceleration for the current physics step.
 *
 * Returns { ax: number, az: number } ready to be ADDED to net acceleration.
 * ay is always zero — vertical motion is never modified.
 *
 * @param {object} state  Simulation state (mutated by reference; no mutation here).
 * @returns {{ ax: number, az: number }}
 */
export function computeGuidance(state) {
  const phase = state.phase;

  // ── SAFE_APPROACH: damp horizontal velocity to stop at target ──────────
  if (phase === 'SAFE_APPROACH') {
    const dampAx = -APPROACH_DAMPING_GAIN * state.vx;
    const dampAz = -APPROACH_DAMPING_GAIN * state.vz;

    const mag = Math.hypot(dampAx, dampAz);
    if (mag > MAX_GUIDANCE_ACCELERATION) {
      const scale = MAX_GUIDANCE_ACCELERATION / mag;
      return { ax: dampAx * scale, az: dampAz * scale };
    }
    return { ax: dampAx, az: dampAz };
  }

  // ── AUTONOMOUS_TARGET_REALIGNMENT: proportional + velocity guidance ────
  if (phase !== 'AUTONOMOUS_TARGET_REALIGNMENT') {
    return { ax: 0, az: 0 };
  }

  const analysis = state.landingSiteAnalysis;
  if (!analysis || !analysis.selectedTarget) return { ax: 0, az: 0 };
  if (state.guidanceRefX === undefined || state.guidanceRefZ === undefined) return { ax: 0, az: 0 };

  // Global target position
  const globalTgtX = state.guidanceRefX + analysis.selectedTarget.x;
  const globalTgtZ = state.guidanceRefZ + analysis.selectedTarget.z;

  // Position error vector
  const errX = globalTgtX - state.x;
  const errZ = globalTgtZ - state.z;
  const dist = Math.hypot(errX, errZ);

  if (dist < 1e-3) return { ax: 0, az: 0 };

  // Unit vector toward target
  const unitX = errX / dist;
  const unitZ = errZ / dist;

  // Desired speed: proportional to distance, capped at max
  const desiredSpeed = Math.min(GUIDANCE_GAIN * dist, MAX_HORIZONTAL_GUIDANCE_SPEED);

  // Desired lateral velocity vector
  const desVx = desiredSpeed * unitX;
  const desVz = desiredSpeed * unitZ;

  // Velocity error (desired minus current horizontal velocity)
  const velErrX = desVx - state.vx;
  const velErrZ = desVz - state.vz;

  // Guidance acceleration proportional to velocity error
  let gAx = GUIDANCE_VELOCITY_GAIN * velErrX;
  let gAz = GUIDANCE_VELOCITY_GAIN * velErrZ;

  // Clamp magnitude to MAX_GUIDANCE_ACCELERATION
  const accelMag = Math.hypot(gAx, gAz);
  if (accelMag > MAX_GUIDANCE_ACCELERATION) {
    const scale = MAX_GUIDANCE_ACCELERATION / accelMag;
    gAx *= scale;
    gAz *= scale;
  }

  return { ax: gAx, az: gAz };
}
