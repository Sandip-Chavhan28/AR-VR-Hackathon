/**
 * tests/landingSite.test.js – Node.js assertion tests for Phase 3B-1:
 * Autonomous Landing-Site Terrain & Hazard Analysis System.
 *
 * Run with:
 *   node tests/landingSite.test.js
 *
 * Tests cover:
 *   1. Terrain function is deterministic.
 *   2. Same coordinates return same elevation.
 *   3. Terrain changes across the analysis area.
 *   4. Slope calculation works.
 *   5. Flat terrain produces approximately zero slope.
 *   6. Crater region produces elevated crater risk.
 *   7. Obstacle region produces obstacle risk.
 *   8. Safe candidate satisfies all constraints.
 *   9. Unsafe candidate fails at least one constraint.
 *   10. Safety grid has expected dimensions (21×21 = 441 cells).
 *   11. Initial target is analyzed.
 *   12. Initial target is rejected when configured hazard exists.
 *   13. Search finds at least one safe candidate.
 *   14. Selected target is actually classified SAFE.
 *   15. Selected target differs from initial target when initial target is unsafe.
 *   16. Selection is deterministic.
 *   17. Repeated analysis produces the same result.
 */

import assert from 'node:assert/strict';

import {
  MAX_LANDING_SLOPE_DEG,
  MAX_CRATER_RISK,
  MAX_OBSTACLE_RISK,
  MIN_LANDING_CLEARANCE,
  GRID_DIMENSION,
  GRID_SPACING,
  INITIAL_PLANNED_TARGET,
} from '../src/simulation/landingSite/constants.js';

import {
  getTerrainHeight,
  getMolaTerrainHeight,
  getTerrainSlope,
  getCraterRisk,
  getObstacleRisk,
  getHazardClearance,
  getTerrainSourceInfo,
  CRATERS,
  OBSTACLES,
} from '../src/simulation/landingSite/terrain.js';

import {
  analyzeCandidate,
  generateSafetyGrid,
  performLandingSiteAnalysis,
} from '../src/simulation/landingSite/landingSiteAnalysis.js';

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

console.log('\n── 1. Terrain Function & Determinism ───────────');

test('NASA MOLA tile is loaded, georeferenced, and anchor-normalized', () => {
  const info = getTerrainSourceInfo();
  assert.strictEqual(info.source, 'NASA MOLA');
  assert.strictEqual(info.loaded, true);
  assert.strictEqual(info.columns, 283);
  assert.strictEqual(info.rows, 283);
  assert.strictEqual(info.samples, 80089);
  assert(info.minimumMeters < -3000 && info.maximumMeters < 0, 'MOLA elevations should contain measured Jezero topography');
  approxEqual(getMolaTerrainHeight(0, 0), 0, 1e-8, 'Jezero anchor-relative MOLA height');
  assert.notStrictEqual(getMolaTerrainHeight(30000, 30000), null, 'Nearby local coordinates should sample the MOLA crop');
  assert.strictEqual(getMolaTerrainHeight(200000, 200000), null, 'Out-of-crop coordinates should use deterministic fallback');
});

test('1. Terrain function is deterministic across separate calls', () => {
  const h1 = getTerrainHeight(28.0, 16.0);
  const h2 = getTerrainHeight(28.0, 16.0);
  assert.strictEqual(h1, h2, 'Terrain height must be bit-for-bit identical');
});

test('2. Same coordinates return same elevation', () => {
  const coords = [
    [0, 0],
    [-50, 20],
    [30, -40],
    [100, 100],
  ];
  for (const [x, z] of coords) {
    const elA = getTerrainHeight(x, z);
    const elB = getTerrainHeight(x, z);
    assert.strictEqual(elA, elB, `Height at (${x}, ${z}) must be identical`);
  }
});

test('3. Terrain changes across the analysis area', () => {
  const hCenter = getTerrainHeight(0, 0);
  const hCrater = getTerrainHeight(24, 15); // near Crater Alpha center
  const molaFar = getMolaTerrainHeight(10000, 10000);

  assert(
    Math.abs(hCrater - hCenter) > 2.0,
    `Crater elevation (${hCrater}) should differ noticeably from center (${hCenter})`
  );
  assert.notStrictEqual(molaFar, null, 'Regional MOLA sample should be inside Jezero crop');
  assert(Math.abs(molaFar - getMolaTerrainHeight(0, 0)) > 20, 'MOLA large-scale elevation should vary across the landing region');
});

console.log('\n── 2. Slope Calculation ────────────────────────');

test('4. Slope calculation works and returns positive degrees', () => {
  const slope = getTerrainSlope(28.0, 16.0);
  assert(typeof slope === 'number' && !isNaN(slope), 'Slope must be a valid number');
  assert(slope >= 0, `Slope must be non-negative, got ${slope}°`);
});

test('5. Flat terrain produces approximately zero slope', () => {
  // Sample gentle rolling plains at (-40, -20) away from craters and obstacles
  const flatSlope = getTerrainSlope(-40.0, -20.0, 1.0);
  assert(typeof flatSlope === 'number');
  // On smooth rolling plains, slope should be gentle (< 5°)
  assert(flatSlope < 5.0, `Gentle terrain slope should be small, got ${flatSlope}°`);
});


console.log('\n── 3. Hazard Detection (Craters & Obstacles) ───');

test('6. Crater region produces elevated crater risk', () => {
  const crater = CRATERS[0];
  const riskInside = getCraterRisk(crater.cx, crater.cz);
  const riskFarAway = getCraterRisk(-150, -150);

  assert(
    riskInside > 0.7,
    `Crater center risk should be high (> 0.7), got ${riskInside}`
  );
  assert.strictEqual(riskFarAway, 0.0, 'Crater risk far away from craters must be 0.0');
});

test('7. Obstacle region produces obstacle risk', () => {
  const obs = OBSTACLES[0];
  const riskNear = getObstacleRisk(obs.ox, obs.oz);
  const riskFar = getObstacleRisk(120, -120);

  assert(
    riskNear > 0.5,
    `Obstacle risk near obstacle should be elevated (> 0.5), got ${riskNear}`
  );
  approxEqual(riskFar, 0.0, 1e-4, 'Obstacle risk far away should be ~0');
});

console.log('\n── 4. Candidate Classification ─────────────────');

test('8. Safe candidate satisfies all constraints', () => {
  // Candidate in flat smooth plains at (-40, -20)
  const candidate = analyzeCandidate(-40, -20, INITIAL_PLANNED_TARGET);

  assert(candidate.slope <= MAX_LANDING_SLOPE_DEG, `Slope ${candidate.slope}° <= ${MAX_LANDING_SLOPE_DEG}°`);
  assert(candidate.craterRisk <= MAX_CRATER_RISK, `Crater risk ${candidate.craterRisk} <= ${MAX_CRATER_RISK}`);
  assert(candidate.obstacleRisk <= MAX_OBSTACLE_RISK, `Obstacle risk ${candidate.obstacleRisk} <= ${MAX_OBSTACLE_RISK}`);
  assert(candidate.clearance >= MIN_LANDING_CLEARANCE, `Clearance ${candidate.clearance}m >= ${MIN_LANDING_CLEARANCE}m`);
  assert.strictEqual(candidate.status, 'SAFE', 'Candidate must be classified SAFE');
  assert(candidate.safetyScore > 50, 'Safe candidate should have high safety score');
});

test('9. Unsafe candidate fails at least one constraint', () => {
  // Initial planned target placed near Crater Alpha rim/wall
  const candidate = analyzeCandidate(INITIAL_PLANNED_TARGET.x, INITIAL_PLANNED_TARGET.z, INITIAL_PLANNED_TARGET);

  assert.strictEqual(candidate.status, 'UNSAFE', 'Candidate must be classified UNSAFE');
  assert(candidate.failureReasons.length > 0, 'Must record failure reasons');
  assert(
    candidate.slope > MAX_LANDING_SLOPE_DEG || candidate.craterRisk > MAX_CRATER_RISK,
    'Must fail either slope or crater risk constraint'
  );
});

console.log('\n── 5. Safety Grid Generation ───────────────────');

test('10. Safety grid has expected dimensions (21×21 = 441 cells)', () => {
  const { grid, safeCount, cautionCount, unsafeCount } = generateSafetyGrid(
    INITIAL_PLANNED_TARGET,
    GRID_DIMENSION,
    GRID_SPACING
  );

  assert.strictEqual(grid.length, GRID_DIMENSION * GRID_DIMENSION, `Grid should have ${GRID_DIMENSION * GRID_DIMENSION} cells`);
  assert.strictEqual(grid.length, 441, 'Grid should have exactly 441 cells');
  assert.strictEqual(safeCount + cautionCount + unsafeCount, 441, 'Sum of cell counts must equal total cells');
  assert(safeCount > 0, 'Grid should contain safe cells');
  assert(unsafeCount > 0, 'Grid should contain unsafe cells');
});

console.log('\n── 6. Initial Target Analysis & Rejection ───────');

test('11. Initial target is analyzed properly', () => {
  const analysis = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);
  assert(analysis.initialTarget !== undefined, 'Initial target analysis must be populated');
  approxEqual(analysis.initialTarget.x, INITIAL_PLANNED_TARGET.x, 1e-4, 'Initial target X');
  approxEqual(analysis.initialTarget.z, INITIAL_PLANNED_TARGET.z, 1e-4, 'Initial target Z');
});

test('12. Initial target is rejected when configured hazard exists', () => {
  const analysis = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);

  assert.strictEqual(analysis.initialTargetStatus, 'UNSAFE', 'Initial target status must be UNSAFE');
  assert.strictEqual(analysis.targetChanged, true, 'targetChanged flag must be true');
  assert(analysis.rejectionReason !== null, 'Rejection reason must be provided');
  assert(analysis.initialTarget.slope > MAX_LANDING_SLOPE_DEG, 'Slope must exceed threshold');
  assert(analysis.initialTarget.craterRisk > MAX_CRATER_RISK, 'Crater risk must exceed threshold');
});

console.log('\n── 7. Safe Candidate Discovery & Selection ─────');

test('13. Search finds at least one safe candidate', () => {
  const analysis = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);
  assert(analysis.safeZoneCount > 0, `Search must discover safe zones (found ${analysis.safeZoneCount})`);
});

test('14. Selected target is actually classified SAFE', () => {
  const analysis = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);
  assert.strictEqual(analysis.selectedTarget.status, 'SAFE', 'Selected target must have status SAFE');
  assert(analysis.selectedTarget.slope <= MAX_LANDING_SLOPE_DEG, 'Selected target slope must be within limit');
  assert(analysis.selectedTarget.craterRisk <= MAX_CRATER_RISK, 'Selected target crater risk must be within limit');
  assert(analysis.selectedTarget.clearance >= MIN_LANDING_CLEARANCE, 'Selected target clearance must be sufficient');
});

test('15. Selected target differs from initial target when initial target is unsafe', () => {
  const analysis = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);

  const coordsDiffer =
    Math.abs(analysis.selectedTarget.x - analysis.initialTarget.x) > 1.0 ||
    Math.abs(analysis.selectedTarget.z - analysis.initialTarget.z) > 1.0;

  assert(coordsDiffer, 'Selected target coordinates must differ from rejected initial target');
});

test('16. Selection is deterministic and reproducible', () => {
  const analysisA = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);
  const analysisB = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);

  assert.strictEqual(analysisA.selectedTarget.x, analysisB.selectedTarget.x, 'Selected X must be deterministic');
  assert.strictEqual(analysisA.selectedTarget.z, analysisB.selectedTarget.z, 'Selected Z must be deterministic');
  assert.strictEqual(analysisA.selectedTargetScore, analysisB.selectedTargetScore, 'Score must be deterministic');
});

test('17. Repeated analysis produces the same result', () => {
  const analysis1 = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);
  const analysis2 = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);

  assert.strictEqual(analysis1.safeZoneCount, analysis2.safeZoneCount, 'Safe zone count identical');
  assert.strictEqual(analysis1.rejectionReason, analysis2.rejectionReason, 'Rejection reason identical');
  assert.strictEqual(analysis1.selectedTargetReason, analysis2.selectedTargetReason, 'Selected target reason identical');
  assert.deepStrictEqual(analysis1.decisionLog, analysis2.decisionLog, 'Decision logs identical');
});

console.log('\n─────────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
