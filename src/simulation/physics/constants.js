/**
 * constants.js – Mars EDL Simulator physical constants.
 *
 * All values are approximate and chosen for simulation fidelity at
 * the scale of the EDL sequence (~125 km altitude down to surface).
 *
 * Sources / references:
 *   - Mars Atmosphere Model: exponential approximation of COSPAR MIRA
 *   - NASA Mars Fact Sheet (gravity)
 *   - Mars Science Laboratory aeroshell reference values
 *
 * Units: SI (m, kg, s, Pa, kg/m³)
 */

// ---------------------------------------------------------------------------
// Mars Gravitational Acceleration
// ---------------------------------------------------------------------------
/**
 * Surface gravitational acceleration on Mars.
 * Mars GM / R_Mars² ≈ 3.71 m/s²  (vs Earth 9.81 m/s²)
 */
export const MARS_G = 3.71; // m/s²

// ---------------------------------------------------------------------------
// Martian Atmosphere – Exponential Model
// ---------------------------------------------------------------------------
/**
 * Sea-level (surface) atmospheric density on Mars.
 * Approximately 0.020 kg/m³ (Earth surface ≈ 1.225 kg/m³).
 * The Martian atmosphere is ~1% as dense as Earth's.
 */
export const RHO0 = 0.020; // kg/m³  (surface reference density)

/**
 * Atmospheric scale height for Mars.
 * H = R_gas * T_avg / (M_gas * g) ≈ 11,100 m for a CO₂-dominated
 * atmosphere at ~210 K mean temperature.
 * Density falls to 1/e ≈ 37% every 11.1 km.
 */
export const SCALE_HEIGHT = 11100; // m

// ---------------------------------------------------------------------------
// Lander / Aeroshell Aerodynamic Properties
// ---------------------------------------------------------------------------
/**
 * Drag coefficient (Cd) for the aeroshell during hypersonic entry.
 * MSL used Cd ≈ 1.7 for the 70° sphere-cone aeroshell.
 * We use a slightly simplified value of 1.5 for Phase 1.
 */
export const CD_ENTRY = 1.5; // dimensionless

/**
 * Reference cross-sectional area of the aeroshell.
 * MSL aeroshell diameter ≈ 4.5 m  → A = π * (4.5/2)² ≈ 15.9 m²
 * We use 12.0 m² for a smaller lander.
 */
export const REFERENCE_AREA = 12.0; // m²

// ---------------------------------------------------------------------------
// Lander Mass Properties
// ---------------------------------------------------------------------------
/**
 * Initial total entry mass of the lander + aeroshell.
 * MSL entry mass ≈ 3,300 kg.  We use 900 kg for a smaller vehicle.
 */
export const LANDER_MASS = 900.0; // kg

// ---------------------------------------------------------------------------
// Simulation Initial Conditions
// ---------------------------------------------------------------------------
/**
 * Initial entry altitude above the Mars datum (mean surface level).
 * Real EDL entry interface: ~125 km.  We use 80 km for Phase 1 to keep
 * simulation runtime manageable at standard timeStep.
 */
export const INITIAL_ALTITUDE = 80000.0; // m  (80 km)

/**
 * Initial inertial speed at entry interface.
 * Real MSL entry speed ≈ 5,900 m/s.  We use 5,500 m/s.
 */
export const INITIAL_SPEED = 5500.0; // m/s

/**
 * Initial entry flight-path angle (degrees below horizontal).
 * Negative = descending.  MSL used approx −15.5°.
 */
export const INITIAL_FPA_DEG = -15.5; // degrees

// ---------------------------------------------------------------------------
// Simulation Timestep
// ---------------------------------------------------------------------------
/**
 * Fixed physics timestep (seconds).
 * Semi-implicit Euler remains stable at dt ≤ 0.1 s for this problem.
 * 0.05 s gives good resolution without excessive computation.
 */
export const PHYSICS_DT = 0.05; // s

/**
 * Time acceleration factor – multiply wall-clock delta by this to fast-forward.
 * Set to 1 for real-time.  Increase for faster demo runs.
 */
export const TIME_SCALE = 50.0; // dimensionless (50× faster than real-time)

// ---------------------------------------------------------------------------
// Ground / Surface
// ---------------------------------------------------------------------------
/**
 * Altitude at which the lander is considered to have contacted the surface.
 * Small positive value to account for lander geometry height.
 */
export const GROUND_ALTITUDE = 0.5; // m

// ---------------------------------------------------------------------------
// Mars Planetary & Orbital Constants
// ---------------------------------------------------------------------------
/**
 * Mean radius of Mars in meters (COSPAR reference).
 * 3,389.5 km.
 */
export const MARS_RADIUS = 3389500.0; // m

/**
 * Standard gravitational parameter for Mars (GM_Mars).
 * mu = G * M_Mars ≈ 4.282837e13 m³/s².
 */
export const MARS_MU = 4.282837e13; // m³/s²

/**
 * Circular parking orbit altitude above Mars surface.
 * 250 km.
 */
export const ORBIT_ALTITUDE = 250000.0; // m

/**
 * Mars atmospheric entry interface altitude.
 * 125 km (standard NASA/JPL definition where aerodynamic effects begin).
 */
export const ENTRY_INTERFACE_ALTITUDE = 125000.0; // m

// ---------------------------------------------------------------------------
// Deorbit Propulsion System Constants
// ---------------------------------------------------------------------------
/**
 * Target retrograde delta-v for deorbit burn.
 * 125 m/s reduces orbital speed to lower periapsis into the atmosphere.
 */
export const DEORBIT_DELTA_V = 125.0; // m/s

/**
 * Thrust delivered by deorbit engine.
 */
export const DEORBIT_THRUST = 4500.0; // N

/**
 * Specific impulse of the deorbit propulsion system.
 */
export const DEORBIT_ISP = 310.0; // s

/**
 * Standard Earth gravitational acceleration used for Isp propellant mass flow.
 */
export const G0_STANDARD = 9.80665; // m/s²

/**
 * Initial usable propellant mass.
 */
export const PROPELLANT_MASS = 300.0; // kg

/**
 * Dry mass of spacecraft (structure, avionics, payload, aeroshell).
 */
export const DRY_MASS = 600.0; // kg

/**
 * Total initial wet mass (DRY_MASS + PROPELLANT_MASS = 900 kg).
 */
export const TOTAL_INITIAL_MASS = 900.0; // kg

// ---------------------------------------------------------------------------
// Aerodynamic Heating (Sutton-Graves Formulation)
// ---------------------------------------------------------------------------
/**
 * Sutton-Graves stagnation-point convective heat flux coefficient for Mars (CO2/N2 atmosphere).
 * q_heat = k * sqrt(rho) * v^3
 * Unit: W/(m² · (kg/m³)^0.5 · (m/s)³)
 */
export const K_SUTTON_GRAVES = 1.7415e-4;

/**
 * Nominal reference maximum heat flux for visual normalization (W/m²).
 * MSL experienced ~2.0 - 2.5 MW/m² peak stagnation heat flux.
 */
export const MAX_HEAT_FLUX_REF = 2.5e6; // W/m² (250 W/cm²)

// ---------------------------------------------------------------------------
// Parachute Deployment & Aerodynamic Properties (Phase 3A)
// ---------------------------------------------------------------------------
/**
 * Altitude trigger threshold for parachute deployment (meters).
 * MSL / Perseverance deployed at ~10-11 km altitude.
 */
export const PARACHUTE_DEPLOY_ALTITUDE = 10000.0; // m (10 km)

/**
 * Maximum airspeed threshold for safe parachute deployment (m/s).
 * Mars supersonic disk-gap-band parachutes deploy at Mach 1.5 - 2.0 (~400-450 m/s).
 * At 10 km, simulation natural entry speed decelerates to ~266 m/s, safely within 450 m/s.
 */
export const PARACHUTE_DEPLOY_MAX_SPEED = 450.0; // m/s

/**
 * Minimum atmospheric density threshold for parachute inflation (kg/m³).
 * Ensures vehicle has entered sufficient atmospheric density.
 * At 10 km, Mars density is ~0.0081 kg/m³, exceeding this 0.004 kg/m³ threshold.
 */
export const PARACHUTE_DEPLOY_MIN_DENSITY = 0.004; // kg/m³

/**
 * Parachute drag coefficient (Cd).
 * Typical disk-gap-band (DGB) supersonic parachute Cd ≈ 1.5 - 1.7.
 */
export const PARACHUTE_CD = 1.6; // dimensionless

/**
 * Parachute canopy reference area (m²).
 * For a ~16-18 m diameter canopy, A ≈ π * r² ≈ 200 - 250 m².
 */
export const PARACHUTE_AREA = 220.0; // m²

/**
 * Simulated canopy inflation / deployment duration (seconds).
 * The effective area ramps smoothly from 0 to 1 over this period to prevent numerical shock.
 */
export const PARACHUTE_DEPLOY_DURATION = 4.8; // seconds

// ---------------------------------------------------------------------------
// Environmental Wind Parameters (Phase 3A)
// ---------------------------------------------------------------------------
/**
 * Nominal peak horizontal wind shear amplitude (m/s).
 */
export const WIND_PEAK_SPEED_X = 22.0; // m/s
export const WIND_PEAK_SPEED_Z = 14.0; // m/s

// ---------------------------------------------------------------------------
// Rendering Scale
// ---------------------------------------------------------------------------
/**
 * Scale factor mapping physical simulation meters to Three.js world units.
 * 1 Three.js unit = 1,000 meters = 1 km.
 * 250,000 m orbit = 250 Three.js units.
 * Mars radius = 3,389.5 Three.js units.
 */
export const RENDER_SCALE = 1 / 1000;

// ---------------------------------------------------------------------------
// Mars 2020 Jezero Crater Landing Site Datum
// ---------------------------------------------------------------------------
/**
 * Global physics coordinates of the Jezero Crater landing target datum (meters).
 * 1 Three.js render unit = 1,000 m → 3324.010 Three.js units.
 * This coordinate is permanently fixed on Mars — terrain does NOT move.
 */
export const JEZERO_TARGET_X = 3324010.0; // m
export const JEZERO_TARGET_Y = -2726425.5; // m (Spherical surface Y coordinate at Jezero)
export const JEZERO_TARGET_Z = 85.0;     // m
export const ROVER_WHEEL_CONTACT_OFFSET = 0.54; // m (Rover origin to wheel bottom contact plane)
export const ROVER_WHEEL_CONTACT_Y = -0.54; // Wheel bottom contact plane relative to rover origin
export const ROVER_WHEEL_RADIUS = 0.2625; // m (52.5 cm diameter / 2)
export const ROVER_WHEEL_DIAMETER = 0.525;
export const ROVER_WHEEL_WIDTH = 0.25;

// 6 Wheel Centers in local Rover coordinates (matches 2.7m track width & 2.1m wheelbase)
export const ROVER_WHEEL_COORDS = [
  { id: 'FL', name: 'Front-Left Wheel',   x: -1.15, z:  1.05, steerable: true  },
  { id: 'FR', name: 'Front-Right Wheel',  x:  1.15, z:  1.05, steerable: true  },
  { id: 'ML', name: 'Middle-Left Wheel',  x: -1.20, z:  0.00, steerable: false },
  { id: 'MR', name: 'Middle-Right Wheel', x:  1.20, z:  0.00, steerable: false },
  { id: 'RL', name: 'Rear-Left Wheel',    x: -1.15, z: -1.05, steerable: true  },
  { id: 'RR', name: 'Rear-Right Wheel',   x:  1.15, z: -1.05, steerable: true  },
];

// ---------------------------------------------------------------------------
// Mars 2020 EDL Staging Milestones & Staging Thresholds
// ---------------------------------------------------------------------------
/**
 * Heat shield jettison altitude (meters).
 * Exposes the terminal descent radar and Lander Vision System (LVS) camera.
 */
export const HEAT_SHIELD_SEP_ALTITUDE = 8000.0; // m (8 km)

/**
 * Terminal descent radar altimeter ground lock acquisition threshold (meters).
 */
export const RADAR_LOCK_ALTITUDE = 4000.0; // m (4 km)

/**
 * Backshell and supersonic parachute separation altitude (meters).
 * Vehicle transitions to powered retro-propulsion descent.
 */
export const BACKSHELL_SEP_ALTITUDE = 1800.0; // m (1.8 km)

/**
 * Terminal powered descent / Sky Crane activation altitude (meters).
 */
export const TERMINAL_POWERED_ALTITUDE = 30.0; // m

/**
 * Descent stage total throttleable thrust (Newtons).
 * Mars 2020 Sky Crane descent stage: 8 × 4,000 N Mars Lander Engines (MLEs).
 */
export const DESCENT_STAGE_THRUST = 32000.0; // N

/**
 * Mean speed of sound in Martian cold CO2 atmosphere (~210 K).
 */
export const MARS_SPEED_OF_SOUND = 225.0; // m/s

/**
 * Maximum safe touchdown vertical velocity threshold (< 2.5 m/s).
 */
export const TOUCHDOWN_MAX_SAFE_SPEED = 2.5; // m/s
export const TOUCHDOWN_NOMINAL_SPEED = 0.75; // m/s

/**
 * Free-fall duration after backshell separation before 8 MLE rocket ignition (seconds).
 * Allows descent stage to clear the jettisoned parachute and backshell.
 */
export const BACKSHELL_FREEFALL_DURATION = 1.2; // s

/**
 * Sky Crane hover altitude and bridle cable extension length (meters).
 */
export const SKY_CRANE_HOVER_ALTITUDE = 21.0; // m
export const SKY_CRANE_CABLE_LENGTH = 7.5; // m

