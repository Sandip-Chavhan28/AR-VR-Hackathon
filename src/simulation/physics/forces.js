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
  MARS_RADIUS,
  TERMINAL_POWERED_ALTITUDE,
  TOUCHDOWN_NOMINAL_SPEED,
  DESCENT_STAGE_THRUST,
  JEZERO_TARGET_X,
  JEZERO_TARGET_Z,
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
// Preallocated scratch vectors for zero heap GC churn
const _scratchDrag = { fx: 0, fy: 0, fz: 0 };
const _scratchGravity = { ax: 0, ay: 0, az: 0 };
const _scratchThrust = { fx: 0, fy: 0, fz: 0 };

export function dragForce(rho, vx, vy, vz, Cd = CD_ENTRY, A = REFERENCE_AREA, out = null) {
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  const target = out || { fx: 0, fy: 0, fz: 0 };

  // No drag when stationary
  if (speed < 1e-9) {
    target.fx = 0;
    target.fy = 0;
    target.fz = 0;
    return target;
  }

  // Drag magnitude:  D = 0.5 * rho * speed² * Cd * A
  const D = 0.5 * rho * speed * speed * Cd * A;

  // Unit vector in velocity direction
  const invSpeed = 1.0 / speed;
  const vxHat = vx * invSpeed;
  const vyHat = vy * invSpeed;
  const vzHat = vz * invSpeed;

  // Force opposes relative velocity
  target.fx = -D * vxHat;
  target.fy = -D * vyHat;
  target.fz = -D * vzHat;
  return target;
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
export function computeAcceleration(state, out = null) {
  const { vx = 0, vy = 0, vz = 0, altitude = 0, mass = 900 } = state;

  const res = out || {
    ax: 0,
    ay: 0,
    az: 0,
    rho: 0,
    q: 0,
    dragMagnitude: 0,
    thrustMagnitude: 0,
    heatFlux: 0,
    wind: { x: 0, y: 0, z: 0 },
    relativeSpeed: 0,
    groundSpeed: 0,
  };

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
    grav = centralGravityAcceleration(state.x, state.y, state.z || 0, _scratchGravity);
  } else {
    grav = gravityAcceleration();
  }

  // Combined aerodynamic drag area (aeroshell + deploying parachute)
  const isChuteAttached = !state.backshellSeparated && state.parachuteState !== 'RELEASED';
  let parachuteCdA = 0;
  if (isChuteAttached) {
    const rawProgress = Math.max(0, Math.min(1, state.parachuteDeploymentProgress || 0));
    // S-curve smooth inflation curve (3p^2 - 2p^3)
    const sProgress = rawProgress * rawProgress * (3.0 - 2.0 * rawProgress);
    parachuteCdA = PARACHUTE_CD * PARACHUTE_AREA * sProgress;
  }
  // When backshell separates, lander drag area is just the compact descent stage / rover
  const aeroshellCdA = state.backshellSeparated ? (REFERENCE_AREA * 0.25) : (CD_ENTRY * REFERENCE_AREA);
  const totalCdA = aeroshellCdA + parachuteCdA;

  // Aerodynamic drag force opposing relative air velocity
  const drag = dragForce(rho, vRelX, vRelY, vRelZ, 1.0, totalCdA, _scratchDrag);
  const dragAx = drag.fx / mass;
  const dragAy = drag.fy / mass;
  const dragAz = drag.fz / mass;
  const dragMagnitude = Math.sqrt(drag.fx ** 2 + drag.fy ** 2 + drag.fz ** 2);

  // Engine Thrust
  let thrustAx = 0;
  let thrustAy = 0;
  let thrustAz = 0;
  let thrustMagnitude = 0;

  if (
    (state.phase === 'DEORBIT_BURN' || state.phase === 'MARS_ORBIT' || !state.phase) &&
    state.enginesActive &&
    (state.fuel === undefined || state.fuel > 0) &&
    !state.grounded
  ) {
    const thrustLevel = state.thrust !== undefined ? state.thrust : DEORBIT_THRUST;
    const thrust = computeDeorbitThrust(vx, vy, vz, thrustLevel, _scratchThrust);
    thrustAx = thrust.fx / mass;
    thrustAy = thrust.fy / mass;
    thrustAz = thrust.fz / mass;
    thrustMagnitude = thrustLevel;
  } else if (
    (state.phase === 'POWERED_DESCENT' || state.phase === 'SAFE_APPROACH' || state.skyCraneActive || state.poweredDescentActive) &&
    state.enginesActive &&
    (state.fuel === undefined || state.fuel > 0) &&
    !state.grounded
  ) {
    // Local spherical coordinate frame
    const rx = state.x || 0;
    const ry = (state.y !== undefined ? state.y : altitude) + MARS_RADIUS;
    const rz = state.z || 0;
    const rSph = Math.hypot(rx, ry, rz);

    const upX = rx / rSph;
    const upY = ry / rSph;
    const upZ = rz / rSph;

    const tanX = -upY;
    const tanY = upX;

    const gravMag = 4.282837e13 / (rSph * rSph);

    const vRadial = vx * upX + vy * upY + vz * upZ;
    const vTan = vx * tanX + vy * tanY;

    // Desired radial vertical velocity
    const desVRadial = altitude > TERMINAL_POWERED_ALTITUDE
      ? -Math.max(1.8, Math.min(20.0, Math.sqrt(2 * 1.5 * Math.max(0, altitude - TERMINAL_POWERED_ALTITUDE)) + 1.8))
      : -TOUCHDOWN_NOMINAL_SPEED;

    const reqAccRadial = gravMag + Math.max(-2.5, Math.min(9.0, (desVRadial - vRadial) * 2.5));

    const refX = state.guidanceRefX !== undefined ? state.guidanceRefX : JEZERO_TARGET_X;
    const refZ = state.guidanceRefZ !== undefined ? state.guidanceRefZ : JEZERO_TARGET_Z;
    let targetX = refX;
    let targetZ = refZ;
    if (state.landingSiteAnalysis?.selectedTarget) {
      targetX = refX + state.landingSiteAnalysis.selectedTarget.x;
      targetZ = refZ + state.landingSiteAnalysis.selectedTarget.z;
    }
    const errX = targetX - state.x;
    const errY = (state.guidanceRefY !== undefined ? state.guidanceRefY : state.y) - state.y;
    const errZ = targetZ - state.z;

    const errTan = errX * tanX + errY * tanY;
    const distTan = Math.abs(errTan);

    let desVTan = 0;
    if (altitude > TERMINAL_POWERED_ALTITUDE) {
      desVTan = Math.sign(errTan) * Math.min(24.0, Math.sqrt(2 * 1.2 * distTan));
    }
    const reqAccTan = Math.max(-8.0, Math.min(8.0, (desVTan - vTan) * 2.5));

    let desVZ = 0;
    if (altitude > TERMINAL_POWERED_ALTITUDE) {
      desVZ = Math.sign(errZ) * Math.min(8.0, Math.sqrt(2 * 0.8 * Math.abs(errZ)));
    }
    const reqAccZ = Math.max(-5.0, Math.min(5.0, (desVZ - vz) * 2.5));

    thrustAx = reqAccRadial * upX + reqAccTan * tanX;
    thrustAy = reqAccRadial * upY + reqAccTan * tanY;
    thrustAz = reqAccRadial * upZ + reqAccZ;

    const totalAccel = Math.hypot(thrustAx, thrustAy, thrustAz);
    thrustMagnitude = mass * totalAccel;
  }

  // Authoritative physical throttle [0.0 to 1.0] across all flight phases
  if (state.enginesActive && (state.fuel === undefined || state.fuel > 0) && !state.grounded) {
    if (state.phase === 'DEORBIT_BURN') {
      state.throttle = 1.0;
    } else {
      state.throttle = Math.min(1.0, Math.max(0.18, thrustMagnitude / DESCENT_STAGE_THRUST));
    }
  } else {
    state.throttle = 0.0;
  }

  // Guidance acceleration (Stage 3B-2: lateral tangent + crossrange for AUTONOMOUS_TARGET_REALIGNMENT)
  let guidanceAx = 0;
  let guidanceAy = 0;
  let guidanceAz = 0;
  const guidPhase = state.phase;
  if (guidPhase === 'AUTONOMOUS_TARGET_REALIGNMENT' || (guidPhase === 'SAFE_APPROACH' && !state.enginesActive)) {
    const g = computeGuidance(state);
    guidanceAx = g.ax;
    guidanceAy = g.ay || 0;
    guidanceAz = g.az;
  }

  // Net acceleration vector
  res.ax = grav.ax + dragAx + thrustAx + guidanceAx;
  res.ay = grav.ay + dragAy + thrustAy + guidanceAy;
  res.az = grav.az + dragAz + thrustAz + guidanceAz;
  res.rho = rho;
  res.q = q;
  res.dragMagnitude = dragMagnitude;
  res.thrustMagnitude = thrustMagnitude;
  res.heatFlux = heatFlux;
  if (!res.wind) res.wind = { x: 0, y: 0, z: 0 };
  res.wind.x = wind.x;
  res.wind.y = wind.y;
  res.wind.z = wind.z;
  res.relativeSpeed = relativeSpeed;
  res.groundSpeed = groundSpeed;

  return res;
}
