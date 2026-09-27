/**
 * landingSiteAnalysis.js – Autonomous Mars Landing-Site Terrain & Hazard Analysis System.
 *
 * Requirements:
 *   - Autonomous analysis of planned landing target.
 *   - High-resolution 21×21 safety classification grid generation around target.
 *   - Identification of hazards (excessive slope, craters, obstacle fields).
 *   - Evaluation of candidate landing zones (SAFE, CAUTION, UNSAFE).
 *   - Rejection of hazardous targets with explicit documented reasons.
 *   - Deterministic selection of optimal safe landing site using multi-variable safety scoring.
 *   - Generation of chronological Mission Control decision logs.
 *   - Pure deterministic physics/math logic with ZERO React dependencies.
 */

import {
  MAX_LANDING_SLOPE_DEG,
  MAX_CRATER_RISK,
  MAX_OBSTACLE_RISK,
  MIN_LANDING_CLEARANCE,
  GRID_DIMENSION,
  GRID_SPACING,
  INITIAL_PLANNED_TARGET,
  SCORE_WEIGHT_SLOPE,
  SCORE_WEIGHT_CLEARANCE,
  SCORE_WEIGHT_CRATER,
  SCORE_WEIGHT_DISTANCE,
} from './constants.js';

import {
  getTerrainHeight,
  getTerrainSlope,
  getCraterRisk,
  getObstacleRisk,
  getHazardClearance,
} from './terrain.js';

/**
 * Analyze a candidate surface location (x, z) against landing safety constraints.
 *
 * @param {number} x East-West offset in meters.
 * @param {number} z North-South offset in meters.
 * @param {{ x: number, z: number }} [referenceTarget] Reference initial target for distance scoring.
 * @returns {object} Evaluated candidate record.
 */
export function analyzeCandidate(x, z, referenceTarget = INITIAL_PLANNED_TARGET) {
  const elevation = getTerrainHeight(x, z);
  const slope = getTerrainSlope(x, z);
  const craterRisk = getCraterRisk(x, z);
  const obstacleRisk = getObstacleRisk(x, z);
  const clearance = getHazardClearance(x, z);

  // Critical constraint checks
  const slopeViolated = slope > MAX_LANDING_SLOPE_DEG;
  const craterViolated = craterRisk > MAX_CRATER_RISK;
  const obstacleViolated = obstacleRisk > MAX_OBSTACLE_RISK;
  const clearanceViolated = clearance < MIN_LANDING_CLEARANCE;

  let status = 'SAFE';
  let failureReasons = [];

  if (slopeViolated) {
    failureReasons.push(`SLOPE (${slope.toFixed(1)}° > ${MAX_LANDING_SLOPE_DEG}°)`);
  }
  if (craterViolated) {
    failureReasons.push(`CRATER HAZARD (${craterRisk.toFixed(2)} > ${MAX_CRATER_RISK})`);
  }
  if (obstacleViolated) {
    failureReasons.push(`OBSTACLE HAZARD (${obstacleRisk.toFixed(2)} > ${MAX_OBSTACLE_RISK})`);
  }
  if (clearanceViolated) {
    failureReasons.push(`INSUFFICIENT CLEARANCE (${clearance.toFixed(1)}m < ${MIN_LANDING_CLEARANCE}m)`);
  }

  if (failureReasons.length > 0) {
    status = 'UNSAFE';
  } else if (
    slope > MAX_LANDING_SLOPE_DEG * 0.75 ||
    craterRisk > MAX_CRATER_RISK * 0.5 ||
    clearance < MIN_LANDING_CLEARANCE * 1.4
  ) {
    status = 'CAUTION';
  }

  // Safety Score Calculation (0 to 100)
  let safetyScore = 0.0;
  if (status !== 'UNSAFE') {
    // 1. Slope Score: 0° is 100, MAX_LANDING_SLOPE_DEG is 0
    const slopeScore = Math.max(0, (1.0 - slope / MAX_LANDING_SLOPE_DEG) * 100.0);

    // 2. Clearance Score: 0m is 0, >= 40m is 100
    const clearanceScore = Math.min(100.0, (clearance / 40.0) * 100.0);

    // 3. Crater Safety Score: 0 risk is 100, MAX_CRATER_RISK is 0
    const craterScore = Math.max(0, (1.0 - craterRisk / MAX_CRATER_RISK) * 100.0);

    // 4. Proximity / Distance Score: prefer zones closer to planned nominal site
    const dist = Math.sqrt((x - referenceTarget.x) ** 2 + (z - referenceTarget.z) ** 2);
    const distanceScore = Math.max(0, (1.0 - dist / 160.0) * 100.0);

    safetyScore =
      SCORE_WEIGHT_SLOPE * slopeScore +
      SCORE_WEIGHT_CLEARANCE * clearanceScore +
      SCORE_WEIGHT_CRATER * craterScore +
      SCORE_WEIGHT_DISTANCE * distanceScore;
  }

  return {
    x,
    z,
    elevation,
    slope,
    craterRisk,
    obstacleRisk,
    clearance,
    status,
    safetyScore,
    failureReasons,
  };
}

/**
 * Generate a local 2D safety classification grid centered at (centerX, centerZ).
 *
 * @param {{ x: number, z: number }} centerTarget Target center.
 * @param {number} [dimension=GRID_DIMENSION] Grid dimension (default 21).
 * @param {number} [spacing=GRID_SPACING] Cell spacing in meters (default 10m).
 * @returns {{ grid: Array<object>, safeCount: number, cautionCount: number, unsafeCount: number }}
 */
export function generateSafetyGrid(centerTarget = INITIAL_PLANNED_TARGET, dimension = GRID_DIMENSION, spacing = GRID_SPACING) {
  const halfSpan = ((dimension - 1) / 2.0) * spacing;
  const grid = [];
  let safeCount = 0;
  let cautionCount = 0;
  let unsafeCount = 0;

  for (let row = 0; row < dimension; row++) {
    for (let col = 0; col < dimension; col++) {
      const x = centerTarget.x - halfSpan + col * spacing;
      const z = centerTarget.z - halfSpan + row * spacing;

      const cell = analyzeCandidate(x, z, centerTarget);
      cell.gridRow = row;
      cell.gridCol = col;

      if (cell.status === 'SAFE') safeCount++;
      else if (cell.status === 'CAUTION') cautionCount++;
      else unsafeCount++;

      grid.push(cell);
    }
  }

  return {
    grid,
    safeCount,
    cautionCount,
    unsafeCount,
  };
}

// Analysis cache for instantaneous retrieval without 250ms procedural terrain lag
const _analysisCache = new Map();

function getAnalysisCacheKey(plannedTarget) {
  const x = Math.round((plannedTarget?.x || 0) * 10) / 10;
  const z = Math.round((plannedTarget?.z || 0) * 10) / 10;
  return `${x},${z}`;
}

/**
 * Perform autonomous landing-site evaluation, hazard identification, and safe target selection.
 *
 * @param {{ x: number, z: number, radius?: number }} [plannedTarget=INITIAL_PLANNED_TARGET]
 * @returns {object} Comprehensive landing site analysis state.
 */
export function performLandingSiteAnalysis(plannedTarget = INITIAL_PLANNED_TARGET) {
  const key = getAnalysisCacheKey(plannedTarget);
  const cached = _analysisCache.get(key);
  if (cached) {
    return {
      ...cached,
      decisionLog: [...cached.decisionLog],
    };
  }

  // 1. Analyze initial planned target
  const initialAnalysis = analyzeCandidate(plannedTarget.x, plannedTarget.z, plannedTarget);

  // 2. Generate local terrain safety grid
  const { grid, safeCount, cautionCount, unsafeCount } = generateSafetyGrid(
    plannedTarget,
    GRID_DIMENSION,
    GRID_SPACING
  );

  const decisionLog = [];
  decisionLog.push(
    `[LANDING ANALYSIS] Initial target at (X: ${plannedTarget.x.toFixed(1)}m, Z: ${plannedTarget.z.toFixed(1)}m) evaluated.`
  );

  let selectedTarget = null;
  let targetChanged = false;
  let rejectionReason = null;
  let selectedTargetReason = null;

  if (initialAnalysis.status === 'SAFE') {
    selectedTarget = initialAnalysis;
    targetChanged = false;
    selectedTargetReason = 'INITIAL TARGET VALIDATED SAFE (All criteria satisfied)';
    decisionLog.push(
      `[LANDING ANALYSIS] Initial target verified SAFE — Slope: ${initialAnalysis.slope.toFixed(1)}°, Clearance: ${initialAnalysis.clearance.toFixed(1)}m.`
    );
  } else {
    // Initial target rejected
    targetChanged = true;
    rejectionReason = initialAnalysis.failureReasons.join(' & ');
    decisionLog.push(
      `[LANDING ANALYSIS] Initial target REJECTED: ${rejectionReason}`
    );
    decisionLog.push(
      `[LANDING ANALYSIS] Scanning 21×21 safety grid (${grid.length} cells, ${((GRID_DIMENSION - 1) * GRID_SPACING) / 2}m radius)...`
    );
    decisionLog.push(
      `[LANDING ANALYSIS] Grid classification: ${safeCount} SAFE, ${cautionCount} CAUTION, ${unsafeCount} UNSAFE.`
    );

    // Search for safe candidates
    const safeCandidates = grid.filter((c) => c.status === 'SAFE');

    if (safeCandidates.length > 0) {
      // Deterministically sort by safetyScore descending
      safeCandidates.sort((a, b) => {
        if (Math.abs(b.safetyScore - a.safetyScore) > 1e-4) {
          return b.safetyScore - a.safetyScore;
        }
        // Tie-breaker: distance to initial target
        const distA = (a.x - plannedTarget.x) ** 2 + (a.z - plannedTarget.z) ** 2;
        const distB = (b.x - plannedTarget.x) ** 2 + (b.z - plannedTarget.z) ** 2;
        return distA - distB;
      });

      selectedTarget = safeCandidates[0];
      selectedTargetReason = `OPTIMAL CLEARANCE (${selectedTarget.clearance.toFixed(1)}m) & LOW SLOPE (${selectedTarget.slope.toFixed(1)}°)`;
      decisionLog.push(
        `[LANDING ANALYSIS] Safe zone SELECTED at (X: ${selectedTarget.x.toFixed(1)}m, Z: ${selectedTarget.z.toFixed(1)}m) — Score: ${selectedTarget.safetyScore.toFixed(1)}.`
      );
      decisionLog.push(
        `[LANDING ANALYSIS] Target reassignment locked for subsequent mission phases.`
      );
    } else {
      // Fallback: pick highest scoring candidate
      const fallbackCandidates = [...grid].sort((a, b) => b.safetyScore - a.safetyScore);
      selectedTarget = fallbackCandidates[0];
      selectedTargetReason = 'BEST AVAILABLE CONTINGENCY ZONE';
      decisionLog.push(
        `[LANDING ANALYSIS] WARNING: No cell met strict SAFE criteria. Selected best contingency zone at (X: ${selectedTarget.x.toFixed(1)}m, Z: ${selectedTarget.z.toFixed(1)}m).`
      );
    }
  }

  return {
    status: 'COMPLETED',
    analyzedAtAltitude: null,
    initialTarget: initialAnalysis,
    initialTargetStatus: initialAnalysis.status,
    rejectionReason,
    targetChanged,
    selectedTarget,
    selectedTargetReason,
    selectedTargetScore: selectedTarget.safetyScore,
    safeZoneCount: safeCount,
    cautionZoneCount: cautionCount,
    unsafeZoneCount: unsafeCount,
    analysisRadius: ((GRID_DIMENSION - 1) * GRID_SPACING) / 2.0,
    grid,
    decisionLog,
  };

  _analysisCache.set(key, result);
  return {
    ...result,
    decisionLog: [...decisionLog],
  };
}

// Pre-warm analysis for initial planned target on module load so mid-flight execution is 0ms
try {
  performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);
} catch (e) {
  // Graceful fallback if environment is uninitialized
}
