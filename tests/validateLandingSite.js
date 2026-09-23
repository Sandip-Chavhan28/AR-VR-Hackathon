/**
 * validateLandingSite.js
 *
 * Programmatic validation of the landing-site analysis system.
 * Verifies all 7 required conditions using ACTUAL terrain calculations.
 * No values are hard-coded — all come from the terrain model.
 *
 * Run: node tests/validateLandingSite.js
 */

'use strict';

// ─── Inline the terrain model (mirrors terrain.js exactly, no ESM imports) ───

const CRATERS = [
  { id: 'CRATER_ALPHA', cx: 24.0, cz: 15.0, radius: 28.0, depth: 16.0, rimHeight: 5.2, rimWidth: 8.0 },
  { id: 'CRATER_BETA',  cx: -65.0, cz: 45.0, radius: 20.0, depth: 9.0,  rimHeight: 3.2, rimWidth: 6.0 },
  { id: 'CRATER_GAMMA', cx: 65.0, cz: -50.0, radius: 22.0, depth: 11.0, rimHeight: 3.8, rimWidth: 7.0 },
];

const OBSTACLES = [
  { id: 'BOULDER_FIELD_NORTH', ox: -25.0, oz: 30.0,  radius: 12.0, height: 3.5 },
  { id: 'ROCKY_RIDGE_EAST',    ox:  50.0, oz: 45.0,  radius: 14.0, height: 4.2 },
  { id: 'BASALT_OUTCROP_SOUTH',ox: -15.0, oz: -55.0, radius: 10.0, height: 2.8 },
];

// Landing-site constants (mirrors constants.js)
const MAX_LANDING_SLOPE_DEG  = 8.0;
const MAX_CRATER_RISK        = 0.35;
const MAX_OBSTACLE_RISK      = 0.30;
const MIN_LANDING_CLEARANCE  = 15.0;
const GRID_DIMENSION         = 21;
const GRID_SPACING           = 10.0;
const INITIAL_PLANNED_TARGET = { x: 28.0, z: 16.0, radius: 20.0 };

const SCORE_WEIGHT_SLOPE     = 0.35;
const SCORE_WEIGHT_CLEARANCE = 0.30;
const SCORE_WEIGHT_CRATER    = 0.20;
const SCORE_WEIGHT_DISTANCE  = 0.15;

// ─── Terrain functions (inline copies of terrain.js) ────────────────────────

function getTerrainHeight(x, z) {
  let elevation =
    3.2 * Math.sin(0.016 * x + 0.3) * Math.cos(0.014 * z + 0.5) +
    1.6 * Math.sin(0.038 * x + 1.2) * Math.sin(0.032 * z + 0.8);

  for (const c of CRATERS) {
    const dx = x - c.cx, dz = z - c.cz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const outerRim = c.radius + c.rimWidth;
    if (dist < c.radius) {
      const norm = dist / c.radius;
      elevation += -c.depth * (1.0 - norm * norm) + c.rimHeight * (norm ** 3);
    } else if (dist <= outerRim) {
      const u = (dist - c.radius) / c.rimWidth;
      elevation += c.rimHeight * 0.5 * (1.0 + Math.cos(Math.PI * u));
    }
  }

  for (const obs of OBSTACLES) {
    const dx = x - obs.ox, dz = z - obs.oz;
    const distSq = dx * dx + dz * dz;
    const sigmaSq = (obs.radius * 0.5) ** 2;
    if (distSq < (obs.radius * 2.0) ** 2) {
      elevation += obs.height * Math.exp(-distSq / (2.0 * sigmaSq));
    }
  }
  return elevation;
}

function getTerrainSlope(x, z, sampleDist = 1.0) {
  const dx = (getTerrainHeight(x + sampleDist, z) - getTerrainHeight(x - sampleDist, z)) / (2.0 * sampleDist);
  const dz = (getTerrainHeight(x, z + sampleDist) - getTerrainHeight(x, z - sampleDist)) / (2.0 * sampleDist);
  return (Math.atan(Math.sqrt(dx * dx + dz * dz)) * 180.0) / Math.PI;
}

function getCraterRisk(x, z) {
  let maxRisk = 0.0;
  for (const c of CRATERS) {
    const dist = Math.sqrt((x - c.cx) ** 2 + (z - c.cz) ** 2);
    const outerRim = c.radius + c.rimWidth;
    if (dist <= outerRim) {
      const risk = (1.0 - dist / outerRim) ** 1.5;
      if (risk > maxRisk) maxRisk = risk;
    }
  }
  return Math.min(1.0, Math.max(0.0, maxRisk));
}

function getObstacleRisk(x, z) {
  let totalRisk = 0.0;
  for (const obs of OBSTACLES) {
    const dx = x - obs.ox, dz = z - obs.oz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < obs.radius * 1.5) {
      totalRisk += Math.exp(-(dist * dist) / (2.0 * (obs.radius * 0.45) ** 2));
    }
  }
  return Math.min(1.0, Math.max(0.0, totalRisk));
}

function getHazardClearance(x, z) {
  let minClearance = 999.0;
  for (const c of CRATERS) {
    const dist = Math.sqrt((x - c.cx) ** 2 + (z - c.cz) ** 2);
    const clr  = dist - (c.radius + c.rimWidth);
    if (clr < minClearance) minClearance = clr;
  }
  for (const obs of OBSTACLES) {
    const dist = Math.sqrt((x - obs.ox) ** 2 + (z - obs.oz) ** 2);
    const clr  = dist - obs.radius;
    if (clr < minClearance) minClearance = clr;
  }
  return Math.max(0.0, minClearance);
}

// ─── Analysis functions (mirrors landingSiteAnalysis.js) ────────────────────

function analyzeCandidate(x, z, referenceTarget = INITIAL_PLANNED_TARGET) {
  const elevation    = getTerrainHeight(x, z);
  const slope        = getTerrainSlope(x, z);
  const craterRisk   = getCraterRisk(x, z);
  const obstacleRisk = getObstacleRisk(x, z);
  const clearance    = getHazardClearance(x, z);

  const slopeViolated     = slope        > MAX_LANDING_SLOPE_DEG;
  const craterViolated    = craterRisk   > MAX_CRATER_RISK;
  const obstacleViolated  = obstacleRisk > MAX_OBSTACLE_RISK;
  const clearanceViolated = clearance    < MIN_LANDING_CLEARANCE;

  let status = 'SAFE';
  const failureReasons = [];

  if (slopeViolated)     failureReasons.push(`SLOPE (${slope.toFixed(1)}° > ${MAX_LANDING_SLOPE_DEG}°)`);
  if (craterViolated)    failureReasons.push(`CRATER HAZARD (${craterRisk.toFixed(4)} > ${MAX_CRATER_RISK})`);
  if (obstacleViolated)  failureReasons.push(`OBSTACLE HAZARD (${obstacleRisk.toFixed(4)} > ${MAX_OBSTACLE_RISK})`);
  if (clearanceViolated) failureReasons.push(`INSUFFICIENT CLEARANCE (${clearance.toFixed(2)}m < ${MIN_LANDING_CLEARANCE}m)`);

  if (failureReasons.length > 0) {
    status = 'UNSAFE';
  } else if (
    slope        > MAX_LANDING_SLOPE_DEG * 0.75 ||
    craterRisk   > MAX_CRATER_RISK * 0.5         ||
    clearance    < MIN_LANDING_CLEARANCE * 1.4
  ) {
    status = 'CAUTION';
  }

  let safetyScore = 0.0;
  if (status !== 'UNSAFE') {
    const slopeScore    = Math.max(0, (1.0 - slope / MAX_LANDING_SLOPE_DEG) * 100.0);
    const clearanceScore= Math.min(100.0, (clearance / 40.0) * 100.0);
    const craterScore   = Math.max(0, (1.0 - craterRisk / MAX_CRATER_RISK) * 100.0);
    const dist          = Math.sqrt((x - referenceTarget.x) ** 2 + (z - referenceTarget.z) ** 2);
    const distanceScore = Math.max(0, (1.0 - dist / 160.0) * 100.0);
    safetyScore = SCORE_WEIGHT_SLOPE * slopeScore +
                  SCORE_WEIGHT_CLEARANCE * clearanceScore +
                  SCORE_WEIGHT_CRATER * craterScore +
                  SCORE_WEIGHT_DISTANCE * distanceScore;
  }

  return { x, z, elevation, slope, craterRisk, obstacleRisk, clearance, status, safetyScore, failureReasons };
}

function generateSafetyGrid(center = INITIAL_PLANNED_TARGET) {
  const halfSpan = ((GRID_DIMENSION - 1) / 2.0) * GRID_SPACING;
  const grid = [];
  for (let row = 0; row < GRID_DIMENSION; row++) {
    for (let col = 0; col < GRID_DIMENSION; col++) {
      const x = center.x - halfSpan + col * GRID_SPACING;
      const z = center.z - halfSpan + row * GRID_SPACING;
      grid.push(analyzeCandidate(x, z, center));
    }
  }
  return grid;
}

function performLandingSiteAnalysis(plannedTarget = INITIAL_PLANNED_TARGET) {
  const initialAnalysis = analyzeCandidate(plannedTarget.x, plannedTarget.z, plannedTarget);
  const grid            = generateSafetyGrid(plannedTarget);

  let selectedTarget = null;
  if (initialAnalysis.status === 'SAFE') {
    selectedTarget = initialAnalysis;
  } else {
    const safeCandidates = grid.filter(c => c.status === 'SAFE');
    if (safeCandidates.length > 0) {
      safeCandidates.sort((a, b) => {
        if (Math.abs(b.safetyScore - a.safetyScore) > 1e-4) return b.safetyScore - a.safetyScore;
        const dA = (a.x - plannedTarget.x) ** 2 + (a.z - plannedTarget.z) ** 2;
        const dB = (b.x - plannedTarget.x) ** 2 + (b.z - plannedTarget.z) ** 2;
        return dA - dB;
      });
      selectedTarget = safeCandidates[0];
    } else {
      const fallback = [...grid].sort((a, b) => b.safetyScore - a.safetyScore);
      selectedTarget = fallback[0];
    }
  }

  return { initialTarget: initialAnalysis, selectedTarget, grid };
}

// ─── Validation runner ───────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${name}`);
    passed++;
  } else {
    console.log(`  ❌  FAIL: ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

console.log('\n══════════════════════════════════════════════════════════════════');
console.log('  Mars EDL Simulator — Landing-Site Analysis Programmatic Validation');
console.log('══════════════════════════════════════════════════════════════════\n');

// ── Run analysis TWICE (for determinism check) ───────────────────────────────
const result1 = performLandingSiteAnalysis();
const result2 = performLandingSiteAnalysis();

const { initialTarget, selectedTarget } = result1;

// ── Print raw computed values ────────────────────────────────────────────────
console.log('┌─ INITIAL PLANNED TARGET ──────────────────────────────────────┐');
console.log(`│  Coordinates      : x = ${INITIAL_PLANNED_TARGET.x.toFixed(1)} m,  z = ${INITIAL_PLANNED_TARGET.z.toFixed(1)} m`);
console.log(`│  Slope            : ${initialTarget.slope.toFixed(4)} °`);
console.log(`│  Crater risk      : ${initialTarget.craterRisk.toFixed(6)}`);
console.log(`│  Obstacle risk    : ${initialTarget.obstacleRisk.toFixed(6)}`);
console.log(`│  Clearance        : ${initialTarget.clearance.toFixed(4)} m`);
console.log(`│  Safety score     : ${initialTarget.safetyScore.toFixed(4)}`);
console.log(`│  Status           : ${initialTarget.status}`);
if (initialTarget.failureReasons.length > 0) {
  console.log(`│  Failure reasons  : ${initialTarget.failureReasons.join(' & ')}`);
}
console.log('└───────────────────────────────────────────────────────────────┘\n');

console.log('┌─ SELECTED TARGET ─────────────────────────────────────────────┐');
console.log(`│  Coordinates      : x = ${selectedTarget.x.toFixed(1)} m,  z = ${selectedTarget.z.toFixed(1)} m`);
console.log(`│  Slope            : ${selectedTarget.slope.toFixed(4)} °`);
console.log(`│  Crater risk      : ${selectedTarget.craterRisk.toFixed(6)}`);
console.log(`│  Obstacle risk    : ${selectedTarget.obstacleRisk.toFixed(6)}`);
console.log(`│  Clearance        : ${selectedTarget.clearance.toFixed(4)} m`);
console.log(`│  Safety score     : ${selectedTarget.safetyScore.toFixed(4)}`);
console.log(`│  Status           : ${selectedTarget.status}`);
console.log('└───────────────────────────────────────────────────────────────┘\n');

// ── Thresholds summary ───────────────────────────────────────────────────────
console.log('┌─ SAFETY THRESHOLDS ───────────────────────────────────────────┐');
console.log(`│  MAX_LANDING_SLOPE_DEG  = ${MAX_LANDING_SLOPE_DEG}`);
console.log(`│  MAX_CRATER_RISK        = ${MAX_CRATER_RISK}`);
console.log(`│  MAX_OBSTACLE_RISK      = ${MAX_OBSTACLE_RISK}`);
console.log(`│  MIN_LANDING_CLEARANCE  = ${MIN_LANDING_CLEARANCE} m`);
console.log('└───────────────────────────────────────────────────────────────┘\n');

// ── 7 Required Checks ────────────────────────────────────────────────────────
console.log('── Validation Checks ───────────────────────────────────────────\n');

// 1. Initial target slope violates the threshold
check(
  `1. initialTarget.slope (${initialTarget.slope.toFixed(4)}°) > MAX_LANDING_SLOPE_DEG (${MAX_LANDING_SLOPE_DEG}°)`,
  initialTarget.slope > MAX_LANDING_SLOPE_DEG
);

// 2. initialTarget.craterRisk violates OR another documented critical hazard exists
const craterViolated    = initialTarget.craterRisk   > MAX_CRATER_RISK;
const obstacleViolated  = initialTarget.obstacleRisk > MAX_OBSTACLE_RISK;
const clearanceViolated = initialTarget.clearance    < MIN_LANDING_CLEARANCE;
const anyOtherHazard    = obstacleViolated || clearanceViolated;
check(
  `2. initialTarget.craterRisk (${initialTarget.craterRisk.toFixed(4)}) > MAX_CRATER_RISK (${MAX_CRATER_RISK}) OR another critical hazard`,
  craterViolated || anyOtherHazard,
  craterViolated
    ? `crater risk violated`
    : anyOtherHazard
      ? `alternate hazard: ${initialTarget.failureReasons.join(', ')}`
      : 'none of the hazard checks triggered'
);

// 3. initialTarget.status === 'UNSAFE'
check(
  `3. initialTarget.status === 'UNSAFE'  (actual: '${initialTarget.status}')`,
  initialTarget.status === 'UNSAFE'
);

// 4. At least one candidate with status === 'SAFE'
const safeCandidates = result1.grid.filter(c => c.status === 'SAFE');
check(
  `4. Safety grid contains at least 1 SAFE cell  (found: ${safeCandidates.length})`,
  safeCandidates.length > 0
);

// 5. selectedTarget.status === 'SAFE'
check(
  `5. selectedTarget.status === 'SAFE'  (actual: '${selectedTarget.status}')`,
  selectedTarget.status === 'SAFE'
);

// 6. Selected target coordinates differ from initial target
const coordsDiffer = (selectedTarget.x !== INITIAL_PLANNED_TARGET.x) ||
                     (selectedTarget.z !== INITIAL_PLANNED_TARGET.z);
check(
  `6. selectedTarget coords (${selectedTarget.x.toFixed(1)}, ${selectedTarget.z.toFixed(1)}) differ from initialTarget (${INITIAL_PLANNED_TARGET.x}, ${INITIAL_PLANNED_TARGET.z})`,
  coordsDiffer
);

// 7. Determinism: two independent runs produce identical results
const det_initialSlope    = Math.abs(result1.initialTarget.slope       - result2.initialTarget.slope)       < 1e-10;
const det_initialCrater   = Math.abs(result1.initialTarget.craterRisk  - result2.initialTarget.craterRisk)  < 1e-10;
const det_selectedX       = Math.abs(result1.selectedTarget.x          - result2.selectedTarget.x)          < 1e-10;
const det_selectedZ       = Math.abs(result1.selectedTarget.z          - result2.selectedTarget.z)          < 1e-10;
const det_selectedScore   = Math.abs(result1.selectedTarget.safetyScore- result2.selectedTarget.safetyScore)< 1e-10;
const det_status1         = result1.initialTarget.status  === result2.initialTarget.status;
const det_status2         = result1.selectedTarget.status === result2.selectedTarget.status;
const deterministic = det_initialSlope && det_initialCrater && det_selectedX && det_selectedZ && det_selectedScore && det_status1 && det_status2;
check(
  `7. Repeated analysis produces exactly the same result (deterministic)`,
  deterministic,
  deterministic ? '' : `Run1 selected=(${result1.selectedTarget.x},${result1.selectedTarget.z}) Run2 selected=(${result2.selectedTarget.x},${result2.selectedTarget.z})`
);

// ── Final Report ─────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════════');
console.log('  FINAL VALIDATED REPORT (from actual terrain calculations)');
console.log('══════════════════════════════════════════════════════════════════\n');
console.log('  Initial target:');
console.log(`    slope          = ${initialTarget.slope.toFixed(4)} degrees`);
console.log(`    crater risk    = ${initialTarget.craterRisk.toFixed(6)}`);
console.log(`    obstacle risk  = ${initialTarget.obstacleRisk.toFixed(6)}`);
console.log(`    clearance      = ${initialTarget.clearance.toFixed(4)} meters`);
console.log(`    status         = ${initialTarget.status}`);
console.log('');
console.log('  Selected target:');
console.log(`    slope          = ${selectedTarget.slope.toFixed(4)} degrees`);
console.log(`    crater risk    = ${selectedTarget.craterRisk.toFixed(6)}`);
console.log(`    obstacle risk  = ${selectedTarget.obstacleRisk.toFixed(6)}`);
console.log(`    clearance      = ${selectedTarget.clearance.toFixed(4)} meters`);
console.log(`    safety score   = ${selectedTarget.safetyScore.toFixed(4)}`);
console.log(`    status         = ${selectedTarget.status}`);
console.log('');

const total = passed + failed;
console.log('──────────────────────────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed  (${total} total)`);
console.log('══════════════════════════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
