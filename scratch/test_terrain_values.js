import {
  MAX_LANDING_SLOPE_DEG,
  MAX_CRATER_RISK,
  MAX_OBSTACLE_RISK,
  MIN_LANDING_CLEARANCE,
  INITIAL_PLANNED_TARGET,
  GRID_DIMENSION,
  GRID_SPACING,
} from '../src/simulation/landingSite/constants.js';
import {
  getTerrainHeight,
  getTerrainSlope,
  getCraterRisk,
  getObstacleRisk,
  getHazardClearance,
} from '../src/simulation/landingSite/terrain.js';


console.log('--- Testing Initial Planned Target ---');
const initX = INITIAL_PLANNED_TARGET.x;
const initZ = INITIAL_PLANNED_TARGET.z;

const initElev = getTerrainHeight(initX, initZ);
const initSlope = getTerrainSlope(initX, initZ);
const initCraterRisk = getCraterRisk(initX, initZ);
const initObsRisk = getObstacleRisk(initX, initZ);
const initClearance = getHazardClearance(initX, initZ);

console.log({
  x: initX,
  z: initZ,
  elevation: initElev.toFixed(2),
  slope: initSlope.toFixed(2) + '°',
  craterRisk: initCraterRisk.toFixed(3),
  obstacleRisk: initObsRisk.toFixed(3),
  clearance: initClearance.toFixed(2) + 'm',
});

console.log('Slope > MAX_LANDING_SLOPE_DEG:', initSlope > MAX_LANDING_SLOPE_DEG);
console.log('CraterRisk > MAX_CRATER_RISK:', initCraterRisk > MAX_CRATER_RISK);

console.log('\n--- Testing Safe Candidate at (-40, -20) ---');
const safeX = -40;
const safeZ = -20;
const safeElev = getTerrainHeight(safeX, safeZ);
const safeSlope = getTerrainSlope(safeX, safeZ);
const safeCraterRisk = getCraterRisk(safeX, safeZ);
const safeObsRisk = getObstacleRisk(safeX, safeZ);
const safeClearance = getHazardClearance(safeX, safeZ);

console.log({
  x: safeX,
  z: safeZ,
  elevation: safeElev.toFixed(2),
  slope: safeSlope.toFixed(2) + '°',
  craterRisk: safeCraterRisk.toFixed(3),
  obstacleRisk: safeObsRisk.toFixed(3),
  clearance: safeClearance.toFixed(2) + 'm',
});
