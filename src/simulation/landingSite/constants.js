/**
 * constants.js – Configuration parameters and safety thresholds for Mars Landing-Site Analysis.
 *
 * All thresholds are physically motivated and clearly documented.
 */

// ---------------------------------------------------------------------------
// Landing Safety Constraints
// ---------------------------------------------------------------------------
/**
 * Maximum allowable terrain slope for safe lander touchdown (degrees).
 * Typical robotic Mars landers (Viking, Phoenix, InSight) tolerate up to ~10-12°,
 * with MSL / Perseverance sky crane targeting < 8.0° to prevent tip-over.
 */
export const MAX_LANDING_SLOPE_DEG = 8.0; // degrees

/**
 * Maximum allowable crater proximity / topography risk metric (0.0 to 1.0).
 * Any cell with crater risk exceeding this is classified as hazardous.
 */
export const MAX_CRATER_RISK = 0.35; // dimensionless

/**
 * Maximum allowable obstacle risk metric (0.0 to 1.0).
 * Represents boulder clusters, steep rock outcroppings, or rocky ridges.
 */
export const MAX_OBSTACLE_RISK = 0.30; // dimensionless

/**
 * Minimum required obstacle clearance distance (meters).
 * Distance to nearest detected hazard feature must meet or exceed this value.
 */
export const MIN_LANDING_CLEARANCE = 15.0; // meters

// ---------------------------------------------------------------------------
// Safety Grid Configuration
// ---------------------------------------------------------------------------
/**
 * Grid dimension (cells per axis).
 * 21 × 21 = 441 analysis cells centered around the planned landing site.
 */
export const GRID_DIMENSION = 21;

/**
 * Spatial spacing between neighboring grid cell centers (meters).
 * 10.0 m spacing yields a 200 m × 200 m local terrain landing footprint.
 */
export const GRID_SPACING = 10.0; // meters

// ---------------------------------------------------------------------------
// Planned Initial Landing Target (Local Terrain Coordinates in meters)
// ---------------------------------------------------------------------------
/**
 * Initial planned landing target coordinates (x, z in meters).
 * Intentionally positioned near Crater Alpha's rim/wall to demonstrate
 * deterministic hazard detection, rejection, and autonomous retargeting.
 */
export const INITIAL_PLANNED_TARGET = {
  x: 28.0,
  z: 16.0,
  radius: 20.0, // planned landing circle radius (m)
};

// ---------------------------------------------------------------------------
// Safety Scoring Weights (Deterministic Autonomous Selector)
// ---------------------------------------------------------------------------
export const SCORE_WEIGHT_SLOPE = 0.35;
export const SCORE_WEIGHT_CLEARANCE = 0.30;
export const SCORE_WEIGHT_CRATER = 0.20;
export const SCORE_WEIGHT_DISTANCE = 0.15;
