/**
 * traceGuidanceRef.js — Traces guidanceRefX and distToTarget from HEAT_SHIELD_SEP.
 */

import { createInitialState, tickSimulation } from '../src/simulation/simulationState.js';
import { jumpToMilestone } from '../src/simulation/missionEvents.js';
import { getTargetDistance } from '../src/simulation/guidance/controller.js';
import { PHYSICS_DT } from '../src/simulation/physics/constants.js';

const state = createInitialState();
jumpToMilestone(state, 'HEAT_SHIELD_SEP');
state.running = true;
state.timeScale = 1;
const accumRef = { current: 0 };

console.log('=== guidanceRefX TRACE from HEAT_SHIELD_SEP ===');
console.log(`Initial: x=${state.x} guidanceRefX=${state.guidanceRefX} alt=${state.altitude}`);
console.log('');

let stepCount = 0;

while (state.altitude > 200 && !state.grounded && stepCount < 300000) {
  const prevGuidRefX = state.guidanceRefX;
  const prevTrn = state.trnActive;
  const prevAlt = state.altitude;

  accumRef.current += PHYSICS_DT;
  tickSimulation(state, PHYSICS_DT, accumRef);
  stepCount++;

  const dist = getTargetDistance(state);
  const distStr = isFinite(dist) ? dist.toFixed(0) : 'inf';

  if (state.guidanceRefX !== prevGuidRefX) {
    console.log(`\n*** guidanceRefX CHANGED at T+${state.elapsed.toFixed(1)}s ***`);
    console.log(`    BEFORE: ${prevGuidRefX}`);
    console.log(`    AFTER:  ${state.guidanceRefX}`);
    console.log(`    state.x: ${state.x.toFixed(0)}  vx: ${state.vx.toFixed(3)}`);
    if (state.landingSiteAnalysis?.selectedTarget) {
      const offX = state.landingSiteAnalysis.selectedTarget.x || 0;
      console.log(`    selectedTarget.x: ${offX}`);
      console.log(`    formula = x + vx*84.1155 - offset = ${state.x.toFixed(0)} + ${state.vx.toFixed(3)}*84.1155 - ${offX.toFixed(0)} = ${(state.x + state.vx*84.1155 - offX).toFixed(0)}`);
    }
    const distAfter = getTargetDistance(state);
    console.log(`    dist before: ${distStr}m  dist after: ${isFinite(distAfter) ? distAfter.toFixed(0) : 'inf'}m`);
  }

  if (state.altitude < 5000) {
    const altBucket = Math.floor(state.altitude / 250);
    const prevBucket = Math.floor(prevAlt / 250);
    if (altBucket !== prevBucket) {
      console.log(`T+${state.elapsed.toFixed(1)}s  alt=${state.altitude.toFixed(0)}m  x=${state.x.toFixed(0)}m  guidRefX=${state.guidanceRefX?.toFixed(0) ?? 'undef'}  vx=${state.vx.toFixed(3)}  dist=${distStr}m  phase=${state.phase}  trn=${state.trnActive}`);
    }
  }
}

console.log('\n=== DONE ===');
