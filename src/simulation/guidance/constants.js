/**
 * guidance/constants.js – Autonomous lateral guidance parameters for Stage 3B-2.
 *
 * Tuning rationale:
 *   - Target is ~60-130 m offset from parachute-deploy position.
 *   - Parachute descent takes ~100-200 simulation seconds from 10 km.
 *   - Wind peak: 22 m/s X, 14 m/s Z. Guidance must compensate naturally.
 *   - MAX_GUIDANCE_ACCELERATION kept low (2.0 m/s²) to avoid disrupting
 *     vertical descent and parachute drag physics.
 */

/**
 * Maximum allowed lateral guidance acceleration magnitude (m/s²).
 * Applied to ax and az only; ay is untouched.
 */
export const MAX_GUIDANCE_ACCELERATION = 2.0; // m/s²

/**
 * Maximum desired horizontal speed toward target (m/s).
 * Prevents large lateral velocities that would cause overshoot.
 */
export const MAX_HORIZONTAL_GUIDANCE_SPEED = 10.0; // m/s

/**
 * Proportional gain: scales position error to desired speed.
 * desiredSpeed = clamp(GUIDANCE_GAIN * distance, MAX_HORIZONTAL_GUIDANCE_SPEED)
 */
export const GUIDANCE_GAIN = 0.45; // s⁻¹

/**
 * Velocity error gain: scales velocity error to guidance acceleration.
 * guidanceAccel = clamp(GUIDANCE_VELOCITY_GAIN * velocityError, MAX_GUIDANCE_ACCELERATION)
 */
export const GUIDANCE_VELOCITY_GAIN = 2.0;

/**
 * Target capture radius (meters). When the spacecraft is within this
 * horizontal distance of the selected target, phase transitions to SAFE_APPROACH.
 */
export const TARGET_CAPTURE_RADIUS = 5.0; // m

/**
 * Damping gain applied during SAFE_APPROACH to bleed off horizontal velocity
 * and prevent oscillation around the target.
 */
export const APPROACH_DAMPING_GAIN = 3.0;

/**
 * Minimum distance interval (simulation seconds) between periodic target-distance log entries.
 */
export const DIST_LOG_INTERVAL = 8.0; // simulation seconds
