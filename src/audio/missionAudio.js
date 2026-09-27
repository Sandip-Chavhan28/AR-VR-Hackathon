/**
 * missionAudio.js – Backward-compatible adapter delegating to SoundEffects.js.
 * All sound generation is centralized in SoundEffects.js singleton.
 */

export {
  sounds,
  SoundEngine,
  playParachuteDeployAudio,
  playShieldSepAudio,
  playRadarLockAudio,
  playEngineIgnitionAudio,
  playTouchdownChime,
  playTelemetryPing,
  playAlertBeep,
  setAudioMuted,
  isAudioMuted,
  default,
} from './SoundEffects.js';
