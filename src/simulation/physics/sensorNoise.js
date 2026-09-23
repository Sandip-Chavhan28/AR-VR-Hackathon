/**
 * sensorNoise.js – Deterministic mathematical sensor noise model.
 *
 * Requirements:
 *   - Completely deterministic and reproducible across simulation runs.
 *   - No Math.random() calls.
 *   - Multi-frequency harmonic formulation:
 *       noise(t) = A1 * sin(f1 * t + p1) + A2 * sin(f2 * t + p2)
 *   - Strict separation of TRUE state vs MEASURED sensor state:
 *       Sensor noise NEVER corrupts or modifies the actual physics state or integrator.
 *   - Produces realistic measurement jitter for:
 *       • Radar / barometric altimeter (altitude)
 *       • Pitot-static / air data system (airspeed / dynamic pressure)
 *       • Doppler radar (vertical velocity)
 *       • Inertial measurement unit (IMU acceleration)
 */

export const SENSOR_NOISE_CONFIG = {
  altitude: {
    // Altimeter noise (~±12 m nominal jitter)
    a1: 9.5,  f1: 1.3, p1: 0.42,
    a2: 3.2,  f2: 3.7, p2: 1.85,
  },
  speed: {
    // Airspeed / Doppler velocity noise (~±1.5 m/s)
    a1: 1.2,  f1: 2.1, p1: 1.10,
    a2: 0.4,  f2: 5.3, p2: 2.74,
  },
  verticalVelocity: {
    // Descent rate sensor noise (~±1.0 m/s)
    a1: 0.85, f1: 1.8, p1: 0.95,
    a2: 0.35, f2: 4.6, p2: 3.14,
  },
  dynamicPressure: {
    // Pressure transducer noise (~±4 Pa)
    a1: 3.5,  f1: 2.7, p1: 0.63,
    a2: 1.2,  f2: 6.9, p2: 1.47,
  },
  acceleration: {
    // Accelerometer noise (~±0.25 m/s²)
    a1: 0.18, f1: 3.4, p1: 0.55,
    a2: 0.08, f2: 8.1, p2: 2.30,
  },
};

/**
 * Compute deterministic harmonic noise for a given sensor channel at time t.
 *
 * @param {{ a1: number, f1: number, p1: number, a2: number, f2: number, p2: number }} cfg
 * @param {number} t Time in seconds
 * @returns {number} Noise offset
 */
export function computeHarmonicNoise(cfg, t) {
  return cfg.a1 * Math.sin(cfg.f1 * t + cfg.p1) + cfg.a2 * Math.sin(cfg.f2 * t + cfg.p2);
}

/**
 * Compute measured sensor state from the true physical simulation state.
 *
 * IMPORTANT: This function is purely read-only on trueState and does not mutate it.
 *
 * @param {object} trueState True physical simulation state.
 * @param {number} [time] Simulation time to sample noise at (defaults to trueState.elapsed).
 * @param {boolean} [noiseEnabled=true] Whether sensor noise is active.
 * @returns {object} Measured sensor state object.
 */
export function computeMeasuredState(trueState, time, noiseEnabled = true) {
  const t = time !== undefined ? time : (trueState.elapsed || 0);

  if (!noiseEnabled) {
    return {
      altitude: trueState.altitude || 0,
      speed: trueState.speed || 0,
      verticalVelocity: trueState.verticalVelocity || 0,
      q: trueState.q || 0,
      ax: trueState.ax || 0,
      ay: trueState.ay || 0,
      az: trueState.az || 0,
    };
  }

  const altNoise = computeHarmonicNoise(SENSOR_NOISE_CONFIG.altitude, t);
  const spdNoise = computeHarmonicNoise(SENSOR_NOISE_CONFIG.speed, t);
  const vvNoise = computeHarmonicNoise(SENSOR_NOISE_CONFIG.verticalVelocity, t);
  const qNoise = computeHarmonicNoise(SENSOR_NOISE_CONFIG.dynamicPressure, t);
  const accNoise = computeHarmonicNoise(SENSOR_NOISE_CONFIG.acceleration, t);

  return {
    altitude: Math.max(0, (trueState.altitude || 0) + altNoise),
    speed: Math.max(0, (trueState.speed || 0) + spdNoise),
    verticalVelocity: (trueState.verticalVelocity || 0) + vvNoise,
    q: Math.max(0, (trueState.q || 0) + qNoise),
    ax: (trueState.ax || 0) + accNoise * 0.5,
    ay: (trueState.ay || 0) + accNoise,
    az: (trueState.az || 0) + accNoise * 0.3,
  };
}
