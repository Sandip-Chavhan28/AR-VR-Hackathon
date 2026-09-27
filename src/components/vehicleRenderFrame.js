import { RENDER_SCALE } from '../simulation/physics/constants.js';
import { writeVehicleWorldPosition } from './marsSurfaceFrame.js';

export function writeInterpolatedVehicleWorldPosition(state, accumulatorRef, target, fittedLocalY) {
  writeVehicleWorldPosition(state, target, fittedLocalY);

  const remainingSimulationTime = accumulatorRef?.current;
  if (!Number.isFinite(remainingSimulationTime) || remainingSimulationTime <= 0 || state.grounded) {
    return target;
  }

  const scale = RENDER_SCALE * remainingSimulationTime;
  target.x += (Number.isFinite(state.vx) ? state.vx : 0) * scale;
  target.y += (Number.isFinite(state.vy) ? state.vy : 0) * scale;
  target.z += (Number.isFinite(state.vz) ? state.vz : 0) * scale;
  return target;
}