/**
 * tests/orbit.test.js – Node.js assertion tests for Mars Orbit, Deorbit Burn, and Entry Transition.
 *
 * Run with:
 *   node tests/orbit.test.js
 *
 * Tests cover:
 *   1. Mars circular orbital velocity at 250 km (~3430.4 m/s)
 *   2. Gravity direction towards Mars center (0, -MARS_RADIUS, 0)
 *   3. Gravity magnitude a = mu / r²
 *   4. Retrograde burn reduces orbital energy
 *   5. Propellant depletion during thrust: dm/dt = T / (Isp * g0)
 *   6. Mass conservation: mass = dryMass + fuel
 *   7. Deorbit transition: MARS_ORBIT -> DEORBIT_BURN
 *   8. Burn completion: DEORBIT_BURN -> COAST_TO_ENTRY when delta-v >= 125 m/s
 *   9. Entry interface: COAST_TO_ENTRY -> ATMOSPHERIC_ENTRY at altitude <= 125 km
 *   10. Ground clamp: touchdown clamping at GROUND_ALTITUDE
 */

import assert from 'node:assert/strict';

import {
  MARS_RADIUS,
  MARS_MU,
  ORBIT_ALTITUDE,
  ENTRY_INTERFACE_ALTITUDE,
  DEORBIT_DELTA_V,
  DEORBIT_THRUST,
  DEORBIT_ISP,
  G0_STANDARD,
  PROPELLANT_MASS,
  DRY_MASS,
  TOTAL_INITIAL_MASS,
  GROUND_ALTITUDE,
  PHYSICS_DT,
} from '../src/simulation/physics/constants.js';
import {
  getCircularOrbitalSpeed,
  centralGravityAcceleration,
  computeDeorbitThrust,
  computeMassFlowRate,
  computeOrbitalParameters,
  getDistanceToMarsCenter,
  getAltitudeFromCenter,
  computeHeatFlux,
} from '../src/simulation/physics/orbit.js';
import { stepSimulation } from '../src/simulation/physics/integrator.js';
import { createInitialState, determinePhase } from '../src/simulation/simulationState.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${name}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

function approxEqual(a, b, tol = 1e-4, msg = '') {
  assert(
    Math.abs(a - b) <= tol,
    `${msg} Expected ${a} ≈ ${b} (diff = ${Math.abs(a - b)}, tol = ${tol})`
  );
}

console.log('\n── 1. Mars Orbital Mechanics ───────────────────');

test('Circular orbital velocity at 250 km is approximately 3430.4 m/s', () => {
  const v = getCircularOrbitalSpeed(ORBIT_ALTITUDE);
  // Theoretical: sqrt(4.282837e13 / 3639500) ≈ 3430.36 m/s
  approxEqual(v, 3430.36, 0.5, 'Orbital velocity');
});

test('Gravity points toward Mars center (0, -MARS_RADIUS, 0)', () => {
  // At (0, ORBIT_ALTITUDE, 0), radius vector from center (0, -MARS_RADIUS, 0) is (0, r, 0)
  // Acceleration should point in -Y direction, with zero X and Z components
  const { ax, ay, az } = centralGravityAcceleration(0, ORBIT_ALTITUDE, 0);
  approxEqual(ax, 0, 1e-9, 'ax should be 0');
  approxEqual(az, 0, 1e-9, 'az should be 0');
  assert(ay < 0, 'ay must be negative (downward toward Mars center)');
});

test('Gravity magnitude matches a = mu / r²', () => {
  const r = MARS_RADIUS + ORBIT_ALTITUDE;
  const expectedMag = MARS_MU / (r * r);
  const { ax, ay, az } = centralGravityAcceleration(0, ORBIT_ALTITUDE, 0);
  const mag = Math.sqrt(ax * ax + ay * ay + az * az);
  approxEqual(mag, expectedMag, 1e-6, 'Gravity magnitude');
});

console.log('\n── 2. Deorbit Propulsion & Energy ──────────────');

test('Retrograde burn reduces specific orbital energy', () => {
  // Spacecraft at (0, ORBIT_ALTITUDE, 0) moving in +X
  const v0 = getCircularOrbitalSpeed(ORBIT_ALTITUDE);
  const params0 = computeOrbitalParameters(0, ORBIT_ALTITUDE, 0, v0, 0, 0);

  // Apply retrograde burn (-125 m/s in X)
  const v1 = v0 - DEORBIT_DELTA_V;
  const params1 = computeOrbitalParameters(0, ORBIT_ALTITUDE, 0, v1, 0, 0);

  assert(
    params1.energy < params0.energy,
    `Orbital energy should decrease: ${params1.energy} < ${params0.energy}`
  );
  assert(
    params1.periapsisAlt < params0.periapsisAlt,
    `Periapsis should lower: ${params1.periapsisAlt} < ${params0.periapsisAlt}`
  );
  assert(
    params1.periapsisAlt < ENTRY_INTERFACE_ALTITUDE,
    `Deorbit burn must lower periapsis into the atmosphere (< 125 km)`
  );
});

test('Propellant mass flow rate matches rocket equation dm/dt = T / (Isp * g0)', () => {
  const expectedMDot = DEORBIT_THRUST / (DEORBIT_ISP * G0_STANDARD);
  const mDot = computeMassFlowRate(DEORBIT_THRUST, DEORBIT_ISP, G0_STANDARD);
  approxEqual(mDot, expectedMDot, 1e-8, 'Mass flow rate');
  // 4500 / (310 * 9.80665) ≈ 1.4802 kg/s
  approxEqual(mDot, 1.4802, 0.01, 'Nominal mass flow rate');
});

test('Mass conservation: mass equals dryMass plus remaining fuel', () => {
  const state = createInitialState();
  state.enginesActive = true;
  state.running = true;

  const dt = 1.0;
  stepSimulation(state, dt);

  assert(state.fuel < PROPELLANT_MASS, 'Fuel must decrease during engine burn');
  approxEqual(state.mass, DRY_MASS + state.fuel, 1e-9, 'Mass conservation');
  assert(state.deliveredDeltaV > 0, 'Delta-v must accumulate during burn');
});

console.log('\n── 3. Mission State Machine Transitions ────────');

test('Autonomous transition: MARS_ORBIT -> DEORBIT_BURN', () => {
  const state = createInitialState();
  assert.strictEqual(state.phase, 'MARS_ORBIT');

  // Advance orbit time past checkout threshold
  state.orbitTime = 7.0;
  const nextPhase = determinePhase(state);
  assert.strictEqual(nextPhase, 'DEORBIT_BURN');
  assert.strictEqual(state.enginesActive, true, 'Engines should activate');
});

test('Burn completion transition: DEORBIT_BURN -> COAST_TO_ENTRY', () => {
  const state = createInitialState();
  state.phase = 'DEORBIT_BURN';
  state.enginesActive = true;
  state.deliveredDeltaV = DEORBIT_DELTA_V + 1.0; // target achieved

  const nextPhase = determinePhase(state);
  assert.strictEqual(nextPhase, 'COAST_TO_ENTRY');
  assert.strictEqual(state.enginesActive, false, 'Engines should shut down');
  assert.strictEqual(state.burnCompleted, true, 'Burn should be marked complete');
});

test('Entry interface transition: COAST_TO_ENTRY -> ATMOSPHERIC_ENTRY at <= 125 km', () => {
  const state = createInitialState();
  state.phase = 'COAST_TO_ENTRY';
  state.altitude = 124000; // below 125 km

  const nextPhase = determinePhase(state);
  assert.strictEqual(nextPhase, 'ATMOSPHERIC_ENTRY');
});

test('Ground clamping halts descent at GROUND_ALTITUDE', () => {
  const state = createInitialState();
  state.phase = 'ATMOSPHERIC_ENTRY';
  state.altitude = 0.1;
  state.y = 0.1;
  state.vy = -100;

  stepSimulation(state, 0.1);

  assert.strictEqual(state.grounded, true, 'Must be grounded');
  assert.strictEqual(state.phase, 'LANDED', 'Phase must be LANDED');
  approxEqual(state.altitude, GROUND_ALTITUDE, 1e-9, 'Altitude clamped at ground');
  approxEqual(state.speed, 0, 1e-9, 'Speed must be 0 after touchdown');
});

console.log('\n── 4. Aerodynamic Heating Formulation ──────────');

test('Heat flux scales with sqrt(rho) and v³', () => {
  const q0 = computeHeatFlux(0.001, 3000);
  assert(q0 > 0, 'Heat flux should be positive');

  // Double velocity -> 8x heat flux
  const qDoubleV = computeHeatFlux(0.001, 6000);
  approxEqual(qDoubleV / q0, 8.0, 1e-3, 'Velocity cube scaling');

  // Zero density -> 0 heat flux
  assert.strictEqual(computeHeatFlux(0, 5000), 0);
});

console.log('\n─────────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
