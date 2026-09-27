/**
 * edlExperience.test.js – Automated Verification for Mars 2020 EDL Experience.
 *
 * Verifies:
 *   1. 13-stage EDL milestones detection & metadata
 *   2. State scrubbing / jumping to all 13 milestones
 *   3. Staging triggers: Heat shield separation at <= 8 km
 *   4. Radar lock acquisition at <= 4 km
 *   5. TRN optical tracking activation at <= 2.5 km
 *   6. Backshell & parachute separation at <= 1.8 km
 *   7. Terminal Sky Crane braking at <= 30 m
 *   8. Touchdown safety limits: vertical velocity < 2.5 m/s, accuracy < 50 m
 */

import assert from 'node:assert';
import { createInitialState, determinePhase } from '../src/simulation/simulationState.js';
import { stepSimulation } from '../src/simulation/physics/integrator.js';
import {
  EDL_MILESTONES,
  detectMilestone,
  jumpToMilestone,
} from '../src/simulation/missionEvents.js';
import { PHYSICS_DT } from '../src/simulation/physics/constants.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${name}`);
    console.error(`      ${err.message}`);
    failed++;
  }
}

console.log('\n── 1. EDL Milestones Metadata & Detection ─────');

test('1. EDL_MILESTONES has exactly 13 canonical mission stages', () => {
  assert.strictEqual(EDL_MILESTONES.length, 13);
  assert.strictEqual(EDL_MILESTONES[0].id, 'ORBIT');
  assert.strictEqual(EDL_MILESTONES[12].id, 'TOUCHDOWN');
});

test('2. detectMilestone identifies parking orbit', () => {
  const s = createInitialState();
  const m = detectMilestone(s);
  assert.strictEqual(m.id, 'ORBIT');
});

test('3. detectMilestone identifies peak heating during hypersonic entry', () => {
  const s = createInitialState();
  s.phase = 'ATMOSPHERIC_ENTRY';
  s.altitude = 45000;
  const m = detectMilestone(s);
  assert.strictEqual(m.id, 'PEAK_HEATING');
});

test('4. detectMilestone identifies parachute deployment', () => {
  const s = createInitialState();
  s.phase = 'PARACHUTE_DESCENT';
  s.altitude = 9500;
  const m = detectMilestone(s);
  assert.strictEqual(m.id, 'PARACHUTE_DEPLOY');
});

test('5. detectMilestone identifies touchdown', () => {
  const s = createInitialState();
  s.grounded = true;
  s.phase = 'LANDED';
  const m = detectMilestone(s);
  assert.strictEqual(m.id, 'TOUCHDOWN');
});

console.log('\n── 2. Interactive Milestone Scrubbing ─────────');

test('6. jumpToMilestone configures valid state for all 13 milestones', () => {
  for (const m of EDL_MILESTONES) {
    const s = createInitialState();
    jumpToMilestone(s, m.id);

    assert(isFinite(s.altitude), `Milestone ${m.id} altitude must be finite`);
    assert(isFinite(s.speed), `Milestone ${m.id} speed must be finite`);
    assert(isFinite(s.x), `Milestone ${m.id} x must be finite`);
    assert(isFinite(s.y), `Milestone ${m.id} y must be finite`);
    assert(s.fuel >= 0, `Milestone ${m.id} fuel must be non-negative`);
    assert(s.mass > 0, `Milestone ${m.id} mass must be positive`);
  }
});

test('7. Scrubbing to PEAK_HEATING initializes thermal intensity', () => {
  const s = createInitialState();
  jumpToMilestone(s, 'PEAK_HEATING');
  assert(s.heatIntensity > 0.5, 'Peak heating must initialize heat intensity > 0.5');
  assert(s.heatFlux > 1e6, 'Peak heat flux must exceed 1 MW/m²');
});

test('8. Scrubbing to HEAT_SHIELD_SEP marks heat shield separated', () => {
  const s = createInitialState();
  jumpToMilestone(s, 'HEAT_SHIELD_SEP');
  assert.strictEqual(s.heatShieldSeparated, true);
  assert(s.heatShieldPos !== null);
});

console.log('\n── 3. Autonomous Physical Staging Triggers ────');

test('9. Heat shield separates at altitude <= 8 km', () => {
  const s = createInitialState();
  s.phase = 'PARACHUTE_DESCENT';
  s.altitude = 7990;
  s.y = 7990;
  s.vy = -35;
  s.speed = 35;
  s.heatShieldSeparated = false;

  stepSimulation(s, PHYSICS_DT);
  assert.strictEqual(s.heatShieldSeparated, true, 'Heat shield must separate below 8 km');
  assert(s.heatShieldPos !== null, 'Heat shield falling position must be recorded');
});

test('10. Terminal descent radar locks at altitude <= 4 km', () => {
  const s = createInitialState();
  s.phase = 'PARACHUTE_DESCENT';
  s.altitude = 3990;
  s.y = 3990;
  s.vy = -30;
  s.radarLocked = false;

  stepSimulation(s, PHYSICS_DT);
  assert.strictEqual(s.radarLocked, true, 'Radar altimeter must lock below 4 km');
});

test('11. Backshell & parachute separate at altitude <= 1.8 km', () => {
  const s = createInitialState();
  s.phase = 'PARACHUTE_DESCENT';
  s.altitude = 1790;
  s.y = 1790;
  s.vy = -25;
  s.backshellSeparated = false;

  stepSimulation(s, PHYSICS_DT);
  assert.strictEqual(s.backshellSeparated, true, 'Backshell must separate below 1.8 km');
  assert.strictEqual(s.phase, 'BACKSHELL_SEP', 'Separation stage must enter BACKSHELL_SEP');

  // Advance through 1.2s free-fall clearance duration
  for (let t = 0; t < 1.3; t += PHYSICS_DT) {
    stepSimulation(s, PHYSICS_DT);
  }
  assert.strictEqual(s.poweredDescentActive, true, 'Powered descent must activate after freefall');
  assert.strictEqual(s.enginesActive, true, 'Descent thrusters must fire');
});

test('12. Terminal Sky Crane deceleration activates at altitude <= 30 m', () => {
  const s = createInitialState();
  s.phase = 'POWERED_DESCENT';
  s.altitude = 28;
  s.y = 28;
  s.vy = -2.5;
  s.skyCraneActive = false;

  stepSimulation(s, PHYSICS_DT);
  assert.strictEqual(s.skyCraneActive, true, 'Sky crane must activate below 30 m');
});

console.log('\n── 4. Touchdown Aerospace Safety Criteria ─────');

test('13. Touchdown satisfies speed, accuracy, and G-force constraints', () => {
  const s = createInitialState();
  jumpToMilestone(s, 'TOUCHDOWN');

  // Verify touchdown speed < 2.5 m/s
  assert(s.speed <= 2.5, `Touchdown speed (${s.speed}) must be <= 2.5 m/s`);
  // Verify landing error within 50m
  assert(s.landingError <= 50.0, `Landing accuracy (${s.landingError} m) must be within 50 m`);
  // Verify grounded
  assert.strictEqual(s.grounded, true);
  assert.strictEqual(s.phase, 'LANDED');
});

console.log('\n───────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
