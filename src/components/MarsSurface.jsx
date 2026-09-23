/**
 * MarsSurface.jsx – High-fidelity multi-scale Mars terrain & procedural rock fields.
 *
 * Requirements (items 1, 2, 6, 7, 8, 13):
 *   - Authentic Mars palette: dark rusty red (#5A2418), deep rust (#7A3020), Mars red (#963D28), dust (#B85A38)
 *   - Multi-scale terrain architecture:
 *       1. High-Density Local Mesh: ±350m around landing zone with 5m vertex spacing.
 *          Resolves CRATER_ALPHA (28m rim/bowl), CRATER_BETA, CRATER_GAMMA, and local topography.
 *       2. Regional Horizon Mesh: ±250km broad topography blending seamlessly with globe horizon.
 *   - Procedural Rock/Boulder Field:
 *       • Single InstancedMesh of low-poly Martian boulders (dodecahedron geometry)
 *       • Deterministic placement clustered near cataloged obstacle fields & crater rims
 *       • Vertically snapped to exact terrain elevation via getTerrainHeight()
 *   - Spatially aligned with getTerrainHeight() and Lander.jsx.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { RENDER_SCALE } from '../simulation/physics/constants.js';
import { getTerrainHeight, CRATERS, OBSTACLES } from '../simulation/landingSite/terrain.js';

export const ELEV_EXAGGERATION = 30; // Exported single source of truth for Lander & Camera

// Color Palette (linear space for sRGB output + ACESFilmic)
const COL_DARK_MARS = new THREE.Color('#5A2418').convertSRGBToLinear();
const COL_DEEP_RUST = new THREE.Color('#7A3020').convertSRGBToLinear();
const COL_MARS_RED  = new THREE.Color('#963D28').convertSRGBToLinear();
const COL_DUST      = new THREE.Color('#B85A38').convertSRGBToLinear();
const COL_BASALT    = new THREE.Color('#381810').convertSRGBToLinear();

// Deterministic noise helper
function seededNoise(x, z) {
  return (
    Math.sin(x * 0.07 + z * 0.05 + 1.3) * 0.5 +
    Math.sin(x * 0.19 - z * 0.13 + 2.7) * 0.3 +
    Math.sin(x * 0.41 + z * 0.37 + 0.9) * 0.15 +
    Math.sin(x * 0.83 - z * 0.79 + 4.1) * 0.05
  );
}

// ---------------------------------------------------------------------------
// 1. High-Resolution Local Landing Terrain (±350m zone, 140×140 vertices)
// ---------------------------------------------------------------------------
function LocalLandingTerrain() {
  const geometry = useMemo(() => {
    const physHalf = 350; // ±350 meters in physics
    const renderSize = physHalf * 2 * RENDER_SCALE; // 0.70 render units
    const segments = 140; // ~5 meters per vertex cell

    const geo = new THREE.PlaneGeometry(renderSize, renderSize, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colors = [];
    const tempCol = new THREE.Color();

    for (let i = 0; i < positions.count; i++) {
      const rx = positions.getX(i);
      const rz = positions.getZ(i);

      const px = rx / RENDER_SCALE;
      const pz = rz / RENDER_SCALE;

      // Exact terrain elevation from physics model
      const elevM = getTerrainHeight(px, pz);

      // Subtle fine micro-roughness in visual render scale
      const microBump = (
        Math.sin(px * 0.25 + pz * 0.18) * 0.08 +
        Math.sin(px * 0.62 - pz * 0.45) * 0.04
      ) * RENDER_SCALE * ELEV_EXAGGERATION;

      const totalY = elevM * RENDER_SCALE * ELEV_EXAGGERATION + microBump;
      positions.setY(i, totalY);

      // Color computation: base deep rust + dust + crater shading
      const dustFactor = seededNoise(px * 0.03, pz * 0.03) * 0.5 + 0.5;
      tempCol.copy(COL_DEEP_RUST).lerp(COL_DUST, dustFactor * 0.55);

      // Crater-specific shading: darker interior bowls, slight ejecta bright rim
      for (let c = 0; c < CRATERS.length; c++) {
        const cr = CRATERS[c];
        const dx = px - cr.cx;
        const dz = pz - cr.cz;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < cr.radius) {
          // Inside crater bowl: shadow darkening + basalt regolith
          const depthFrac = 1.0 - (dist / cr.radius);
          tempCol.lerp(COL_DARK_MARS, depthFrac * 0.65);
        } else if (dist < cr.radius + cr.rimWidth * 1.5) {
          // Raised rim & proximal ejecta: slightly dustier/brighter
          const rimFrac = 1.0 - Math.abs(dist - cr.radius) / (cr.rimWidth * 1.5);
          tempCol.lerp(COL_MARS_RED, rimFrac * 0.45);
        }
      }

      // Obstacle rock ridge basalt darkening
      for (let o = 0; o < OBSTACLES.length; o++) {
        const obs = OBSTACLES[o];
        const dist = Math.hypot(px - obs.ox, pz - obs.oz);
        if (dist < obs.radius) {
          tempCol.lerp(COL_BASALT, 0.45 * (1.0 - dist / obs.radius));
        }
      }

      colors.push(tempCol.r, tempCol.g, tempCol.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow position={[0, 0, 0]}>
      <meshStandardMaterial
        vertexColors
        roughness={1.0}
        metalness={0.0}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// 2. Regional Horizon Terrain (±250km zone, rolling hills & horizon blend)
// ---------------------------------------------------------------------------
function RegionalHorizonTerrain() {
  const geometry = useMemo(() => {
    const size = 500; // 500 km render units
    const segments = 120;

    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colors = [];
    const tempCol = new THREE.Color();

    for (let i = 0; i < positions.count; i++) {
      const rx = positions.getX(i);
      const rz = positions.getZ(i);
      const distFromCenter = Math.hypot(rx, rz);

      // Transition blend: smooth hollow center so local high-res mesh takes over
      const blend = Math.min(1.0, Math.max(0.0, (distFromCenter - 0.3) / 0.8));

      // Regional rolling topography
      const regionalY = (
        Math.sin(rx * 0.015 + 0.5) * Math.cos(rz * 0.012 + 0.3) * 0.45 +
        Math.sin(rx * 0.035 + 1.2) * Math.sin(rz * 0.028 + 1.7) * 0.22 +
        Math.sin(rx * 0.08 + 2.1)  * Math.cos(rz * 0.065 + 0.9) * 0.09
      ) * blend;

      positions.setY(i, regionalY);

      // Color
      const dust = seededNoise(rx * 0.04, rz * 0.04) * 0.5 + 0.5;
      tempCol.copy(COL_DEEP_RUST).lerp(COL_DUST, dust * 0.5);

      // Dark basalt patches
      const basaltPatch = seededNoise(rx * 0.08 + 3.0, rz * 0.08 - 2.0);
      if (basaltPatch < -0.3) {
        tempCol.lerp(COL_DARK_MARS, 0.4);
      }

      colors.push(tempCol.r, tempCol.g, tempCol.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow position={[0, -0.002, 0]}>
      <meshStandardMaterial
        vertexColors
        roughness={1.0}
        metalness={0.0}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// 3. Procedural Rock Field (InstancedMesh, clustered near obstacles & rims)
// ---------------------------------------------------------------------------
function BoulderField() {
  const count = 90;
  const meshRef = useRef();

  // Low-poly dodecahedron boulder base geometry
  const rockGeometry = useMemo(() => {
    const geo = new THREE.DodecahedronGeometry(1.0, 0); // low poly
    return geo;
  }, []);

  const rockMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: COL_BASALT,
    roughness: 0.98,
    metalness: 0.05,
    flatShading: true,
  }), []);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();

    let seed = 1337;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    let idx = 0;

    // Distribute boulders near cataloged obstacle zones and crater rims
    for (let i = 0; i < count; i++) {
      let px, pz;

      if (i < 30) {
        // Clustered near BOULDER_FIELD_NORTH (-25, 30)
        const angle = rnd() * Math.PI * 2;
        const rad   = rnd() * 18.0;
        px = -25.0 + Math.cos(angle) * rad;
        pz =  30.0 + Math.sin(angle) * rad;
      } else if (i < 55) {
        // Clustered near ROCKY_RIDGE_EAST (50, 45)
        const angle = rnd() * Math.PI * 2;
        const rad   = rnd() * 20.0;
        px = 50.0 + Math.cos(angle) * rad;
        pz = 45.0 + Math.sin(angle) * rad;
      } else if (i < 75) {
        // Near CRATER_ALPHA raised rim (24, 15, radius 28m)
        const angle = rnd() * Math.PI * 2;
        const rad   = 28.0 + (rnd() - 0.3) * 10.0;
        px = 24.0 + Math.cos(angle) * rad;
        pz = 15.0 + Math.sin(angle) * rad;
      } else {
        // General landing zone scatter within ±80m
        px = (rnd() - 0.5) * 160.0;
        pz = (rnd() - 0.5) * 160.0;
      }

      // Physics elevation in meters
      const elevM = getTerrainHeight(px, pz);

      // Render coordinates
      const rx = px * RENDER_SCALE;
      const rz = pz * RENDER_SCALE;
      // Boulder size: 0.6m to 2.2m physical size
      const boulderSizeM = 0.6 + rnd() * 1.6;
      const rSize = boulderSizeM * RENDER_SCALE * ELEV_EXAGGERATION * 0.15; // proportioned for visual clarity

      // Embed base slightly into ground
      const ry = elevM * RENDER_SCALE * ELEV_EXAGGERATION + rSize * 0.35;

      dummy.position.set(rx, ry, rz);
      dummy.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
      dummy.scale.set(
        rSize * (0.8 + rnd() * 0.4),
        rSize * (0.7 + rnd() * 0.5),
        rSize * (0.8 + rnd() * 0.4)
      );

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(idx++, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[rockGeometry, rockMaterial, count]}
      castShadow
      receiveShadow
    />
  );
}

// ---------------------------------------------------------------------------
// Combined MarsSurface Component
// ---------------------------------------------------------------------------
export default function MarsSurface() {
  return (
    <group position={[0, 0, 0]}>
      <LocalLandingTerrain />
      <RegionalHorizonTerrain />
      <BoulderField />
    </group>
  );
}
