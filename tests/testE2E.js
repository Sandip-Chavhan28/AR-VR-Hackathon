import { createInitialState, tickSimulation } from '../src/simulation/simulationState.js';

const state = createInitialState();
state.running = true;
state.timeScale = 50.0;
const accumRef = { current: 0 };
let prevPhase = state.phase;
console.log('Start phase:', state.phase, 'Alt:', state.altitude);

let steps = 0;
while (!state.grounded && steps < 1000000) {
  tickSimulation(state, 0.02, accumRef);
  steps++;
  if (state.phase !== prevPhase) {
    console.log(
      `T+${state.elapsed.toFixed(1)}s [${state.phase}] ` +
      `Alt: ${(state.altitude / 1000).toFixed(2)}km ` +
      `Spd: ${state.speed.toFixed(1)}m/s ` +
      `Fuel: ${state.fuel?.toFixed(1)}kg ` +
      `ShieldSep: ${state.heatShieldSeparated} ` +
      `Chute: ${state.parachuteState} ` +
      `BackshellSep: ${state.backshellSeparated} ` +
      `Engines: ${state.enginesActive}`
    );
    prevPhase = state.phase;
  }
}

console.log(
  `\nSimulation End at Step ${steps}:\n` +
  `Phase: ${state.phase}\n` +
  `Grounded: ${state.grounded}\n` +
  `Altitude: ${state.altitude.toFixed(2)} m\n` +
  `Vertical Velocity: ${state.verticalVelocity?.toFixed(2)} m/s\n` +
  `Speed: ${state.speed?.toFixed(2)} m/s\n` +
  `Elapsed sim time: ${state.elapsed.toFixed(1)} s\n` +
  `Fuel remaining: ${state.fuel?.toFixed(1)} kg\n` +
  `Landing Error: ${state.landingError?.toFixed(2)} m\n` +
  `Peak G: ${state.peakGForce?.toFixed(2)} G\n` +
  `Heat Shield Separated: ${state.heatShieldSeparated}\n` +
  `Radar Locked: ${state.radarLocked}\n` +
  `TRN Active: ${state.trnActive}\n` +
  `Backshell Separated: ${state.backshellSeparated}\n` +
  `Sky Crane Active: ${state.skyCraneActive}`
);
