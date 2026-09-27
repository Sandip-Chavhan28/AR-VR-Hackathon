import { RENDER_SCALE } from '../simulation/physics/constants.js';
import { writeVehicleWorldPosition } from './marsSurfaceFrame.js';

const INITIAL_TRAJECTORY_CAPACITY = 4096;

export function createTrajectoryPath() {
  return {
    positions: new Float32Array(INITIAL_TRAJECTORY_CAPACITY * 3),
    count: 0,
    revision: 0,
    origin: null,
    fullUpdate: false,
  };
}

export function appendTrajectoryPosition(pathRef, position) {
  const path = pathRef?.current;
  if (!path || !position) return false;

  if (!path.origin) {
    path.origin = { x: position.x, y: position.y, z: position.z };
  }

  const offset = path.count * 3;
  if (path.count > 0) {
    const previous = path.positions;
    const dx = position.x - path.origin.x - previous[offset - 3];
    const dy = position.y - path.origin.y - previous[offset - 2];
    const dz = position.z - path.origin.z - previous[offset - 1];
    if (dx * dx + dy * dy + dz * dz < 1e-12) return false;
  }

  if (offset + 3 > path.positions.length) {
    const expanded = new Float32Array(path.positions.length * 2);
    expanded.set(path.positions);
    path.positions = expanded;
  }

  path.positions[offset] = position.x - path.origin.x;
  path.positions[offset + 1] = position.y - path.origin.y;
  path.positions[offset + 2] = position.z - path.origin.z;
  path.count++;
  path.lastUpdateStart = path.fullUpdate ? 0 : offset;
  path.lastUpdateCount = path.fullUpdate ? path.count * 3 : 3;
  path.revision++;
  return true;
}

export function rebaseTrajectoryPath(pathRef, newOrigin) {
  const path = pathRef?.current;
  if (!path || !newOrigin || path.count === 0 || !path.origin) return;

  const dx = newOrigin.x - path.origin.x;
  const dy = newOrigin.y - path.origin.y;
  const dz = newOrigin.z - path.origin.z;
  for (let i = 0; i < path.count; i++) {
    const offset = i * 3;
    path.positions[offset] -= dx;
    path.positions[offset + 1] -= dy;
    path.positions[offset + 2] -= dz;
  }

  path.origin = { x: newOrigin.x, y: newOrigin.y, z: newOrigin.z };
  path.fullUpdate = true;
  path.revision++;
}

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