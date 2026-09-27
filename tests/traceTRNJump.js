/**
 * traceTRNJump.js — Diagnostic script to trace exact position/distance evolution
 * from RADAR_LOCK through TRN_HAZARD to BACKSHELL_SEP.
 *
 * Run: node tests/traceTRNJump.js
 */

// Use the actual simulation modules
import { createInitialState, tickSimulation, determinePhase } from '../src/simulation/simulationState.js';
import { jumpToMilestone, detectMilestone } from '../src/simulation/missionEvents.js';
import { getTargetDistance } from '../src/simulation/guidance/controller.js';
import { PHYSICS_DT } from '../src/simulation/physics/constants.js';

const state = createInitialState();
jumpToMilestone(state, 'RADAR_LOCK');
state.running = true;
state.timeScale = 1;

const accumRef = { current: 0 };

console.log('=== TRN JUMP TRACE ===');
console.log('Starting from jumpToMilestone(RADAR_LOCK):');
console.log(`  x=${state.x.toFixed(0)} y=${state.y.toFixed(0)} alt=${state.altitude.toFixed(0)} vy=${state.vy.toFixed(2)} guidanceRefX=${state.guidanceRefX}`);
console.log('');

let lastPhase = state.phase;
let lastAlt = state.altitude;
let lastX = state.x;
let stepCount = 0;
let trnActivationLogged = false;

const startAlt = state.altitude;
const TARGET_ALT = 200;  // run until powered descent well underway

while (state.altitude > TARGET_ALT && !state.grounded && stepCount < 100000) {
  const prevPhase = state.phase;
  const prevAlt = state.altitude;
  const prevX = state.x;
  const prevVy = state.vy;
  const prevTrnActive = state.trnActive;
  const prevGuidRefX = state.guidanceRefX;

  // Simulate one physics step
  accumRef.current += PHYSICS_DT;
  tickSimulation(state, PHYSICS_DT, accumRef);
  stepCount++;

  const dist = getTargetDistance(state);
  const milestone = detectMilestone(state);
  const distLabel = isFinite(dist) ? dist.toFixed(0) + 'm' : 'N/A';

  // Log on phase change
  if (state.phase !== prevPhase) {
    console.log(`\n[PHASE CHANGE at T+${state.elapsed.toFixed(1)}s, step ${stepCount}]`);
    console.log(`  ${prevPhase} → ${state.phase}`);
    console.log(`  alt: ${prevAlt.toFixed(1)}m → ${state.altitude.toFixed(1)}m  DELTA=${Math.abs(state.altitude - prevAlt).toFixed(1)}m`);
    console.log(`  x:   ${prevX.toFixed(0)}m → ${state.x.toFixed(0)}m  DELTA=${Math.abs(state.x - prevX).toFixed(0)}m`);
    console.log(`  vy:  ${prevVy.toFixed(2)} → ${state.vy.toFixed(2)} m/s`);
    console.log(`  guidanceRefX: ${prevGuidRefX} → ${state.guidanceRefX}`);
    console.log(`  trnActive: ${prevTrnActive} → ${state.trnActive}`);
    console.log(`  distToTarget: ${distLabel}`);
    console.log(`  milestone: ${milestone.id}`);
  }

  // Log when TRN first activates
  if (state.trnActive && !prevTrnActive && !trnActivationLogged) {
    trnActivationLogged = true;
    console.log(`\n[TRN ACTIVATED at T+${state.elapsed.toFixed(1)}s, step ${stepCount}]`);
    console.log(`  alt: ${state.altitude.toFixed(1)}m`);
    console.log(`  x: ${state.x.toFixed(0)}m (prev x: ${prevX.toFixed(0)}m, jump? ${Math.abs(state.x - prevX).toFixed(0)}m)`);
    console.log(`  guidanceRefX BEFORE: ${prevGuidRefX}`);
    console.log(`  guidanceRefX AFTER:  ${state.guidanceRefX}`);
    if (state.guidanceRefX !== undefined && prevGuidRefX !== undefined) {
      const jump = state.x - (state.guidanceRefX + (state.landingSiteAnalysis?.selectedTarget?.x || 0));
      console.log(`  Implied current-to-target offset X: ${jump.toFixed(0)}m`);
    }
    console.log(`  distToTarget: ${distLabel}`);
  }

  // Log every 500m of altitude drop
  const altBucket = Math.floor(state.altitude / 500);
  const prevAltBucket = Math.floor(prevAlt / 500);
  if (altBucket !== prevAltBucket && state.altitude < 5000) {
    console.log(`  alt=${state.altitude.toFixed(0)}m x=${state.x.toFixed(0)}m vy=${state.vy.toFixed(1)}m/s phase=${state.phase} dist=${distLabel} trnActive=${state.trnActive} guidRefX=${state.guidanceRefX?.toFixed(0) ?? 'undef'}`);
  }
}

console.log('\n=== TRACE COMPLETE ===');
console.log(`Final: alt=${state.altitude.toFixed(1)}m phase=${state.phase} elapsed=${state.elapsed.toFixed(1)}s`);
