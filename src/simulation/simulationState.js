/**
 * simulationState.js – 3-DoF state factory and simulation controller.
 *
 * Owns:
 *   - Definition of the simulation state object (Mars orbit, deorbit, entry).
 *   - State factory (createInitialState) placing spacecraft in 250 km circular orbit.
 *   - Autonomous mission state machine (MARS_ORBIT -> DEORBIT_BURN -> COAST_TO_ENTRY -> ATMOSPHERIC_ENTRY -> LANDED).
 *   - Fixed-timestep accumulator (tickSimulation) decouples physics from browser FPS.
 *
 * All coordinates in pure SI units (m, s, kg, N).
 * Unified simulation frame:
 *   Mars center: (0, -MARS_RADIUS, 0)
 *   Lander starts at (0, ORBIT_ALTITUDE, 0) with circular orbital velocity in +X.
 */

import {
  MARS_RADIUS,
  ORBIT_ALTITUDE,
  ENTRY_INTERFACE_ALTITUDE,
  GROUND_ALTITUDE,
  DEORBIT_DELTA_V,
  DEORBIT_THRUST,
  DEORBIT_ISP,
  PROPELLANT_MASS,
  DRY_MASS,
  TOTAL_INITIAL_MASS,
  PHYSICS_DT,
  TIME_SCALE,
  PARACHUTE_DEPLOY_ALTITUDE,
  PARACHUTE_DEPLOY_MAX_SPEED,
  PARACHUTE_DEPLOY_MIN_DENSITY,
} from './physics/constants.js';
import { atmosphericDensity } from './physics/atmosphere.js';
import { stepSimulation } from './physics/integrator.js';
import { getCircularOrbitalSpeed, getDistanceToMarsCenter } from './physics/orbit.js';
import { computeMeasuredState } from './physics/sensorNoise.js';
import { INITIAL_PLANNED_TARGET } from './landingSite/constants.js';
import { performLandingSiteAnalysis } from './landingSite/landingSiteAnalysis.js';
import { getTargetDistance, calculateLandingError } from './guidance/controller.js';
import { TARGET_CAPTURE_RADIUS, DIST_LOG_INTERVAL } from './guidance/constants.js';

// ---------------------------------------------------------------------------
// Autonomous Mission State Machine
// ---------------------------------------------------------------------------

/**
 * Determine the current mission phase based on physical state and thresholds.
 *
 * Autonomous progression:
 *   MARS_ORBIT                   (stable circular orbit at 250 km)
 *       ↓                        (after orbital checkout / trigger)
 *   DEORBIT_BURN                 (retrograde thruster fires until 125 m/s delta-v achieved)
 *       ↓                        (burn complete)
 *   COAST_TO_ENTRY               (suborbital transfer descent towards Mars)
 *       ↓                        (altitude <= 125 km)
 *   ATMOSPHERIC_ENTRY            (hypersonic aerodynamic braking and heating)
 *       ↓                        (altitude <= 10 km, density >= 0.004, speed <= 450 m/s)
 *   PARACHUTE_DESCENT            (supersonic parachute deployment & aerodynamic deceleration)
 *       ↓                        (analysis complete, initial target UNSAFE)
 *   AUTONOMOUS_TARGET_REALIGNMENT (lateral guidance corrects trajectory to safe target)
 *       ↓                        (horizontal distance to safe target <= TARGET_CAPTURE_RADIUS)
 *   SAFE_APPROACH                (velocity damping, final vertical descent)
 *       ↓                        (altitude <= GROUND_ALTITUDE)
 *   LANDED                       (touchdown)
 *
 *   If initial target is SAFE, the flow goes:
 *   PARACHUTE_DESCENT → LANDED  (no guidance phases)
 *
 * @param {object} state  Current simulation state.
 * @returns {string}      Phase identifier.
 */
export function determinePhase(state) {
  if (state.grounded || state.altitude <= GROUND_ALTITUDE) return 'LANDED';

  switch (state.phase) {
    case 'MARS_ORBIT':
      // Autonomous deorbit trigger after ~6s of orbital flight, or if manually commanded
      if ((state.orbitTime >= 6.0 && state.autoSequence !== false) || state.triggerDeorbit) {
        state.enginesActive = true;
        state.burnStartTime = state.elapsed;
        state.triggerDeorbit = false;
        return 'DEORBIT_BURN';
      }
      return 'MARS_ORBIT';

    case 'DEORBIT_BURN':
      // Burn stops when target delta-v delivered or fuel runs out
      if (state.burnCompleted || state.deliveredDeltaV >= (state.targetDeltaV || DEORBIT_DELTA_V) || state.fuel <= 0) {
        state.enginesActive = false;
        state.burnCompleted = true;
        return 'COAST_TO_ENTRY';
      }
      return 'DEORBIT_BURN';

    case 'COAST_TO_ENTRY':
      // Aerodynamic entry interface at 125 km altitude
      if (state.altitude <= ENTRY_INTERFACE_ALTITUDE) {
        return 'ATMOSPHERIC_ENTRY';
      }
      return 'COAST_TO_ENTRY';

    case 'ATMOSPHERIC_ENTRY':
      // Autonomous parachute deployment trigger:
      // altitude <= 10 km, density >= 0.004 kg/m³, speed <= 450 m/s
      if (
        state.altitude <= PARACHUTE_DEPLOY_ALTITUDE &&
        state.rho >= PARACHUTE_DEPLOY_MIN_DENSITY &&
        state.speed <= PARACHUTE_DEPLOY_MAX_SPEED
      ) {
        if (!state.parachuteState || state.parachuteState === 'PACKED') {
          state.parachuteState = 'DEPLOYING';
          state.parachuteDeploymentProgress = 0;
        }
        if (!state.landingSiteAnalysis) {
          state.landingSiteAnalysis = performLandingSiteAnalysis(state.initialPlannedTarget || INITIAL_PLANNED_TARGET);
          state.landingSiteAnalysis.analyzedAtAltitude = state.altitude;
          state.landingSiteAnalysis.analyzedAtTime = state.elapsed;
        }
        return 'PARACHUTE_DESCENT';
      }
      return 'ATMOSPHERIC_ENTRY';

    case 'PARACHUTE_DESCENT': {
      // Run landing-site analysis exactly once
      if (!state.landingSiteAnalysis) {
        state.landingSiteAnalysis = performLandingSiteAnalysis(state.initialPlannedTarget || INITIAL_PLANNED_TARGET);
        state.landingSiteAnalysis.analyzedAtAltitude = state.altitude;
        state.landingSiteAnalysis.analyzedAtTime = state.elapsed;
      }

      if (state.altitude <= GROUND_ALTITUDE || state.grounded) {
        return 'LANDED';
      }

      // If initial target is UNSAFE, arm guidance and transition immediately
      const lsa = state.landingSiteAnalysis;
      if (lsa && lsa.initialTargetStatus === 'UNSAFE' && lsa.selectedTarget) {
        // Store guidance reference coordinates once (global physics coords at this moment)
        if (state.guidanceRefX === undefined) {
          state.guidanceRefX = state.x;
          state.guidanceRefZ = state.z;
          // Mission control log entries
          lsa.decisionLog.push('[MC] INITIAL LANDING SITE UNSAFE — AUTONOMOUS REDIRECT REQUIRED');
          lsa.decisionLog.push(
            `[MC] SAFE TARGET LOCKED: (${lsa.selectedTarget.x.toFixed(0)}m, ${lsa.selectedTarget.z.toFixed(0)}m) — Score: ${lsa.selectedTarget.safetyScore.toFixed(1)}`
          );
          lsa.decisionLog.push('[MC] AUTONOMOUS TRAJECTORY CORRECTION INITIATED');
          state._lastDistLogTime = state.elapsed;
        }
        return 'AUTONOMOUS_TARGET_REALIGNMENT';
      }

      return 'PARACHUTE_DESCENT';
    }

    case 'AUTONOMOUS_TARGET_REALIGNMENT': {
      if (state.altitude <= GROUND_ALTITUDE || state.grounded) {
        return 'LANDED';
      }

      // Periodic target distance log
      const distATR = getTargetDistance(state);
      if (
        isFinite(distATR) &&
        state.landingSiteAnalysis &&
        (!state._lastDistLogTime || state.elapsed - state._lastDistLogTime >= DIST_LOG_INTERVAL)
      ) {
        state._lastDistLogTime = state.elapsed;
        state.landingSiteAnalysis.decisionLog.push(
          `[MC] GUIDANCE ACTIVE — TARGET DISTANCE: ${distATR.toFixed(0)} m`
        );
      }

      // Capture check
      if (isFinite(distATR) && distATR <= TARGET_CAPTURE_RADIUS) {
        if (state.landingSiteAnalysis) {
          state.landingSiteAnalysis.decisionLog.push(
            `[MC] TARGET CAPTURED (${distATR.toFixed(1)} m from safe target)`
          );
          state.landingSiteAnalysis.decisionLog.push('[MC] FINAL APPROACH — VELOCITY DAMPING ACTIVE');
        }
        return 'SAFE_APPROACH';
      }

      return 'AUTONOMOUS_TARGET_REALIGNMENT';
    }

    case 'SAFE_APPROACH': {
      if (state.altitude <= GROUND_ALTITUDE || state.grounded) {
        return 'LANDED';
      }
      return 'SAFE_APPROACH';
    }

    default:
      if (state.altitude > ENTRY_INTERFACE_ALTITUDE) {
        return 'MARS_ORBIT';
      }
      return 'ATMOSPHERIC_ENTRY';
  }
}

// ---------------------------------------------------------------------------
// State Factory
// ---------------------------------------------------------------------------

/**
 * Create and return a fresh initial simulation state in stable Mars orbit.
 *
 * @param {object} [options]
 * @param {number} [options.altitude] Custom orbit altitude (default 250 km)
 * @param {boolean} [options.autoSequence] Whether transitions occur automatically (default true)
 * @returns {object} Mutable simulation state object.
 */
export function createInitialState(options = {}) {
  const altitude = options.altitude !== undefined ? options.altitude : ORBIT_ALTITUDE;
  const autoSequence = options.autoSequence !== undefined ? options.autoSequence : true;

  // Circular orbital velocity at parking orbit
  const vOrbit = getCircularOrbitalSpeed(altitude);

  // Initial position: Top of Mars in X-Y plane (0, altitude, 0)
  // Radius vector from Mars center (0, -MARS_RADIUS, 0) is (0, MARS_RADIUS + altitude, 0)
  const x = 0;
  const y = altitude;
  const z = 0;

  // Initial velocity: Tangential to orbit (in +X direction)
  const vx = vOrbit;
  const vy = 0;
  const vz = 0;

  const r = getDistanceToMarsCenter(x, y, z);
  const rho = atmosphericDensity(altitude);

  const initialTrueState = {
    // ------------------------------------------------------------------
    // Position (m) in simulation frame
    // ------------------------------------------------------------------
    x,
    y,
    z,
    r,
    altitude,

    // ------------------------------------------------------------------
    // Velocity (m/s)
    // ------------------------------------------------------------------
    vx,
    vy,
    vz,
    speed: vOrbit,
    verticalVelocity: 0, // radial velocity (m/s)
    relativeSpeed: vOrbit,
    groundSpeed: vOrbit,

    // ------------------------------------------------------------------
    // Acceleration (m/s²)
    // ------------------------------------------------------------------
    ax: 0,
    ay: 0,
    az: 0,

    // ------------------------------------------------------------------
    // Mass & Propulsion Properties (kg, N, s)
    // ------------------------------------------------------------------
    dryMass: DRY_MASS,
    fuel: PROPELLANT_MASS,
    mass: TOTAL_INITIAL_MASS,
    thrust: DEORBIT_THRUST,
    isp: DEORBIT_ISP,
    enginesActive: false,
    deliveredDeltaV: 0,
    targetDeltaV: DEORBIT_DELTA_V,
    burnDuration: 0,
    burnStartTime: null,
    burnCompleted: false,

    // ------------------------------------------------------------------
    // Aerodynamics & Environment
    // ------------------------------------------------------------------
    rho,
    q: 0.5 * rho * vOrbit * vOrbit,
    gForce: 0,
    heatFlux: 0,
    heatIntensity: 0,
    wind: { x: 0, y: 0, z: 0 },

    // ------------------------------------------------------------------
    // Parachute System (Phase 3A)
    // ------------------------------------------------------------------
    parachuteState: 'PACKED', // 'PACKED' | 'DEPLOYING' | 'DEPLOYED'
    parachuteDeploymentProgress: 0.0,

    // ------------------------------------------------------------------
    // Landing Site & Hazard Analysis (Phase 3B-1)
    // ------------------------------------------------------------------
    landingSiteAnalysis: null,
    initialPlannedTarget: { ...INITIAL_PLANNED_TARGET },

    // ------------------------------------------------------------------
    // Autonomous Guidance (Stage 3B-2)
    // guidanceRefX/Z: global physics coords recorded when guidance arms.
    // These define the "local terrain origin" in global space so that
    // selectedTarget.x/z offsets map correctly to global targets.
    // ------------------------------------------------------------------
    guidanceRefX: undefined,
    guidanceRefZ: undefined,
    landingError: null,          // m — distance from selected target at touchdown
    _lastDistLogTime: null,      // internal: throttles periodic distance log entries

    // ------------------------------------------------------------------
    // Mission State & Autonomous Sequence
    // ------------------------------------------------------------------
    phase: 'MARS_ORBIT',
    autoSequence,
    triggerDeorbit: false,
    orbitTime: 0,
    grounded: false,
    elapsed: 0,
    running: false,
    noiseEnabled: true,
  };


  initialTrueState.sensors = computeMeasuredState(initialTrueState, 0, true);

  return initialTrueState;
}

// ---------------------------------------------------------------------------
// Fixed-Timestep Accumulator Loop
// ---------------------------------------------------------------------------

/**
 * Advance the simulation by the appropriate number of fixed-dt steps.
 * Decouples physics from frame rate.
 *
 * @param {object} state        Simulation state.
 * @param {number} wallDelta    Frame delta time (seconds).
 * @param {object} accumRef     Reference holding accumulated time.
 */
export function tickSimulation(state, wallDelta, accumRef) {
  if (!state.running || state.grounded) return;

  // Clamp wallDelta to prevent spiral of death on tab unfocus
  const clampedDelta = Math.min(wallDelta, 0.1);

  // Time-scale acceleration
  accumRef.current += clampedDelta * TIME_SCALE;

  let safetyCounter = 0;
  while (accumRef.current >= PHYSICS_DT && safetyCounter < 50) {
    // If in orbit, increment orbital time counter
    if (state.phase === 'MARS_ORBIT') {
      state.orbitTime = (state.orbitTime || 0) + PHYSICS_DT;
    }

    // Advance 3-DoF dynamics
    stepSimulation(state, PHYSICS_DT);
    accumRef.current -= PHYSICS_DT;
    safetyCounter++;

    // Evaluate autonomous mission state transitions
    if (!state.grounded) {
      state.phase = determinePhase(state);
    }
  }
}
