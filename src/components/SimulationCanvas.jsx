/**
 * SimulationCanvas.jsx – Comprehensive 3D Mars EDL Flight Experience.
 *
 * Implements:
 *   - React Three Fiber Canvas with ACESFilmic tone mapping and sRGB output
 *   - AtmosphereController: Dynamic atmospheric scattering, altitude-dependent fog & Martian horizon transition
 *   - CameraDirector: 8 smooth cinematic perspectives with anti-clipping
 *   - Multi-body staged spacecraft with physical heat shield & backshell separation
 *   - Hypersonic entry plasma & shockwave FX
 *   - Procedural Mars globe, atmospheric shells, multi-scale terrain & boulder field
 *   - FlightDirectorHUD with edge-docked collapsible aerospace telemetry panels
 *   - Interactive 13-stage MissionTimeline scrubber
 *   - MissionIntroModal for cinematic briefing & browser audio context unlocking
 *   - EventToast for cinematic HUD milestone announcements
 *   - Lander Vision System (LVS / TRN) PiP & streaming TelemetryGraphs stripcharts
 *   - Post-touchdown aerospace evaluation MissionResultModal
 *   - Client-side Web Audio mission sound effects & keyboard shortcuts
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import MarsSurface from './MarsSurface';
import MarsGlobe from './MarsGlobe';
import Lander from './Lander';
import OrbitalTrajectory from './OrbitalTrajectory';
import LandingSiteGrid from './LandingSiteGrid';
import StarField from './StarField';
import CameraDirector from './CameraDirector';
import MartianDustFX from './MartianDustFX';
import FlightDirectorHUD from './FlightDirectorHUD';
import MissionTimeline from './MissionTimeline';
import MissionIntroModal from './MissionIntroModal';
import EventToast from './EventToast';
import TRNOverlay from './TRNOverlay';
import TelemetryGraphs from './TelemetryGraphs';
import MissionResultModal from './MissionResultModal';
import WorldLabels from './WorldLabels';
import DiagnosticsOverlay from './DiagnosticsOverlay';
import ExplorationModePanel from './ExplorationModePanel';

import { createInitialState, tickSimulation } from '../simulation/simulationState.js';
import { RENDER_SCALE, JEZERO_TARGET_X, JEZERO_TARGET_Z } from '../simulation/physics/constants.js';
import { getTerrainRenderHeight } from '../simulation/landingSite/terrain.js';
import { MARS_SURFACE_FRAME } from './marsSurfaceFrame.js';
import { writeInterpolatedVehicleWorldPosition } from './vehicleRenderFrame.js';
import { EDL_MILESTONES, jumpToMilestone, detectMilestone } from '../simulation/missionEvents.js';
import {
  sounds,
  playTelemetryPing,
  playParachuteDeployAudio,
  playEngineIgnitionAudio,
  playShieldSepAudio,
  playRadarLockAudio,
  playTouchdownChime,
  setAudioMuted,
} from '../audio/SoundEffects.js';

// ---------------------------------------------------------------------------
// 1. Three.js Renderer Configuration
// ---------------------------------------------------------------------------
function RendererConfig() {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    scene.background = new THREE.Color(0x01010a);
  }, [gl, scene]);
  return null;
}

// ---------------------------------------------------------------------------
// 2. Dynamic Atmospheric & Sky Controller
// ---------------------------------------------------------------------------
function AtmosphereController({ simStateRef }) {
  const { scene } = useThree();
  const spaceColor = useMemo(() => new THREE.Color(0x01010a), []);
  const surfaceSkyColor = useMemo(() => new THREE.Color('#2e1a14'), []);
  const fogColor = useMemo(() => new THREE.Color('#6a3c26'), []);

  useFrame(() => {
    const s = simStateRef.current;
    if (!s) return;

    const altKm = (s.altitude || 0) / 1000;

    if (altKm > 60) {
      // Orbital deep space: pitch black, zero fog
      scene.background.copy(spaceColor);
      scene.fog = null;
    } else if (altKm > 10) {
      // Mesosphere / Entry: smooth transition into thin Martian haze
      const t = (60 - altKm) / 50; // 0 to 1
      scene.background.copy(spaceColor).lerp(surfaceSkyColor, t * 0.75);
      const density = 0.00006 * t;
      if (!scene.fog) scene.fog = new THREE.FogExp2(fogColor, density);
      else scene.fog.density = density;
    } else {
      // Low altitude & Surface: authentic dusty Martian sky & horizon haze
      scene.background.copy(surfaceSkyColor);
      const density = 0.00028;
      if (!scene.fog) scene.fog = new THREE.FogExp2(fogColor, density);
      else scene.fog.density = density;
    }
  });

  return null;
}

function MartianSkyDome({ simStateRef }) {
  const domeRef = useRef();
  const { camera } = useThree();
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      horizon: { value: new THREE.Color('#9c5a36') },
      zenith:  { value: new THREE.Color('#0c0a12') },
    },
    vertexShader: `
      varying float vHeight;
      void main() {
        vHeight = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 horizon;
      uniform vec3 zenith;
      varying float vHeight;

      void main() {
        // Atmospheric dust gradient: warm dusty salmon at horizon, fading into dark space at zenith
        float t = smoothstep(-0.12, 0.72, vHeight);
        vec3 color = mix(horizon, zenith, t);

        // Forward scattering dust glow along horizon
        float horizonGlow = smoothstep(0.0, 0.35, 1.0 - abs(vHeight));
        color += vec3(0.07, 0.025, 0.012) * horizonGlow;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  }), []);

  useFrame(() => {
    const altitudeKm = (simStateRef.current?.altitude || 0) / 1000;
    if (!domeRef.current) return;
    domeRef.current.position.copy(camera.position);
    domeRef.current.quaternion.copy(MARS_SURFACE_FRAME.rotation);
    domeRef.current.visible = altitudeKm <= 60;
  });

  return (
    <mesh ref={domeRef} renderOrder={-100} material={material}>
      <sphereGeometry args={[220, 64, 64]} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// 3. Physics Runner (Fixed-dt Accumulator)
// ---------------------------------------------------------------------------
function PhysicsRunner({ simStateRef, accumRef, onStateChange }) {
  useFrame((_, delta) => {
    tickSimulation(simStateRef.current, delta, accumRef);
    if (onStateChange) onStateChange();
  });
  return null;
}

// ---------------------------------------------------------------------------
// 4. Authentic Martian Sun & Planetary Lighting
// ---------------------------------------------------------------------------
function SceneLighting({ simStateRef, accumRef }) {
  const lightRef = useRef();
  const targetRef = useRef(new THREE.Object3D());
  const { scene } = useThree();

  useEffect(() => {
    const t = targetRef.current;
    scene.add(t);
    return () => {
      scene.remove(t);
    };
  }, [scene]);

  useFrame(() => {
    if (!lightRef.current || !simStateRef?.current) return;
    const s = simStateRef.current;
    writeInterpolatedVehicleWorldPosition(s, accumRef, targetRef.current.position);
    lightRef.current.target = targetRef.current;
    // Grazing sunlight angle relative to authoritative vehicle position
    const tp = targetRef.current.position;
    lightRef.current.position.set(tp.x + 15.0, tp.y + 7.2, tp.z + 8.5);
  });

  return (
    <>
      {/* Primary Key Sunlight — grazing angle creates crisp relief & hill-shading */}
      <directionalLight
        ref={lightRef}
        position={[350, 200, 180]}
        intensity={2.8}
        color="#fff0e0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      {/* Secondary Surface Albedo Fill — warm reddish-orange bounce from dusty regolith */}
      <directionalLight
        position={[-250, -350, -120]}
        intensity={0.75}
        color="#b05022"
      />
      {/* Tertiary Sky Back-Fill — subtle blue-grey scattered light */}
      <directionalLight
        position={[0, 180, -300]}
        intensity={0.25}
        color="#586c80"
      />
      {/* Ambient Regolith Radiance — deep shadow tone */}
      <ambientLight intensity={0.28} color="#22100a" />
      {/* Hemisphere: dusty salmon sky / dark basalt ground */}
      <hemisphereLight skyColor="#7c482c" groundColor="#200a04" intensity={0.55} />
    </>
  );
}

// ---------------------------------------------------------------------------
// 4.5 Automatic Scene Sanity & Visibility Checker
// ---------------------------------------------------------------------------
function SceneSanityChecker() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (!gl || !scene || !camera) {
      console.error('[SANITY CHECK] Critical Three.js subsystem missing!');
    } else {
      console.log('[SANITY CHECK] Three.js WebGL Renderer initialized successfully. Scene children:', scene.children.length);
      if (typeof window !== 'undefined') {
        window.__THREE_SCENE__ = scene;
        window.__THREE_GL__ = gl;
        window.__THREE_CAMERA__ = camera;
      }
    }
  }, [gl, scene, camera]);

  useFrame(() => {
    const cp = camera.position;
    if (!isFinite(cp.x) || !isFinite(cp.y) || !isFinite(cp.z)) {
      console.warn('[SANITY CHECK] Camera coordinates became non-finite! Auto-recovering camera.');
      camera.position.set(0, 255, 10);
      camera.lookAt(0, 250, 0);
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// 5. WebGL Stats Tracker (inside Canvas, samples gl.info at 10Hz)
// ---------------------------------------------------------------------------
function WebGLStatsTracker({ statsRef, simStateRef }) {
  const { gl } = useThree();
  const lastSampleTime = useRef(0);
  const frameCount = useRef(0);
  const lastFrameTime = useRef(performance.now());

  useFrame(() => {
    const now = performance.now();
    const frameDelta = now - lastFrameTime.current;
    lastFrameTime.current = now;
    frameCount.current++;

    const s = simStateRef?.current;

    // Throttle stats sampling to 10Hz
    if (now - lastSampleTime.current >= 100) {
      const elapsed = now - lastSampleTime.current;
      const fps = Math.round((frameCount.current * 1000) / elapsed);
      frameCount.current = 0;
      lastSampleTime.current = now;

      if (statsRef) {
        statsRef.current = {
          fps,
          frameTimeMs: frameDelta,
          substeps: s?.substepsLastFrame || 0,
          physicsMs: s?.physicsMsLastFrame || 0,
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
        };
        if (typeof window !== 'undefined') {
          window.__EDL_STATS__ = statsRef.current;
        }
      }

      // Reset render info counters
      gl.info.reset();
    }
  });
  return null;
}

// ---------------------------------------------------------------------------
// 6. Main Simulation Canvas Component
// ---------------------------------------------------------------------------
export default function SimulationCanvas() {
  const simStateRef = useRef(createInitialState());
  if (typeof window !== 'undefined') {
    window.__SIM_STATE_REF__ = simStateRef;
  }
  const accumRef = useRef(0);
  const cameraRef = useRef(null);
  const webGLStatsRef = useRef({ fps: 60, frameTimeMs: 16.6, drawCalls: 0, triangles: 0, geometries: 0, textures: 0 });

  const [introOpen, setIntroOpen] = useState(true);
  const [running, setRunning] = useState(false);
  const [cameraMode, setCameraMode] = useState('CHASE');
  const [zoomFactor, setZoomFactor] = useState(1.0);
  const [timeScale, setTimeScale] = useState(1);
  const [units, setUnits] = useState('metric');
  const [mode, setMode] = useState('DEMO');
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [trnOpen, setTrnOpen] = useState(false);
  const [graphsOpen, setGraphsOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [muted, setMutedState] = useState(() => sounds.isMuted());
  const [activeMilestone, setActiveMilestone] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  // Post-landing exploration mode — activates automatically after phase === 'LANDED'
  const [explorationModeActive, setExplorationModeActive] = useState(false);


  // Rover Inspection Mode state
  const [roverViewMode, setRoverViewMode] = useState('normal');     // 'normal' | 'cutaway' | 'exploded'
  const [explodedFactor, setExplodedFactor] = useState(0.65);       // 0.0–1.0
  const [selectedComponent, setSelectedComponent] = useState(null); // e.g. 'MASTCAM_Z'

  const prevMilestoneIdRef = useRef('ORBIT');
  const resultModalShownRef = useRef(false);
  const lastScrollTime = useRef(0);

  // Play / Pause toggle
  const handleTogglePlay = useCallback(() => {
    sounds.resume();
    simStateRef.current.running = !simStateRef.current.running;
    setRunning(simStateRef.current.running);
    if (!simStateRef.current.running) {
      sounds.pause();
    }
  }, []);

  // Reset simulation
  const handleReset = useCallback(() => {
    sounds.reset();
    simStateRef.current = createInitialState();
    simStateRef.current.timeScale = timeScale;
    simStateRef.current.mode = mode;
    accumRef.current = 0;
    setRunning(false);
    setResultModalOpen(false);
    resultModalShownRef.current = false;
    setCameraMode('CHASE');
    setZoomFactor(1.0);
    prevMilestoneIdRef.current = 'ORBIT';
    setActiveMilestone(null);
    setExplorationModeActive(false);
  }, [timeScale, mode]);

  // Start mission from intro briefing
  const handleStartMission = useCallback(() => {
    setIntroOpen(false);
    sounds.init();
    sounds.resume();
    sounds.playTelemetryPing();
    simStateRef.current.running = true;
    setRunning(true);
  }, []);

  // Time scale adjustment
  const handleTimeScaleChange = useCallback((newScale) => {
    setTimeScale(newScale);
    if (simStateRef.current) {
      simStateRef.current.timeScale = newScale;
    }
    accumRef.current = 0; // Clear lingering accumulated debt so rapid speed switching never stutters
  }, []);

  // Camera change and zoom handling
  const handleCameraChange = useCallback((newCam) => {
    if (newCam === 'ZOOM_IN') {
      setZoomFactor((z) => Math.max(0.3, z * 0.8));
    } else if (newCam === 'ZOOM_OUT') {
      setZoomFactor((z) => Math.min(3.5, z * 1.25));
    } else {
      setZoomFactor(1.0);
      setCameraMode(newCam);
    }
  }, []);

  // Milestone scrub / jump (distinguishes seek from live events - no historical cascade)
  const handleSelectMilestone = useCallback((milestoneId) => {
    if (!simStateRef.current) return;
    sounds.resume();
    // Mark prior milestone one-shot guards as already triggered so seek does not replay historical sounds
    sounds.markGuardsForMilestone(milestoneId);

    jumpToMilestone(simStateRef.current, milestoneId);
    simStateRef.current.timeScale = timeScale;
    simStateRef.current.running = true;
    setRunning(true);

    // Play one short seek cue
    sounds.playTelemetryPing();

    // Immediately update continuous sound levels for the scrubbed milestone
    sounds.updateContinuousAudio(simStateRef.current, true);

    const m = detectMilestone(simStateRef.current);
    setActiveMilestone(m);

    // Auto-select corresponding camera and modal cues (no duplicate event sound replay)
    if (milestoneId === 'ORBIT') setCameraMode('ORBIT_OVERVIEW');
    else if (milestoneId === 'PEAK_HEATING') setCameraMode('HEAT_SHIELD_CAM');
    else if (milestoneId === 'PARACHUTE_DEPLOY') setCameraMode('PARACHUTE_LOOKUP');
    else if (milestoneId === 'HEAT_SHIELD_SEP') setCameraMode('CHASE');
    else if (milestoneId === 'RADAR_LOCK') setCameraMode('CHASE');
    else if (milestoneId === 'TRN_HAZARD') {
      setCameraMode('CHASE');
      setTrnOpen(true);
    } else if (milestoneId === 'BACKSHELL_SEP' || milestoneId === 'POWERED_DESCENT') {
      setCameraMode('POWERED_DESCENT');
    } else if (milestoneId === 'TOUCHDOWN' || milestoneId === 'SKY_CRANE_TERMINAL') {
      setCameraMode(milestoneId === 'SKY_CRANE_TERMINAL' ? 'SKY_CRANE' : 'GROUND_TOUCHDOWN');
      if (milestoneId === 'TOUCHDOWN') {
        setTimeout(() => {
          setResultModalOpen(true);
        }, 2800);
        sounds.playTouchdownChime();
      }
    } else {
      setCameraMode('CHASE');
    }
  }, [timeScale]);

  // Advance to next milestone
  const handleNextMilestone = useCallback(() => {
    const s = simStateRef.current;
    if (!s) return;
    const cur = detectMilestone(s);
    const idx = EDL_MILESTONES.findIndex((item) => item.id === cur.id);
    if (idx < EDL_MILESTONES.length - 1) {
      handleSelectMilestone(EDL_MILESTONES[idx + 1].id);
    }
  }, [handleSelectMilestone]);

  // Rewind to previous milestone
  const handlePrevMilestone = useCallback(() => {
    const s = simStateRef.current;
    if (!s) return;
    const cur = detectMilestone(s);
    const idx = EDL_MILESTONES.findIndex((item) => item.id === cur.id);
    if (idx > 0) {
      handleSelectMilestone(EDL_MILESTONES[idx - 1].id);
    }
  }, [handleSelectMilestone]);

  // Audio mute toggle with persistent storage
  const handleToggleMute = useCallback(() => {
    sounds.resume();
    const nextMuted = sounds.toggleMute();
    setMutedState(nextMuted);
  }, []);

  // State change hook (monitors continuous audio & one-shot physical staging transitions)
  const handleFrameStateChange = useCallback(() => {
    const s = simStateRef.current;
    if (!s) return;

    // Continuous audio update (wind + rocket engine rumble) - throttled at 20Hz inside soundEngine
    sounds.updateContinuousAudio(s, s.running);

    // Milestone change HUD toast & milestone cue
    const curMilestone = detectMilestone(s);
    if (curMilestone.id !== prevMilestoneIdRef.current) {
      prevMilestoneIdRef.current = curMilestone.id;
      setActiveMilestone(curMilestone);
      sounds.playTelemetryPing();
    }

    // Specific staging triggers based on actual physical state with one-shot protection:
    if (s.cruiseStageSeparated) {
      sounds.playEventOnce('cruise-stage-sep', () => sounds.playSeparation());
    }

    if (s.parachuteState === 'DEPLOYING' || s.phase === 'PARACHUTE_DESCENT') {
      sounds.playEventOnce('parachute-deploy', () => sounds.playParachuteDeploy());
    }

    if (s.heatShieldSeparated) {
      sounds.playEventOnce('heat-shield-sep', () => sounds.playSeparation());
    }

    if (s.radarLocked) {
      sounds.playEventOnce('radar-lock', () => sounds.playRadarPing());
    }

    if (s.backshellSeparated) {
      sounds.playEventOnce('backshell-sep', () => sounds.playSeparation());
    }

    if (s.phase === 'POWERED_DESCENT') {
      sounds.playEventOnce('powered-descent', () => sounds.playAlertBeep());
    }

    // Touchdown trigger
    if ((s.grounded || s.phase === 'LANDED') && !resultModalShownRef.current) {
      resultModalShownRef.current = true;
      sounds.playEventOnce('cable-cut', () => sounds.playSeparation());
      sounds.playEventOnce('touchdown', () => sounds.playTouchdownChime());
      setCameraMode('GROUND_TOUCHDOWN');
      // Delay evaluation modal by 2.8s so the user visually enjoys cable severance, suspension settling, and descent stage flyaway
      setTimeout(() => {
        setResultModalOpen(true);
      }, 2800);
      // Activate exploration mode after a comfortable post-landing pause
      setTimeout(() => {
        setExplorationModeActive(true);
        setCameraMode('EXPLORE_DRAMATIC');
      }, 8000);
    }
  }, []);

  // Mouse wheel scroll to scrub phases ("Scroll for next phase ↓")
  useEffect(() => {
    const handleWheel = (e) => {
      // If user is inside a scrollable modal/panel or in free camera mode, skip
      if (!e.target.closest('.mission-timeline') || e.ctrlKey || e.metaKey || cameraMode === 'FREE') return;

      const now = Date.now();
      if (now - lastScrollTime.current < 450) return;

      if (e.deltaY > 25) {
        lastScrollTime.current = now;
        handleNextMilestone();
      } else if (e.deltaY < -25) {
        lastScrollTime.current = now;
        handlePrevMilestone();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [cameraMode, handleNextMilestone, handlePrevMilestone]);

  // Ensure AudioContext is resumed upon first user interaction without errors
  useEffect(() => {
    const unlockAudio = () => {
      sounds.resume();
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true, once: true });
    window.addEventListener('keydown', unlockAudio, { passive: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset();
      } else if (e.key === 't' || e.key === 'T') {
        setTrnOpen((v) => !v);
      } else if (e.key === 'g' || e.key === 'G') {
        setGraphsOpen((v) => !v);
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
      } else if (e.key === 'u' || e.key === 'U') {
        setUnits((prev) => (prev === 'metric' ? 'imperial' : 'metric'));
      } else if (e.key === 'p' || e.key === 'P') {
        setIsPresentationMode((prev) => !prev);
      } else if (e.key === 'd' || e.key === 'D') {
        setShowDiagnostics((prev) => !prev);
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextMilestone();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevMilestone();
      } else if (e.key === 'f' || e.key === 'F') {
        setCameraMode('FREE');
      } else if (e.key === '1') {
        const isLanded = simStateRef.current?.grounded || simStateRef.current?.phase === 'LANDED';
        setCameraMode(isLanded ? 'EXPLORE_FRONT' : 'CHASE');
      } else if (e.key === '2') {
        const isLanded = simStateRef.current?.grounded || simStateRef.current?.phase === 'LANDED';
        setCameraMode(isLanded ? 'EXPLORE_HIGH' : 'HEAT_SHIELD_CAM');
      } else if (e.key === '3') {
        const isLanded = simStateRef.current?.grounded || simStateRef.current?.phase === 'LANDED';
        setCameraMode(isLanded ? 'EXPLORE_LOW' : 'PARACHUTE_LOOKUP');
      } else if (e.key === '4') {
        const isLanded = simStateRef.current?.grounded || simStateRef.current?.phase === 'LANDED';
        setCameraMode(isLanded ? 'EXPLORE_REAR' : 'TRN_NADIR');
      } else if (e.key === '5') {
        const isLanded = simStateRef.current?.grounded || simStateRef.current?.phase === 'LANDED';
        setCameraMode(isLanded ? 'EXPLORE_DRAMATIC' : 'POWERED_DESCENT');
      } else if (e.key === '6') setCameraMode('GROUND_TOUCHDOWN');
      else if (e.key === '7') setCameraMode('ORBIT_OVERVIEW');
      else if (e.key === '8') setCameraMode('FREE');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, handleReset, handleToggleMute, handleNextMilestone, handlePrevMilestone]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#01010a' }}>
      {/* ── Cinematic Mission Briefing Screen ── */}
      <MissionIntroModal
        isOpen={introOpen}
        onStartMission={handleStartMission}
      />

      {/* ── Cinematic HUD Event Toast ── */}
      <EventToast activeMilestone={activeMilestone} />

      {/* ── Flight Director Mission Control HUD ── */}
      <FlightDirectorHUD
        simStateRef={simStateRef}
        running={running}
        cameraMode={cameraMode}
        timeScale={timeScale}
        units={units}
        mode={mode}
        isPresentationMode={isPresentationMode}
        onTogglePlay={handleTogglePlay}
        onReset={handleReset}
        onTimeScaleChange={handleTimeScaleChange}
        onCameraChange={handleCameraChange}
        onSelectMilestone={handleSelectMilestone}
        onToggleUnits={() => setUnits((u) => (u === 'metric' ? 'imperial' : 'metric'))}
        onToggleMode={() =>
          setMode((m) => {
            const next = m === 'DEMO' ? 'REALISTIC' : 'DEMO';
            if (simStateRef.current) simStateRef.current.mode = next;
            return next;
          })
        }
        onTogglePresentationMode={() => setIsPresentationMode((p) => !p)}
        onToggleTRN={() => setTrnOpen(!trnOpen)}
        onToggleGraphs={() => setGraphsOpen(!graphsOpen)}
        onOpenInfo={() => setIntroOpen(true)}
        trnOpen={trnOpen}
        graphsOpen={graphsOpen}
        isMuted={muted}
        onToggleMute={handleToggleMute}
      />

      {/* ── Floating 3D Spatial World Labels ── */}
      <WorldLabels simStateRef={simStateRef} cameraRef={cameraRef} />

      {/* ── Rover Inspection HUD (visible when landed or FREE camera) ── */}
      {(cameraMode === 'FREE' || cameraMode === 'GROUND_TOUCHDOWN') && (
        <div
          className="hud-panel"
          style={{
            position: 'absolute',
            bottom: '96px',
            right: '18px',
            background: 'rgba(10,14,26,0.88)',
            border: '1px solid rgba(255,140,0,0.35)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#e2e8f0',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 120,
            minWidth: '200px',
            backdropFilter: 'blur(6px)',
            userSelect: 'none',
          }}
        >
          <div style={{ color: '#ff8c00', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '0.08em', fontSize: '11px' }}>
            🔭 ROVER INSPECTION
          </div>

          {/* View Mode Toggle */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}>VIEW MODE</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['normal', 'cutaway', 'exploded'].map((m) => (
                <button
                  key={m}
                  onClick={() => setRoverViewMode(m)}
                  style={{
                    flex: 1,
                    padding: '4px 2px',
                    background: roverViewMode === m ? 'rgba(255,140,0,0.25)' : 'rgba(255,255,255,0.05)',
                    border: roverViewMode === m ? '1px solid #ff8c00' : '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '4px',
                    color: roverViewMode === m ? '#ff8c00' : '#94a3b8',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {m === 'normal' ? 'Normal' : m === 'cutaway' ? 'X-Ray' : 'Explode'}
                </button>
              ))}
            </div>
          </div>

          {/* Exploded Factor Slider (only when exploded) */}
          {roverViewMode === 'exploded' && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}>
                SEPARATION: {Math.round(explodedFactor * 100)}%
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(explodedFactor * 100)}
                onChange={(e) => setExplodedFactor(e.target.value / 100)}
                style={{ width: '100%', accentColor: '#ff8c00' }}
              />
            </div>
          )}

          {/* Component Focus Selector */}
          <div>
            <div style={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}>FOCUS COMPONENT</div>
            <select
              value={selectedComponent || ''}
              onChange={(e) => setSelectedComponent(e.target.value || null)}
              style={{
                width: '100%',
                background: 'rgba(10,14,26,0.9)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px',
                color: '#e2e8f0',
                fontSize: '11px',
                padding: '4px 6px',
                fontFamily: 'monospace',
              }}
            >
              <option value="">— Entire Rover —</option>
              <option value="MASTCAM_Z">Mastcam-Z Cameras</option>
              <option value="SUPERCAM">SuperCam Laser</option>
              <option value="HIGH_GAIN_ANTENNA">High-Gain Antenna</option>
              <option value="ROBOTIC_ARM">Robotic Arm</option>
              <option value="TURRET_DRILL">Science Turret &amp; Drill</option>
              <option value="MMRTG">MMRTG Power Source</option>
              <option value="WHEELS_FRONT">Front Wheels (48 Grousers)</option>
              <option value="CHASSIS_WEB">WEB Chassis Interior</option>
            </select>
          </div>
        </div>
      )}

      {/* ── Lander Vision System (LVS / TRN) PiP ── */}
      <TRNOverlay
        simStateRef={simStateRef}
        isOpen={trnOpen}
        onClose={() => setTrnOpen(false)}
      />

      {/* ── Streaming Multi-Channel Telemetry Graphs ── */}
      <TelemetryGraphs
        simStateRef={simStateRef}
        isOpen={graphsOpen}
        onClose={() => setGraphsOpen(false)}
      />

      {/* ── Interactive EDL Milestone Timeline Scrubber ── */}
      {!isPresentationMode && (
        <MissionTimeline
          simStateRef={simStateRef}
          running={running}
          timeScale={timeScale}
          onTogglePlay={handleTogglePlay}
          onReset={handleReset}
          onTimeScaleChange={handleTimeScaleChange}
          onSelectMilestone={handleSelectMilestone}
        />
      )}

      {/* ── Post-Touchdown Mission Evaluation Modal ── */}
      <MissionResultModal
        simStateRef={simStateRef}
        isOpen={resultModalOpen}
        onReplay={handleReset}
        onExploreSurface={() => {
          setResultModalOpen(false);
          setExplorationModeActive(true);
          setCameraMode('EXPLORE_DRAMATIC');
        }}
        onClose={() => setResultModalOpen(false)}
      />

      {/* ── Post-Landing Rover Exploration Mode ── */}
      <ExplorationModePanel
        isActive={explorationModeActive}
        cameraMode={cameraMode}
        onCameraChange={handleCameraChange}
        simStateRef={simStateRef}
      />

      {/* ── Real-Time Developer Diagnostics Overlay (Toggle 'D') ── */}
      <DiagnosticsOverlay
        isOpen={showDiagnostics}
        simStateRef={simStateRef}
        cameraRef={cameraRef}
        cameraMode={cameraMode}
        webGLStatsRef={webGLStatsRef}
      />

      {/* ── WebGL 3D Simulation Canvas ── */}
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 1.5]}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#01010a' }}
      >
        <RendererConfig />
        <SceneSanityChecker />
        <WebGLStatsTracker statsRef={webGLStatsRef} simStateRef={simStateRef} />
        <AtmosphereController simStateRef={simStateRef} />
        <PhysicsRunner simStateRef={simStateRef} accumRef={accumRef} onStateChange={handleFrameStateChange} />
        <Lander
          simStateRef={simStateRef}
          accumRef={accumRef}
          viewMode={roverViewMode}
          explodedFactor={explodedFactor}
          selectedComponent={selectedComponent}
        />
        <CameraDirector simStateRef={simStateRef} accumRef={accumRef} cameraMode={cameraMode} cameraRef={cameraRef} zoomFactor={zoomFactor} />
        <MartianSkyDome simStateRef={simStateRef} />
        <SceneLighting simStateRef={simStateRef} accumRef={accumRef} />
        <StarField />
        <MarsGlobe simStateRef={simStateRef} />
        <OrbitalTrajectory simStateRef={simStateRef} />
        <MarsSurface simStateRef={simStateRef} />
        <LandingSiteGrid simStateRef={simStateRef} />
        <MartianDustFX simStateRef={simStateRef} />
      </Canvas>
    </div>
  );
}
