import React, { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import MarsSurface from './MarsSurface';
import Lander from './Lander';
import StarField from './StarField';

/**
 * CameraController – sets up a fixed cinematic camera position
 * looking at the lander on the Mars surface.
 * No orbit controls (not installing @react-three/drei).
 * Uses native Three.js camera manipulation via useThree.
 */
function CameraController() {
  const { camera } = useThree();

  // Set initial camera pose once
  React.useEffect(() => {
    camera.position.set(8, 5, 12);
    camera.lookAt(0, 1.5, 0);
    camera.fov = 55;
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

/**
 * MarsAtmosphereHaze – a large translucent sphere simulating
 * the thin reddish-orange Martian atmospheric haze at the horizon.
 */
function MarsAtmosphereHaze() {
  return (
    <mesh position={[0, 0, 0]}>
      <sphereGeometry args={[180, 32, 16]} />
      <meshBasicMaterial
        color="#c0622a"
        transparent
        opacity={0.06}
        side={2} /* THREE.BackSide = 2 */
      />
    </mesh>
  );
}

/**
 * SceneLighting – sets up the lighting rig for the Mars scene.
 *
 * - Ambient: dim warm fill (simulate Mars sky scatter)
 * - Directional: low-angle "sun" from the side (golden hour angle)
 * - Hemisphere: subtle sky/ground contribution
 */
function SceneLighting() {
  return (
    <>
      {/* Dim warm ambient fill */}
      <ambientLight intensity={0.25} color="#ffddaa" />

      {/* Primary directional sun light – low angle for dramatic shadows */}
      <directionalLight
        position={[30, 20, 10]}
        intensity={1.8}
        color="#ffcc88"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={200}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />

      {/* Subtle blue fill from "space" side (reflected Mars sky) */}
      <directionalLight
        position={[-20, 10, -15]}
        intensity={0.15}
        color="#8899cc"
      />

      {/* Hemisphere sky/ground light */}
      <hemisphereLight
        skyColor="#331800"
        groundColor="#1a0800"
        intensity={0.4}
      />
    </>
  );
}

/**
 * MarsScene – main React Three Fiber canvas scene.
 *
 * Renders:
 *   - Dark space background
 *   - Star field (points)
 *   - Martian atmosphere haze sphere
 *   - Reddish procedural Mars surface
 *   - Low-poly lander with idle sway
 *   - Cinematic lighting rig
 *
 * No physics, GN&C, telemetry, or controls implemented yet.
 * This is only the visual prototype (Phase 0).
 */
export default function MarsScene() {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* HUD label – EDL Phase indicator placeholder */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,160,80,0.4)',
            borderRadius: '8px',
            padding: '8px 24px',
            letterSpacing: '0.12em',
            fontSize: '11px',
            color: '#ffaa55',
            textTransform: 'uppercase',
          }}
        >
          🚀 Mars EDL Simulator — Visual Prototype
        </div>
      </div>

      <Canvas
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#000010' }}
        camera={{ fov: 55, near: 0.1, far: 1000, position: [8, 5, 12] }}
      >
        {/* Camera setup */}
        <CameraController />

        {/* Lighting */}
        <SceneLighting />

        {/* Background stars */}
        <StarField count={2500} />

        {/* Atmosphere haze sphere */}
        <MarsAtmosphereHaze />

        {/* Mars surface terrain */}
        <MarsSurface />

        {/* Low-poly lander sitting on the surface */}
        <Lander position={[0, 1.5, 0]} />
      </Canvas>
    </div>
  );
}
