/**
 * terrain.js – Shared MOLA-backed Mars terrain sampler with deterministic fallback.
 *
 * Requirements:
 *   - Completely deterministic and reproducible across runs (zero Math.random()).
 *   - Continuous and smooth enough for numerical gradient slope calculation.
 *   - Computationally lightweight and independent of React.
 *   - Combines:
 *       1. NASA MOLA MEGDR regional elevation (when the local tile is bundled)
 *       2. Deterministic local crater depressions and obstacle detail
 *       3. Deterministic procedural regional fallback when outside/missing MOLA
 */

import molaTile from '../../data/mola-regional.json' with { type: 'json' };
import { MARS_RADIUS, RENDER_SCALE } from '../physics/constants.js';

export const MOLA_TILE = molaTile;
export const TERRAIN_SOURCE = molaTile?.source?.includes('NASA Mars Global Surveyor MOLA') ? 'NASA MOLA' : 'Procedural Fallback';

const DEG_TO_RAD = Math.PI / 180;
const MOLA_BOUNDS = molaTile?.bounds;
const MOLA_ANCHOR = molaTile?.anchor;
const MOLA_VALUES = molaTile?.elevationsMeters;
const MOLA_COLS = molaTile?.ncols || 0;
const MOLA_ROWS = molaTile?.nrows || 0;
const MOLA_PPD = molaTile?.pixelsPerDegree || 0;
const MOLA_ANCHOR_HEIGHT = MOLA_BOUNDS && MOLA_ANCHOR && MOLA_VALUES
  ? sampleMolaAbsolute(MOLA_ANCHOR.latitude, MOLA_ANCHOR.longitude)
  : null;

function sampleMolaAbsolute(latitude, longitude) {
  if (!MOLA_BOUNDS || !MOLA_VALUES || !MOLA_PPD) return null;
  if (latitude < MOLA_BOUNDS.south || latitude > MOLA_BOUNDS.north || longitude < MOLA_BOUNDS.west || longitude > MOLA_BOUNDS.east) return null;

  const column = (longitude - MOLA_BOUNDS.west) * MOLA_PPD;
  const row = (MOLA_BOUNDS.north - latitude) * MOLA_PPD;
  const x0 = Math.min(MOLA_COLS - 1, Math.max(0, Math.floor(column)));
  const z0 = Math.min(MOLA_ROWS - 1, Math.max(0, Math.floor(row)));
  const x1 = Math.min(MOLA_COLS - 1, x0 + 1);
  const z1 = Math.min(MOLA_ROWS - 1, z0 + 1);
  const tx = column - x0;
  const tz = row - z0;
  const h00 = MOLA_VALUES[z0 * MOLA_COLS + x0];
  const h10 = MOLA_VALUES[z0 * MOLA_COLS + x1];
  const h01 = MOLA_VALUES[z1 * MOLA_COLS + x0];
  const h11 = MOLA_VALUES[z1 * MOLA_COLS + x1];
  const north = h00 + (h10 - h00) * tx;
  const south = h01 + (h11 - h01) * tx;
  return north + (south - north) * tz;
}

export function getMolaTerrainHeight(x, z) {
  if (MOLA_ANCHOR_HEIGHT === null) return null;
  const latitude = MOLA_ANCHOR.latitude + (z / MARS_RADIUS) / DEG_TO_RAD;
  const longitude = MOLA_ANCHOR.longitude + (x / (MARS_RADIUS * Math.cos(MOLA_ANCHOR.latitude * DEG_TO_RAD))) / DEG_TO_RAD;
  const absoluteHeight = sampleMolaAbsolute(latitude, longitude);
  return absoluteHeight === null ? null : absoluteHeight - MOLA_ANCHOR_HEIGHT;
}

export function getTerrainSourceInfo() {
  return {
    source: MOLA_ANCHOR_HEIGHT === null ? 'Procedural Fallback' : 'NASA MOLA',
    loaded: MOLA_ANCHOR_HEIGHT !== null,
    product: molaTile?.product || null,
    samples: MOLA_VALUES?.length || 0,
    columns: MOLA_COLS,
    rows: MOLA_ROWS,
    minimumMeters: molaTile?.minElevationMeters ?? null,
    maximumMeters: molaTile?.maxElevationMeters ?? null,
    anchorMeters: MOLA_ANCHOR_HEIGHT,
    bounds: MOLA_BOUNDS || null,
    anchor: MOLA_ANCHOR || null,
  };
}

// ---------------------------------------------------------------------------
// Deterministic Catalog of Landing Zone Topographic Features
// ---------------------------------------------------------------------------
export const CRATERS = [
  {
    id: 'CRATER_ALPHA', // Hazardous feature at initial planned landing target
    cx: 24.0,
    cz: 15.0,
    radius: 28.0,      // rim-to-rim radius in meters
    depth: 16.0,       // central depression depth (m)
    rimHeight: 5.2,    // raised rim height above base terrain (m)
    rimWidth: 8.0,     // rim width (m)
  },
  {
    id: 'CRATER_BETA',
    cx: -65.0,
    cz: 45.0,
    radius: 20.0,
    depth: 9.0,
    rimHeight: 3.2,
    rimWidth: 6.0,
  },
  {
    id: 'CRATER_GAMMA',
    cx: 65.0,
    cz: -50.0,
    radius: 22.0,
    depth: 11.0,
    rimHeight: 3.8,
    rimWidth: 7.0,
  },
];

export const OBSTACLES = [
  {
    id: 'BOULDER_FIELD_NORTH',
    ox: -25.0,
    oz: 30.0,
    radius: 12.0,
    height: 3.5,
  },
  {
    id: 'ROCKY_RIDGE_EAST',
    ox: 50.0,
    oz: 45.0,
    radius: 14.0,
    height: 4.2,
  },
  {
    id: 'BASALT_OUTCROP_SOUTH',
    ox: -15.0,
    oz: -55.0,
    radius: 10.0,
    height: 2.8,
  },
];

// ---------------------------------------------------------------------------
// Procedural Terrain Height
// ---------------------------------------------------------------------------

/**
 * Compute the deterministic terrain elevation at local landing coordinates (x, z).
 *
 * @param {number} x East-West offset in meters.
 * @param {number} z North-South offset in meters.
 * @returns {number} Terrain surface elevation above reference datum in meters.
 */
export function getTerrainHeight(x, z) {
  // The MOLA tile supplies regional topography; these harmonics remain the deterministic fallback.
  const molaHeight = getMolaTerrainHeight(x, z);
  let elevation = molaHeight ?? (
    3.2 * Math.sin(0.016 * x + 0.3) * Math.cos(0.014 * z + 0.5) +
    1.6 * Math.sin(0.038 * x + 1.2) * Math.sin(0.032 * z + 0.8)
  );

  // 2. Craters contribution (parabolic bowl depressions + raised elevated rims)
  for (let i = 0; i < CRATERS.length; i++) {
    const c = CRATERS[i];
    const dx = x - c.cx;
    const dz = z - c.cz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const outerRim = c.radius + c.rimWidth;

    if (dist < c.radius) {
      // Inside crater: steep bowl descending to -depth at center, rising to +rimHeight at rim
      const norm = dist / c.radius; // 0 at center, 1 at rim
      // Smooth cubic polynomial: f(0) = -depth, f(1) = rimHeight
      const bowl = -c.depth * (1.0 - norm * norm) + c.rimHeight * (norm * norm * norm);
      elevation += bowl;
    } else if (dist <= outerRim) {
      // Outer crater rim: raised lip tapering smoothly to 0 at outer boundary
      const u = (dist - c.radius) / c.rimWidth; // 0 at rim crest, 1 at outer boundary
      const lip = c.rimHeight * 0.5 * (1.0 + Math.cos(Math.PI * u));
      elevation += lip;
    }
  }

  // 3. Obstacles contribution (localized boulder bumps / ridges)
  for (let i = 0; i < OBSTACLES.length; i++) {
    const obs = OBSTACLES[i];
    const dx = x - obs.ox;
    const dz = z - obs.oz;
    const distSq = dx * dx + dz * dz;
    const sigmaSq = (obs.radius * 0.5) ** 2;

    if (distSq < (obs.radius * 2.0) ** 2) {
      // Gaussian obstacle profile
      elevation += obs.height * Math.exp(-distSq / (2.0 * sigmaSq));
    }
  }

  return elevation;
}

export function getTerrainRenderHeight(x, z, detailExaggeration = 38) {
  const terrainHeight = getTerrainHeight(x, z);
  const molaHeight = getMolaTerrainHeight(x, z);
  if (molaHeight === null) return terrainHeight * RENDER_SCALE * detailExaggeration;
  const localDetail = terrainHeight - molaHeight;
  return (molaHeight + localDetail * detailExaggeration) * RENDER_SCALE;
}

// ---------------------------------------------------------------------------
// Slope Calculation (Numerical Gradient)
// ---------------------------------------------------------------------------

/**
 * Compute the local terrain surface slope angle in degrees at (x, z).
 * Uses central differences over a small sample distance.
 *
 * @param {number} x East-West offset in meters.
 * @param {number} z North-South offset in meters.
 * @param {number} [sampleDist=1.0] Sample distance for numerical derivative (meters).
 * @returns {number} Terrain slope in degrees (0° = perfectly flat horizontal surface).
 */
export function getTerrainSlope(x, z, sampleDist = 1.0) {
  let dx;
  let dz;
  if (MOLA_ANCHOR_HEIGHT !== null && getMolaTerrainHeight(x, z) !== null) {
    // The global MEGDR is 463 m/sample; estimate regional grade over ~16 km,
    // then add meter-scale procedural crater/obstacle grade at the requested baseline.
    const regionalBaseline = 16000;
    const halfRegional = regionalBaseline * 0.5;
    const molaEast = (getMolaTerrainHeight(x + halfRegional, z) - getMolaTerrainHeight(x - halfRegional, z)) / regionalBaseline;
    const molaNorth = (getMolaTerrainHeight(x, z + halfRegional) - getMolaTerrainHeight(x, z - halfRegional)) / regionalBaseline;
    const detailHeight = (sampleX, sampleZ) => getTerrainHeight(sampleX, sampleZ) - getMolaTerrainHeight(sampleX, sampleZ);
    const detailDx = (detailHeight(x + sampleDist, z) - detailHeight(x - sampleDist, z)) / (2.0 * sampleDist);
    const detailDz = (detailHeight(x, z + sampleDist) - detailHeight(x, z - sampleDist)) / (2.0 * sampleDist);
    dx = molaEast + detailDx;
    dz = molaNorth + detailDz;
  } else {
    const hRight = getTerrainHeight(x + sampleDist, z);
    const hLeft = getTerrainHeight(x - sampleDist, z);
    const hForward = getTerrainHeight(x, z + sampleDist);
    const hBackward = getTerrainHeight(x, z - sampleDist);
    dx = (hRight - hLeft) / (2.0 * sampleDist);
    dz = (hForward - hBackward) / (2.0 * sampleDist);
  }

  const slopeMagnitude = Math.sqrt(dx * dx + dz * dz);
  const slopeAngleRad = Math.atan(slopeMagnitude);

  return (slopeAngleRad * 180.0) / Math.PI;
}

// ---------------------------------------------------------------------------
// Crater Hazard Risk
// ---------------------------------------------------------------------------

/**
 * Calculate the crater risk metric (0.0 = completely safe, 1.0 = extreme crater hazard).
 *
 * @param {number} x East-West coordinate in meters.
 * @param {number} z North-South coordinate in meters.
 * @returns {number} Crater risk metric between 0.0 and 1.0.
 */
export function getCraterRisk(x, z) {
  let maxRisk = 0.0;

  for (let i = 0; i < CRATERS.length; i++) {
    const c = CRATERS[i];
    const dx = x - c.cx;
    const dz = z - c.cz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const outerRim = c.radius + c.rimWidth;

    if (dist <= outerRim) {
      // Peak risk near crater center and steep walls, tapering to 0 at outer rim boundary
      const risk = (1.0 - dist / outerRim) ** 1.5;
      if (risk > maxRisk) {
        maxRisk = risk;
      }
    }
  }

  return Math.min(1.0, Math.max(0.0, maxRisk));
}

// ---------------------------------------------------------------------------
// Obstacle Hazard Risk & Clearance
// ---------------------------------------------------------------------------

/**
 * Calculate the obstacle hazard risk metric (0.0 = clear flat, 1.0 = direct rock collision).
 *
 * @param {number} x East-West coordinate in meters.
 * @param {number} z North-South coordinate in meters.
 * @returns {number} Obstacle risk metric between 0.0 and 1.0.
 */
export function getObstacleRisk(x, z) {
  let totalRisk = 0.0;

  for (let i = 0; i < OBSTACLES.length; i++) {
    const obs = OBSTACLES[i];
    const dx = x - obs.ox;
    const dz = z - obs.oz;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < obs.radius * 1.5) {
      const risk = Math.exp(-(dist * dist) / (2.0 * (obs.radius * 0.45) ** 2));
      totalRisk += risk;
    }
  }

  return Math.min(1.0, Math.max(0.0, totalRisk));
}

/**
 * Compute the distance from (x, z) to the boundary of the nearest hazard (crater rim or boulder).
 *
 * @param {number} x East-West coordinate in meters.
 * @param {number} z North-South coordinate in meters.
 * @returns {number} Clearance distance in meters (0 if inside hazard).
 */
export function getHazardClearance(x, z) {
  let minClearance = 999.0;

  // Clearance from craters (outer rim)
  for (let i = 0; i < CRATERS.length; i++) {
    const c = CRATERS[i];
    const dist = Math.sqrt((x - c.cx) ** 2 + (z - c.cz) ** 2);
    const outerRim = c.radius + c.rimWidth;
    const clearance = dist - outerRim;
    if (clearance < minClearance) {
      minClearance = clearance;
    }
  }

  // Clearance from obstacle boundaries
  for (let i = 0; i < OBSTACLES.length; i++) {
    const obs = OBSTACLES[i];
    const dist = Math.sqrt((x - obs.ox) ** 2 + (z - obs.oz) ** 2);
    const clearance = dist - obs.radius;
    if (clearance < minClearance) {
      minClearance = clearance;
    }
  }

  return Math.max(0.0, minClearance);
}
