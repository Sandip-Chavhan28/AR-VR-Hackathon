import { createInitialState, tickSimulation } from '../src/simulation/simulationState.js';
import { jumpToMilestone, detectMilestone } from '../src/simulation/missionEvents.js';

const state = createInitialState();
jumpToMilestone(state, 'POWERED_DESCENT');
state.running = true;
state.timeScale = 1.0;
const accumRef = { current: 0 };

for (let step = 0; step < 2000; step++) {
  tickSimulation(state, 0.05, accumRef);
  if (state.altitude < 40 && step % 4 === 0) {
    console.log(`T+${state.elapsed.toFixed(1)}s Alt=${state.altitude.toFixed(2)}m x=${state.x.toFixed(1)} vx=${state.vx.toFixed(2)} ax=${state.ax.toFixed(2)} vz=${state.vz.toFixed(2)} az=${state.az.toFixed(2)} phase=${state.phase}`);
  }
  if (state.grounded) {
    console.log(`Landed at T+${state.elapsed.toFixed(1)}s`);
    break;
  }
}
