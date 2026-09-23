import React from 'react';
// CreatorCode scaffold – App entry point
import SimulationCanvas from './components/SimulationCanvas';

/**
 * App – root component for the Mars EDL Simulator.
 *
 * Phase 1: 3-DoF physics simulation active.
 * Renders the physics-connected 3D Mars scene.
 */
function App() {
  return <SimulationCanvas />;
}

export default App;
