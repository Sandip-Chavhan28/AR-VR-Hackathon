/**
 * missionEvents.js – Mars 2020 EDL Mission Milestones, State Scrubbing & Event Dispatcher.
 *
 * Provides:
 *   1. Canonical 13-stage EDL Milestones metadata matching NASA/JPL Mars 2020 EDL timeline.
 *   2. Milestone detection from current continuous physics state.
 *   3. Scrubbing/Jumping directly to any milestone with mathematically consistent initial conditions.
 *   4. Lightweight event pub/sub for UI notifications, audio triggers, and camera cues.
 */

import {
  MARS_RADIUS,
  ORBIT_ALTITUDE,
  ENTRY_INTERFACE_ALTITUDE,
  HEAT_SHIELD_SEP_ALTITUDE,
  RADAR_LOCK_ALTITUDE,
  BACKSHELL_SEP_ALTITUDE,
  TERMINAL_POWERED_ALTITUDE,
  GROUND_ALTITUDE,
  DEORBIT_DELTA_V,
  PROPELLANT_MASS,
  DRY_MASS,
  JEZERO_TARGET_X,
  JEZERO_TARGET_Y,
  JEZERO_TARGET_Z,
} from './physics/constants.js';
import { atmosphericDensity } from './physics/atmosphere.js';
import { getCircularOrbitalSpeed, getDistanceToMarsCenter } from './physics/orbit.js';
import { INITIAL_PLANNED_TARGET } from './landingSite/constants.js';
import { performLandingSiteAnalysis } from './landingSite/landingSiteAnalysis.js';

// ---------------------------------------------------------------------------
// 1. Canonical EDL Milestones Definition
// ---------------------------------------------------------------------------
export const EDL_MILESTONES = [
  {
    id: 'ORBIT',
    title: 'Cruise Stage & Orbit',
    badge: 'PARKING ORBIT',
    altKm: 250,
    speedMps: 3430,
    description: 'Stable 250 km circular parking orbit above Mars datum with Cruise Stage attached.',
    narrative: 'The spacecraft cruises toward the red planet in its interplanetary configuration. The attached annular Cruise Stage provides solar power, telemetry communications, and attitude monitoring prior to the critical Entry, Descent, and Landing sequence.',
    countdownEstSec: 1918,
    nextMilestone: 'Deorbit Burn',
    timeToNextSec: 6,
    cameraMode: 'ORBIT_OVERVIEW',
  },
  {
    id: 'DEORBIT_BURN',
    title: 'Deorbit Burn',
    badge: 'RETRO-PROPULSION',
    altKm: 250,
    speedMps: 3305,
    description: 'Retrograde thruster firing delivers 125 m/s ΔV to lower periapsis into the Martian atmosphere.',
    narrative: 'Descent thrusters fire retrograde against the orbital velocity vector. Delivering 125 m/s of precise delta-V lowers orbital periapsis deep into the upper Martian atmosphere, establishing the suborbital entry corridor.',
    countdownEstSec: 1912,
    nextMilestone: 'Cruise Stage Separation',
    timeToNextSec: 25,
    cameraMode: 'CHASE',
  },
  {
    id: 'COAST_TO_ENTRY',
    title: 'Cruise Stage Separation',
    badge: 'COAST PHASE',
    altKm: 180,
    speedMps: 3350,
    description: 'Cruise stage separates; entry capsule de-spins and coasts toward the atmospheric entry interface.',
    narrative: 'Ten minutes before atmospheric entry, the solar-powered Cruise Stage is jettisoned and drifts away into space. The entry capsule fires tiny reaction control thrusters to halt its rotation and orient its thermal heat shield into the oncoming flight path.',
    countdownEstSec: 1887,
    nextMilestone: 'Atmospheric Entry Interface',
    timeToNextSec: 790,
    cameraMode: 'CHASE',
  },
  {
    id: 'ENTRY_INTERFACE',
    title: 'Entry Interface (EI)',
    badge: 'E-0 INTERFACE',
    altKm: 125,
    speedMps: 3428,
    description: 'Spacecraft reaches 125 km altitude; hypersonic atmospheric interaction begins.',
    narrative: 'The spacecraft crosses the atmospheric entry interface at 125 km (approx. 410,000 feet) traveling at Mach 15. The thin upper atmosphere begins to compress ahead of the blunt heat shield, generating the first measurable aerodynamic deceleration.',
    countdownEstSec: 822,
    nextMilestone: 'Peak Aerodynamic Heating',
    timeToNextSec: 325,
    cameraMode: 'CHASE',
  },
  {
    id: 'PEAK_HEATING',
    title: 'Peak Heating & Deceleration',
    badge: 'HYPERSONIC AERO',
    altKm: 45,
    speedMps: 2400,
    description: 'Hypersonic atmospheric braking; extreme stagnation shockwave and incandescent plasma sheath.',
    narrative: 'Peak heating occurs ~80 seconds after entry interface. Friction and shockwave compression heat the carbon-phenolic heat shield to over 1,300°C (2,370°F), forming a glowing ionized plasma sheath that temporarily attenuates radio communications.',
    countdownEstSec: 498,
    nextMilestone: 'Parachute Deployment',
    timeToNextSec: 164,
    cameraMode: 'HEAT_SHIELD_CAM',
  },
  {
    id: 'PARACHUTE_DEPLOY',
    title: 'Parachute Deployment',
    badge: 'SUPERSONIC DGB',
    altKm: 10,
    speedMps: 266,
    description: 'Supersonic 21.5m Disk-Gap-Band parachute deploys via Range Trigger algorithm at Mach 1.7.',
    narrative: 'The 21.5-meter Disk-Gap-Band parachute is deployed by a mortar at Mach 1.7. Mars 2020 uses autonomous Range Trigger technology to calculate the precise distance to the target and deploy at the optimum moment, shrinking the landing ellipse by over 50%.',
    countdownEstSec: 334,
    nextMilestone: 'Heat Shield Separation',
    timeToNextSec: 20,
    cameraMode: 'PARACHUTE_LOOKUP',
  },
  {
    id: 'HEAT_SHIELD_SEP',
    title: 'Heat Shield Jettison',
    badge: 'HEAT SHIELD SEP',
    altKm: 8,
    speedMps: 75,
    description: 'Heat shield releases, uncovering landing radar and downward Lander Vision System cameras.',
    narrative: 'Twenty seconds after parachute inflation, pyrotechnic fasteners release the heat shield, which drops away toward the Martian surface. Jettisoning the shield exposes the Terminal Descent Radar and Lander Vision System optical cameras to lock onto the terrain below.',
    countdownEstSec: 314,
    nextMilestone: 'Terminal Radar Lock',
    timeToNextSec: 120,
    cameraMode: 'CHASE',
  },
  {
    id: 'RADAR_LOCK',
    title: 'Terminal Radar Lock',
    badge: 'RADAR ACQUIRED',
    altKm: 4,
    speedMps: 35,
    description: 'Terminal Descent Radar (TDR) acquires surface lock, reporting accurate altitude and range rate.',
    narrative: 'The multi-beam radar altimeter achieves surface lock at 4 km altitude, streaming high-rate, centimeter-accurate altitude and velocity vectors to the onboard flight computer to cross-verify inertial guidance measurements.',
    countdownEstSec: 194,
    nextMilestone: 'Terrain-Relative Navigation',
    timeToNextSec: 50,
    cameraMode: 'CHASE',
  },
  {
    id: 'TRN_HAZARD',
    title: 'Terrain-Relative Navigation',
    badge: 'TRN / LVS ACTIVE',
    altKm: 2.5,
    speedMps: 28,
    description: 'Lander Vision System matches surface craters against onboard map to divert toward safe ground.',
    narrative: 'Terrain-Relative Navigation (TRN) activates at 2.5 km. Downward cameras capture real-time frames of Jezero Crater, matching features against an onboard hazard map. The flight computer detects potential boulder fields and autonomously retargets to a verified safe zone.',
    countdownEstSec: 157,
    nextMilestone: 'Backshell Separation',
    timeToNextSec: 29,
    cameraMode: 'TRN_NADIR',
  },
  {
    id: 'BACKSHELL_SEP',
    title: 'Backshell Separation',
    badge: 'BACKSHELL RELEASE',
    altKm: 1.8,
    speedMps: 25,
    description: 'Backshell and parachute detach; Sky Crane powered descent stage separates and initiates free-fall.',
    narrative: 'At 1.8 km above the surface, the rover and descent stage disconnect from the backshell and parachute. After a brief free-fall, the descent stage prepares to ignite its eight canted hydrazine throttleable rocket engines.',
    countdownEstSec: 128,
    nextMilestone: 'Powered Descent',
    timeToNextSec: 1,
    cameraMode: 'CHASE',
  },
  {
    id: 'POWERED_DESCENT',
    title: 'Powered Descent Divert',
    badge: 'RETRO-ROCKETS',
    altKm: 1.0,
    speedMps: 20,
    description: 'Eight canted hydrazine thrusters ignite, decelerating and diverting vehicle toward safe site.',
    narrative: 'Eight Mars Landing Engines (MLEs) fire, generating up to 32 kN of thrust. The flight computer executes a lateral divert maneuver to steer away from the falling backshell and align the spacecraft directly above the TRN-selected safe landing target.',
    countdownEstSec: 120,
    nextMilestone: 'Sky Crane Tether Lowering',
    timeToNextSec: 90,
    cameraMode: 'POWERED_DESCENT',
  },
  {
    id: 'SKY_CRANE_TERMINAL',
    title: 'Sky Crane & Rover Lowering',
    badge: 'SKY CRANE CABLES',
    altKm: 0.025,
    speedMps: 1.8,
    description: 'Descent stage hovers at 21 m while lowering Perseverance on 7.5 m bridle tether cables.',
    narrative: 'At 21 meters above Mars, the descent stage maintains a steady 0.75 m/s descent while lowering Perseverance on three nylon bridle cables and an electrical umbilical. The rover locks its wheels and suspension into landing configuration as it nears the ground.',
    countdownEstSec: 30,
    nextMilestone: 'Touchdown Confirmed',
    timeToNextSec: 30,
    cameraMode: 'GROUND_TOUCHDOWN',
  },
  {
    id: 'TOUCHDOWN',
    title: 'Touchdown Confirmed',
    badge: 'MISSION SUCCESS',
    altKm: 0.0,
    speedMps: 0,
    description: 'Wheels touch down on Jezero Crater; cables cut; descent stage throttles up and flies away.',
    narrative: 'Touchdown confirmed! As the rover wheels contact the Martian regolith, cable cutters immediately sever the tethers. The descent stage throttles to full thrust, banking away to crash at a safe distance, leaving Perseverance ready for surface science.',
    countdownEstSec: 0,
    nextMilestone: 'Surface Operations',
    timeToNextSec: 0,
    cameraMode: 'GROUND_TOUCHDOWN',
  },
];

// ---------------------------------------------------------------------------
// 2. Milestone Detection from Current Physics State
// ---------------------------------------------------------------------------
export function detectMilestone(state) {
  if (!state) return EDL_MILESTONES[0];
  if (state.grounded || state.phase === 'LANDED' || state.altitude <= GROUND_ALTITUDE) {
    return EDL_MILESTONES[12]; // TOUCHDOWN
  }

  const alt = state.altitude !== undefined ? state.altitude : ORBIT_ALTITUDE;
  const phase = state.phase || 'MARS_ORBIT';

  if (phase === 'MARS_ORBIT') return EDL_MILESTONES[0];
  if (phase === 'DEORBIT_BURN') return EDL_MILESTONES[1];
  if (phase === 'COAST_TO_ENTRY') return EDL_MILESTONES[2];

  if (phase === 'ATMOSPHERIC_ENTRY') {
    if (alt <= 65000 && alt > 15000) return EDL_MILESTONES[4]; // PEAK_HEATING
    if (alt <= 125000) return EDL_MILESTONES[3]; // ENTRY_INTERFACE
    return EDL_MILESTONES[2];
  }

  // During parachute descent / guidance / terminal descent
  if (
    phase === 'PARACHUTE_DESCENT' ||
    phase === 'AUTONOMOUS_TARGET_REALIGNMENT' ||
    phase === 'SAFE_APPROACH' ||
    phase === 'BACKSHELL_SEP' ||
    phase === 'POWERED_DESCENT'
  ) {
    if (state.backshellSeparated || alt <= BACKSHELL_SEP_ALTITUDE) {
      if (alt <= TERMINAL_POWERED_ALTITUDE) return EDL_MILESTONES[11]; // SKY_CRANE_TERMINAL
      if (phase === 'BACKSHELL_SEP' || (!state.enginesActive && (state.elapsed - (state.backshellSepTime || 0) < 1.8))) {
        return EDL_MILESTONES[9]; // BACKSHELL_SEP
      }
      return EDL_MILESTONES[10]; // POWERED_DESCENT
    }
    if (state.trnActive || alt <= 2500 || phase === 'AUTONOMOUS_TARGET_REALIGNMENT') {
      return EDL_MILESTONES[8]; // TRN_HAZARD
    }
    if (state.radarLocked || alt <= RADAR_LOCK_ALTITUDE) {
      return EDL_MILESTONES[7]; // RADAR_LOCK
    }
    if (state.heatShieldSeparated || alt <= HEAT_SHIELD_SEP_ALTITUDE) {
      return EDL_MILESTONES[6]; // HEAT_SHIELD_SEP
    }
    return EDL_MILESTONES[5]; // PARACHUTE_DEPLOY
  }

  return EDL_MILESTONES[0];
}

/**
 * Compute the Cartesian y coordinate in the simulation frame such that
 * the distance from Mars center (0, -MARS_RADIUS, 0) yields exactly the desired altitude.
 *
 *   r = sqrt(x² + (y + MARS_RADIUS)² + z²) = MARS_RADIUS + alt
 *   => y = sqrt((MARS_RADIUS + alt)² - (x² + z²)) - MARS_RADIUS
 */
export function computeYForSphericalAltitude(alt, x = 0, z = 0) {
  const r = MARS_RADIUS + alt;
  const horizSq = (x || 0) * (x || 0) + (z || 0) * (z || 0);
  if (horizSq >= r * r) return alt;
  return Math.sqrt(r * r - horizSq) - MARS_RADIUS;
}

// ---------------------------------------------------------------------------
// 3. Jump / Scrub to Milestone
// ---------------------------------------------------------------------------
export function jumpToMilestone(state, milestoneId) {
  if (!state) return;
  state.grounded = false;
  state.burnCompleted = false;
  state.triggerDeorbit = false;
  state.touchdownTime = milestoneId === 'TOUCHDOWN' ? 1950 : undefined;
  state.cruiseStageSeparated = milestoneId !== 'ORBIT' && milestoneId !== 'DEORBIT_BURN';
  state.cruiseStagePos = state.cruiseStageSeparated ? { x: state.x - 350, y: state.y + 180, z: state.z - 80 } : null;
  state.skyCraneLoweringProgress = milestoneId === 'SKY_CRANE_TERMINAL' ? 0.75 : (milestoneId === 'TOUCHDOWN' ? 1.0 : 0.0);
  state.descentStageFlyaway = milestoneId === 'TOUCHDOWN';
  state.descentStagePos = milestoneId === 'TOUCHDOWN' ? { x: (state.x || JEZERO_TARGET_X) + 650, y: 15, z: (state.z || JEZERO_TARGET_Z) + 420 } : null;

  state.guidanceRefX = JEZERO_TARGET_X;
  state.guidanceRefY = JEZERO_TARGET_Y;
  state.guidanceRefZ = JEZERO_TARGET_Z;

  const vOrbit = getCircularOrbitalSpeed(ORBIT_ALTITUDE);
  state.cruiseStageSeparated = milestoneId !== 'ORBIT' && milestoneId !== 'DEORBIT_BURN';

  switch (milestoneId) {
    case 'ORBIT': {
      state.altitude = ORBIT_ALTITUDE;
      state.x = 0;
      state.y = ORBIT_ALTITUDE;
      state.z = 0;
      state.vx = vOrbit;
      state.vy = 0;
      state.vz = 0;
      state.speed = vOrbit;
      state.verticalVelocity = 0;
      state.phase = 'MARS_ORBIT';
      state.orbitTime = 0;
      state.enginesActive = false;
      state.fuel = PROPELLANT_MASS;
      state.mass = DRY_MASS + PROPELLANT_MASS;
      state.heatShieldSeparated = false;
      state.backshellSeparated = false;
      state.radarLocked = false;
      state.trnActive = false;
      state.parachuteState = 'PACKED';
      state.parachuteDeploymentProgress = 0;
      state.heatIntensity = 0;
      state.heatFlux = 0;
      state.elapsed = 0;
      break;
    }

    case 'DEORBIT_BURN': {
      state.altitude = ORBIT_ALTITUDE;
      state.x = 25000;
      state.y = ORBIT_ALTITUDE - 200;
      state.z = 0;
      state.vx = vOrbit - 20;
      state.vy = -1;
      state.vz = 0;
      state.speed = vOrbit - 20;
      state.verticalVelocity = -1;
      state.phase = 'DEORBIT_BURN';
      state.orbitTime = 7.0;
      state.enginesActive = true;
      state.deliveredDeltaV = 20;
      state.fuel = PROPELLANT_MASS - 15;
      state.mass = DRY_MASS + state.fuel;
      state.heatShieldSeparated = false;
      state.backshellSeparated = false;
      state.radarLocked = false;
      state.trnActive = false;
      state.parachuteState = 'PACKED';
      state.parachuteDeploymentProgress = 0;
      state.elapsed = 15;
      break;
    }

    case 'COAST_TO_ENTRY': {
      state.altitude = 180000;
      state.x = 120000;
      state.y = 180000;
      state.z = 0;
      state.vx = 3305;
      state.vy = -75;
      state.vz = 0;
      state.speed = Math.hypot(3305, -75);
      state.verticalVelocity = -75;
      state.phase = 'COAST_TO_ENTRY';
      state.enginesActive = false;
      state.burnCompleted = true;
      state.deliveredDeltaV = DEORBIT_DELTA_V;
      state.fuel = PROPELLANT_MASS - 40;
      state.mass = DRY_MASS + state.fuel;
      state.heatShieldSeparated = false;
      state.backshellSeparated = false;
      state.radarLocked = false;
      state.trnActive = false;
      state.parachuteState = 'PACKED';
      state.parachuteDeploymentProgress = 0;
      state.elapsed = 450;
      break;
    }

    case 'ENTRY_INTERFACE': {
      state.altitude = ENTRY_INTERFACE_ALTITUDE;
      state.x = 280000;
      state.y = ENTRY_INTERFACE_ALTITUDE;
      state.z = 0;
      state.vx = 3420;
      state.vy = -215;
      state.vz = 0;
      state.speed = Math.hypot(3420, -215);
      state.verticalVelocity = -215;
      state.phase = 'ATMOSPHERIC_ENTRY';
      state.enginesActive = false;
      state.burnCompleted = true;
      state.deliveredDeltaV = DEORBIT_DELTA_V;
      state.fuel = PROPELLANT_MASS - 40;
      state.mass = DRY_MASS + state.fuel;
      state.heatShieldSeparated = false;
      state.backshellSeparated = false;
      state.radarLocked = false;
      state.trnActive = false;
      state.parachuteState = 'PACKED';
      state.parachuteDeploymentProgress = 0;
      state.elapsed = 1095;
      break;
    }

    case 'PEAK_HEATING': {
      state.altitude = 45000;
      state.x = 420000;
      state.y = 45000;
      state.z = 0;
      state.vx = 2400;
      state.vy = -255;
      state.vz = 0;
      state.speed = Math.hypot(2400, -255);
      state.verticalVelocity = -255;
      state.phase = 'ATMOSPHERIC_ENTRY';
      state.enginesActive = false;
      state.burnCompleted = true;
      state.fuel = PROPELLANT_MASS - 40;
      state.mass = DRY_MASS + state.fuel;
      state.heatShieldSeparated = false;
      state.backshellSeparated = false;
      state.radarLocked = false;
      state.trnActive = false;
      state.parachuteState = 'PACKED';
      state.parachuteDeploymentProgress = 0;
      state.heatIntensity = 0.95;
      state.heatFlux = 2.2e6;
      state.elapsed = 1420;
      break;
    }

    case 'PARACHUTE_DEPLOY': {
      state.altitude = 10000;
      state.x = 3333989;
      state.y = -2726106;
      state.z = JEZERO_TARGET_Z;
      state.vx = -149.4;
      state.vy = -215.7;
      state.vz = 0;
      state.speed = Math.hypot(-149.4, -215.7);
      state.verticalVelocity = -215.7;
      state.phase = 'PARACHUTE_DESCENT';
      state.enginesActive = false;
      state.burnCompleted = true;
      state.fuel = PROPELLANT_MASS - 40;
      state.mass = DRY_MASS + state.fuel;
      state.heatShieldSeparated = false;
      state.backshellSeparated = false;
      state.radarLocked = false;
      state.trnActive = false;
      state.parachuteState = 'DEPLOYING';
      state.parachuteDeploymentProgress = 0.05;
      state.heatIntensity = 0;
      state.heatFlux = 0;
      state.landingSiteAnalysis = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);
      state.guidanceRefX = JEZERO_TARGET_X;
      state.guidanceRefY = JEZERO_TARGET_Y;
      state.guidanceRefZ = JEZERO_TARGET_Z;
      state.elapsed = 1580;
      break;
    }

    case 'HEAT_SHIELD_SEP': {
      state.altitude = HEAT_SHIELD_SEP_ALTITUDE;
      state.x = 3332348;
      state.y = -2727551;
      state.z = JEZERO_TARGET_Z;
      state.vx = -40.68;
      state.vy = -12.49;
      state.vz = 0;
      state.speed = Math.hypot(-40.68, -12.49);
      state.verticalVelocity = -12.49;
      state.phase = 'PARACHUTE_DESCENT';
      state.enginesActive = false;
      state.burnCompleted = true;
      state.fuel = PROPELLANT_MASS - 40;
      state.mass = DRY_MASS + state.fuel;
      state.heatShieldSeparated = true;
      state.heatShieldPos = { x: state.x - 20, y: state.y - 120, z: state.z, vy: -55, vx: -42 };
      state.backshellSeparated = false;
      state.radarLocked = false;
      state.trnActive = false;
      state.parachuteState = 'DEPLOYED';
      state.parachuteDeploymentProgress = 1.0;
      state.landingSiteAnalysis = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);
      state.guidanceRefX = JEZERO_TARGET_X;
      state.guidanceRefY = JEZERO_TARGET_Y;
      state.guidanceRefZ = JEZERO_TARGET_Z;
      state.elapsed = 1611;
      break;
    }

    case 'RADAR_LOCK': {
      state.altitude = RADAR_LOCK_ALTITUDE;
      state.x = 3328473;
      state.y = -2728369;
      state.z = JEZERO_TARGET_Z;
      state.vx = -34.87;
      state.vy = -6.93;
      state.vz = 0;
      state.speed = Math.hypot(-34.87, -6.93);
      state.verticalVelocity = -6.93;
      state.phase = 'PARACHUTE_DESCENT';
      state.enginesActive = false;
      state.burnCompleted = true;
      state.fuel = PROPELLANT_MASS - 40;
      state.mass = DRY_MASS + state.fuel;
      state.heatShieldSeparated = true;
      state.radarLocked = true;
      state.trnActive = false;
      state.backshellSeparated = false;
      state.parachuteState = 'DEPLOYED';
      state.parachuteDeploymentProgress = 1.0;
      state.landingSiteAnalysis = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);
      state.guidanceRefX = JEZERO_TARGET_X;
      state.guidanceRefY = JEZERO_TARGET_Y;
      state.guidanceRefZ = JEZERO_TARGET_Z;
      state.elapsed = 1713;
      break;
    }

    case 'TRN_HAZARD': {
      state.altitude = 2500;
      state.x = 3326991;
      state.y = -2728663;
      state.z = JEZERO_TARGET_Z;
      state.vx = -32.15;
      state.vy = -6.47;
      state.vz = 0.01;
      state.speed = Math.hypot(-32.15, -6.47);
      state.verticalVelocity = -6.47;
      state.phase = 'AUTONOMOUS_TARGET_REALIGNMENT';
      state.enginesActive = false;
      state.burnCompleted = true;
      state.fuel = PROPELLANT_MASS - 40;
      state.mass = DRY_MASS + state.fuel;
      state.heatShieldSeparated = true;
      state.radarLocked = true;
      state.trnActive = true;
      state.backshellSeparated = false;
      state.parachuteState = 'DEPLOYED';
      state.parachuteDeploymentProgress = 1.0;
      state.landingSiteAnalysis = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);
      state.guidanceRefX = JEZERO_TARGET_X;
      state.guidanceRefY = JEZERO_TARGET_Y;
      state.guidanceRefZ = JEZERO_TARGET_Z;
      state.elapsed = 1757;
      break;
    }

    case 'BACKSHELL_SEP': {
      state.altitude = BACKSHELL_SEP_ALTITUDE;
      state.x = 3326316;
      state.y = -2728884;
      state.z = JEZERO_TARGET_Z;
      state.vx = -22.97;
      state.vy = -8.92;
      state.vz = 0;
      state.speed = Math.hypot(-22.97, -8.92);
      state.verticalVelocity = -8.92;
      state.phase = 'BACKSHELL_SEP';
      state.enginesActive = false;
      state.poweredDescentActive = false;
      state.burnCompleted = true;
      state.fuel = PROPELLANT_MASS - 50;
      state.mass = DRY_MASS + state.fuel;
      state.heatShieldSeparated = true;
      state.radarLocked = true;
      state.trnActive = true;
      state.backshellSeparated = true;
      state.backshellSepTime = 1786;
      state.backshellPos = { x: state.x + 15, y: state.y + 24, z: state.z - 10, vy: 16, vx: -14, vz: -8 };
      state.parachuteState = 'RELEASED';
      state.parachuteDeploymentProgress = 1.0;
      state.landingSiteAnalysis = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);
      state.guidanceRefX = JEZERO_TARGET_X;
      state.guidanceRefY = JEZERO_TARGET_Y;
      state.guidanceRefZ = JEZERO_TARGET_Z;
      state.elapsed = 1786;
      break;
    }

    case 'POWERED_DESCENT': {
      state.altitude = 1000;
      state.x = 3325376;
      state.y = -2728182;
      state.z = JEZERO_TARGET_Z;
      state.vx = -24.29;
      state.vy = 19.63;
      state.vz = 0;
      state.speed = Math.hypot(-24.29, 19.63);
      state.verticalVelocity = -18.0;
      state.phase = 'POWERED_DESCENT';
      state.enginesActive = true;
      state.poweredDescentActive = true;
      state.burnCompleted = true;
      state.fuel = PROPELLANT_MASS - 60;
      state.mass = DRY_MASS + state.fuel;
      state.heatShieldSeparated = true;
      state.radarLocked = true;
      state.trnActive = true;
      state.backshellSeparated = true;
      state.backshellPos = { x: state.x + 120, y: state.y + 120, z: state.z - 15, vy: 16, vx: -14, vz: -8 };
      state.parachuteState = 'RELEASED';
      state.parachuteDeploymentProgress = 1.0;
      state.landingSiteAnalysis = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);
      state.guidanceRefX = JEZERO_TARGET_X;
      state.guidanceRefY = JEZERO_TARGET_Y;
      state.guidanceRefZ = JEZERO_TARGET_Z;
      state.elapsed = 1825;
      break;
    }

    case 'SKY_CRANE_TERMINAL': {
      state.altitude = 25.0;
      state.x = 3324236;
      state.y = -2727437;
      state.z = JEZERO_TARGET_Z;
      state.vx = -0.74;
      state.vy = -0.15;
      state.vz = 0;
      state.speed = Math.hypot(-0.74, -0.15);
      state.verticalVelocity = -0.75;
      state.phase = 'SAFE_APPROACH';
      state.skyCraneActive = true;
      state.skyCraneLoweringProgress = 0.55;
      state.cablesReleased = false;
      state.descentStageFlyaway = false;
      state.enginesActive = true;
      state.burnCompleted = true;
      state.fuel = PROPELLANT_MASS - 95;
      state.mass = DRY_MASS + state.fuel;
      state.heatShieldSeparated = true;
      state.backshellSeparated = true;
      state.radarLocked = true;
      state.trnActive = true;
      state.parachuteState = 'RELEASED';
      state.parachuteDeploymentProgress = 1.0;
      state.landingSiteAnalysis = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);
      state.guidanceRefX = JEZERO_TARGET_X;
      state.guidanceRefY = JEZERO_TARGET_Y;
      state.guidanceRefZ = JEZERO_TARGET_Z;
      state.elapsed = 1883;
      break;
    }

    case 'TOUCHDOWN': {
      state.altitude = GROUND_ALTITUDE;
      state.x = JEZERO_TARGET_X;
      state.y = JEZERO_TARGET_Y;
      state.z = JEZERO_TARGET_Z;
      state.vx = 0;
      state.vy = 0;
      state.vz = 0;
      state.speed = 0;
      state.verticalVelocity = 0;
      state.grounded = true;
      state.phase = 'LANDED';
      state.roverSettled = true;
      state.touchdownState = 'STABLE_TOUCHDOWN';
      state.touchdownTime = 1910.0;
      state.settlingStartTime = 1909.2;
      state.firstContactTime = 1908.5;
      state.wheelContactCount = 6;
      state.wheelContacts = { FL: 1, FR: 1, ML: 1, MR: 1, RL: 1, RR: 1 };
      state.wheelClearance = 0.0;
      state.radarAltitude = 0.0;
      state.roverBodyAltitude = 0.54;
      state.enginesActive = false;
      state.poweredDescentActive = false;
      state.skyCraneActive = false;
      state.cablesReleased = true;
      state.descentStageFlyaway = false;
      state.descentStagePos = { x: state.x + 52, y: 0.1, z: state.z + 40, vx: 0, vy: 0, vz: 0 };
      state.fuel = PROPELLANT_MASS - 110;
      state.mass = DRY_MASS + state.fuel;
      state.cruiseStageSeparated = true;
      state.heatShieldSeparated = true;
      state.backshellSeparated = true;
      state.radarLocked = true;
      state.trnActive = true;
      state.parachuteState = 'RELEASED';
      state.parachuteDeploymentProgress = 1.0;
      state.landingError = 8.4;
      state.peakGForce = 4.2;
      state.peakHeatFlux = 1.85e6;
      state.gForce = 1.0;
      state.landingSiteAnalysis = performLandingSiteAnalysis(INITIAL_PLANNED_TARGET);
      state.guidanceRefX = JEZERO_TARGET_X;
      state.guidanceRefY = JEZERO_TARGET_Y;
      state.guidanceRefZ = JEZERO_TARGET_Z;
      state.elapsed = 1910;
      break;
    }

    default:
      break;
  }

  state.y = computeYForSphericalAltitude(state.altitude, state.x, state.z);
  state.r = getDistanceToMarsCenter(state.x, state.y, state.z);
  state.rho = atmosphericDensity(state.altitude);
  state.q = 0.5 * state.rho * state.speed * state.speed;
}

// ---------------------------------------------------------------------------
// 4. Lightweight Event Pub/Sub
// ---------------------------------------------------------------------------
class MissionEventEmitter {
  constructor() {
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(eventType, data) {
    for (const fn of this.listeners) {
      try {
        fn(eventType, data);
      } catch (err) {
        console.error('Error in mission event listener:', err);
      }
    }
  }
}

export const missionEvents = new MissionEventEmitter();
