/**
 * wind.js – Deterministic mathematical wind shear model for Mars atmosphere.
 *
 * Requirements:
 *   - No random values generated every frame (Math.random() is forbidden).
 *   - Deterministic and reproducible across runs.
 *   - Wind varies smoothly with altitude and simulation time.
 *   - Primarily horizontal wind (X = East/West, Z = North/South).
 *   - Vertical wind (Y) is zero to maintain physical fidelity for EDL descent.
 *
 * Altitude profile:
 *   - Fades to 0 above 125 km (vacuum / exosphere).
 *   - Fades to 0 at surface altitude (boundary layer no-slip condition).
 *   - Peak shear winds in the lower-to-middle atmosphere (5 km - 40 km).
 */

import { WIND_PEAK_SPEED_X, WIND_PEAK_SPEED_Z, ENTRY_INTERFACE_ALTITUDE } from './constants.js';

// Characteristic spatial wavelength for atmospheric shear layers (~18 km)
const SHEAR_WAVELENGTH_X = 18000.0; // m
const SHEAR_WAVELENGTH_Z = 24000.0; // m

// Characteristic time variation period (~120 s)
const TIME_PERIOD_X = 120.0; // s
const TIME_PERIOD_Z = 160.0; // s

/**
 * Compute the deterministic 3D wind velocity vector at a given altitude and simulation time.
 *
 * @param {number} altitude Current altitude above Mars datum (meters).
 * @param {number} [time=0] Current simulation elapsed time (seconds).
 * @returns {{ x: number, y: number, z: number }} Wind velocity vector in m/s.
 */
export function computeWind(altitude, time = 0) {
  // Guard: No atmosphere outside the Mars atmospheric entry interface or below surface
  if (altitude <= 0 || altitude >= ENTRY_INTERFACE_ALTITUDE) {
    return { x: 0, y: 0, z: 0 };
  }

  // Smooth atmospheric envelope factor: 0 at altitude=0, peaks mid-atmosphere, 0 at 125 km
  // Uses a smooth half-sine envelope
  const altNorm = Math.min(1, Math.max(0, altitude / ENTRY_INTERFACE_ALTITUDE));
  const envelope = Math.sin(altNorm * Math.PI);

  // Altitude shear harmonics
  const altPhaseX = (altitude / SHEAR_WAVELENGTH_X) * 2 * Math.PI;
  const altPhaseZ = (altitude / SHEAR_WAVELENGTH_Z) * 2 * Math.PI;

  // Temporal oscillation
  const timePhaseX = (time / TIME_PERIOD_X) * 2 * Math.PI;
  const timePhaseZ = (time / TIME_PERIOD_Z) * 2 * Math.PI;

  // Multi-harmonic horizontal wind velocity
  // X (East-West) component
  const wx =
    WIND_PEAK_SPEED_X *
    envelope *
    (0.7 * Math.sin(altPhaseX + timePhaseX) + 0.3 * Math.sin(altPhaseX * 2.3 + timePhaseX * 1.5));

  // Z (North-South) component
  const wz =
    WIND_PEAK_SPEED_Z *
    envelope *
    (0.75 * Math.cos(altPhaseZ + timePhaseZ) + 0.25 * Math.cos(altPhaseZ * 1.8 - timePhaseZ * 0.8));

  // Y (Vertical) component: zero (EDL models assume hydrostatic balance / negligible vertical winds)
  const wy = 0;

  return {
    x: wx,
    y: wy,
    z: wz,
  };
}
