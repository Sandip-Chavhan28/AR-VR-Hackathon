import { createInitialState, tickSimulation } from '../src/simulation/simulationState.js';
import { PHYSICS_DT } from '../src/simulation/physics/constants.js';

const state = createInitialState();
state.running = true;
state.timeScale = 50.0;
const accumRef = { current: 0 };

while (!state.grounded && state.altitude > 0.5 && state.elapsed < 3000) {
  accumRef.current += PHYSICS_DT;
  tickSimulation(state, PHYSICS_DT, accumRef);
}

console.log('Orbital flight touchdown:');
console.log('  Elapsed time:', state.elapsed.toFixed(1), 's');
console.log('  Touchdown X: ', state.x.toFixed(2), 'm');
console.log('  Touchdown Z: ', state.z.toFixed(2), 'm');
console.log('  Altitude:   ', state.altitude.toFixed(2), 'm');
