/**
 * orbit.js – Mars two-body Keplerian orbital mechanics and deorbit propulsion.
 *
 * All calculations use SI units (meters, seconds, kg, N).
 * Unified simulation frame:
 *   Mars center is located at (0, -MARS_RADIUS, 0).
 *   The local landing terrain corresponds to y ≈ 0.
 *   Distance from Mars center: r = sqrt(x² + (y + MARS_RADIUS)² + z²)
 *   Altitude: h = r - MARS_RADIUS
 */

import {
  MARS_RADIUS,
  MARS_MU,
  ORBIT_ALTITUDE,
  ENTRY_INTERFACE_ALTITUDE,
  DEORBIT_THRUST,
  DEORBIT_ISP,
  G0_STANDARD,
  K_SUTTON_GRAVES,
  RENDER_SCALE,
} from './constants.js';

// ---------------------------------------------------------------------------
// 1. Orbital Geometry and Radius
// ---------------------------------------------------------------------------

/**
 * Compute distance from Mars center for coordinates in the simulation frame.
 *
 * @param {number} x  Sim X (east)
 * @param {number} y  Sim Y (altitude near 0, elevated in orbit)
 * @param {number} z  Sim Z (south)
 * @returns {number} Distance from Mars center (m)
 */
export function getDistanceToMarsCenter(x, y, z) {
  const cy = y + MARS_RADIUS;
  return Math.sqrt(x * x + cy * cy + z * z);
}

/**
 * Compute altitude above Mars mean datum (h = r - R_Mars).
 *
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {number} Altitude in meters
 */
export function getAltitudeFromCenter(x, y, z) {
  return getDistanceToMarsCenter(x, y, z) - MARS_RADIUS;
}

/**
 * Circular orbital velocity for a given altitude above Mars.
 *   v = sqrt(mu / (R_Mars + h))
 *
 * For h = 250 km:
 *   r = 3,639,500 m
 *   v ≈ 3430.4 m/s
 *
 * @param {number} altitude  Altitude above surface (m).
 * @returns {number} Orbital velocity (m/s).
 */
export function getCircularOrbitalSpeed(altitude = ORBIT_ALTITUDE) {
  const r = MARS_RADIUS + altitude;
  return Math.sqrt(MARS_MU / r);
}

// ---------------------------------------------------------------------------
// 2. Central Mars Gravity
// ---------------------------------------------------------------------------

/**
 * Central Mars gravitational acceleration vector:
 *   a_gravity = -mu / r³ * r_vec
 *
 * where r_vec = (x, y + MARS_RADIUS, z) points from Mars center to spacecraft.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {{ ax: number, ay: number, az: number }} Acceleration components in m/s².
 */
export function centralGravityAcceleration(x, y, z) {
  const rx = x;
  const ry = y + MARS_RADIUS;
  const rz = z;
  const r2 = rx * rx + ry * ry + rz * rz;
  const r = Math.sqrt(r2);

  if (r < 1e-6) {
    return { ax: 0, ay: 0, az: 0 };
  }

  // -mu / r³
  const factor = -MARS_MU / (r2 * r);

  return {
    ax: factor * rx,
    ay: factor * ry,
    az: factor * rz,
  };
}

// ---------------------------------------------------------------------------
// 3. Deorbit Propulsion
// ---------------------------------------------------------------------------

/**
 * Calculate retrograde deorbit thrust vector.
 * Thrust acts in the direction directly opposing the velocity vector:
 *   u_retrograde = -v_vec / |v|
 *   F_thrust = thrust * u_retrograde
 *
 * @param {number} vx Velocity X (m/s)
 * @param {number} vy Velocity Y (m/s)
 * @param {number} vz Velocity Z (m/s)
 * @param {number} [thrust] Engine thrust in Newtons (defaults to DEORBIT_THRUST)
 * @returns {{ fx: number, fy: number, fz: number }} Thrust force vector in N.
 */
export function computeDeorbitThrust(vx, vy, vz, thrust = DEORBIT_THRUST) {
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (speed < 1e-6) {
    return { fx: 0, fy: 0, fz: 0 };
  }

  const invSpeed = 1.0 / speed;
  return {
    fx: -thrust * (vx * invSpeed),
    fy: -thrust * (vy * invSpeed),
    fz: -thrust * (vz * invSpeed),
  };
}

/**
 * Propellant mass flow rate for rocket thrust:
 *   dm/dt = T / (Isp * g0)
 *
 * @param {number} thrust Engine thrust in N.
 * @param {number} [Isp]   Specific impulse in s.
 * @param {number} [g0]    Standard gravity in m/s².
 * @returns {number} Mass consumption rate in kg/s.
 */
export function computeMassFlowRate(thrust = DEORBIT_THRUST, Isp = DEORBIT_ISP, g0 = G0_STANDARD) {
  return thrust / (Isp * g0);
}

// ---------------------------------------------------------------------------
// 4. Aerodynamic Heating (Sutton-Graves)
// ---------------------------------------------------------------------------

/**
 * Compute stagnation-point convective heat flux:
 *   q_heat = k * sqrt(rho) * v³
 *
 * @param {number} rho   Atmospheric density (kg/m³).
 * @param {number} speed Air-relative speed (m/s).
 * @returns {number} Heat flux in W/m².
 */
export function computeHeatFlux(rho, speed) {
  if (rho <= 0 || speed <= 0) return 0;
  return K_SUTTON_GRAVES * Math.sqrt(rho) * (speed * speed * speed);
}

// ---------------------------------------------------------------------------
// 5. Orbital Parameters Telemetry
// ---------------------------------------------------------------------------

/**
 * Compute classical Keplerian orbital parameters from state vectors.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} vx
 * @param {number} vy
 * @param {number} vz
 * @returns {object} Orbital telemetry parameters.
 */
export function computeOrbitalParameters(x, y, z, vx, vy, vz) {
  const rx = x;
  const ry = y + MARS_RADIUS;
  const rz = z;
  const r = Math.sqrt(rx * rx + ry * ry + rz * rz);
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

  // Specific orbital energy: E = v²/2 - mu/r
  const energy = 0.5 * speed * speed - MARS_MU / r;

  // Specific angular momentum: h = r x v
  const hx = ry * vz - rz * vy;
  const hy = rz * vx - rx * vz;
  const hz = rx * vy - ry * vx;
  const hMag = Math.sqrt(hx * hx + hy * hy + hz * hz);

  // Semi-major axis: a = -mu / (2*E)
  const a = energy !== 0 ? -MARS_MU / (2 * energy) : r;

  // Eccentricity: e = sqrt(max(0, 1 + 2*E*h² / mu²))
  const eTerm = 1 + (2 * energy * hMag * hMag) / (MARS_MU * MARS_MU);
  const eccentricity = Math.sqrt(Math.max(0, eTerm));

  // Apoapsis & Periapsis radii
  const rApoapsis = a * (1 + eccentricity);
  const rPeriapsis = a * (1 - eccentricity);

  const apoapsisAlt = rApoapsis - MARS_RADIUS;
  const periapsisAlt = rPeriapsis - MARS_RADIUS;

  return {
    radius: r,
    altitude: r - MARS_RADIUS,
    speed,
    energy,
    angularMomentum: hMag,
    semiMajorAxis: a,
    eccentricity,
    apoapsisAlt,
    periapsisAlt,
  };
}

// ---------------------------------------------------------------------------
// 6. Trajectory Path Generators for Three.js Rendering
// ---------------------------------------------------------------------------

/**
 * Generate 3D points for the circular parking orbit in Three.js world scale.
 * Orbit lies in the X-Y plane around Mars center (0, -MARS_RADIUS * SCALE, 0).
 *
 * @param {number} [altitude] Orbit altitude (m).
 * @param {number} [segments] Number of segments.
 * @returns {Float32Array} Packed XYZ vertices for Three.js BufferGeometry.
 */
export function generateParkingOrbitPoints(altitude = ORBIT_ALTITUDE, segments = 180) {
  const rRender = (MARS_RADIUS + altitude) * RENDER_SCALE;
  const centerY = -MARS_RADIUS * RENDER_SCALE;
  const points = new Float32Array((segments + 1) * 3);

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    // X = r * sin(theta), Y = centerY + r * cos(theta), Z = 0
    points[i * 3 + 0] = rRender * Math.sin(theta);
    points[i * 3 + 1] = centerY + rRender * Math.cos(theta);
    points[i * 3 + 2] = 0;
  }

  return points;
}
