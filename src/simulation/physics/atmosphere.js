/**
 * atmosphere.js – Martian atmospheric density model.
 *
 * Model: single-layer exponential (barometric formula).
 *
 *   rho(h) = rho0 * exp( -h / H )
 *
 * where:
 *   rho0  = surface reference density  (RHO0,        kg/m³)
 *   h     = altitude above datum       (m)
 *   H     = atmospheric scale height   (SCALE_HEIGHT, m)
 *
 * This approximation is valid from the surface up to ~80 km.
 * Above ~100 km the real atmosphere becomes far thinner than this
 * model predicts, but for EDL purposes (entry interface at 80 km)
 * it provides acceptable fidelity.
 *
 * A more accurate implementation would use the GRAM-Mars or
 * MarsGRAM tabulated profiles; those are reserved for a later phase.
 */

import { RHO0, SCALE_HEIGHT } from './constants.js';

/**
 * Compute atmospheric density at a given altitude.
 *
 * @param {number} altitude_m  Altitude above Mars datum, in metres.
 *                             Clamped to zero for sub-surface values.
 * @returns {number}           Atmospheric density in kg/m³.
 */
export function atmosphericDensity(altitude_m) {
  // Clamp: no negative altitudes in the model
  const h = Math.max(0, altitude_m);

  // Exponential barometric formula
  return RHO0 * Math.exp(-h / SCALE_HEIGHT);
}

/**
 * Compute approximate dynamic (atmospheric) pressure scale at altitude.
 * Useful for quick threshold checks without a full velocity term.
 *
 * @param {number} altitude_m  Altitude in metres.
 * @returns {number}           Density in kg/m³.
 */
export function densityAtAltitude(altitude_m) {
  return atmosphericDensity(altitude_m);
}
