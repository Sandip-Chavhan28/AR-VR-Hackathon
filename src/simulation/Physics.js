// Mars EDL 3-DoF Atmospheric Flight Dynamics & Guidance Engine
// Implements Martian exponential atmosphere, Sutton-Graves aerothermal heating,
// aerodynamic drag & lift, gravity, and autonomous GN&C closed-loop control.

export const MARS_GRAVITY = 3.72; // m/s^2
export const EARTH_G0 = 9.80665;   // for G-load calculations
export const MARS_RADIUS = 3389500; // m
export const RHO_0 = 0.020;        // kg/m^3 at surface
export const SCALE_HEIGHT = 11100; // m
export const SPEED_OF_SOUND = 240; // m/s (Martian CO2 average)

// Spacecraft Properties (Mars 2020 Perseverance Class)
export const VEHICLE = {
  entryMass: 3350,       // kg (Aeroshell + Cruise balance + Rover)
  parachuteMass: 1800,   // kg (Backshell + Descent stage + Rover after heat shield drop)
  descentStageMass: 1050,// kg (Sky crane dry)
  roverMass: 1025,       // kg (Perseverance rover)
  initialFuel: 400,      // kg hydrazine monopropellant
  aeroshellRadius: 2.25, // m (diameter 4.5m)
  aeroshellArea: Math.PI * Math.pow(2.25, 2), // ~15.9 m^2
  parachuteDiameter: 21.5,// m Supersonic Disk-Gap-Band chute
  parachuteArea: Math.PI * Math.pow(21.5 / 2, 2), // ~363 m^2
  cdHypersonic: 1.68,    // Blunt body drag coefficient
  cdParachute: 0.62,     // Chute drag coefficient
  maxThrustPerEngine: 3100, // N (8 Mars Lander Engines = up to 24.8 kN total)
  numEngines: 8,
  isp: 225,              // seconds (Hydrazine thruster specific impulse)
};

/**
 * Calculates atmospheric density at Martian altitude h (meters)
 */
export function marsDensity(altitude) {
  if (altitude < 0) return RHO_0;
  // Multi-layer piecewise approximation of Mars climate database
  if (altitude > 100000) return 0;
  return RHO_0 * Math.exp(-altitude / SCALE_HEIGHT);
}

/**
 * Dynamic pressure q = 0.5 * rho * v^2 in Pascals
 */
export function dynamicPressure(density, speed) {
  return 0.5 * density * speed * speed;
}

/**
 * Sutton-Graves stagnation point convective heat flux (W/cm^2)
 * Q = k * sqrt(rho / Rn) * V^3
 */
export function aerothermalHeatFlux(density, speed) {
  if (speed < 100 || density <= 0) return 0;
  const k = 1.898e-4; // CO2 atmosphere constant
  const noseRadius = 0.75; // meters effective nose radius
  const fluxWcm2 = k * Math.sqrt(density / noseRadius) * Math.pow(speed, 3);
  return Math.max(0, fluxWcm2);
}

/**
 * Approximates heat shield surface equilibrium temperature in Celsius
 */
export function heatShieldTemperature(fluxWcm2) {
  if (fluxWcm2 <= 0) return -60; // ambient Mars upper atmosphere
  // Stefan-Boltzmann radiative equilibrium: flux = epsilon * sigma * T^4
  const sigma = 5.670374e-8; // W / (m^2 K^4)
  const epsilon = 0.85;      // Carbon-phenolic emissivity
  const fluxWm2 = fluxWcm2 * 10000;
  const tempK = Math.pow(fluxWm2 / (epsilon * sigma), 0.25);
  return Math.min(2200, Math.round(tempK - 273.15));
}

/**
 * Calculates Mach number in Martian atmosphere
 */
export function machNumber(speed) {
  return speed / SPEED_OF_SOUND;
}

/**
 * PID Controller helper for autonomous guidance
 */
export class PIDController {
  constructor(kp, ki, kd, minOut = -Infinity, maxOut = Infinity) {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
    this.minOut = minOut;
    this.maxOut = maxOut;
    this.integral = 0;
    this.lastError = 0;
  }

  reset() {
    this.integral = 0;
    this.lastError = 0;
  }

  update(target, current, dt) {
    if (dt <= 0) return 0;
    const error = target - current;
    this.integral += error * dt;
    this.integral = Math.max(-50, Math.min(50, this.integral)); // anti-windup
    const derivative = (error - this.lastError) / dt;
    this.lastError = error;

    const out = this.kp * error + this.ki * this.integral + this.kd * derivative;
    return Math.max(this.minOut, Math.min(this.maxOut, out));
  }
}