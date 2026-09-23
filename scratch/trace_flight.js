import { createInitialState, tickSimulation } from '../src/simulation/simulationState.js';
import { RENDER_SCALE, MARS_RADIUS } from '../src/simulation/physics/constants.js';

const s = createInitialState();
s.running = true;
const accum = { current: 0 };

for (let wallSec = 1; wallSec <= 45; wallSec++) {
  tickSimulation(s, 1.0, accum);
  const lx = s.x * RENDER_SCALE;
  const ly = s.y * RENDER_SCALE;
  const lz = s.z * RENDER_SCALE;

  // Check distance to Mars center
  // Mars center is at [0, -MARS_RADIUS * RENDER_SCALE, 0] = [0, -3389.5, 0]
  const distToCenter = Math.sqrt(lx * lx + (ly + MARS_RADIUS * RENDER_SCALE) ** 2 + lz * lz);
  const altFromCenter = distToCenter - MARS_RADIUS * RENDER_SCALE;

  console.log(`Wall ${wallSec}s (Sim ${s.elapsed.toFixed(1)}s): Phase=${s.phase} Alt=${(s.altitude/1000).toFixed(1)}km (CenterAlt=${altFromCenter.toFixed(1)}u) Pos=(${lx.toFixed(1)}, ${ly.toFixed(1)}, ${lz.toFixed(1)}) Speed=${s.speed.toFixed(1)} Grounded=${s.grounded}`);
}
