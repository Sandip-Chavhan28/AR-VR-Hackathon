import { createInitialState, determinePhase } from '../src/simulation/simulationState.js';
import { stepSimulation } from '../src/simulation/physics/integrator.js';
import { PHYSICS_DT } from '../src/simulation/physics/constants.js';

const state = createInitialState({ autoSequence: true });
state.running = true;

console.log('Starting trajectory simulation...');
let step = 0;
let lastReportAlt = 130000;

const logIntervals = [125000, 100000, 80000, 60000, 40000, 25000, 20000, 15000, 12000, 11000, 10000, 9000, 8000, 7000, 6000, 5000, 3000, 1000, 500, 10];

let nextLogIdx = 0;
let deorbitReported = false;
let coastReported = false;
let entryReported = false;

while (!state.grounded && state.elapsed < 3600) {
  if (state.phase === 'MARS_ORBIT') {
    state.orbitTime = (state.orbitTime || 0) + PHYSICS_DT;
  }

  stepSimulation(state, PHYSICS_DT);
  state.phase = determinePhase(state);

  if (state.phase === 'DEORBIT_BURN' && !deorbitReported) {
    console.log(`[T=${state.elapsed.toFixed(1)}s] Phase changed to DEORBIT_BURN, alt=${(state.altitude/1000).toFixed(2)}km, speed=${state.speed.toFixed(1)}m/s`);
    deorbitReported = true;
  }
  if (state.phase === 'COAST_TO_ENTRY' && !coastReported) {
    console.log(`[T=${state.elapsed.toFixed(1)}s] Phase changed to COAST_TO_ENTRY, alt=${(state.altitude/1000).toFixed(2)}km, speed=${state.speed.toFixed(1)}m/s, fuel=${state.fuel.toFixed(1)}kg`);
    coastReported = true;
  }
  if (state.phase === 'ATMOSPHERIC_ENTRY' && !entryReported) {
    console.log(`[T=${state.elapsed.toFixed(1)}s] Phase changed to ATMOSPHERIC_ENTRY, alt=${(state.altitude/1000).toFixed(2)}km, speed=${state.speed.toFixed(1)}m/s`);
    entryReported = true;
  }

  while (nextLogIdx < logIntervals.length && state.altitude <= logIntervals[nextLogIdx]) {
    const targetAlt = logIntervals[nextLogIdx];
    console.log(`[T=${state.elapsed.toFixed(1)}s | Phase: ${state.phase}] Alt: ${(state.altitude/1000).toFixed(2)}km, Speed: ${state.speed.toFixed(1)}m/s, VertV: ${state.verticalVelocity.toFixed(1)}m/s, Rho: ${state.rho.toFixed(5)}kg/m³, q: ${state.q.toFixed(0)}Pa, HeatFlux: ${(state.heatFlux/10000).toFixed(1)}W/cm²`);
    nextLogIdx++;
  }

  step++;
}

console.log(`\nFinal state: grounded=${state.grounded}, phase=${state.phase}, alt=${state.altitude.toFixed(2)}m, speed=${state.speed.toFixed(2)}m/s, T=${state.elapsed.toFixed(1)}s`);
