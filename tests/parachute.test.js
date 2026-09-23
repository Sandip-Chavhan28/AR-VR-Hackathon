/**
 * tests/parachute.test.js – Node.js assertion tests for Phase 3A:
 * Parachute Deployment, Environmental Disturbances (Wind Shear), and Sensor Noise.
 *
 * Run with:
 *   node tests/parachute.test.js
 *
 * Tests cover:
 *   1. Parachute is initially packed.
 *   2. Deployment condition becomes true at the intended altitude/velocity.
 *   3. Deployment does not occur above the configured threshold.
 *   4. Deployment progress goes from 0 to 1.
 *   5. Parachute drag is greater than aeroshell drag after deployment.
 *   6. Drag direction opposes relative air velocity.
 *   7. Relative air velocity changes when wind is present.
 *   8. Dynamic pressure uses relative airspeed.
 *   9. Wind changes smoothly with altitude/time.
 *   10. Sensor noise does not modify true physics state.
 *   11. Sensor measurements differ from true values when noise is enabled.
 *   12. Sensor noise is deterministic/reproducible.
 *   13. State transition: ATMOSPHERIC_ENTRY -> PARACHUTE_DESCENT.
 *   14. Existing LANDED transition still works.
 */

import assert from 'node:assert/strict';

import {
  PARACHUTE_DEPLOY_ALTITUDE,
  PARACHUTE_DEPLOY_MAX_SPEED,
  PARACHUTE_DEPLOY_MIN_DENSITY,
  PARACHUTE_CD,
  PARACHUTE_AREA,
  PARACHUTE_DEPLOY_DURATION,
  CD_ENTRY,
  REFERENCE_AREA,
  GROUND_ALTITUDE,
  PHYSICS_DT,
} from '../src/simulation/physics/constants.js';
import { atmosphericDensity } from '../src/simulation/physics/atmosphere.js';
import { computeWind } from '../src/simulation/physics/wind.js';
import { computeHarmonicNoise, computeMeasuredState } from '../src/simulation/physics/sensorNoise.js';
import { dragForce, dynamicPressure, computeAcceleration } from '../src/simulation/physics/forces.js';
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

console.log('\n── 1. Parachute Initial & Deployment Conditions ─');

test('1. Parachute is initially packed', () => {
  const state = createInitialState();
  assert.strictEqual(state.parachuteState, 'PACKED', 'Initial parachute state must be PACKED');
  assert.strictEqual(state.parachuteDeploymentProgress, 0.0, 'Initial deployment progress must be 0');
});

test('2. Deployment condition becomes true at intended altitude, density, and speed', () => {
  const state = createInitialState();
  state.phase = 'ATMOSPHERIC_ENTRY';
  state.altitude = PARACHUTE_DEPLOY_ALTITUDE; // 10,000 m
  state.rho = atmosphericDensity(PARACHUTE_DEPLOY_ALTITUDE); // ~0.0081 kg/m³
  state.speed = 300.0; // <= 450 m/s

  assert(state.altitude <= PARACHUTE_DEPLOY_ALTITUDE, 'Altitude condition met');
  assert(state.rho >= PARACHUTE_DEPLOY_MIN_DENSITY, 'Density condition met');
  assert(state.speed <= PARACHUTE_DEPLOY_MAX_SPEED, 'Speed condition met');

  const nextPhase = determinePhase(state);
  assert.strictEqual(nextPhase, 'PARACHUTE_DESCENT', 'Phase should transition to PARACHUTE_DESCENT');
  assert.strictEqual(state.parachuteState, 'DEPLOYING', 'Parachute state should change to DEPLOYING');
});

test('3. Deployment does not occur above configured threshold', () => {
  const state = createInitialState();
  state.phase = 'ATMOSPHERIC_ENTRY';
  // Altitude is above 10 km
  state.altitude = PARACHUTE_DEPLOY_ALTITUDE + 2000; // 12,000 m
  state.rho = atmosphericDensity(state.altitude);
  state.speed = 300.0;

  const nextPhase = determinePhase(state);
  assert.strictEqual(nextPhase, 'ATMOSPHERIC_ENTRY', 'Must remain in ATMOSPHERIC_ENTRY above threshold');
  assert.strictEqual(state.parachuteState, 'PACKED', 'Parachute must remain PACKED');

  // Also verify excessive speed prevents deployment
  state.altitude = PARACHUTE_DEPLOY_ALTITUDE - 500;
  state.speed = PARACHUTE_DEPLOY_MAX_SPEED + 100.0; // 550 m/s > 450 m/s
  const nextPhaseOverspeed = determinePhase(state);
  assert.strictEqual(nextPhaseOverspeed, 'ATMOSPHERIC_ENTRY', 'Overspeed must prevent deployment');
});

test('4. Deployment progress goes from 0 to 1', () => {
  const state = createInitialState();
  state.phase = 'PARACHUTE_DESCENT';
  state.parachuteState = 'DEPLOYING';
  state.parachuteDeploymentProgress = 0.0;
  state.altitude = 9000;

  // Simulate forward in increments of PHYSICS_DT
  const stepsToDeploy = Math.ceil(PARACHUTE_DEPLOY_DURATION / PHYSICS_DT);
  for (let i = 0; i < stepsToDeploy; i++) {
    stepSimulation(state, PHYSICS_DT);
  }

  approxEqual(state.parachuteDeploymentProgress, 1.0, 1e-4, 'Deployment progress must reach 1.0');
  assert.strictEqual(state.parachuteState, 'DEPLOYED', 'Parachute state must be DEPLOYED when progress = 1');
});

console.log('\n── 2. Parachute Aerodynamic Physics ────────────');

test('5. Parachute drag is greater than aeroshell drag after deployment', () => {
  const rho = 0.01;
  const vx = 0, vy = -150, vz = 0;

  // Aeroshell drag alone (packed, progress = 0)
  const statePacked = {
    vx, vy, vz, altitude: 8000, mass: 900,
    parachuteState: 'PACKED', parachuteDeploymentProgress: 0.0,
    disableWind: true,
  };
  const accelPacked = computeAcceleration(statePacked);

  // Deployed parachute drag (progress = 1)
  const stateDeployed = {
    vx, vy, vz, altitude: 8000, mass: 900,
    parachuteState: 'DEPLOYED', parachuteDeploymentProgress: 1.0,
    disableWind: true,
  };
  const accelDeployed = computeAcceleration(stateDeployed);

  assert(
    accelDeployed.dragMagnitude > accelPacked.dragMagnitude * 5,
    `Deployed drag (${accelDeployed.dragMagnitude} N) must substantially exceed packed drag (${accelPacked.dragMagnitude} N)`
  );
});

test('6. Drag direction opposes relative air velocity', () => {
  const rho = 0.01;
  // Spacecraft falling downward with +X eastward movement
  const vRelX = 80;
  const vRelY = -120;
  const vRelZ = 40;

  const drag = dragForce(rho, vRelX, vRelY, vRelZ, CD_ENTRY, REFERENCE_AREA);

  // Drag must oppose each relative velocity component
  assert(drag.fx * vRelX < 0, 'fx must oppose vRelX');
  assert(drag.fy * vRelY < 0, 'fy must oppose vRelY');
  assert(drag.fz * vRelZ < 0, 'fz must oppose vRelZ');
});

console.log('\n── 3. Environmental Disturbances (Wind Shear) ──');

test('7. Relative air velocity changes when wind is present', () => {
  const stateNoWind = {
    vx: 100, vy: -200, vz: 0, altitude: 8000, mass: 900,
    wind: { x: 0, y: 0, z: 0 },
  };
  const accelNoWind = computeAcceleration(stateNoWind);

  // Inject 20 m/s horizontal crosswind in X
  const stateWithWind = {
    vx: 100, vy: -200, vz: 0, altitude: 8000, mass: 900,
    wind: { x: 20, y: 0, z: 0 },
  };
  const accelWithWind = computeAcceleration(stateWithWind);

  assert(
    Math.abs(accelWithWind.relativeSpeed - accelNoWind.relativeSpeed) > 1.0,
    'Relative airspeed must reflect wind velocity vector'
  );
  assert(
    Math.abs(accelWithWind.ax - accelNoWind.ax) > 0.1,
    'Horizontal acceleration must change due to wind shear'
  );
});

test('8. Dynamic pressure uses relative airspeed', () => {
  const rho = 0.01;
  const groundSpeed = 100.0;
  const headWind = 25.0;
  const relAirspeed = groundSpeed + headWind; // 125 m/s

  const qGround = dynamicPressure(rho, groundSpeed);
  const qRelative = dynamicPressure(rho, relAirspeed);

  assert(
    qRelative > qGround,
    `qRelative (${qRelative}) must be greater than qGround (${qGround}) with headwind`
  );
  approxEqual(qRelative, 0.5 * rho * relAirspeed * relAirspeed, 1e-6, 'Dynamic pressure formulation');
});

test('9. Wind changes smoothly with altitude and time', () => {
  const h1 = 10000;
  const h2 = 10050; // delta h = 50 m
  const w1 = computeWind(h1, 100);
  const w2 = computeWind(h2, 100);

  // Difference over 50 meters should be small and continuous (no jump discontinuity)
  const diffX = Math.abs(w2.x - w1.x);
  const diffZ = Math.abs(w2.z - w1.z);
  assert(diffX < 1.0, `Wind X should vary smoothly across 50m (got diff ${diffX})`);
  assert(diffZ < 1.0, `Wind Z should vary smoothly across 50m (got diff ${diffZ})`);

  // Wind above 125 km (vacuum) is 0
  const wExo = computeWind(130000, 50);
  approxEqual(wExo.x, 0, 1e-9);
  approxEqual(wExo.y, 0, 1e-9);
  approxEqual(wExo.z, 0, 1e-9);
});

console.log('\n── 4. Deterministic Sensor Noise & True State ───');

test('10. Sensor noise does not modify true physics state', () => {
  const state = createInitialState();
  state.altitude = 12000;
  state.speed = 350;
  state.verticalVelocity = -180;
  state.q = 400;
  state.elapsed = 150.0;

  const trueAltBefore = state.altitude;
  const trueSpeedBefore = state.speed;

  const measured = computeMeasuredState(state, state.elapsed, true);

  // True state fields must remain completely unmodified
  assert.strictEqual(state.altitude, trueAltBefore, 'True altitude must not be modified');
  assert.strictEqual(state.speed, trueSpeedBefore, 'True speed must not be modified');
  assert(measured !== undefined, 'Measured state object must be returned');
});

test('11. Sensor measurements differ from true values when noise is enabled', () => {
  const state = createInitialState();
  state.altitude = 8000;
  state.speed = 220;
  state.verticalVelocity = -150;
  state.elapsed = 42.5;

  const measured = computeMeasuredState(state, state.elapsed, true);

  assert(
    Math.abs(measured.altitude - state.altitude) > 0.01,
    'Measured altitude should include noise offset'
  );
  assert(
    Math.abs(measured.speed - state.speed) > 0.01,
    'Measured speed should include noise offset'
  );
  assert(
    Math.abs(measured.verticalVelocity - state.verticalVelocity) > 0.01,
    'Measured vertical velocity should include noise offset'
  );
});

test('12. Sensor noise is deterministic and reproducible', () => {
  const state = createInitialState();
  state.altitude = 5000;
  state.speed = 100;
  state.elapsed = 77.0;

  const run1 = computeMeasuredState(state, 77.0, true);
  const run2 = computeMeasuredState(state, 77.0, true);

  // Repeated calls with same time must produce bit-for-bit identical results
  assert.strictEqual(run1.altitude, run2.altitude, 'Deterministic altitude noise');
  assert.strictEqual(run1.speed, run2.speed, 'Deterministic speed noise');
  assert.strictEqual(run1.verticalVelocity, run2.verticalVelocity, 'Deterministic vertical velocity noise');
  assert.strictEqual(run1.q, run2.q, 'Deterministic dynamic pressure noise');
});

console.log('\n── 5. Full Mission State Machine Transitions ───');

test('13. State transition: ATMOSPHERIC_ENTRY -> PARACHUTE_DESCENT', () => {
  const state = createInitialState();
  state.phase = 'ATMOSPHERIC_ENTRY';
  state.altitude = 9900;
  state.rho = atmosphericDensity(9900);
  state.speed = 250;

  const phase = determinePhase(state);
  assert.strictEqual(phase, 'PARACHUTE_DESCENT', 'Must transition to PARACHUTE_DESCENT');
  assert.strictEqual(state.parachuteState, 'DEPLOYING', 'Parachute state must be DEPLOYING');
});

test('14. Existing LANDED transition still works', () => {
  const state = createInitialState();
  state.phase = 'PARACHUTE_DESCENT';
  state.altitude = 0.2;
  state.y = 0.2;
  state.vy = -30.0;
  state.parachuteState = 'DEPLOYED';
  state.parachuteDeploymentProgress = 1.0;

  stepSimulation(state, PHYSICS_DT);

  assert.strictEqual(state.grounded, true, 'Spacecraft must be grounded');
  assert.strictEqual(state.phase, 'LANDED', 'Phase must be LANDED');
  approxEqual(state.altitude, GROUND_ALTITUDE, 1e-6, 'Altitude clamped at ground');
  approxEqual(state.speed, 0, 1e-6, 'Speed must be 0 at landing');
});

console.log('\n─────────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
