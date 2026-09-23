# Mars EDL Simulator

### Problem Statement Fit

Interactive simulation of Mars Entry, Descent, and Landing (EDL). Addresses the challenge of visualizing and understanding the three-phase EDL sequence — hypersonic aero-braking, supersonic parachute deployment, and powered descent — in a real-time 3D environment with real physics equations.

### Target Users

Aerospace engineering students, educators, hackathon judges, and space-enthusiast developers who want to explore and understand Mars EDL mechanics interactively. Accessible from any modern browser with no installation required.

### What We Built

Phase 1: A 3-DoF physics simulation engine connected to a live 3D Mars scene. The lander begins at 80 km altitude and descends under Mars gravity (3.71 m/s²) with realistic exponential atmospheric drag. A debug telemetry HUD shows altitude, speed, vertical velocity, atmospheric density, dynamic pressure, G-force, acceleration components, and simulation time. The simulation runs at 50× time acceleration for demo-friendly viewing. A tracking camera follows the lander's altitude descent.

### Core Features

- Exponential Martian atmosphere model: ρ(h) = ρ₀·exp(−h/H)
- Mars gravity: 3.71 m/s² downward
- Aerodynamic drag: D = 0.5·ρ·v²·Cd·A opposing velocity vector
- Dynamic pressure: q = 0.5·ρ·v²
- 3-DoF translational integration (semi-implicit Euler, fixed dt = 0.05 s)
- Fixed-timestep accumulator (frame-rate independent physics)
- Ground contact detection and clamping
- Altitude-tracking camera (smooth lerp follow)
- Debug telemetry HUD (10 Hz polling, no physics re-renders)
- Start / Reset simulation controls
- 21 passing physics unit tests (Node.js built-in assert)

### Technical Architecture

**Physics layer (pure JS, no React)**
- `src/simulation/physics/constants.js` → All tunable Mars constants
- `src/simulation/physics/atmosphere.js` → Exponential density model
- `src/simulation/physics/forces.js` → Gravity, drag, dynamic pressure, net acceleration
- `src/simulation/physics/integrator.js` → Semi-implicit Euler stepper + ground clamping
- `src/simulation/simulationState.js` → State factory + fixed-timestep accumulator

**Rendering layer (React / R3F)**
- `src/App.jsx` → Root, renders `<SimulationCanvas />`
- `src/components/SimulationCanvas.jsx` → Canvas + PhysicsRunner + TrackingCamera + HUD wiring
- `src/components/Lander.jsx` → Physics-driven; position updated imperatively via ref
- `src/components/DebugHUD.jsx` → Polls state ref at 10 Hz; own useState only for HUD display
- `src/components/MarsSurface.jsx` → Procedural terrain (unchanged)
- `src/components/StarField.jsx` → Procedural stars (unchanged)

**Tests**
- `tests/physics.test.js` → 21 assertions (Node.js, no framework)

### Tech Stack

- React 18.2
- React Three Fiber 8.15
- Three.js 0.160
- Vite 5.0
- Axios 1.6 (installed, not yet used in UI)
- Node.js assert (built-in, for tests)

### Innovation / Uniqueness

Clean separation between physics and rendering: all equations live in pure JS functions with zero React imports. The renderer reads a mutable state ref imperatively — the physics loop never triggers React re-renders. The fixed-timestep accumulator makes the simulation fully frame-rate independent.

### Demo Instructions

1. Clone the repository
2. Run `npm install`
3. Run `npm run dev`
4. Open `http://localhost:5173`
5. Click **▶ Start** in the debug HUD (top-right)
6. Watch the lander descend from 80 km under Mars gravity and atmospheric drag
7. Click **↺ Reset** to restart

To run physics tests:
```
node tests/physics.test.js
```

### Known Limitations

- Phase 1 only: no parachute, no retro-rockets, no GN&C, no telemetry graphs, no wind
- Camera is altitude-tracking but not full orbit control (@react-three/drei not installed)
- Exponential atmosphere model (single-layer); real Mars uses tabulated profiles (GRAM-Mars)
- Chunk size exceeds Vite's 500 kB warning (Three.js + R3F are large libraries)

### Future Work

- Phase 2: Autonomous EDL phases (parachute deployment at Mach/altitude threshold, retro-rocket activation)
- Phase 3: GN&C / PID control algorithms
- Phase 4: Polished telemetry HUD (altitude/velocity chart, fuel, heat, G-force graphs)
- Phase 5: Environmental disturbances (wind shear, dust storms, sensor noise)
- Phase 6: Landing evaluation scoring (velocity, accuracy, G-force)
- Phase 7: Mission Control viewing mode and AR/VR capability