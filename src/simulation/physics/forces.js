/**
 * forces.js – 3-DoF aerodynamic and gravitational force calculations.
 *
 * Coordinate system (simulation frame):
 *   +X  = east (horizontal)
 *   +Y  = up   (altitude increases with +Y)
 *   +Z  = south (horizontal, completes right-hand system)
 *
 * Forces computed here:
 *   1. Gravity          – constant downward in -Y direction
 *   2. Aerodynamic drag – opposes velocity vector
 *   3. Dynamic pressure – derived quantity, needed for HUD and thresholds
 *   4. Guidance accel   – lateral only (ax, az), Phase 3B-2 autonomous correction
 *
 * NOT implemented in Phase 1:
 *   - Lift  (requires angle-of-attack tracking)
 *   - Thrust (Phase 2 retro-rockets)
 *   - Wind  (Phase 4 environmental disturbances)
 */

import {
  MARS_G,
  CD_ENTRY,
  REFERENCE_AREA,
  PARACHUTE_CD,
  PARACHUTE_AREA,
  DEORBIT_THRUST,
  ENTRY_INTERFACE_ALTITUDE,
} from './constants.js';
import { atmosphericDensity } from './atmosphere.js';
import { centralGravityAcceleration, computeDeorbitThrust, computeHeatFlux } from './orbit.js';
import { computeWind } from './wind.js';
import { computeGuidance } from '../guidance/controller.js';

// ---------------------------------------------------------------------------
// Gravity
// ---------------------------------------------------------------------------

/**
 * Compute flat-surface gravitational acceleration vector (Phase 1 legacy).
 *
 * Mars gravity acts purely in the -Y direction for the flat-surface approximation.
 *
 * @returns {{ ax: number, ay: number, az: number }}
 *          Gravitational acceleration components in m/s².
 */
export function gravityAcceleration() {
  return {
    ax: 0,
    ay: -MARS_G, // downward
    az: 0,
  };
}

// ---------------------------------------------------------------------------
// Dynamic Pressure
// ---------------------------------------------------------------------------

/**
 * Compute aerodynamic dynamic pressure.
 *
 *   q = 0.5 * rho * v_rel²
 *
 * @param {number} rho   Atmospheric density at current altitude (kg/m³).
 * @param {number} speed Magnitude of air-relative velocity (m/s).
 * @returns {number}     Dynamic pressure in Pascals (Pa).
 */
export function dynamicPressure(rho, speed) {
  return 0.5 * rho * speed * speed;
}

// ---------------------------------------------------------------------------
// Aerodynamic Drag
// ---------------------------------------------------------------------------

/**
 * Compute aerodynamic drag force vector.
 *
 * Drag acts opposite to the air-relative velocity vector:
 *
 *   D = 0.5 * rho * v_rel² * Cd * A    (magnitude)
 *   D_vec = -D * v_hat                  (direction: against relative velocity)
 *
 * where v_hat = v_rel / |v_rel|  is the unit relative velocity vector.
 *
 * @param {number} rho    Atmospheric density (kg/m³).
 * @param {number} vx     Air-relative velocity component X (m/s).
 * @param {number} vy     Air-relative velocity component Y (m/s).
 * @param {number} vz     Air-relative velocity component Z (m/s).
 * @param {number} [Cd]   Drag coefficient (defaults to CD_ENTRY).
 * @param {number} [A]    Reference area m² (defaults to REFERENCE_AREA).
 * @returns {{ fx: number, fy: number, fz: number }}
 *          Drag force vector in Newtons.
 */
export function dragForce(rho, vx, vy, vz, Cd = CD_ENTRY, A = REFERENCE_AREA) {
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

  // No drag when stationary
  if (speed < 1e-9) {
    return { fx: 0, fy: 0, fz: 0 };
  }

  // Drag magnitude:  D = 0.5 * rho * speed² * Cd * A
  const D = 0.5 * rho * speed * speed * Cd * A;

  // Unit vector in velocity direction
  const invSpeed = 1.0 / speed;
  const vxHat = vx * invSpeed;
  const vyHat = vy * invSpeed;
  const vzHat = vz * invSpeed;

  // Force opposes relative velocity
  return {
    fx: -D * vxHat,
    fy: -D * vyHat,
    fz: -D * vzHat,
  };
}

// ---------------------------------------------------------------------------
// Net Acceleration (Gravity + Drag + Deorbit Thrust + Wind)
// ---------------------------------------------------------------------------

/**
 * Compute the total translational acceleration on the lander.
 *
 * Forces evaluated:
 *   - Mars gravity: Central gravity model a = -mu/r³ * r_vec (or flat -Y if coordinates missing)
 *   - Aerodynamic drag: opposes air-relative velocity (spacecraft velocity - wind velocity)
 *   - Parachute drag: scales smoothly with parachuteDeploymentProgress
 *   - Deorbit thrust: retrograde engine thrust when enginesActive is true
 *
 * @param {object} state  Current simulation state.
 * @returns {{
 *   ax: number, ay: number, az: number,
 *   rho: number, q: number,
 *   dragMagnitude: number,
 *   thrustMagnitude: number,
 *   heatFlux: number,
 *   wind: { x: number, y: number, z: number },
 *   relativeSpeed: number,
 *   groundSpeed: number
 * }}
 */
export function computeAcceleration(state) {
  const { vx = 0, vy = 0, vz = 0, altitude = 0, mass = 900 } = state;

  // Atmospheric density at current altitude
  const rho = atmosphericDensity(altitude);

  // Environmental wind velocity at current altitude and time
  let wind = { x: 0, y: 0, z: 0 };
  if (state.wind !== undefined) {
    wind = state.wind;
  } else if (state.disableWind !== true) {
    wind = computeWind(altitude, state.elapsed || 0);
  }

  // Air-relative velocity vector: v_rel = v_spacecraft - v_wind
  const vRelX = vx - wind.x;
  const vRelY = vy - wind.y;
  const vRelZ = vz - wind.z;

  // Air-relative speed
  const relativeSpeed = Math.sqrt(vRelX * vRelX + vRelY * vRelY + vRelZ * vRelZ);

  // Ground speed (inertial speed relative to Mars center)
  const groundSpeed = Math.sqrt(vx * vx + vy * vy + vz * vz);

  // Dynamic pressure based on air-relative velocity
  const q = dynamicPressure(rho, relativeSpeed);

  // Aerodynamic heat flux (Sutton-Graves) based on air-relative speed
  const heatFlux = computeHeatFlux(rho, relativeSpeed);

  // Gravity: use central Mars gravity if x & y coordinates are present and flat mode not requested
  let grav;
  if (state.x !== undefined && state.y !== undefined && state.useFlatGravity !== true) {
    grav = centralGravityAcceleration(state.x, state.y, state.z || 0);
  } else {
    grav = gravityAcceleration();
  }

  // Combined aerodynamic drag area (aeroshell + deploying parachute)
  const aeroshellCdA = CD_ENTRY * REFERENCE_AREA;
  const progress = Math.max(0, Math.min(1, state.parachuteDeploymentProgress || 0));
  const parachuteCdA = PARACHUTE_CD * PARACHUTE_AREA * progress;
  const totalCdA = aeroshellCdA + parachuteCdA;

  // Aerodynamic drag force opposing relative air velocity
  const drag = dragForce(rho, vRelX, vRelY, vRelZ, 1.0, totalCdA);
  const dragAx = drag.fx / mass;
  const dragAy = drag.fy / mass;
  const dragAz = drag.fz / mass;
  const dragMagnitude = Math.sqrt(drag.fx ** 2 + drag.fy ** 2 + drag.fz ** 2);

  // Deorbit thrust (Newtons)
  let thrustAx = 0;
  let thrustAy = 0;
  let thrustAz = 0;
  let thrustMagnitude = 0;

  if (state.enginesActive && (state.fuel === undefined || state.fuel > 0)) {
    const thrustLevel = state.thrust !== undefined ? state.thrust : DEORBIT_THRUST;
    const thrust = computeDeorbitThrust(vx, vy, vz, thrustLevel);
    thrustAx = thrust.fx / mass;
    thrustAy = thrust.fy / mass;
    thrustAz = thrust.fz / mass;
    thrustMagnitude = thrustLevel;
  }

  // Guidance acceleration (Stage 3B-2: lateral only, NEVER modifies ay)
  // Active during AUTONOMOUS_TARGET_REALIGNMENT and SAFE_APPROACH phases.
  let guidanceAx = 0;
  let guidanceAz = 0;
  const guidPhase = state.phase;
  if (guidPhase === 'AUTONOMOUS_TARGET_REALIGNMENT' || guidPhase === 'SAFE_APPROACH') {
    const g = computeGuidance(state);
    guidanceAx = g.ax;
    guidanceAz = g.az;
  }

  // Net acceleration vector
  //   ax/az: gravity + drag + deorbit thrust + guidance (lateral only)
  //   ay:    gravity + drag + deorbit thrust            (vertical only – untouched by guidance)
  const ax = grav.ax + dragAx + thrustAx + guidanceAx;
  const ay = grav.ay + dragAy + thrustAy;
  const az = grav.az + dragAz + thrustAz + guidanceAz;

  return {
    ax,
    ay,
    az,
    rho,
    q,
    dragMagnitude,
    thrustMagnitude,
    heatFlux,
    wind,
    relativeSpeed,
    groundSpeed,
  };
}
