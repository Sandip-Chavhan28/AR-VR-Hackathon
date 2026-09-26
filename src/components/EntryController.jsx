import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useSimulationStore } from "../simulation/SimulationStore";
import {
  marsDensity,
  dynamicPressure,
  aerothermalHeatFlux,
  heatShieldTemperature,
  machNumber,
  MARS_GRAVITY,
  EARTH_G0,
  VEHICLE,
  PIDController
} from "../simulation/Physics";
import { sounds } from "../audio/SoundEffects";

// --- Visual Scale Helpers ---
// Real altitude (0–65000 m) maps to visual Y (0–130 units)
// 1 visual unit = 500 m
export const VISUAL_SCALE = 1 / 500;

export default function EntryController() {
  const store = useSimulationStore();

  // GN&C Autonomous PID controllers
  const throttlePidRef = useRef(new PIDController(0.045, 0.008, 0.035, 0.1, 1.0));
  const pitchPidRef = useRef(new PIDController(0.8, 0.02, 0.4, -25, 25));
  const rollPidRef = useRef(new PIDController(0.6, 0.01, 0.3, -20, 20));

  const telemetryTimerRef = useRef(0);
  const audioInitRef = useRef(false);

  useFrame((_, rawDelta) => {
    if (store.isPaused) return;

    // Initialize audio on first frame (requires user gesture)
    if (!audioInitRef.current) {
      sounds.init();
      audioInitRef.current = true;
    }

    // Time scaling with timeWarp
    const dt = Math.min(rawDelta, 0.05) * (store.timeWarp || 1);

    let {
      altitude,
      downrange,
      crossrange,
      speed,
      vx,
      vy,
      vz,
      pitch,
      yaw,
      roll,
      phase,
      fuel,
      heatShieldAttached,
      heatShieldFallingOffset,
      parachuteDeployed,
      parachuteDeployProgress,
      backshellSeparated,
      backshellOffset,
      skyCraneCableLength,
      skyCraneFlyawayOffset,
      roverSettled,
      radarLocked,
      maxGForce,
      timeElapsed,
      disturbances
    } = store;

    if (phase === "COMPLETED") return;

    timeElapsed += dt;

    // --- Atmospheric Conditions ---
    const rho = marsDensity(altitude);
    const q = dynamicPressure(rho, speed);
    const mach = machNumber(speed);
    const qFlux = aerothermalHeatFlux(rho, speed);
    const temp = heatShieldTemperature(qFlux);

    // Sound reactivity
    if (phase === "ENTRY" || phase === "PARACHUTE") {
      sounds.setHeatIntensity(Math.min(1, qFlux / 120));
    } else {
      sounds.setHeatIntensity(0);
    }

    // Small baseline fuel burn during atmospheric descent so the telemetry
    // rises gradually from the start of the mission instead of staying flat
    // until retro-rocket ignition.
    if (phase === "ENTRY") {
      fuel = Math.max(0, fuel - dt * 0.8);
    } else if (phase === "PARACHUTE") {
      fuel = Math.max(0, fuel - dt * 1.7);
    }

    // --- Wind Shear Disturbance ---
    let windVx = 0, windVz = 0;
    if (disturbances.windShear) {
      windVx = Math.sin(timeElapsed * 0.4) * (disturbances.windSpeed * 0.5) + (Math.random() - 0.5) * 4;
      windVz = Math.cos(timeElapsed * 0.35) * (disturbances.windSpeed * 0.3) + (Math.random() - 0.5) * 4;
    }

    let mass = VEHICLE.entryMass;
    let dragArea = VEHICLE.aeroshellArea;
    let cd = VEHICLE.cdHypersonic;
    let throttle = 0;
    let totalThrust = 0;
    let ax = 0, ay = 0, az = 0;

    // =====================================================================
    // PHASE 1: HYPERSONIC ENTRY / AERO-BRAKING
    // =====================================================================
    if (phase === "ENTRY") {
      const dragMag = 0.5 * rho * speed * speed * cd * dragArea;
      const dragAcc = dragMag / mass;

      // Unit vectors in velocity direction
      const sp = Math.max(1, speed);
      const uvx = vx / sp;
      const uvy = vy / sp;
      const uvz = vz / sp;

      // Drag opposes motion; gravity pulls down
      ax = -dragAcc * uvx + windVx * 0.08;
      ay = -dragAcc * uvy - MARS_GRAVITY;
      az = -dragAcc * uvz + windVz * 0.08;

      // Gentle ballistic roll during entry
      roll += 0.6 * dt;
      pitch = -14 + Math.sin(timeElapsed * 1.2) * 2.0;

      // TRIGGER: Parachute deploy at Mach < 2.2 and alt < 12 km
      if (altitude <= 12000 && mach <= 2.3) {
        phase = "PARACHUTE";
        parachuteDeployed = true;
        sounds.playParachuteDeploy();
        store.addEvent("PARACHUTE DEPLOYED — Mach 2.0 threshold, altitude 12 km. Chute mortar fired!", "warning");
      }
    }

    // =====================================================================
    // PHASE 2: SUPERSONIC PARACHUTE DESCENT
    // =====================================================================
    else if (phase === "PARACHUTE") {
      parachuteDeployProgress = Math.min(1, parachuteDeployProgress + dt * 1.0);
      mass = VEHICLE.parachuteMass;

      // Parachute drag coefficient ramps up as chute opens
      const effectiveChuteArea = VEHICLE.aeroshellArea + VEHICLE.parachuteArea * parachuteDeployProgress;
      const combinedCd = VEHICLE.cdParachute;

      const dragMag = 0.5 * rho * speed * speed * combinedCd * effectiveChuteArea;
      const dragAcc = dragMag / mass;

      const sp = Math.max(1, speed);
      const uvx = vx / sp;
      const uvy = vy / sp;
      const uvz = vz / sp;

      ax = -dragAcc * uvx * 0.6 + windVx * 0.12;
      ay = -dragAcc * uvy * 0.7 - MARS_GRAVITY;
      az = -dragAcc * uvz * 0.6 + windVz * 0.12;

      // Gentle pendulum sway under chute
      pitch = Math.sin(timeElapsed * 1.8) * 5.0;
      roll = Math.cos(timeElapsed * 1.4) * 4.0;

      // TRIGGER: Heat shield jettison at 8.5 km
      if (altitude <= 8500 && heatShieldAttached) {
        heatShieldAttached = false;
        radarLocked = true;
        sounds.playSeparation();
        sounds.playRadarPing();
        store.addEvent("HEAT SHIELD JETTISONED at 8.5 km. TRN radar locked on Jezero.", "nominal");
      }

      if (!heatShieldAttached) {
        heatShieldFallingOffset = Math.min(heatShieldFallingOffset + 30 * dt, 200);
      }

      // TRIGGER: Backshell separation + retro-rocket ignition at 2 km
      if (altitude <= 2000) {
        phase = "POWERED";
        backshellSeparated = true;
        sounds.playSeparation();
        store.addEvent("BACKSHELL SEPARATED! Retro-rockets IGNITED — Powered Descent Initiation.", "warning");
      }
    }

    // =====================================================================
    // PHASE 3: POWERED DESCENT — SKY CRANE + 8 RETRO ROCKETS
    // =====================================================================
    else if (phase === "POWERED") {
      if (!heatShieldAttached) {
        heatShieldFallingOffset = Math.min(heatShieldFallingOffset + 40 * dt, 200);
      }
      backshellOffset = Math.min(backshellOffset + 25 * dt, 200);

      mass = VEHICLE.descentStageMass + VEHICLE.roverMass + fuel;

      // GN&C: Target velocity profile — slow to near-zero by 20 m altitude
      const targetVy = altitude > 50
        ? Math.max(-50, -Math.sqrt(altitude) * 1.8 - 1.5)
        : Math.max(-3, -altitude * 0.12 - 0.8);

      const commandedThrottle = throttlePidRef.current.update(targetVy, vy, dt);
      throttle = Math.max(0.12, Math.min(1.0, commandedThrottle));

      // Horizontal steering corrections
      const pitchTarget = pitchPidRef.current.update(-downrange * 0.04, vx, dt);
      const rollTarget = rollPidRef.current.update(-crossrange * 0.04, vz, dt);
      pitch = pitch * 0.92 + pitchTarget * 0.08;
      roll = roll * 0.92 + rollTarget * 0.08;

      // Fuel consumption
      const maxThrust = VEHICLE.numEngines * VEHICLE.maxThrustPerEngine;
      totalThrust = maxThrust * throttle;
      const fuelFlow = (totalThrust / (VEHICLE.isp * EARTH_G0)) * dt * 1.8;
      fuel = Math.max(0, fuel - fuelFlow);
      sounds.setRocketThrottle(throttle);

      // Thrust accelerations (pitch/roll attitude control)
      const pitchRad = (pitch * Math.PI) / 180;
      const rollRad = (roll * Math.PI) / 180;
      const thrustAy = (totalThrust * Math.cos(pitchRad)) / mass;
      const thrustAx = (totalThrust * Math.sin(pitchRad)) / mass;
      const thrustAz = -(totalThrust * Math.sin(rollRad)) / mass;

      // Drag during powered descent
      const dragAy = -0.5 * rho * vy * Math.abs(vy) * 1.2 * 10 / mass;

      ax = thrustAx + windVx * 0.1;
      ay = thrustAy - MARS_GRAVITY + dragAy;
      az = thrustAz + windVz * 0.1;

      // TRIGGER: Sky Crane at 20 m
      if (altitude <= 20) {
        phase = "SKY_CRANE";
        throttlePidRef.current.reset();
        store.addEvent("SKY CRANE ENGAGED — hovering at 20 m, lowering Perseverance on nylon tethers.", "warning");
      }
    }

    // =====================================================================
    // PHASE 4: SKY CRANE — HOVER + LOWER ROVER ON CABLES
    // =====================================================================
    else if (phase === "SKY_CRANE") {
      mass = VEHICLE.descentStageMass + VEHICLE.roverMass + fuel;

      // Soft controlled descent rate: -0.75 m/s
      const targetVy = -0.75;
      const commandedThrottle = throttlePidRef.current.update(targetVy, vy, dt);
      throttle = Math.max(0.4, Math.min(0.88, commandedThrottle));

      const maxThrust = VEHICLE.numEngines * VEHICLE.maxThrustPerEngine;
      totalThrust = maxThrust * throttle;
      const fuelFlow = (totalThrust / (VEHICLE.isp * EARTH_G0)) * dt * 1.8;
      fuel = Math.max(0, fuel - fuelFlow);
      sounds.setRocketThrottle(throttle);

      ay = (totalThrust / mass) - MARS_GRAVITY;
      ax = -vx * 2.5; // kill horizontal drift
      az = -vz * 2.5;

      skyCraneCableLength = Math.min(7.5, skyCraneCableLength + dt * 1.5);

      // TOUCHDOWN: rover wheels reach ground
      if (altitude <= skyCraneCableLength + 0.3 || altitude <= 1.8) {
        altitude = 0;
        vy = -0.62;
        vx = 0;
        vz = 0;
        phase = "TOUCHDOWN";
        roverSettled = true;
        sounds.playSeparation();
        sounds.playTouchdownChime();
        sounds.setRocketThrottle(0.15);
        store.addEvent("✅ TOUCHDOWN CONFIRMED! Perseverance safely on Jezero Crater floor.", "nominal");
      }
    }

    // =====================================================================
    // PHASE 5: SKY CRANE FLYAWAY (after rover bridle cut)
    // =====================================================================
    else if (phase === "TOUCHDOWN") {
      skyCraneFlyawayOffset = [
        skyCraneFlyawayOffset[0] + dt * 35,
        skyCraneFlyawayOffset[1] + dt * 22,
        skyCraneFlyawayOffset[2] + dt * 15,
      ];

      const maxThrust = VEHICLE.numEngines * VEHICLE.maxThrustPerEngine;
      throttle = 0.92;
      fuel = Math.max(0, fuel - (maxThrust / (VEHICLE.isp * EARTH_G0)) * dt * 0.85);
      sounds.setRocketThrottle(Math.max(0, 0.35 - skyCraneFlyawayOffset[1] * 0.004));

      altitude = 0; vy = 0; vx = 0; vz = 0;

      if (skyCraneFlyawayOffset[1] > 180 || fuel <= 0) {
        sounds.setRocketThrottle(0);
        phase = "COMPLETED";

        const landingDistance = Math.hypot(downrange, crossrange);
        const finalVSpeed = 0.62; // touchdown speed we locked
        const passedVel = finalVSpeed < 2.5;
        const passedAcc = landingDistance < 50;
        const passedG = maxGForce < 5.0;
        const success = passedVel && passedAcc && passedG;

        let grade = "FAILED";
        if (success && landingDistance < 15 && finalVSpeed < 1.0) grade = "S — Perseverance Flight Master!";
        else if (success && landingDistance < 30) grade = "A — NASA Mission Qualified";
        else if (success) grade = "B — Acceptable Landing";
        else if (passedVel && passedAcc) grade = "C — Marginal";
        else grade = "FAILED — Mission Abort";

        store.setEvaluation({
          success,
          finalVelocity: finalVSpeed.toFixed(2),
          accuracy: landingDistance.toFixed(1),
          maxG: maxGForce.toFixed(2),
          fuelRemaining: Math.round(fuel),
          fuelPercent: Math.round((fuel / VEHICLE.initialFuel) * 100),
          grade,
          debrief: success
            ? "Flawless autonomous landing! All physical thresholds met within NASA mission criteria."
            : [
                !passedVel && "Touchdown velocity > 2.5 m/s",
                !passedAcc && "Landed outside 50 m target zone",
                !passedG && "G-force exceeded 5.0 G structural limit",
              ].filter(Boolean).join(". "),
        });
      }
    }

    // =====================================================================
    // INTEGRATE POSITION (Euler integration)
    // =====================================================================
    vx += ax * dt;
    vy += ay * dt;
    vz += az * dt;

    speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    altitude = Math.max(0, altitude + vy * dt);
    downrange += vx * dt;
    crossrange += vz * dt;

    // G-Force
    const totalAcc = Math.sqrt(ax * ax + ay * ay + az * az);
    const gForce = totalAcc / EARTH_G0;
    if (gForce > maxGForce) maxGForce = gForce;

    const distanceToTarget = Math.hypot(downrange, crossrange);
    const fuelPercent = (fuel / VEHICLE.initialFuel) * 100;

    // Write back to store
    store.updateFlightData({
      altitude, downrange, crossrange,
      speed, vx, vy, vz,
      pitch, yaw, roll,
      phase, fuel, fuelPercent, throttle,
      heatShieldAttached, heatShieldFallingOffset,
      parachuteDeployed, parachuteDeployProgress,
      backshellSeparated, backshellOffset,
      skyCraneCableLength, skyCraneFlyawayOffset,
      roverSettled, radarLocked,
      dynamicPressure: q,
      gForce, maxGForce,
      heatFlux: qFlux, temperature: temp, mach,
      distanceToTarget, timeElapsed,
    });

    // Record telemetry for graphs every 0.3s simulated time
    telemetryTimerRef.current += dt;
    if (telemetryTimerRef.current >= 0.3) {
      telemetryTimerRef.current = 0;
      store.appendTelemetryPoint();

      // Trajectory ribbon point in visual space
      const visualY = altitude * VISUAL_SCALE;
      const visualX = downrange * VISUAL_SCALE;
      const visualZ = crossrange * VISUAL_SCALE;
      store.appendTrajectoryPoint({ x: visualX, y: visualY, z: visualZ, phase });
    }
  });

  return null;
}