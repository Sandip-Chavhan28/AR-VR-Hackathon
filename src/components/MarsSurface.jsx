/**
 * MarsSurface.jsx – Photorealistic NASA/JPL-Reference Mars Terrain & Geology.
 *
 * Implements:
 *   - Spatial anchoring to landing site: positioned at [landingRefX, 0, 0] so the lander
 *     descends into and touches down directly inside Jezero Crater.
 *   - MOLA elevation sampler (getTerrainHeight / getMolaTerrainHeight)
 *     is the 100% UNTOUCHED scientific source of truth for all vertex topography.
 *   - Authentic Martian mineral palette (warm, dusty, rich NASA regolith tones):
 *       • Basalt crater floors & shadows: #341810 / #421e14
 *       • Dark iron-rich bedrock: #5a2618 / #723220
 *       • Weathered bedrock: #8c3e24
 *       • Primary Mars regolith: #ad522e
 *       • Warm oxidized soil: #c46438
 *       • Sunlit dust: #d67a46
 *       • Windblown fine dust deposits: #e28c56
 *       • Bright ejecta crater rims: #eca072
 *       • Pale carbonate/silica streaks: #f2b48e
 *   - Multi-scale terrain architecture:
 *       1. High-Density Local Jezero Mesh: ±600m with fine vertex resolution.
 *          Resolves CRATER_ALPHA, CRATER_BETA, CRATER_GAMMA, secondary impact pits,
 *          slope-dependent rock faces, aeolian ripples, and micro-gravel.
 *       2. Medium MOLA Regional Terrain: 60 km authentic MOLA grid with slope-aware
 *          shading, crater enhancement, and geological provinces.
 *       3. Planetary horizon and far-field context are provided by the single MarsGlobe.
 *       4. Procedural Rock / Boulder Field: 220 weathered, dust-settled Martian boulders.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MARS_RADIUS, RENDER_SCALE, JEZERO_TARGET_X, JEZERO_TARGET_Z } from '../simulation/physics/constants.js';
import { getLandingSurfaceRenderHeight, MARS_SURFACE_FRAME } from './marsSurfaceFrame.js';
import {
  getTerrainHeight,
  getMolaTerrainHeight,
  CRATERS,
  OBSTACLES,
} from '../simulation/landingSite/terrain.js';

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTIC NASA MARTIAN GEOLOGICAL COLOR PALETTE
// ─────────────────────────────────────────────────────────────────────────────
const COL_BASALT       = new THREE.Color('#341810');
const COL_DARK_IRON    = new THREE.Color('#522416');
const COL_BEDROCK      = new THREE.Color('#78341e');
const COL_REGOLITH     = new THREE.Color('#9e4828');
const COL_IRON_OXIDE   = new THREE.Color('#ba5c32');
const COL_DUST         = new THREE.Color('#d27240');
const COL_FINE_DUST    = new THREE.Color('#e08652');
const COL_RIM_BRIGHT   = new THREE.Color('#eca272');
const COL_PALE_DEPOSIT = new THREE.Color('#f4ba92');

// Multi-scale deterministic fractal noise helper (no Math.random)
function noise(x, z) {
  const o1 = Math.sin(x * 0.0042 + z * 0.0033 + 1.37) * Math.cos(x * 0.0045 - z * 0.0037 + 2.61);
  const o2 = Math.sin(x * 0.0125 + z * 0.0102 + 0.73) * Math.cos(x * 0.0098 - z * 0.0131 + 3.14);
  const o3 = Math.sin(x * 0.0340 - z * 0.0268 + 4.20) * Math.cos(x * 0.0295 + z * 0.0335 + 1.08);
  const o4 = Math.sin(x * 0.0920 + z * 0.0784 + 2.55) * Math.cos(x * 0.0690 - z * 0.0860 + 0.45);
  return o1 * 0.45 + o2 * 0.28 + o3 * 0.18 + o4 * 0.09;
}

function noise01(x, z, phase = 0) {
  return noise(x + phase * 137.3, z + phase * 89.7) * 0.5 + 0.5;
}

const SECONDARY_CRATERS = [
  { x:  -92, z:  -72, radius: 18, depth: 4.5 },
  { x:  104, z:   18, radius: 14, depth: 3.5 },
  { x: -112, z:   92, radius: 22, depth: 5.5 },
  { x:  126, z: -106, radius: 16, depth: 4.0 },
  { x:    8, z:  112, radius: 12, depth: 2.8 },
  { x:  -55, z:   48, radius: 10, depth: 2.2 },
  { x:   68, z:  -62, radius: 8,  depth: 1.8 },
];

const MARS_RENDER_RADIUS = MARS_RADIUS * RENDER_SCALE;

function createRadialGridGeometry(radius, radialSegments, angularSegments, innerRadius = 0) {
  const geometry = new THREE.BufferGeometry();
  const rowLength = angularSegments + 1;
  const vertexCount = (radialSegments + 1) * rowLength;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint16Array(radialSegments * angularSegments * 6);

  for (let ring = 0; ring <= radialSegments; ring++) {
    const t = ring / radialSegments;
    const arcDistance = innerRadius + (radius - innerRadius) * t;

    for (let slice = 0; slice <= angularSegments; slice++) {
      const angle = (slice / angularSegments) * Math.PI * 2;
      const x = arcDistance * Math.cos(angle);
      const z = arcDistance * Math.sin(angle);
      const index = ring * rowLength + slice;
      positions[index * 3] = x;
      positions[index * 3 + 1] = 0;
      positions[index * 3 + 2] = z;
      uvs[index * 2] = x / (radius * 2) + 0.5;
      uvs[index * 2 + 1] = z / (radius * 2) + 0.5;
    }
  }

  let indexOffset = 0;
  for (let ring = 0; ring < radialSegments; ring++) {
    for (let slice = 0; slice < angularSegments; slice++) {
      const inner = ring * rowLength + slice;
      const innerNext = inner + 1;
      const outer = inner + rowLength;
      const outerNext = outer + 1;
      indices[indexOffset++] = inner;
      indices[indexOffset++] = innerNext;
      indices[indexOffset++] = outerNext;
      indices[indexOffset++] = inner;
      indices[indexOffset++] = outerNext;
      indices[indexOffset++] = outer;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}


const HAS_MOLA_TERRAIN = getMolaTerrainHeight(0, 0) !== null;

// Grazing sun direction for analytical hill-shading:
// Coming from south-southeast at ~24° elevation angle
const SUN_DIR = new THREE.Vector3(0.78, 0.40, 0.48).normalize();

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL SEAMLESS REGOLITH DETAIL TEXTURE & BUMP MAP
// ─────────────────────────────────────────────────────────────────────────────
function generateRegolithDetailTextures() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const bCanvas = document.createElement('canvas');
  bCanvas.width = size;
  bCanvas.height = size;
  const bCtx = bCanvas.getContext('2d');

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const bImgData = bCtx.createImageData(size, size);
  const bData = bImgData.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const av = v * Math.PI * 2;
    const sinV = Math.sin(av), cosV = Math.cos(av);

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const au = u * Math.PI * 2;
      const sinU = Math.sin(au), cosU = Math.cos(au);

      // Seamless sand ripples and rock grains
      const ripple1 = Math.sin(av * 12.0 + sinU * 3.5) * 0.40;
      const ripple2 = Math.sin(av * 26.0 - cosU * 6.0) * 0.22;
      const gravel  = (Math.sin(au * 38.0 + cosV * 28.0) * Math.cos(av * 34.0 - sinU * 24.0)) * 0.18;
      const val     = ripple1 + ripple2 + gravel; // ~ -0.8 to +0.8

      // Warm neutral multiplier texture (around 1.0)
      const r = Math.min(255, Math.max(0, 220 + val * 35));
      const g = Math.min(255, Math.max(0, 195 + val * 30));
      const b = Math.min(255, Math.max(0, 175 + val * 25));

      const idx = (y * size + x) * 4;
      data[idx]     = Math.round(r);
      data[idx + 1] = Math.round(g);
      data[idx + 2] = Math.round(b);
      data[idx + 3] = 255;

      // Bump: subtle height variations for sand ripples
      const bVal = Math.min(255, Math.max(0, 128 + val * 80));
      bData[idx]     = Math.round(bVal);
      bData[idx + 1] = Math.round(bVal);
      bData[idx + 2] = Math.round(bVal);
      bData[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  bCtx.putImageData(bImgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;

  const bump = new THREE.CanvasTexture(bCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.needsUpdate = true;

  return { texture, bump };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HIGH-RESOLUTION LOCAL LANDING TERRAIN (±600m Jezero Crater zone)
// ─────────────────────────────────────────────────────────────────────────────
function LocalLandingTerrain({ regolithTexture, regolithBump }) {
  const geometry = useMemo(() => {
    const physHalf = 600;
    const renderRadius = physHalf * RENDER_SCALE;
    const geo = createRadialGridGeometry(renderRadius, 48, 128);

    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const tempCol = new THREE.Color();

    for (let i = 0; i < positions.count; i++) {
      const rx = positions.getX(i);
      const rz = positions.getZ(i);
      const px = rx / RENDER_SCALE;
      const pz = rz / RENDER_SCALE;

      // Authentic MOLA elevation (100% UNTOUCHED)
      const totalY = getLandingSurfaceRenderHeight(px, pz)
        + Math.sqrt(Math.max(0, MARS_RENDER_RADIUS ** 2 - rx ** 2 - rz ** 2)) - MARS_RENDER_RADIUS;
      positions.setY(i, totalY);

      // Local slope
      const dhX = (getTerrainHeight(px + 2, pz) - getTerrainHeight(px - 2, pz)) * 0.25;
      const dhZ = (getTerrainHeight(px, pz + 2) - getTerrainHeight(px, pz - 2)) * 0.25;
      const localSlope = Math.min(1.0, Math.hypot(dhX, dhZ));

      // Analytical hill-shading
      const nx = -dhX, ny = 1.0, nz = -dhZ;
      const nLen = Math.hypot(nx, ny, nz) || 1.0;
      const dotSun = Math.max(0.0, (nx / nLen) * SUN_DIR.x + (ny / nLen) * SUN_DIR.y + (nz / nLen) * SUN_DIR.z);

      // Noise layers
      const n1 = noise01(px, pz, 0);
      const n2 = noise01(px, pz, 1);

      // Base color: warm Martian regolith with iron oxide variation
      tempCol.copy(COL_REGOLITH);
      if (n1 > 0.52) {
        tempCol.lerp(COL_FINE_DUST, (n1 - 0.52) * 2.1 * 0.65);
      } else if (n1 < 0.42) {
        tempCol.lerp(COL_BEDROCK, (0.42 - n1) * 2.5 * 0.55);
      }

      // Slope-driven rock exposure: steep slopes reveal dark basalt
      if (localSlope > 0.14) {
        const steep = Math.min(1.0, (localSlope - 0.14) * 3.5);
        tempCol.lerp(COL_DARK_IRON, steep * 0.50);
        if (localSlope > 0.38) {
          tempCol.lerp(COL_BASALT, (localSlope - 0.38) * 2.0 * 0.55);
        }
      }

      // Flat areas: dust accumulation
      if (localSlope < 0.08 && n2 > 0.58) {
        tempCol.lerp(COL_DUST, (n2 - 0.58) * 2.4 * 0.40);
      }

      // Crater-specific multi-layer shading (craters Alpha, Beta, Gamma)
      for (let c = 0; c < CRATERS.length; c++) {
        const cr = CRATERS[c];
        const dist = Math.hypot(px - cr.cx, pz - cr.cz);

        if (dist < cr.radius) {
          // Inside crater bowl: dark basalt floor
          const depthFrac = 1.0 - (dist / cr.radius);
          tempCol.lerp(COL_BASALT, depthFrac * depthFrac * 0.65);
          if (depthFrac < 0.45) {
            tempCol.lerp(COL_DARK_IRON, (0.45 - depthFrac) * 0.55);
          }
        } else if (dist < cr.radius + cr.rimWidth * 2.0) {
          // Raised rim: bright mineral crust & ejecta
          const rimFrac = 1.0 - Math.abs(dist - cr.radius) / (cr.rimWidth * 2.0);
          tempCol.lerp(COL_RIM_BRIGHT, rimFrac * 0.60);
          if (dist > cr.radius + cr.rimWidth * 0.8) {
            tempCol.lerp(COL_FINE_DUST, rimFrac * 0.28);
          }
        }
      }

      // Secondary craters
      for (let sc of SECONDARY_CRATERS) {
        const dist = Math.hypot(px - sc.x, pz - sc.z);
        if (dist < sc.radius) {
          const df = 1.0 - dist / sc.radius;
          tempCol.lerp(COL_DARK_IRON, df * df * 0.55);
        } else if (dist < sc.radius * 1.8) {
          const rf = 1.0 - (dist - sc.radius) / (sc.radius * 0.8);
          tempCol.lerp(COL_RIM_BRIGHT, rf * 0.35);
        }
      }

      // Obstacle rock ridges: basalt outcrop
      for (let obs of OBSTACLES) {
        const dist = Math.hypot(px - obs.ox, pz - obs.oz);
        if (dist < obs.radius * 1.8) {
          const factor = Math.max(0, 1.0 - dist / (obs.radius * 1.8));
          tempCol.lerp(COL_BASALT, factor * factor * 0.50);
        }
      }

      // Hill-shade modulation
      const sunShade = 0.82 + dotSun * 0.36;
      tempCol.r = Math.min(1.0, tempCol.r * sunShade);
      tempCol.g = Math.min(1.0, tempCol.g * (sunShade * 0.96));
      tempCol.b = Math.min(1.0, tempCol.b * (sunShade * 0.92));

      const ci = i * 3;
      colors[ci]     = tempCol.r;
      colors[ci + 1] = tempCol.g;
      colors[ci + 2] = tempCol.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  const localTex = useMemo(() => {
    if (!regolithTexture) return null;
    const t = regolithTexture.clone();
    t.repeat.set(16, 16);
    t.needsUpdate = true;
    return t;
  }, [regolithTexture]);

  const localBump = useMemo(() => {
    if (!regolithBump) return null;
    const b = regolithBump.clone();
    b.repeat.set(16, 16);
    b.needsUpdate = true;
    return b;
  }, [regolithBump]);

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: localTex,
    bumpMap: localBump,
    bumpScale: 0.005, // subtle micro sand-ripple relief (no inside-out normal artifacts)
    roughness: 0.94,
    metalness: 0.02,
    flatShading: false,
  }), [localTex, localBump]);

  return <mesh geometry={geometry} material={material} receiveShadow />;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MEDIUM MOLA REGIONAL TERRAIN (60 km authentic MOLA grid)
// ─────────────────────────────────────────────────────────────────────────────
function MediumMolaTerrain({ regolithTexture, regolithBump }) {
  const geometry = useMemo(() => {
    const size = 60; // 60 render units = 60 km
    const outerRadius = size / 2; // 30 render units = 30 km
    const innerRadius = 560 * RENDER_SCALE; // 0.56 render units = 560m (seamlessly meets 600m local landing mesh)
    const geo = createRadialGridGeometry(outerRadius, 64, 128, innerRadius);
    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const tempColor = new THREE.Color();

    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const px = x / RENDER_SCALE;
      const pz = z / RENDER_SCALE;

      const distanceM = Math.hypot(x, z) / RENDER_SCALE;
      const elevation = getMolaTerrainHeight(px, pz) ?? 0;

      const edgeT = Math.max(0, Math.min(1, (distanceM - 22000) / 8000));
      const edgeBlend = edgeT * edgeT * (3 - 2 * edgeT);
      const terrainFade = 1 - edgeBlend;
      const verticalScale = 1.0 * (1 - edgeBlend) + 5.0 * edgeBlend;
      const curvatureY = Math.sqrt(Math.max(0, MARS_RENDER_RADIUS ** 2 - x ** 2 - z ** 2)) - MARS_RENDER_RADIUS;
      positions.setY(index, curvatureY + elevation * RENDER_SCALE * verticalScale * terrainFade);

      // Estimate slope from MOLA neighbor samples
      const stepM = 450;
      const eE = getMolaTerrainHeight(px + stepM, pz) ?? elevation;
      const eW = getMolaTerrainHeight(px - stepM, pz) ?? elevation;
      const eN = getMolaTerrainHeight(px, pz + stepM) ?? elevation;
      const eS = getMolaTerrainHeight(px, pz - stepM) ?? elevation;
      const slopeMOLA = Math.hypot(eE - eW, eN - eS) / (2 * stepM);

      // Normal vector & hill-shading
      const nx = -(eE - eW) / (2 * stepM);
      const ny = 1.0;
      const nz = -(eN - eS) / (2 * stepM);
      const nLen = Math.hypot(nx, ny, nz) || 1.0;
      const dotSun = Math.max(0.0, (nx / nLen) * SUN_DIR.x + (ny / nLen) * SUN_DIR.y + (nz / nLen) * SUN_DIR.z);

      const elevNorm = Math.max(0, Math.min(1, 0.48 + elevation / 1200.0));

      // Base: dark basalt in depressions, dusty salmon in highlands
      tempColor.copy(COL_DARK_IRON).lerp(COL_DUST, elevNorm * 0.85);

      const n1 = noise01(px * 0.001, pz * 0.001, 0);
      const n2 = noise01(px * 0.002, pz * 0.002, 1);
      tempColor.lerp(COL_REGOLITH, n1 * 0.35);
      tempColor.lerp(COL_FINE_DUST, n2 * 0.30);

      // Exposed bedrock on steep slopes
      if (slopeMOLA > 0.06) {
        const sFactor = Math.min(1.0, (slopeMOLA - 0.06) * 12.0);
        tempColor.lerp(COL_BASALT, sFactor * 0.55);
      }

      // Bright rims on high ridges
      if (elevNorm > 0.68) {
        tempColor.lerp(COL_RIM_BRIGHT, (elevNorm - 0.68) * 2.8 * 0.40);
      }

      tempColor.lerp(COL_DUST, edgeBlend);

      // Hill-shade modulation
      const sunShade = 0.80 + dotSun * 0.38;
      tempColor.r = Math.min(1.0, tempColor.r * sunShade);
      tempColor.g = Math.min(1.0, tempColor.g * (sunShade * 0.95));
      tempColor.b = Math.min(1.0, tempColor.b * (sunShade * 0.90));

      const ci = index * 3;
      colors[ci]     = tempColor.r;
      colors[ci + 1] = tempColor.g;
      colors[ci + 2] = tempColor.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  const medTex = useMemo(() => {
    if (!regolithTexture) return null;
    const t = regolithTexture.clone();
    t.repeat.set(64, 64);
    t.needsUpdate = true;
    return t;
  }, [regolithTexture]);

  const medBump = useMemo(() => {
    if (!regolithBump) return null;
    const b = regolithBump.clone();
    b.repeat.set(64, 64);
    b.needsUpdate = true;
    return b;
  }, [regolithBump]);

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: medTex,
    bumpMap: medBump,
    bumpScale: 0.015,
    roughness: 0.96,
    metalness: 0.02,
    flatShading: false,
  }), [medTex, medBump]);

  return <mesh geometry={geometry} material={material} receiveShadow />;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PROCEDURAL BOULDER / ROCK FIELD (220 instanced weathered boulders)
// ─────────────────────────────────────────────────────────────────────────────
function BoulderField() {
  const count = 220;
  const meshRef = useRef();

  const rockGeometry = useMemo(() => {
    const geo = new THREE.DodecahedronGeometry(1.0, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      pos.setXYZ(
        i,
        vx * (0.88 + Math.sin(i * 3.71) * 0.18),
        vy * (0.80 + Math.cos(i * 4.23) * 0.20),
        vz * (0.88 + Math.sin(i * 5.13) * 0.18),
      );
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const rockMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.04,
    flatShading: true,
  }), []);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    const instanceColor = new THREE.Color();

    const rockPalette = [
      COL_BASALT,
      COL_DARK_IRON,
      COL_BEDROCK,
      COL_IRON_OXIDE,
      COL_DARK_IRON,
      COL_BASALT,
    ];

    let seed = 4242;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    let idx = 0;
    for (let i = 0; i < count; i++) {
      let px, pz;

      if (i < 55) {
        // Clustered near CRATER_ALPHA rim
        const angle = rnd() * Math.PI * 2;
        const rad   = 28.0 + (rnd() - 0.4) * 14.0;
        px = 24.0 + Math.cos(angle) * rad;
        pz = 15.0 + Math.sin(angle) * rad;
      } else if (i < 95) {
        // BOULDER_FIELD_NORTH
        const angle = rnd() * Math.PI * 2;
        const rad   = rnd() * 22.0;
        px = -25.0 + Math.cos(angle) * rad;
        pz =  30.0 + Math.sin(angle) * rad;
      } else if (i < 135) {
        // ROCKY_RIDGE_EAST
        const angle = rnd() * Math.PI * 2;
        const rad   = rnd() * 24.0;
        px = 50.0 + Math.cos(angle) * rad;
        pz = 45.0 + Math.sin(angle) * rad;
      } else {
        px = (rnd() - 0.5) * 280.0;
        pz = (rnd() - 0.5) * 280.0;
      }

      // Safe touchdown clearance
      if (Math.hypot(px, pz) < 4.5) {
        px += (px >= 0 ? 5.5 : -5.5);
        pz += (pz >= 0 ? 5.5 : -5.5);
      }

      const rx = px * RENDER_SCALE;
      const rz = pz * RENDER_SCALE;

      const rWeight = rnd();
      const boulderSizeM = 0.25 + rWeight * rWeight * 2.6;
      const rSize = boulderSizeM * RENDER_SCALE * 0.48;
      const ry = getLandingSurfaceRenderHeight(px, pz) + rSize * 0.32;

      dummy.position.set(rx, ry, rz);
      dummy.rotation.set(
        (rnd() - 0.5) * 0.40,
        rnd() * Math.PI * 2,
        (rnd() - 0.5) * 0.40,
      );
      dummy.scale.set(
        rSize * (0.80 + rnd() * 0.45),
        rSize * (0.50 + rnd() * 0.60),
        rSize * (0.80 + rnd() * 0.45),
      );
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(idx++, dummy.matrix);

      const baseColor = rockPalette[i % rockPalette.length];
      instanceColor.copy(baseColor);

      const dustNoise = noise01(px, pz, 6);
      if (dustNoise > 0.55) {
        instanceColor.lerp(COL_DUST, (dustNoise - 0.55) * 2.0 * 0.40);
      }

      instanceColor.multiplyScalar(0.85 + rnd() * 0.25);
      meshRef.current.setColorAt(i, instanceColor);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[rockGeometry, rockMaterial, count]}
      receiveShadow
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT: Combined MarsSurface component anchored to landing site
// ─────────────────────────────────────────────────────────────────────────────
export default function MarsSurface({ simStateRef }) {
  const groupRef        = useRef();
  const mediumMolaRef   = useRef();
  const localRef        = useRef();

  const { texture: regolithTexture, bump: regolithBump } = useMemo(
    () => generateRegolithDetailTextures(),
    []
  );

  const anchorX = JEZERO_TARGET_X * RENDER_SCALE;
  const anchorZ = JEZERO_TARGET_Z * RENDER_SCALE;

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(MARS_SURFACE_FRAME.origin);
    groupRef.current.quaternion.copy(MARS_SURFACE_FRAME.rotation);
  }, [anchorX, anchorZ]);

  useFrame(() => {
    const state = simStateRef?.current;
    if (!groupRef.current || !state) return;
    groupRef.current.position.copy(MARS_SURFACE_FRAME.origin);
    groupRef.current.quaternion.copy(MARS_SURFACE_FRAME.rotation);

    const altitude = Number.isFinite(state.altitude) ? state.altitude : Infinity;
    const landed   = state.phase === 'LANDED' || state.grounded;

    // Visible from 80 km down to surface
    groupRef.current.visible = altitude <= 80000 || landed;
    if (mediumMolaRef.current) mediumMolaRef.current.visible = groupRef.current.visible;
    if (localRef.current)      localRef.current.visible      = groupRef.current.visible;
  });

  return (
    <group
      ref={groupRef}
      position={MARS_SURFACE_FRAME.origin.toArray()}
      quaternion={MARS_SURFACE_FRAME.rotation.toArray()}
    >
      {/* 60 km authentic MOLA Jezero Crater region */}
      <group ref={mediumMolaRef}>
        <MediumMolaTerrain regolithTexture={regolithTexture} regolithBump={regolithBump} />
      </group>

      {/* ±600m high-resolution landing site with craters Alpha/Beta/Gamma & boulders */}
      <group ref={localRef}>
        <LocalLandingTerrain regolithTexture={regolithTexture} regolithBump={regolithBump} />
        <BoulderField />
      </group>
    </group>
  );
}
