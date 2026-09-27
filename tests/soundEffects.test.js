import assert from 'assert';
import { sounds, SoundEngine } from '../src/audio/SoundEffects.js';

console.log('\n── 1. SoundEngine Lifecycle & Guard Protection ─');

// Verify initial state
assert.strictEqual(typeof sounds.init, 'function');
assert.strictEqual(typeof sounds.playEventOnce, 'function');
assert.strictEqual(typeof sounds.updateContinuousAudio, 'function');

// Test one-shot guard mechanism
sounds.resetGuards();
let execCount = 0;
const testAction = () => { execCount++; };

// Trigger 1: should execute
const res1 = sounds.playEventOnce('test-event', testAction);
assert.strictEqual(res1, true, 'First event trigger must succeed');

// Trigger 2: should be blocked
const res2 = sounds.playEventOnce('test-event', testAction);
assert.strictEqual(res2, false, 'Duplicate event trigger must be blocked');
assert.strictEqual(sounds.hasTriggered('test-event'), true, 'Guard must record event as triggered');

console.log('  ✅  One-shot duplicate event protection works (prevented repeated firing)');

// Test guard reset
sounds.resetGuards();
assert.strictEqual(sounds.hasTriggered('test-event'), false, 'Reset must clear event guards');
console.log('  ✅  Event guards successfully reset on mission reset');

// Test milestone seek guard marking
sounds.resetGuards();
sounds.markGuardsForMilestone('POWERED_DESCENT');
assert.strictEqual(sounds.hasTriggered('parachute-deploy'), true, 'Past milestone (parachute) marked consumed');
assert.strictEqual(sounds.hasTriggered('heat-shield-sep'), true, 'Past milestone (heat shield) marked consumed');
assert.strictEqual(sounds.hasTriggered('radar-lock'), true, 'Past milestone (radar lock) marked consumed');
assert.strictEqual(sounds.hasTriggered('backshell-sep'), true, 'Past milestone (backshell sep) marked consumed');
assert.strictEqual(sounds.hasTriggered('touchdown'), false, 'Future milestone (touchdown) NOT marked consumed');
console.log('  ✅  Milestone seeking marks historical events without firing duplicate audio');

// Test mute toggle and persistence interface
const initialMute = sounds.isMuted();
sounds.setMuted(true);
assert.strictEqual(sounds.isMuted(), true, 'setMuted(true) sets muted state');
sounds.setMuted(false);
assert.strictEqual(sounds.isMuted(), false, 'setMuted(false) unmutes sound engine');
sounds.toggleMute();
assert.strictEqual(sounds.isMuted(), true, 'toggleMute() flips muted state');
sounds.setMuted(initialMute);
console.log('  ✅  Mute control interface functions correctly');

// Test pause and continuous audio reset
sounds.pause();
assert.strictEqual(sounds.lastHeat, 0, 'Pause resets cached heat gain');
assert.strictEqual(sounds.lastThrottle, 0, 'Pause resets cached throttle gain');
console.log('  ✅  Pause smoothly ramps down continuous audio levels');

console.log('\n─────────────────────────────────────────────────');
console.log('Results: 5 passed, 0 failed\n');
