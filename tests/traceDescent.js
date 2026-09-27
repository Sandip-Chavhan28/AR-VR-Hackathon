import { createInitialState, tickSimulation } from '../src/simulation/simulationState.js';
import { jumpToMilestone, detectMilestone } from '../src/simulation/missionEvents.js';

const state = createInitialState();
jumpToMilestone(state, 'RADAR_LOCK');
state.running = true;
state.timeScale = 1.0;
const accumRef = { current: 0 };

console.log('--- STARTING 1X SIMULATION FROM RADAR_LOCK ---');
let lastSec = 0;
let lastMilestone = '';
for (let step = 0; step < 10000; step++) {
  tickSimulation(state, 0.05, accumRef);
  const m = detectMilestone(state);
  if (state.elapsed < 1825 && step % 10 === 0) {
    console.log(`T+${state.elapsed.toFixed(1)}s [${m.id}] Alt=${state.altitude.toFixed(1)}m, Vy=${state.verticalVelocity?.toFixed(1)}m/s, Spd=${state.speed?.toFixed(1)}m/s, BackshellSep=${state.backshellSeparated}, Phase=${state.phase}`);
  }
  if (m.id !== lastMilestone) {
    console.log(`>>> MILESTONE CHANGE: ${lastMilestone} -> ${m.id} (${m.title}) at T+${state.elapsed.toFixed(1)}s, Alt=${state.altitude.toFixed(1)}m, Vy=${state.verticalVelocity?.toFixed(1)}m/s, Spd=${state.speed?.toFixed(1)}m/s, Phase=${state.phase}`);
    lastMilestone = m.id;
  }
  if (state.grounded) {
    console.log(`>>> TOUCHDOWN at T+${state.elapsed.toFixed(1)}s, Alt=${state.altitude.toFixed(2)}m!`);
    break;
  }
}
