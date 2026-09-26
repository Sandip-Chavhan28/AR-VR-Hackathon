import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useSimulationStore } from "../simulation/SimulationStore";
import { VISUAL_SCALE } from "../components/EntryController";
import Backshell from "./Backshell";
import Parachute from "./Parachute";
import SkyCrane from "./SkyCrane";
import MarsRover from "./MarsRover";
import HeatShield from "../effects/HeatShield";

/**
 * Integrated 3D Spacecraft Assembly
 * Visual coordinate system: 1 unit = 500 meters
 * - Altitude 65000 m → Y = 130 units (high above terrain at Y=0)
 * - Altitude 0 m     → Y = 0 (resting on surface)
 */
export default function Lander() {
  const landerRef = useRef();

  const {
    altitude,
    downrange,
    crossrange,
    pitch,
    yaw,
    roll,
    phase,
    temperature,
    heatFlux,
    throttle,
    heatShieldAttached,
    heatShieldFallingOffset,
    parachuteDeployed,
    parachuteDeployProgress,
    backshellSeparated,
    backshellOffset,
    skyCraneCableLength,
    skyCraneFlyawayOffset,
    roverSettled,
  } = useSimulationStore();

  useFrame(() => {
    if (!landerRef.current) return;

    // Visual position: 1 visual unit = 500 real meters
    // altitude 65000 m → Y = 130 visual units above terrain
    // altitude 0 m     → Y = 0 (on the surface)
    const visualY = altitude * VISUAL_SCALE;
    const visualX = downrange * VISUAL_SCALE;
    const visualZ = crossrange * VISUAL_SCALE;

    landerRef.current.position.set(visualX, visualY, visualZ);

    // Attitude (pitch/roll in radians)
    landerRef.current.rotation.x = (pitch * Math.PI) / 180;
    landerRef.current.rotation.y = (yaw * Math.PI) / 180;
    landerRef.current.rotation.z = (roll * Math.PI) / 180;
  });

  // Heat shield fall offset in visual space
  const shieldFallVisual = heatShieldFallingOffset * VISUAL_SCALE * 5;
  // Backshell separation in visual space
  const backshellVisual = backshellOffset * VISUAL_SCALE * 5;

  return (
    <group ref={landerRef}>
      {/* 1. HEAT SHIELD — PICA Ablative, glows during entry heating */}
      {(phase === "ENTRY" || (phase === "PARACHUTE" && heatShieldAttached)) && (
        <HeatShield
          temperature={temperature}
          heatFlux={heatFlux}
          isDetached={false}
          fallOffset={0}
        />
      )}

      {/* Detached heat shield falling away */}
      {phase === "PARACHUTE" && !heatShieldAttached && heatShieldFallingOffset < 180 && (
        <group position={[0.3, -shieldFallVisual, 0.2]} rotation={[shieldFallVisual * 0.05, 0, shieldFallVisual * 0.03]}>
          <HeatShield temperature={200} heatFlux={0} isDetached={true} fallOffset={0} />
        </group>
      )}

      {/* 2. BACKSHELL & PARACHUTE during Entry and Parachute phases */}
      {(phase === "ENTRY" || phase === "PARACHUTE") && (
        <group>
          <Backshell />
          {parachuteDeployed && (
            <Parachute deployProgress={parachuteDeployProgress} />
          )}
        </group>
      )}

      {/* Backshell flying away after powered descent ignition */}
      {phase === "POWERED" && backshellOffset < 180 && (
        <group position={[0, backshellVisual + 0.5, -backshellVisual * 0.3]}>
          <Backshell />
          <Parachute deployProgress={1.0} />
        </group>
      )}

      {/* 3. SKY CRANE (active during Powered Descent, Sky Crane, and Touchdown flyaway) */}
      {(phase === "POWERED" || phase === "SKY_CRANE" || phase === "TOUCHDOWN") && (
        <group
          position={
            phase === "TOUCHDOWN"
              ? [
                  skyCraneFlyawayOffset[0] * VISUAL_SCALE * 3,
                  skyCraneFlyawayOffset[1] * VISUAL_SCALE * 3 + 0.8,
                  skyCraneFlyawayOffset[2] * VISUAL_SCALE * 3,
                ]
              : [0, 0, 0]
          }
          rotation={
            phase === "TOUCHDOWN" ? [0.5, 0.2, 0.35] : [0, 0, 0]
          }
        >
          <SkyCrane
            throttle={throttle}
            cableLength={skyCraneCableLength}
            isHovering={phase === "SKY_CRANE"}
          />
        </group>
      )}

      {/* 4. PERSEVERANCE ROVER */}
      {/* During sky crane: rover hangs below on cables. During ENTRY/PARACHUTE/POWERED: hidden inside aeroshell */}
      {(phase === "SKY_CRANE" || phase === "TOUCHDOWN" || phase === "COMPLETED") && (
        <group
          position={[
            0,
            phase === "SKY_CRANE"
              ? -(skyCraneCableLength * 0.15) // hangs below sky crane on cables
              : 0.15, // sitting on surface
            0,
          ]}
        >
          <MarsRover settled={roverSettled || phase === "COMPLETED"} />
        </group>
      )}

      {/* Rover hidden inside aeroshell during entry but visible during POWERED once we're near surface */}
      {phase === "POWERED" && altitude < 500 && (
        <group position={[0, -0.3, 0]}>
          <MarsRover settled={false} />
        </group>
      )}
    </group>
  );
}