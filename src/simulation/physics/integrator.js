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
  HEAT_SHIELD_SEP_ALTITUDE,
  RADAR_LOCK_ALTITUDE,
  BACKSHELL_SEP_ALTITUDE,
  BACKSHELL_FREEFALL_DURATION,
  TERMINAL_POWERED_ALTITUDE,
  MARS_SPEED_OF_SOUND,
  G0_STANDARD,
  JEZERO_TARGET_X,
  JEZERO_TARGET_Z,
  ROVER_WHEEL_COORDS,
  ROVER_WHEEL_CONTACT_Y,
  ROVER_WHEEL_CONTACT_OFFSET,
} from './constants.js';
import { getDistanceToMarsCenter, computeMassFlowRate } from './orbit.js';
import { computeMeasuredState } from './sensorNoise.js';
import { calculateLandingError } from '../guidance/controller.js';
import { performLandingSiteAnalysis } from '../landingSite/landingSiteAnalysis.js';
import { INITIAL_PLANNED_TARGET } from '../landingSite/constants.js';
import { getTerrainHeight } from '../landingSite/terrain.js';

/**
 * Evaluate 6-wheel contact physics against authoritative MOLA terrain.
 *
 * For each wheel:
 *   - Computes local terrain coordinates relative to JEZERO_TARGET_X/Z.
 *   - Samples authoritative terrain elevation via getTerrainHeight.
 *   - Computes wheel clearance = wheelBottomAltitude - terrainElevation.
 *   - Confirms contact if clearance <= 0.05m.
 *
 * @param {object} state Simulation state
 * @returns {object} Contact physics metrics
 */
export function evaluateWheelContacts(state) {
  const refX = state.guidanceRefX !== undefined ? state.guidanceRefX : JEZERO_TARGET_X;
  const refZ = state.guidanceRefZ !== undefined ? state.guidanceRefZ : JEZERO_TARGET_Z;

  const physX = state.x || 0;
  const physZ = state.z || 0;

  const cableExt = (state.skyCraneActive && !state.cablesReleased)
    ? (state.skyCraneLoweringProgress || 0) * 7.5
    : 0;
  const roverBodyAlt = (state.altitude !== undefined ? state.altitude : 0) - cableExt;
  const roverWheelBottomAlt = roverBodyAlt + ROVER_WHEEL_CONTACT_Y;

  let minClearance = Infinity;
  let maxClearance = -Infinity;
  let sumClearance = 0;
  let contactCount = 0;
  const contacts = {};
  const elevations = {};
  const clearances = {};

  for (let i = 0; i < ROVER_WHEEL_COORDS.length; i++) {
    const wh = ROVER_WHEEL_COORDS[i];
    const terrX = (physX - refX) + wh.x;
    const terrZ = (physZ - refZ) + wh.z;

    const elev = getTerrainHeight(terrX, terrZ);
    elevations[wh.id] = elev;

    const clearance = roverWheelBottomAlt - elev;
    clearances[wh.id] = clearance;
    sumClearance += clearance;

    if (clearance < minClearance) minClearance = clearance;
    if (clearance > maxClearance) maxClearance = clearance;

    const isContact = clearance <= 0.05;
    contacts[wh.id] = isContact ? 1 : 0;
    if (isContact) contactCount++;
  }

  const meanClearance = sumClearance / ROVER_WHEEL_COORDS.length;
  const centerTerrElev = getTerrainHeight(physX - refX, physZ - refZ);

  return {
    roverBodyAlt,
    roverWheelBottomAlt,
    minClearance: Number.isFinite(minClearance) ? minClearance : 0,
    maxClearance: Number.isFinite(maxClearance) ? maxClearance : 0,
    meanClearance: Number.isFinite(meanClearance) ? meanClearance : 0,
    contactCount,
    contacts,
    elevations,
    clearances,
    centerTerrElev,
  };
}


/**
 * Advance the simulation state by one fixed physics timestep.
 *
 * Mutates the state object in-place for performance.
 *
 * @param {object} state  Mutable simulation state.
 * @param {number} dt     Fixed physics timestep in seconds.
 */
export function stepSimulation(state, dt) {
  // If already grounded, maintain consistent surface contact telemetry and advance flyaway bodies
  if (state.grounded) {
    state.radarAltitude = 0.0;
    state.wheelClearance = 0.0;
    state.wheelContactCount = 6;
    if (!state.wheelContacts) {
      state.wheelContacts = { FL: 1, FR: 1, ML: 1, MR: 1, RL: 1, RR: 1 };
    }
    if (state.descentStageFlyaway && state.descentStagePos) {
      if (state.descentStagePos.y > 0.5 && state.descentStagePos.y < 350) {
        state.descentStagePos.x += (state.descentStagePos.vx || 45) * dt;
        state.descentStagePos.y += (state.descentStagePos.vy || 15) * dt;
        state.descentStagePos.z += (state.descentStagePos.vz || 25) * dt;
        state.descentStagePos.vy -= 1.8 * dt;
      }
    }
    return;
  }

  // ------------------------------------------------------------------
  // 0. Parachute deployment inflation advancement
  // ------------------------------------------------------------------
  if (state.parachuteState === 'DEPLOYING') {
    const progress = (state.parachuteDeploymentProgress || 0) + dt / PARACHUTE_DEPLOY_DURATION;
    if (progress >= 1.0 - 1e-6) {
      state.parachuteDeploymentProgress = 1.0;
      state.parachuteState = 'DEPLOYED';
    } else {
      state.parachuteDeploymentProgress = progress;
    }
  }

// Preallocated scratch acceleration vector for zero GC pressure
const _scratchIntegratorAccel = {
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
  } = computeAcceleration(state, _scratchIntegratorAccel);

  state.ax = ax;
  state.ay = ay;
  state.az = az;
  if (!state.wind) state.wind = { x: 0, y: 0, z: 0 };
  state.wind.x = wind.x;
  state.wind.y = wind.y;
  state.wind.z = wind.z;
  state.relativeSpeed = relativeSpeed;
  state.groundSpeed = groundSpeed;

  // ------------------------------------------------------------------
  // 2. Propulsion integration & mass depletion during burn
  // ------------------------------------------------------------------
  if (state.enginesActive && (state.fuel === undefined || state.fuel > 0)) {
    if (
      state.phase === 'POWERED_DESCENT' ||
      state.phase === 'SAFE_APPROACH' ||
      state.skyCraneActive ||
      state.poweredDescentActive
    ) {
      const mDot = Math.min(1.8, thrustMagnitude / (225.0 * G0_STANDARD));
      const dm = Math.min(state.fuel || 0, mDot * dt);
      state.fuel = Math.max(0, (state.fuel || 0) - dm);
      state.mass = (state.dryMass || DRY_MASS) + state.fuel;
      if (state.fuel <= 0) {
        state.enginesActive = false;
      }
    } else {
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
      if (state.phase === 'DEORBIT_BURN' && (state.deliveredDeltaV >= targetDeltaV || state.fuel <= 0)) {
        state.enginesActive = false;
        state.burnCompleted = true;
      }
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

  // Radar altitude (AGL clearance above local Jezero MOLA terrain)
  const refX = state.guidanceRefX !== undefined ? state.guidanceRefX : JEZERO_TARGET_X;
  const refZ = state.guidanceRefZ !== undefined ? state.guidanceRefZ : JEZERO_TARGET_Z;
  const localX = (state.x || 0) - refX;
  const localZ = (state.z || 0) - refZ;
  const terrElev = getTerrainHeight(localX, localZ);
  const wheelInfo = evaluateWheelContacts(state);
  state.wheelContactCount = wheelInfo.contactCount;
  state.wheelContacts = wheelInfo.contacts;
  state.wheelClearance = Math.max(0, wheelInfo.minClearance);
  state.roverBodyAltitude = wheelInfo.roverBodyAlt;
  state.terrainElevation = terrElev;

  // Radar altitude reflects true AGL clearance from the lowest vehicle point to terrain
  state.radarAltitude = state.grounded ? 0.0 : Math.max(0, wheelInfo.minClearance);

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

  // G-force: felt deceleration normalized to Earth standard gravity (g0 = 9.80665 m/s²)
  const feltForce = dragMagnitude + (state.enginesActive ? thrustMagnitude : 0);
  const feltAccel = feltForce / state.mass;
  state.gForce = feltAccel / G0_STANDARD;

  // Simulation elapsed time
  state.elapsed += dt;

  // Mach number in cold Martian atmosphere
  state.mach = state.speed / MARS_SPEED_OF_SOUND;

  // Track peak mission values for post-landing mission evaluation
  state.peakGForce = Math.max(state.peakGForce || 0, state.gForce || 0);
  state.peakHeatFlux = Math.max(state.peakHeatFlux || 0, state.heatFlux || 0);

  // ------------------------------------------------------------------
  // 5b. Staging progression & Powered descent retro-propulsion
  // ------------------------------------------------------------------
  // Cruise stage jettison at suborbital coast transition (~180 km)
  if ((state.phase === 'COAST_TO_ENTRY' || state.altitude <= 180000) &&
      state.phase !== 'MARS_ORBIT' && state.phase !== 'DEORBIT_BURN' &&
      !state.cruiseStageSeparated) {
    state.cruiseStageSeparated = true;
    state.cruiseStagePos = {
      x: state.x - 30,
      y: state.y + 45,
      z: state.z - 20,
      vx: (state.vx || 3300) * 0.97,
      vy: (state.vy || 0) + 15,
    };
  }

  if (
    state.phase === 'PARACHUTE_DESCENT' ||
    state.phase === 'AUTONOMOUS_TARGET_REALIGNMENT' ||
    state.phase === 'SAFE_APPROACH' ||
    state.phase === 'BACKSHELL_SEP' ||
    state.phase === 'POWERED_DESCENT'
  ) {
    // Heat shield jettison at ~8 km
    if (state.altitude <= HEAT_SHIELD_SEP_ALTITUDE && !state.heatShieldSeparated) {
      state.heatShieldSeparated = true;
      state.heatShieldSepTime = state.elapsed;
      state.heatShieldPos = { x: state.x, y: state.y - 10, z: state.z, vy: state.vy - 18 };
      if (state.landingSiteAnalysis) {
        state.landingSiteAnalysis.decisionLog.push('[MC] HEAT SHIELD JETTISON CONFIRMED — RADAR & LVS UNCOVERED');
      }
    }
    // Terminal radar altimeter ground lock
    if (state.altitude <= RADAR_LOCK_ALTITUDE && !state.radarLocked) {
      state.radarLocked = true;
      if (state.landingSiteAnalysis) {
        state.landingSiteAnalysis.decisionLog.push('[MC] TERMINAL DESCENT RADAR (TDR) GROUND LOCK ACQUIRED');
      }
    }
    // Terrain-Relative Navigation optical tracking
    if (state.altitude <= 2500 && !state.trnActive) {
      state.trnActive = true;
      if (!state.landingSiteAnalysis) {
        state.landingSiteAnalysis = performLandingSiteAnalysis(state.initialPlannedTarget || INITIAL_PLANNED_TARGET);
        state.landingSiteAnalysis.analyzedAtAltitude = state.altitude;
        state.landingSiteAnalysis.analyzedAtTime = state.elapsed;
      }
    }
    // Backshell separation at ~1.8 km -> Free-fall staging
    if (state.altitude <= BACKSHELL_SEP_ALTITUDE && !state.backshellSeparated) {
      state.backshellSeparated = true;
      state.backshellSepTime = state.elapsed;
      state.parachuteState = 'RELEASED';
      state.backshellPos = { x: state.x - 15, y: state.y + 24, z: state.z - 10, vy: 16, vx: -14, vz: -8 };
      state.phase = 'BACKSHELL_SEP';
      state.poweredDescentActive = false;
      state.enginesActive = false;
      if (!state.landingSiteAnalysis) {
        state.landingSiteAnalysis = performLandingSiteAnalysis(state.initialPlannedTarget || INITIAL_PLANNED_TARGET);
      }
      if (state.landingSiteAnalysis) {
        state.landingSiteAnalysis.decisionLog.push('[MC] BACKSHELL & PARACHUTE JETTISON — FREE-FALL CLEARANCE');
      }
    }

    // 1.2s free-fall clearing window -> 8x MLE Rocket Ignition & Powered Descent
    if (
      state.backshellSeparated &&
      !state.poweredDescentActive &&
      (state.elapsed - (state.backshellSepTime || 0) >= BACKSHELL_FREEFALL_DURATION || state.altitude <= 1650)
    ) {
      state.phase = 'POWERED_DESCENT';
      state.poweredDescentActive = true;
      state.enginesActive = true;
      if (state.landingSiteAnalysis) {
        state.landingSiteAnalysis.decisionLog.push('[MC] 8x MARS LANDING ENGINES (MLE) IGNITED — POWERED RETRO-DIVERT');
      }
    }

    // Terminal Sky Crane deceleration & Rover Cable Lowering
    if (state.altitude <= TERMINAL_POWERED_ALTITUDE && !state.skyCraneActive) {
      state.skyCraneActive = true;
      state.phase = 'SAFE_APPROACH';
      if (state.landingSiteAnalysis) {
        state.landingSiteAnalysis.decisionLog.push('[MC] TERMINAL SKY CRANE BRAKING ACTIVE — CONSTANT DECELERATION');
        state.landingSiteAnalysis.decisionLog.push('[MC] ROVER BRIDLE TETHER REEL DEPLOYED — LOWERING PERSEVERANCE');
      }
    }
    if (state.skyCraneActive && state.altitude <= 25.0) {
      state.skyCraneLoweringProgress = Math.min(1.0, Math.max(0.0, (25.0 - state.altitude) / 24.5));
    }
  }

  // Update separated dynamic bodies in flight
  if (state.cruiseStageSeparated && state.cruiseStagePos) {
    state.cruiseStagePos.x += (state.cruiseStagePos.vx || 3200) * dt;
    state.cruiseStagePos.y += (state.cruiseStagePos.vy || 10) * dt;
  }
  if (state.heatShieldSeparated && state.heatShieldPos) {
    state.heatShieldPos.vy -= 3.71 * dt;
    state.heatShieldPos.y += state.heatShieldPos.vy * dt;
    state.heatShieldPos.x += (state.vx * 0.95) * dt;
  }
  if (state.backshellSeparated && state.backshellPos) {
    state.backshellPos.y += (state.backshellPos.vy || 16) * dt;
    state.backshellPos.x += (state.backshellPos.vx || -14) * dt;
    state.backshellPos.z += (state.backshellPos.vz || -8) * dt;
  }
  if (state.descentStageFlyaway && state.descentStagePos) {
    if (state.descentStagePos.y > 0.5 && state.descentStagePos.y < 350) {
      state.descentStagePos.x += (state.descentStagePos.vx || 45) * dt;
      state.descentStagePos.y += (state.descentStagePos.vy || 15) * dt;
      state.descentStagePos.z += (state.descentStagePos.vz || 25) * dt;
      state.descentStagePos.vy -= 1.8 * dt; // gravity deceleration
    }
  }

  // ------------------------------------------------------------------
  // 6. Sensor measurements (deterministic noise, isolated from true state)
  // ------------------------------------------------------------------
  state.sensors = computeMeasuredState(state, state.elapsed, state.noiseEnabled !== false, state.sensors);


  // ------------------------------------------------------------------
  // 7. Ground contact & Touchdown State Machine
  // ------------------------------------------------------------------
  const inTerminalStage =
    state.phase === 'SAFE_APPROACH' ||
    state.phase === 'POWERED_DESCENT' ||
    state.skyCraneActive ||
    (state.altitude <= 50.0 && state.altitude > -10.0);

  if (inTerminalStage && !state.grounded) {
    if (!state.touchdownState) state.touchdownState = 'APPROACH';

    // State 1: FIRST_CONTACT — at least 1 wheel enters within 8 cm of terrain
    if (wheelInfo.minClearance <= 0.08 && wheelInfo.contactCount >= 1 && state.touchdownState === 'APPROACH') {
      state.touchdownState = 'FIRST_CONTACT';
      state.firstContactTime = state.elapsed;
      state.touchdownDustTrigger = true;
      if (state.landingSiteAnalysis) {
        state.landingSiteAnalysis.decisionLog.push(
          `[MC] WHEEL CONTACT DETECTED (${wheelInfo.contactCount}/6) — ENTERING SUSPENSION SETTLING`
        );
      }
    }

    // State 2: SETTLING — 4+ wheels in contact, suspension compresses and absorbs downward velocity
    if (
      (state.touchdownState === 'FIRST_CONTACT' || state.touchdownState === 'SETTLING') &&
      wheelInfo.contactCount >= 4
    ) {
      state.touchdownState = 'SETTLING';
      if (!state.settlingStartTime) state.settlingStartTime = state.elapsed;

      // Normal ground reaction damping: dissipate downward and lateral momentum
      const dtDamp = Math.min(1.0, dt * 8.0);
      state.vy *= (1.0 - dtDamp);
      state.vx *= (1.0 - dtDamp);
      state.vz *= (1.0 - dtDamp);
      state.verticalVelocity = state.vy;
      state.speed = Math.hypot(state.vx, state.vy, state.vz);

      // Clamp altitude so wheels compress suspension without burrowing into terrain
      const targetAlt = terrElev + ROVER_WHEEL_CONTACT_OFFSET;
      if (state.altitude < targetAlt) {
        state.altitude += (targetAlt - state.altitude) * 0.8;
      }

      // Settling completes when suspension is compressed and velocity near zero (> 0.5s or v < 0.15 m/s)
      const settlingDuration = state.elapsed - state.settlingStartTime;
      if (
        (wheelInfo.contactCount >= 5 && Math.abs(state.vy) < 0.15 && Math.abs(state.vx) < 0.15) ||
        settlingDuration >= 0.8
      ) {
        state.touchdownState = 'STABLE_TOUCHDOWN';
        state.roverSettled = true;
        state.touchdownTime = state.elapsed;

        // PYROTECHNIC CABLE CUTTERS
        state.cablesReleased = true;
        state.skyCraneActive = false;

        // DESCENT STAGE FLYAWAY CLIMB
        state.descentStageFlyaway = true;
        state.descentStagePos = {
          x: state.x + 0.5,
          y: state.altitude + 4.2,
          z: state.z + 0.5,
          vx: 35.0,
          vy: 22.0,
          vz: 25.0,
        };

        // HALT ROVER COMPLETELY ON TERRAIN
        state.grounded = true;
        state.phase = 'LANDED';
        state.vy = 0;
        state.vx = 0;
        state.vz = 0;
        state.verticalVelocity = 0;
        state.speed = 0;
        state.radarAltitude = 0.0;
        state.enginesActive = false;
        state.poweredDescentActive = false;

        // Calculate true landing error from Jezero target
        const err = calculateLandingError(state);
        state.landingError = err !== null ? err : 0;
        if (state.landingSiteAnalysis) {
          state.landingSiteAnalysis.decisionLog.push('[MC] 6-WHEEL CONTACT CONFIRMED — SUSPENSION SETTLED');
          state.landingSiteAnalysis.decisionLog.push('[MC] BRIDLE CABLES SEVERED — DESCENT STAGE FLYAWAY INITIATED');
          state.landingSiteAnalysis.decisionLog.push(
            `[MC] TOUCHDOWN CONFIRMED — LANDING ERROR: ${state.landingError.toFixed(1)} m from safe target`
          );
        }
      }
    }
  }

  // Fallback ground contact protection for arbitrary trajectories or direct collision (altitude <= terrain + GROUND_ALTITUDE)
  if (!state.grounded && (state.altitude <= (terrElev + GROUND_ALTITUDE) || state.altitude <= GROUND_ALTITUDE) && state.altitude < 100) {
    state.grounded = true;
    state.altitude = GROUND_ALTITUDE;
    state.y = GROUND_ALTITUDE;
    state.roverSettled = true;
    state.touchdownState = 'STABLE_TOUCHDOWN';
    state.phase = 'LANDED';
    state.cablesReleased = true;
    state.descentStageFlyaway = true;
    state.vy = 0;
    state.vx = 0;
    state.vz = 0;
    state.verticalVelocity = 0;
    state.speed = 0;
    state.radarAltitude = 0.0;
    state.enginesActive = false;
    state.poweredDescentActive = false;
    state.skyCraneActive = false;
    if (state.touchdownTime === undefined) {
      state.touchdownTime = state.elapsed;
    }
    if (!state.descentStagePos) {
      state.descentStagePos = { x: state.x + 25, y: 18, z: state.z + 18, vx: 50, vy: 20, vz: 30 };
    }
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

