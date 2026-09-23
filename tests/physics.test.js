/**
 * tests/physics.test.js – Plain Node.js assertion tests for Phase 1 physics.
 *
 * No test framework required. Run with:
 *   node tests/physics.test.js
 *
 * Uses Node's built-in assert module.
 *
 * Tests cover:
 *   1. Atmospheric density at known altitudes
 *   2. Mars gravity value
 *   3. Dynamic pressure calculation
 *   4. Drag force direction (must oppose velocity)
 *   5. Drag force magnitude
 *   6. Net acceleration direction (gravity + drag)
 *   7. Integrator: altitude decreases under gravity
 *   8. Integrator: ground contact clamps altitude
 *   9. Time-scale: simulation state advances correctly
 */

import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Import physics modules (ESM, run with Node >= 18)
// ---------------------------------------------------------------------------
import { RHO0, SCALE_HEIGHT, MARS_G, CD_ENTRY, REFERENCE_AREA, LANDER_MASS, GROUND_ALTITUDE, PHYSICS_DT } from '../src/simulation/physics/constants.js';
import { atmosphericDensity } from '../src/simulation/physics/atmosphere.js';
import { dynamicPressure, dragForce, computeAcceleration, gravityAcceleration } from '../src/simulation/physics/forces.js';
import { stepSimulation } from '../src/simulation/physics/integrator.js';
import { createInitialState } from '../src/simulation/simulationState.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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

function approxEqual(a, b, tol = 1e-6, msg = '') {
  assert(
    Math.abs(a - b) <= tol,
    `${msg} Expected ${a} ≈ ${b} (tolerance ${tol}), got diff = ${Math.abs(a - b)}`
  );
}

// ---------------------------------------------------------------------------
// 1. Atmospheric density
// ---------------------------------------------------------------------------
console.log('\n── Atmospheric Density ──────────────────────────');

test('Surface density equals RHO0', () => {
  const rho = atmosphericDensity(0);
  approxEqual(rho, RHO0, 1e-12, 'Surface density');
});

test('Density at one scale height is RHO0 / e', () => {
  const rho = atmosphericDensity(SCALE_HEIGHT);
  approxEqual(rho, RHO0 / Math.E, 1e-10, 'Scale-height density');
});

test('Density at 80 km is much less than surface', () => {
  const rho80 = atmosphericDensity(80000);
  assert(rho80 < RHO0 * 0.001, `Density at 80 km (${rho80}) should be < 0.001 * RHO0 (${RHO0 * 0.001})`);
});

test('Density monotonically decreases with altitude', () => {
  const alts = [0, 5000, 10000, 20000, 40000, 80000];
  for (let i = 1; i < alts.length; i++) {
    const rhoLow  = atmosphericDensity(alts[i - 1]);
    const rhoHigh = atmosphericDensity(alts[i]);
    assert(rhoHigh < rhoLow,
      `Density should decrease: rho(${alts[i]}) = ${rhoHigh} should be < rho(${alts[i-1]}) = ${rhoLow}`
    );
  }
});

test('Negative altitude clamps to surface density', () => {
  const rhoNeg  = atmosphericDensity(-1000);
  const rhoSurf = atmosphericDensity(0);
  approxEqual(rhoNeg, rhoSurf, 1e-12, 'Negative altitude clamping');
});

// ---------------------------------------------------------------------------
// 2. Mars Gravity
// ---------------------------------------------------------------------------
console.log('\n── Mars Gravity ─────────────────────────────────');

test('Gravity constant is 3.71 m/s²', () => {
  approxEqual(MARS_G, 3.71, 1e-9, 'MARS_G');
});

test('gravityAcceleration returns correct -Y vector', () => {
  const g = gravityAcceleration();
  approxEqual(g.ax, 0,       1e-12, 'gravity ax');
  approxEqual(g.ay, -MARS_G, 1e-12, 'gravity ay');
  approxEqual(g.az, 0,       1e-12, 'gravity az');
});

// ---------------------------------------------------------------------------
// 3. Dynamic pressure
// ---------------------------------------------------------------------------
console.log('\n── Dynamic Pressure ─────────────────────────────');

test('q = 0.5 * rho * v² — basic calculation', () => {
  const q = dynamicPressure(0.02, 100);
  approxEqual(q, 0.5 * 0.02 * 100 * 100, 1e-9, 'Dynamic pressure');
});

test('q = 0 when speed = 0', () => {
  approxEqual(dynamicPressure(0.02, 0), 0, 1e-12, 'Zero speed dynamic pressure');
});

test('q scales as v²', () => {
  const q1 = dynamicPressure(0.02, 100);
  const q2 = dynamicPressure(0.02, 200);
  approxEqual(q2, 4 * q1, 1e-9, 'q ∝ v² scaling');
});

// ---------------------------------------------------------------------------
// 4. Drag force direction
// ---------------------------------------------------------------------------
console.log('\n── Drag Force ───────────────────────────────────');

test('Drag force opposes +Y velocity (upward motion → downward drag)', () => {
  const drag = dragForce(0.02, 0, 100, 0);
  assert(drag.fy < 0, `Drag fy should be < 0 for +vy motion, got ${drag.fy}`);
  approxEqual(drag.fx, 0, 1e-9, 'No X drag for pure Y motion');
  approxEqual(drag.fz, 0, 1e-9, 'No Z drag for pure Y motion');
});

test('Drag force opposes -Y velocity (downward motion → upward drag)', () => {
  const drag = dragForce(0.02, 0, -5500, 0);
  assert(drag.fy > 0, `Drag fy should be > 0 for -vy motion, got ${drag.fy}`);
});

test('Drag force magnitude: D = 0.5 * rho * v² * Cd * A', () => {
  const rho = 0.02, vx = 0, vy = -1000, vz = 0;
  const drag = dragForce(rho, vx, vy, vz);
  const expected = 0.5 * rho * 1000 * 1000 * CD_ENTRY * REFERENCE_AREA;
  const actual   = Math.sqrt(drag.fx ** 2 + drag.fy ** 2 + drag.fz ** 2);
  approxEqual(actual, expected, 0.001, 'Drag magnitude');
});

test('Zero drag when velocity is zero', () => {
  const drag = dragForce(0.02, 0, 0, 0);
  approxEqual(drag.fx, 0, 1e-12, 'No drag at rest fx');
  approxEqual(drag.fy, 0, 1e-12, 'No drag at rest fy');
  approxEqual(drag.fz, 0, 1e-12, 'No drag at rest fz');
});

test('Drag scales with area', () => {
  const rho = 0.02, vy = -1000;
  const drag1 = dragForce(rho, 0, vy, 0, CD_ENTRY, 1.0);
  const drag2 = dragForce(rho, 0, vy, 0, CD_ENTRY, 2.0);
  approxEqual(drag2.fy, 2 * drag1.fy, 0.001, 'Drag area scaling');
});

// ---------------------------------------------------------------------------
// 5. Net acceleration
// ---------------------------------------------------------------------------
console.log('\n── Net Acceleration ─────────────────────────────');

test('At rest in atmosphere, only gravity acts (no drag)', () => {
  const state = { vx: 0, vy: 0, vz: 0, altitude: 0, mass: LANDER_MASS };
  const { ax, ay, az } = computeAcceleration(state);
  approxEqual(ax, 0,       1e-9, 'Net ax at rest');
  approxEqual(ay, -MARS_G, 1e-9, 'Net ay at rest = gravity');
  approxEqual(az, 0,       1e-9, 'Net az at rest');
});

test('Drag decelerates a fast-moving lander (ay > -MARS_G for downward motion)', () => {
  // Lander falling at 5500 m/s downward — drag should reduce net downward acceleration
  const state = { vx: 0, vy: -5500, vz: 0, altitude: 80000, mass: LANDER_MASS };
  const { ay } = computeAcceleration(state);
  // At 80 km the drag might be small, so let's test at low altitude where rho is high
  const stateLow = { vx: 0, vy: -1000, vz: 0, altitude: 1000, mass: LANDER_MASS };
  const { ay: ayLow } = computeAcceleration(stateLow);
  assert(ayLow > -MARS_G, `At low altitude with downward velocity, drag should reduce |ay|. Got ${ayLow}`);
});

// ---------------------------------------------------------------------------
// 6. Integrator behaviour
// ---------------------------------------------------------------------------
console.log('\n── Integrator ───────────────────────────────────');

test('Altitude decreases under gravity with no drag (vacuum)', () => {
  // State with zero velocity in near-vacuum (very high altitude)
  const state = {
    x: 0, y: 200000, z: 0,
    vx: 0, vy: 0, vz: 0,
    ax: 0, ay: 0, az: 0,
    mass: LANDER_MASS,
    altitude: 200000,
    speed: 0,
    verticalVelocity: 0,
    rho: 0,
    q: 0,
    gForce: 0,
    phase: 'ENTRY',
    grounded: false,
    elapsed: 0,
  };

  const altBefore = state.altitude;
  stepSimulation(state, PHYSICS_DT);
  assert(state.altitude < altBefore,
    `Altitude should decrease after one step. Before: ${altBefore}, After: ${state.altitude}`
  );
});

test('Integrator clamps altitude at GROUND_ALTITUDE on touchdown', () => {
  const state = {
    x: 0, y: 0.1, z: 0,                // just above ground
    vx: 0, vy: -50, vz: 0,             // descending fast
    ax: 0, ay: 0, az: 0,
    mass: LANDER_MASS,
    altitude: 0.1,
    speed: 50,
    verticalVelocity: -50,
    rho: RHO0,
    q: 0,
    gForce: 0,
    phase: 'ENTRY',
    grounded: false,
    elapsed: 0,
  };

  stepSimulation(state, PHYSICS_DT);
  assert(state.grounded === true, 'Should be grounded after hitting surface');
  assert(state.altitude >= GROUND_ALTITUDE, `Altitude should not go below GROUND_ALTITUDE (${GROUND_ALTITUDE}), got ${state.altitude}`);
  approxEqual(state.vy, 0, 1e-9, 'vy should be zero after landing');
});

test('Grounded state does not advance simulation', () => {
  const state = createInitialState();
  state.grounded = true;
  state.altitude = GROUND_ALTITUDE;
  state.y        = GROUND_ALTITUDE;
  state.running  = true;

  const altBefore = state.altitude;
  stepSimulation(state, PHYSICS_DT);
  approxEqual(state.altitude, altBefore, 1e-9, 'Grounded state altitude unchanged');
});

test('Speed increases from rest under gravity alone (high altitude)', () => {
  const state = {
    x: 0, y: 500000, z: 0,             // very high: near-zero air density
    vx: 0, vy: 0, vz: 0,
    ax: 0, ay: 0, az: 0,
    mass: LANDER_MASS,
    altitude: 500000,
    speed: 0,
    verticalVelocity: 0,
    rho: 0,
    q: 0,
    gForce: 0,
    phase: 'ENTRY',
    grounded: false,
    elapsed: 0,
  };

  stepSimulation(state, PHYSICS_DT);
  assert(state.speed > 0, `Speed should increase from gravity. Got ${state.speed}`);
  assert(state.vy < 0,    `vy should be negative (downward). Got ${state.vy}`);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n─────────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
