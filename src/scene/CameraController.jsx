import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulationStore } from "../simulation/SimulationStore";
import { VISUAL_SCALE } from "../components/EntryController";

/**
 * Multi-angle NASA Mission Camera Director
 * Coordinate system: 1 visual unit = 500 m real
 * Lander starts at Y ≈ 130 (altitude 65 km), descends to Y = 0 (ground)
 */
export default function CameraController() {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3(0, 145, 18));
  const currentTarget = useRef(new THREE.Vector3(0, 130, 0));

  const {
    altitude,
    downrange,
    crossrange,
    cameraMode,
    skyCraneCableLength,
  } = useSimulationStore();

  useFrame((_, delta) => {
    if (cameraMode === "FREE_ORBIT") return;

    const visualY = altitude * VISUAL_SCALE;
    const visualX = downrange * VISUAL_SCALE;
    const visualZ = crossrange * VISUAL_SCALE;

    const landerPos = new THREE.Vector3(visualX, visualY, visualZ);
    const targetLookAt = landerPos.clone();
    let desiredCamPos = new THREE.Vector3();

    // Scale camera distance based on altitude (far away in space, close near surface)
    // At 65 km (130 units): cam 25 units away
    // At 0 m (0 units): cam 4 units away
    const camDist = Math.max(3.5, Math.min(25, 3.5 + visualY * 0.18));

    switch (cameraMode) {
      case "CHASE":
        desiredCamPos.set(visualX - 1.5, visualY + camDist * 0.3, visualZ + camDist);
        break;

      case "BELLY_CAM":
        // Looking DOWN from belly at Martian surface
        desiredCamPos.set(visualX, visualY - 0.3, visualZ + 0.8);
        targetLookAt.set(visualX, 0, visualZ); // look at ground
        break;

      case "CHUTE_CAM":
        // Looking UP at the parachute canopy from below
        desiredCamPos.set(visualX, visualY + 0.8, visualZ + 1.0);
        targetLookAt.set(visualX, visualY + 8, visualZ);
        break;

      case "SKY_CRANE":
        // Top-down from sky crane looking down at rover below
        desiredCamPos.set(visualX + 1.2, visualY + 1.5, visualZ + 1.2);
        targetLookAt.set(visualX, visualY - skyCraneCableLength * VISUAL_SCALE * 10, visualZ);
        break;

      case "GROUND":
        // Ground station at the Jezero target pad looking up
        desiredCamPos.set(5, 0.8, 7);
        targetLookAt.copy(landerPos);
        break;

      default:
        desiredCamPos.set(visualX - 1.5, visualY + camDist * 0.3, visualZ + camDist);
    }

    // Smooth camera interpolation (lerp)
    const speed = Math.min(1, delta * 2.8);
    currentPos.current.lerp(desiredCamPos, speed);
    currentTarget.current.lerp(targetLookAt, speed);

    camera.position.copy(currentPos.current);
    camera.lookAt(currentTarget.current);
  });

  return null;
}
