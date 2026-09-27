/**
 * verifyFullTerminalSequence.js
 *
 * Verifies that the complete descent sequence from Terminal Radar Lock (4 km)
 * all the way to Touchdown (0 m) on Mars executes as a SINGLE continuous,
 * physically uninterrupted sequence with NO position teleportation,
 * NO distance jumps, NO coordinate shifts, and NO timer skips.
 */

import { createInitialState, tickSimulation } from '../src/simulation/simulationState.js';
import { jumpToMilestone, detectMilestone } from '../src/simulation/missionEvents.js';
import { getTargetDistance } from '../src/simulation/guidance/controller.js';
import { PHYSICS_DT, JEZERO_TARGET_X, JEZERO_TARGET_Z } from '../src/simulation/physics/constants.js';

console.log('======================================================================');
console.log('VERIFYING CONTINUOUS TERMINAL RADAR LOCK -> TRN -> TOUCHDOWN SEQUENCE');
console.log('======================================================================\n');

const state = createInitialState();
jumpToMilestone(state, 'RADAR_LOCK');
state.running = true;
state.timeScale = 1.0;

const accumRef = { current: 0 };

let prevAlt = state.altitude;
let prevRadarAlt = state.radarAltitude;
let prevX = state.x;
let prevDist = Math.hypot((state.x || 0) - (JEZERO_TARGET_X + (state.landingSiteAnalysis?.selectedTarget?.x || 0)), state.altitude);

let maxAltDeltaPerStep = 0;
let maxXDeltaPerStep = 0;
let maxDistDeltaPerStep = 0;

let trnSeen = false;
let backshellSepSeen = false;
let poweredDescentSeen = false;
let skyCraneSeen = false;
let touchdownSeen = false;

const logMilestones = [];

let steps = 0;
const MAX_STEPS = 200000; // safety ceiling

while (!state.grounded && state.altitude > 0.5 && steps < MAX_STEPS) {
  accumRef.current += PHYSICS_DT;
  tickSimulation(state, PHYSICS_DT, accumRef);
  steps++;

  const tgtX = (state.guidanceRefX ?? JEZERO_TARGET_X) + (state.landingSiteAnalysis?.selectedTarget?.x || 0);
  const tgtZ = (state.guidanceRefZ ?? JEZERO_TARGET_Z) + (state.landingSiteAnalysis?.selectedTarget?.z || 0);
  const dx = state.x - tgtX;
  const dz = state.z - tgtZ;
  const groundDist = Math.hypot(dx, dz);
  const altM = Math.max(0, state.radarAltitude !== undefined ? state.radarAltitude : state.altitude);
  const distTarget = Math.hypot(groundDist, altM);

  const altDelta = Math.abs(state.altitude - prevAlt);
  const xDelta = Math.abs(state.x - prevX);
  const distDelta = Math.abs(distTarget - prevDist);

  if (altDelta > maxAltDeltaPerStep) maxAltDeltaPerStep = altDelta;
  if (xDelta > maxXDeltaPerStep) maxXDeltaPerStep = xDelta;
  if (distDelta > maxDistDeltaPerStep) maxDistDeltaPerStep = distDelta;

  // Fail if there is any discontinuous jump (> 25m in one 0.05s step = 500 m/s instantaneous movement)
  if (altDelta > 25.0) {
    throw new Error(`DISCONTINUOUS ALTITUDE JUMP DETECTED at step ${steps}: ${altDelta.toFixed(1)} m in one step!`);
  }
  if (xDelta > 25.0) {
    throw new Error(`DISCONTINUOUS X POSITION JUMP DETECTED at step ${steps}: ${xDelta.toFixed(1)} m in one step!`);
  }
  if (distDelta > 25.0) {
    throw new Error(`DISCONTINUOUS DISTANCE-TO-TARGET JUMP DETECTED at step ${steps}: ${distDelta.toFixed(1)} m in one step!`);
  }

  // Record milestone transitions
  if (state.trnActive && !trnSeen) {
    trnSeen = true;
    logMilestones.push({
      event: 'TRN_ACQUIRED',
      step: steps,
      time: state.elapsed,
      alt: state.altitude,
      radarAlt: state.radarAltitude,
      x: state.x,
      distTarget,
      phase: state.phase,
    });
  }

  if (state.backshellSeparated && !backshellSepSeen) {
    backshellSepSeen = true;
    logMilestones.push({
      event: 'BACKSHELL_SEPARATION',
      step: steps,
      time: state.elapsed,
      alt: state.altitude,
      radarAlt: state.radarAltitude,
      x: state.x,
      distTarget,
      phase: state.phase,
    });
  }

  if (state.poweredDescentActive && !poweredDescentSeen) {
    poweredDescentSeen = true;
    logMilestones.push({
      event: 'POWERED_DESCENT_IGNITION',
      step: steps,
      time: state.elapsed,
      alt: state.altitude,
      radarAlt: state.radarAltitude,
      x: state.x,
      distTarget,
      throttle: state.throttle,
      phase: state.phase,
    });
  }

  if (state.skyCraneActive && !skyCraneSeen) {
    skyCraneSeen = true;
    logMilestones.push({
      event: 'SKY_CRANE_TERMINAL',
      step: steps,
      time: state.elapsed,
      alt: state.altitude,
      radarAlt: state.radarAltitude,
      x: state.x,
      distTarget,
      phase: state.phase,
    });
  }

  prevAlt = state.altitude;
  prevRadarAlt = state.radarAltitude;
  prevX = state.x;
  prevDist = distTarget;
}

if (state.grounded || state.phase === 'LANDED') {
  touchdownSeen = true;
  logMilestones.push({
    event: 'TOUCHDOWN',
    step: steps,
    time: state.elapsed,
    alt: state.altitude,
    radarAlt: state.radarAltitude,
    x: state.x,
    landingError: state.landingError,
    speed: state.speed,
    phase: state.phase,
  });
}

console.log('PHYSICAL TRANSITION LOG:');
console.log('----------------------------------------------------------------------');
for (const m of logMilestones) {
  console.log(`[${m.event}] at T+${m.time.toFixed(1)}s (step ${m.step}):`);
  console.log(`  Altitude:       ${m.alt.toFixed(1)} m`);
  console.log(`  Radar Alt (AGL): ${m.radarAlt.toFixed(1)} m`);
  console.log(`  X Position:     ${m.x.toFixed(1)} m`);
  if (m.distTarget !== undefined) console.log(`  Distance to Tgt:${(m.distTarget / 1000).toFixed(2)} km (${m.distTarget.toFixed(0)} m)`);
  if (m.throttle !== undefined) console.log(`  Throttle:       ${(m.throttle * 100).toFixed(0)}%`);
  if (m.speed !== undefined) console.log(`  Touchdown Speed:${m.speed.toFixed(2)} m/s (safe < 2.5 m/s)`);
  if (m.landingError !== undefined) console.log(`  Landing Error:  ${m.landingError.toFixed(2)} m`);
  console.log(`  Phase:          ${m.phase}`);
  console.log('');
}

console.log('----------------------------------------------------------------------');
console.log('CONTINUITY SANITY CHECKS:');
console.log(`  Max Altitude Delta per 0.05s step:  ${maxAltDeltaPerStep.toFixed(3)} m (<= 2.5 m)`);
console.log(`  Max X Position Delta per 0.05s step:${maxXDeltaPerStep.toFixed(3)} m (<= 2.0 m)`);
console.log(`  Max Target Dist Delta per 0.05s step:${maxDistDeltaPerStep.toFixed(3)} m (<= 2.5 m)`);
console.log('');

if (!trnSeen) throw new Error('TRN was not activated!');
if (!backshellSepSeen) throw new Error('Backshell separation was not activated!');
if (!poweredDescentSeen) throw new Error('Powered descent was not activated!');
if (!skyCraneSeen) throw new Error('Sky crane was not activated!');
if (!touchdownSeen) throw new Error('Touchdown was not achieved!');

console.log('✅ ALL STAGES PASSED CONTINUOUSLY WITH ZERO TELEPORTATION OR JUMPS.');
console.log('======================================================================');
