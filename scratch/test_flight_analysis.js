import { createInitialState, determinePhase } from '../src/simulation/simulationState.js';
import { stepSimulation } from '../src/simulation/physics/integrator.js';
import { PHYSICS_DT } from '../src/simulation/physics/constants.js';

const state = createInitialState({ autoSequence: true });
state.running = true;

let analysisChecked = false;
let prevSpeed = state.speed;

while (!state.grounded && state.elapsed < 2000) {
  if (state.phase === 'MARS_ORBIT') {
    state.orbitTime = (state.orbitTime || 0) + PHYSICS_DT;
  }

  stepSimulation(state, PHYSICS_DT);
  state.phase = determinePhase(state);

  if (state.landingSiteAnalysis && !analysisChecked) {
    console.log(`[T=${state.elapsed.toFixed(1)}s | Phase: ${state.phase}] Landing Site Analysis triggered at Alt: ${(state.altitude/1000).toFixed(2)}km`);
    console.log('Initial Target Status:', state.landingSiteAnalysis.initialTargetStatus);
    console.log('Rejection Reason:', state.landingSiteAnalysis.rejectionReason);
    console.log('Selected Target:', {
      x: state.landingSiteAnalysis.selectedTarget.x,
      z: state.landingSiteAnalysis.selectedTarget.z,
      slope: state.landingSiteAnalysis.selectedTarget.slope.toFixed(2) + '°',
      clearance: state.landingSiteAnalysis.selectedTarget.clearance.toFixed(2) + 'm',
      status: state.landingSiteAnalysis.selectedTarget.status,
      score: state.landingSiteAnalysis.selectedTarget.safetyScore.toFixed(1),
    });
    console.log('Safe Zone Count:', state.landingSiteAnalysis.safeZoneCount);
    console.log('Decision Log Lines:', state.landingSiteAnalysis.decisionLog.length);
    analysisChecked = true;
  }

  // Check numerical stability
  if (isNaN(state.speed) || !isFinite(state.speed) || isNaN(state.altitude)) {
    throw new Error(`Numerical instability detected: speed=${state.speed}, alt=${state.altitude}`);
  }

  prevSpeed = state.speed;
}

console.log(`Mission finished: grounded=${state.grounded}, final phase=${state.phase}, alt=${state.altitude.toFixed(2)}m, speed=${state.speed.toFixed(2)}m/s`);
