// Web Audio API Synthesized NASA EDL Sound Generator
// Procedurally generates authentic space mission soundscapes with zero external audio assets
// Adapted from origin/MarsLanding2 with high-performance continuous streaming & duplicate event guards

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.muted = false;
    this.rumbleNode = null;
    this.rumbleGain = null;
    this.windNode = null;
    this.windGain = null;

    // One-shot event duplicate prevention guards
    this.oneShotGuards = new Set();

    // Continuous audio throttling & state caching
    this.lastContinuousUpdate = 0;
    this.lastHeat = -1;
    this.lastThrottle = -1;

    // Load persisted mute state if in browser
    if (typeof window !== 'undefined') {
      try {
        const savedMute = localStorage.getItem('mars_edl_sound_muted');
        if (savedMute !== null) {
          this.muted = savedMute === 'true';
        }
      } catch (_) {}
    }
  }

  init() {
    if (this.initialized || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.initialized = true;
      this.setupContinuousSounds();
    } catch (e) {
      console.warn("Web Audio not supported", e);
    }
  }

  resume() {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setupContinuousSounds() {
    if (!this.ctx) return;

    // Atmospheric roar / wind noise generator
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Bandpass filter for wind / hypersonic shock
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 350;
    filter.Q.value = 1.2;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0001;

    whiteNoise.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    try { whiteNoise.start(0); } catch (_) {}

    // Rocket rumble generator (low freq brown noise + sub-oscillator)
    const rumbleNoise = this.ctx.createBufferSource();
    rumbleNoise.buffer = noiseBuffer;
    rumbleNoise.loop = true;

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 90;

    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.value = 0.0001;

    rumbleNoise.connect(lowpass);
    lowpass.connect(this.rumbleGain);
    this.rumbleGain.connect(this.ctx.destination);
    try { rumbleNoise.start(0); } catch (_) {}

    this.windNode = whiteNoise;
    this.rumbleNode = rumbleNoise;
  }

  setHeatIntensity(intensity) {
    if (!this.ctx || this.muted) return;
    const targetGain = Math.min(0.28, Math.max(0.0001, intensity * 0.28));
    if (this.windGain) {
      try {
        this.windGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
      } catch (_) {}
    }
  }

  setRocketThrottle(throttle) {
    if (!this.ctx || this.muted) return;
    const targetGain = Math.min(0.4, Math.max(0.0001, throttle * 0.4));
    if (this.rumbleGain) {
      try {
        this.rumbleGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
      } catch (_) {}
    }
  }

  // Throttled continuous update responding to actual state (runs outside React state)
  updateContinuousAudio(state, running) {
    if (!this.initialized || !this.ctx) return;
    const now = performance.now();
    // Throttle to 20Hz (every 50ms) to ensure minimal CPU usage
    if (now - this.lastContinuousUpdate < 50) return;
    this.lastContinuousUpdate = now;

    if (!running || this.muted) {
      if (this.lastHeat !== 0) {
        if (this.windGain) this.windGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
        this.lastHeat = 0;
      }
      if (this.lastThrottle !== 0) {
        if (this.rumbleGain) this.rumbleGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
        this.lastThrottle = 0;
      }
      return;
    }

    if (!state) return;

    // 1. Wind / atmospheric roar: proportional to heating intensity & hypersonic airflow
    let heat = state.heatIntensity || 0;
    const alt = state.altitude || 0;
    const spd = state.speed || 0;
    // Aerodynamic wind during high-speed descent in atmosphere (e.g. entry / early parachute)
    if (alt < 125000 && alt > 2000 && spd > 100) {
      const aeroWind = Math.min(0.6, (spd / 2500) * 0.5);
      heat = Math.max(heat, aeroWind);
    }
    // Fade out wind after touchdown or at low altitude and speed
    if (state.grounded || state.phase === 'LANDED') {
      heat = 0;
    }

    if (Math.abs(heat - this.lastHeat) > 0.01) {
      this.lastHeat = heat;
      this.setHeatIntensity(heat);
    }

    // 2. Rocket engine rumble: active when engines are firing or during descent stage flyaway
    let throttle = 0;
    if (state.enginesActive && !state.grounded && state.phase !== 'LANDED') {
      throttle = state.throttle !== undefined ? state.throttle : 1.0;
      if (state.phase === 'SAFE_APPROACH') {
        throttle = 0.65;
      }
    } else if (state.descentStageFlyaway && state.touchdownTime !== undefined) {
      const flyTime = state.elapsed - state.touchdownTime;
      if (flyTime >= 0 && flyTime < 6.0) {
        // Flyaway rocket engine roar flares up at touchdown and fades gracefully with distance
        throttle = Math.max(0, (1.0 - flyTime / 6.0) * 0.95);
      }
    }

    if (Math.abs(throttle - this.lastThrottle) > 0.01) {
      this.lastThrottle = throttle;
      this.setRocketThrottle(throttle);
    }
  }

  // --- Duplicate Event Protection ---
  playEventOnce(eventName, fn) {
    if (this.oneShotGuards.has(eventName)) return false;
    this.oneShotGuards.add(eventName);
    if (!this.muted) {
      this.resume();
      try {
        fn();
      } catch (_) {}
    }
    return true;
  }

  hasTriggered(eventName) {
    return this.oneShotGuards.has(eventName);
  }

  markGuard(eventName) {
    this.oneShotGuards.add(eventName);
  }

  resetGuards() {
    this.oneShotGuards.clear();
  }

  // Distinguish live events from seeking: mark past events as already triggered
  markGuardsForMilestone(milestoneId) {
    const milestoneOrder = [
      'ORBIT',
      'DEORBIT_BURN',
      'COAST_TO_ENTRY',
      'ENTRY_INTERFACE',
      'PEAK_HEATING',
      'PARACHUTE_DEPLOY',
      'HEAT_SHIELD_SEP',
      'RADAR_LOCK',
      'TRN_HAZARD',
      'BACKSHELL_SEP',
      'POWERED_DESCENT',
      'SKY_CRANE_TERMINAL',
      'TOUCHDOWN',
    ];
    const targetIdx = milestoneOrder.indexOf(milestoneId);
    if (targetIdx === -1) return;

    if (targetIdx >= milestoneOrder.indexOf('DEORBIT_BURN')) {
      this.markGuard('deorbit-burn');
    }
    if (targetIdx >= milestoneOrder.indexOf('COAST_TO_ENTRY')) {
      this.markGuard('cruise-stage-sep');
    }
    if (targetIdx >= milestoneOrder.indexOf('PARACHUTE_DEPLOY')) {
      this.markGuard('parachute-deploy');
    }
    if (targetIdx >= milestoneOrder.indexOf('HEAT_SHIELD_SEP')) {
      this.markGuard('heat-shield-sep');
    }
    if (targetIdx >= milestoneOrder.indexOf('RADAR_LOCK')) {
      this.markGuard('radar-lock');
    }
    if (targetIdx >= milestoneOrder.indexOf('TRN_HAZARD')) {
      this.markGuard('trn-hazard');
    }
    if (targetIdx >= milestoneOrder.indexOf('BACKSHELL_SEP')) {
      this.markGuard('backshell-sep');
    }
    if (targetIdx >= milestoneOrder.indexOf('POWERED_DESCENT')) {
      this.markGuard('powered-descent');
    }
    if (targetIdx >= milestoneOrder.indexOf('TOUCHDOWN')) {
      this.markGuard('cable-cut');
      this.markGuard('touchdown');
    }
  }

  // --- Synthesized Mission Audio Cues ---

  playParachuteDeploy() {
    if (!this.ctx || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Explosive mortar pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);

    // Chute snap / canopy flutter
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = "triangle";
    snapOsc.frequency.setValueAtTime(320, now + 0.1);
    snapOsc.frequency.exponentialRampToValueAtTime(60, now + 0.5);
    snapGain.gain.setValueAtTime(0.3, now + 0.1);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    snapOsc.connect(snapGain);
    snapGain.connect(this.ctx.destination);
    snapOsc.start(now + 0.1);
    snapOsc.stop(now + 0.55);
  }

  playSeparation() {
    if (!this.ctx || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;
    // Pyro bolt cut clunk
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.25);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playRadarPing() {
    if (!this.ctx || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.08);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playTouchdownChime() {
    if (!this.ctx || this.muted) return;
    this.resume();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 triumph
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const startTime = now + idx * 0.12;
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.85);
    });
  }

  playAlertBeep() {
    if (!this.ctx || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playTelemetryPing() {
    if (!this.ctx || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // --- State Control Methods ---
  pause() {
    if (this.ctx) {
      if (this.windGain) this.windGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
      if (this.rumbleGain) this.rumbleGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
    }
    this.lastHeat = 0;
    this.lastThrottle = 0;
  }

  reset() {
    this.pause();
    this.resetGuards();
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('mars_edl_sound_muted', this.muted ? 'true' : 'false');
      } catch (_) {}
    }
    if (this.muted) {
      if (this.windGain && this.ctx) this.windGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.02);
      if (this.rumbleGain && this.ctx) this.rumbleGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  isMuted() {
    return this.muted;
  }
}

export const sounds = new SoundEngine();

// Convenience exports matching teammate & existing API
export const playParachuteDeployAudio = () => sounds.playParachuteDeploy();
export const playShieldSepAudio = () => sounds.playSeparation();
export const playRadarLockAudio = () => sounds.playRadarPing();
export const playEngineIgnitionAudio = () => sounds.playAlertBeep();
export const playTouchdownChime = () => sounds.playTouchdownChime();
export const playTelemetryPing = () => sounds.playTelemetryPing();
export const playAlertBeep = () => sounds.playAlertBeep();
export const setAudioMuted = (m) => sounds.setMuted(m);
export const isAudioMuted = () => sounds.isMuted();

export { SoundEngine };
export default sounds;
