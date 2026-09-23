/**
 * integrator.js – Numerical integration for 3-DoF translational dynamics.
 *
 * Method: Semi-implicit Euler (also called symplectic Euler).
 *
 *   Semi-implicit Euler update order:
 *     1. Compute accelerations at current state
 *     2. Update velocity:  v_new = v + a * dt
 *     3. Update position:  x_new = x + v_new * dt   ← uses UPDATED velocity
 *
 * Why semi-implicit over explicit Euler?
 *   - Explicit Euler:  x_new = x + v_old * dt  →  energy drift (grows unbounded)
 *   - Semi-implicit:   x_new = x + v_new * dt  →  energy conserving for conservative
 *     systems, much more stable for oscillatory and gravitational dynamics.
 *
 * Stability:  stable when dt ≤ 2 / ω_max where ω_max is the highest
 * frequency in the system.  At PHYSICS_DT = 0.05 s this is well satisfied.
 *
 * A fixed timestep (PHYSICS_DT) is used throughout, independent of the
 * browser frame rate.  The render loop accumulates wall-clock delta time
 * and steps the integrator as many fixed steps as accumulated time allows.
 */

import { computeAcceleration } from './forces.js';
import {
  GROUND_ALTITUDE,
  MARS_RADIUS,
  DEORBIT_DELTA_V,
  DEORBIT_THRUST,
  DEORBIT_ISP,
  DRY_MASS,
  MAX_HEAT_FLUX_REF,
  PARACHUTE_DEPLOY_DURATION,
} from './constants.js';
import { getDistanceToMarsCenter, computeMassFlowRate } from './orbit.js';
import { computeMeasuredState } from './sensorNoise.js';
import { calculateLandingError } from '../guidance/controller.js';

/**
 * Advance the simulation state by one fixed physics timestep.
 *
 * Mutates the state object in-place for performance.
 *
 * @param {object} state  Mutable simulation state.
 * @param {number} dt     Fixed physics timestep in seconds.
 */
export function stepSimulation(state, dt) {
  // Do nothing if already grounded
  if (state.grounded) return;

  // ------------------------------------------------------------------
  // 0. Parachute deployment inflation advancement
  // ------------------------------------------------------------------
  if (state.parachuteState === 'DEPLOYING') {
    const progress = (state.parachuteDeploymentProgress || 0) + dt / PARACHUTE_DEPLOY_DURATION;
    if (progress >= 1.0) {
      state.parachuteDeploymentProgress = 1.0;
      state.parachuteState = 'DEPLOYED';
    } else {
      state.parachuteDeploymentProgress = progress;
    }
  }

  // ------------------------------------------------------------------
  // 1. Compute forces and accelerations at current state
  // ------------------------------------------------------------------
  const {
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
  } = computeAcceleration(state);

  state.ax = ax;
  state.ay = ay;
  state.az = az;
  state.wind = wind;
  state.relativeSpeed = relativeSpeed;
  state.groundSpeed = groundSpeed;

  // ------------------------------------------------------------------
  // 2. Propulsion integration & mass depletion during burn
  // ------------------------------------------------------------------
  if (state.enginesActive && (state.fuel === undefined || state.fuel > 0)) {
    const thrust = state.thrust !== undefined ? state.thrust : DEORBIT_THRUST;
    const isp = state.isp !== undefined ? state.isp : DEORBIT_ISP;
    const mDot = computeMassFlowRate(thrust, isp);
    const dm = Math.min(state.fuel || 0, mDot * dt);

    state.fuel = Math.max(0, (state.fuel || 0) - dm);
    state.mass = (state.dryMass || DRY_MASS) + state.fuel;
    state.burnDuration = (state.burnDuration || 0) + dt;

    const deltaVStep = (thrust / state.mass) * dt;
    state.deliveredDeltaV = (state.deliveredDeltaV || 0) + deltaVStep;

    const targetDeltaV = state.targetDeltaV !== undefined ? state.targetDeltaV : DEORBIT_DELTA_V;
    if (state.deliveredDeltaV >= targetDeltaV || state.fuel <= 0) {
      state.enginesActive = false;
      state.burnCompleted = true;
    }
  }

  // ------------------------------------------------------------------
  // 3. Semi-implicit Euler – update velocity first (v += a * dt)
  // ------------------------------------------------------------------
  state.vx += ax * dt;
  state.vy += ay * dt;
  state.vz += az * dt;

  // ------------------------------------------------------------------
  // 4. Update position using UPDATED velocity (x += v_new * dt)
  // ------------------------------------------------------------------
  state.x += state.vx * dt;
  state.y += state.vy * dt;
  state.z += state.vz * dt;

  // ------------------------------------------------------------------
  // 5. Update derived quantities
  // ------------------------------------------------------------------
  // Distance from Mars center and true spherical altitude
  const r = getDistanceToMarsCenter(state.x, state.y, state.z);
  state.r = r;
  state.altitude = r - MARS_RADIUS;

  // Total speed
  state.speed = Math.sqrt(
    state.vx * state.vx + state.vy * state.vy + state.vz * state.vz
  );

  // Radial vertical velocity: v_radial = v · (r_vec / |r|)
  const rx = state.x;
  const ry = state.y + MARS_RADIUS;
  const rz = state.z;
  const vRadial = (state.vx * rx + state.vy * ry + state.vz * rz) / r;
  state.verticalVelocity = vRadial;

  // Atmospheric density and dynamic pressure
  state.rho = rho;
  state.q = q;

  // Thermal heat flux & normalized rendering intensity
  state.heatFlux = heatFlux;
  state.heatIntensity = Math.min(1, Math.max(0, heatFlux / MAX_HEAT_FLUX_REF));

  // G-force: felt deceleration (drag + engine thrust, gravity is freefall)
  const feltForce = dragMagnitude + (state.enginesActive ? thrustMagnitude : 0);
  const feltAccel = feltForce / state.mass;
  state.gForce = feltAccel / 3.71;

  // Simulation elapsed time
  state.elapsed += dt;

  // ------------------------------------------------------------------
  // 6. Sensor measurements (deterministic noise, isolated from true state)
  // ------------------------------------------------------------------
  state.sensors = computeMeasuredState(state, state.elapsed, state.noiseEnabled !== false);

  // ------------------------------------------------------------------
  // 7. Ground contact detection
  // ------------------------------------------------------------------
  if (state.altitude <= GROUND_ALTITUDE) {
    state.altitude = GROUND_ALTITUDE;
    state.y = GROUND_ALTITUDE;
    state.vy = 0;
    state.vx = 0;
    state.vz = 0;
    state.verticalVelocity = 0;
    state.speed = 0;
    state.grounded = true;
    state.phase = 'LANDED';
    state.enginesActive = false;

    // Calculate true landing error (Stage 3B-2):
    // Distance in metres from actual touchdown position to selected safe target.
    // Uses guidance reference frame so the result is in terrain-local metres.
    if (state.landingError === null || state.landingError === undefined) {
      const err = calculateLandingError(state);
      state.landingError = err !== null ? err : 0;
      if (state.landingSiteAnalysis) {
        state.landingSiteAnalysis.decisionLog.push(
          `[MC] TOUCHDOWN — LANDING ERROR: ${state.landingError.toFixed(1)} m from safe target`
        );
      }
    }
  }
}

