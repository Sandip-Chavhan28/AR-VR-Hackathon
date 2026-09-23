import { performLandingSiteAnalysis } from '../src/simulation/landingSite/landingSiteAnalysis.js';
import { MAX_LANDING_SLOPE_DEG, MAX_CRATER_RISK } from '../src/simulation/landingSite/constants.js';

const result1 = performLandingSiteAnalysis();
const result2 = performLandingSiteAnalysis();

console.log('=== Initial Target ===');
console.log('Coordinates:', { x: result1.initialTarget.x, z: result1.initialTarget.z });
console.log('Elevation:', result1.initialTarget.elevation.toFixed(2) + ' m');
console.log('Slope:', result1.initialTarget.slope.toFixed(2) + '°');
console.log('Crater Risk:', result1.initialTarget.craterRisk.toFixed(3));
console.log('Obstacle Risk:', result1.initialTarget.obstacleRisk.toFixed(3));
console.log('Clearance:', result1.initialTarget.clearance.toFixed(2) + ' m');
console.log('Status:', result1.initialTarget.status);
console.log('Rejection Reason:', result1.rejectionReason);

console.log('\n=== Selected Target ===');
console.log('Coordinates:', { x: result1.selectedTarget.x, z: result1.selectedTarget.z });
console.log('Elevation:', result1.selectedTarget.elevation.toFixed(2) + ' m');
console.log('Slope:', result1.selectedTarget.slope.toFixed(2) + '°');
console.log('Crater Risk:', result1.selectedTarget.craterRisk.toFixed(3));
console.log('Obstacle Risk:', result1.selectedTarget.obstacleRisk.toFixed(3));
console.log('Clearance:', result1.selectedTarget.clearance.toFixed(2) + ' m');
console.log('Safety Score:', result1.selectedTarget.safetyScore.toFixed(2));
console.log('Status:', result1.selectedTarget.status);
console.log('Selected Reason:', result1.selectedTargetReason);

console.log('\n=== Grid Summary ===');
console.log('Safe Count:', result1.safeZoneCount);
console.log('Caution Count:', result1.cautionZoneCount);
console.log('Unsafe Count:', result1.unsafeZoneCount);

console.log('\n=== Verification Checks ===');
console.log('1. Slope > MAX_LANDING_SLOPE_DEG:', result1.initialTarget.slope > MAX_LANDING_SLOPE_DEG);
console.log('2. CraterRisk > MAX_CRATER_RISK:', result1.initialTarget.craterRisk > MAX_CRATER_RISK);
console.log('3. Initial status === UNSAFE:', result1.initialTarget.status === 'UNSAFE');
console.log('4. Selected status === SAFE:', result1.selectedTarget.status === 'SAFE');
console.log('5. Selected coordinates differ:', result1.selectedTarget.x !== result1.initialTarget.x || result1.selectedTarget.z !== result1.initialTarget.z);
console.log('6. Deterministic reproducibility:', JSON.stringify(result1.selectedTarget) === JSON.stringify(result2.selectedTarget));

console.log('\n=== Decision Log ===');
result1.decisionLog.forEach((line) => console.log(' ', line));
