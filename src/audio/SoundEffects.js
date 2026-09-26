// Web Audio API Synthesized NASA EDL Sound Generator
// Procedurally generates authentic space mission soundscapes with zero external audio assets

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.muted = false;
    this.rumbleNode = null;
    this.rumbleGain = null;
    this.windNode = null;
    this.windGain = null;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initialized = true;
      this.setupContinuousSounds();
    } catch (e) {
      console.warn("Web Audio not supported", e);
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
  }

  setHeatIntensity(intensity) {
    if (!this.ctx || this.muted) return;
    const targetGain = Math.min(0.28, intensity * 0.28);
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
    }
  }

  setRocketThrottle(throttle) {
    if (!this.ctx || this.muted) return;
    const targetGain = Math.min(0.4, throttle * 0.4);
    if (this.rumbleGain) {
      this.rumbleGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
    }
  }

  playParachuteDeploy() {
    if (!this.ctx || this.muted) return;
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

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      if (this.windGain) this.windGain.gain.value = 0;
      if (this.rumbleGain) this.rumbleGain.gain.value = 0;
    }
    return this.muted;
  }
}

export const sounds = new SoundEngine();
