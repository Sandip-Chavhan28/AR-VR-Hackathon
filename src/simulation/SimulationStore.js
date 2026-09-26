import { create } from "zustand";
import { VEHICLE } from "./Physics";

const INITIAL_STATE = {
  // Flight Coordinates (meters)
  altitude: 65000,          // Entry atmospheric interface begins intense braking around 65km
  downrange: -35000,        // Downrange distance to Jezero crater center
  crossrange: 450,          // Crossrange offset (m)
  
  // Velocity Vector (m/s)
  speed: 5350,              // Hypersonic entry speed ~ Mach 22.3
  vx: 4700,                 // Horizontal forward speed
  vy: -2500,                // Vertical descent speed
  vz: 40,                   // Lateral drift
  
  // Attitude & Rates (degrees)
  pitch: -14.5,             // Entry angle of attack
  yaw: 1.2,
  roll: 0.0,
  pitchRate: 0,
  yawRate: 0,
  rollRate: 0.05,
  
  // Aerothermal & Dynamics
  dynamicPressure: 15,      // Pa
  gForce: 1.0,              // G
  maxGForce: 1.0,
  heatFlux: 0,              // W/cm^2
  temperature: 20,          // °C
  mach: 22.3,
  
  // Fuel & Propulsion
  fuel: VEHICLE.initialFuel, // 400 kg
  fuelPercent: 100,
  fuelUsedTotal: 0,
  throttle: 0,              // 0 to 1
  rcsFiring: { pitch: false, yaw: false, roll: false },
  
  // Subsystem States
  phase: "ENTRY",           // ENTRY, PARACHUTE, HEAT_SHIELD_DROP, POWERED, SKY_CRANE, TOUCHDOWN, COMPLETED
  heatShieldAttached: true,
  heatShieldFallingOffset: 0,
  parachuteDeployed: false,
  parachuteDeployProgress: 0, // 0 to 1
  backshellSeparated: false,
  backshellOffset: 0,
  skyCraneCableLength: 0,    // 0 to 7.5 meters
  skyCraneFlyawayOffset: [0, 0, 0],
  roverSettled: false,
  radarLocked: false,
  
  // Landing Target
  distanceToTarget: 35000,
  targetRadius: 50,         // 50m radius target zone
  
  // Simulation Flow
  timeElapsed: 0,
  isPaused: false,
  timeWarp: 1,
  
  // Disturbance Settings
  disturbances: {
    windShear: true,
    windSpeed: 24,           // m/s
    windGust: 0,
    dustStorm: false,
    dustIntensity: 0.65,
    sensorNoise: true,
    noiseOffsetAlt: 0,
    noiseOffsetVel: 0,
  },
  
  // Telemetry Recording for Realtime Graphs
  telemetryHistory: {
    altVsVel: [],
    fuelVsTime: [],
    heatVsTime: [],
  },
  trajectoryHistory: [],
  
  // Viewing & Cameras
  cameraMode: "CHASE",      // CHASE, BELLY_CAM, CHUTE_CAM, SKY_CRANE, GROUND, FREE_ORBIT
  missionControlMode: false,
  audioMuted: false,
  
  // Milestone Events Log
  eventsLog: [
    { time: "00:00", text: "Entry interface reached (65 km). Atmospheric friction building.", type: "nominal" }
  ],
  
  // Post-Mission Debrief
  evaluationResult: null,
};

export const useSimulationStore = create((set, get) => ({
  ...INITIAL_STATE,

  resetSimulation: () => {
    set({
      ...INITIAL_STATE,
      telemetryHistory: { altVsVel: [], fuelVsTime: [], heatVsTime: [] },
      trajectoryHistory: [],
      eventsLog: [
        { time: "00:00", text: "Entry interface reached (65 km). Atmospheric friction building.", type: "nominal" }
      ],
      evaluationResult: null,
    });
  },

  updateFlightData: (updates) => set((state) => ({ ...state, ...updates })),

  appendTelemetryPoint: (point) => set((state) => {
    const maxLen = 120;
    const newAltVsVel = [...state.telemetryHistory.altVsVel, {
      alt: Math.round(state.altitude),
      vel: Math.round(state.speed),
      time: Math.round(state.timeElapsed)
    }].slice(-maxLen);

    const fuelUsedKg = Math.max(0, VEHICLE.initialFuel - state.fuel);
    const fuelUsedPct = Math.min(100, (fuelUsedKg / VEHICLE.initialFuel) * 100);

    const newFuelVsTime = [...state.telemetryHistory.fuelVsTime, {
      time: Number(state.timeElapsed.toFixed(1)),
      fuel: Number(state.fuel.toFixed(1)),
      fuelPct: Number(((state.fuel / VEHICLE.initialFuel) * 100).toFixed(2)),
      fuelUsedPct: Number(fuelUsedPct.toFixed(2)),
      fuelUsedKg: Number(fuelUsedKg.toFixed(1)),
    }].slice(-maxLen);

    const newHeatVsTime = [...state.telemetryHistory.heatVsTime, {
      time: Math.round(state.timeElapsed),
      heat: Math.round(state.temperature),
      gForce: Number(state.gForce.toFixed(1))
    }].slice(-maxLen);

    return {
      telemetryHistory: {
        altVsVel: newAltVsVel,
        fuelVsTime: newFuelVsTime,
        heatVsTime: newHeatVsTime,
      }
    };
  }),

  appendTrajectoryPoint: (pt) => set((state) => ({
    trajectoryHistory: state.trajectoryHistory.length > 300 
      ? [...state.trajectoryHistory.slice(1), pt]
      : [...state.trajectoryHistory, pt]
  })),

  addEvent: (text, type = "nominal") => set((state) => {
    const mins = Math.floor(state.timeElapsed / 60);
    const secs = Math.floor(state.timeElapsed % 60);
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return {
      eventsLog: [{ time: timeStr, text, type }, ...state.eventsLog].slice(0, 30)
    };
  }),

  setPhase: (phase) => set({ phase }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  toggleMissionControl: () => set((state) => ({ missionControlMode: !state.missionControlMode })),
  toggleAudio: () => set((state) => ({ audioMuted: !state.audioMuted })),
  setTimeWarp: (timeWarp) => set({ timeWarp }),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  
  updateDisturbances: (partial) => set((state) => ({
    disturbances: { ...state.disturbances, ...partial }
  })),

  setEvaluation: (evaluation) => set({ evaluationResult: evaluation }),
}));