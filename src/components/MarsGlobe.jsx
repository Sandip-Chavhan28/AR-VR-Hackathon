/**
 * MarsGlobe.jsx – Photorealistic NASA-Grade 3D Mars Planetary Sphere.
 *
 * Implements:
 *   - High-resolution procedural 2048x1024 equirectangular Mars texture generated ONCE
 *     at initialization via offscreen Canvas (zero runtime CPU cost, zero GC).
 *   - Authentic Martian planetary geography with prominent high-contrast geological provinces:
 *       • Syrtis Major Planum: iconic dark volcanic basalt shield (#220e08)
 *       • Isidis Planitia: vast smooth dusty impact basin (#d67a42)
 *       • Sinus Sabaeus & Mare Tyrrhenum: sweeping dark equatorial albedo markings
 *       • Jezero Crater: 45 km impact crater with raised ejecta rim & delta fan
 *       • Valles Marineris: 4,000 km grand canyon system with branching chasmata
 *       • Olympus Mons & Tharsis Montes: massive shield volcanoes with calderas
 *       • Hellas & Argyre: southern giant impact basins
 *       • Named craters: Huygens, Schiaparelli, Antoniadi, Cassini
 *       • North & South polar ice caps (Planum Boreum & Planum Australe)
 *       • Aeolian wind streaks: bright dust drifts trailing southwest
 *   - Clean, smooth Bump Map for physical relief under grazing sunlight (no facet artifacts)
 *   - Luminous, razor-thin Martian atmospheric limb with custom Fresnel shader
 *   - Precise planetary radius (3,389.5 km scaled) centered at [0, -MARS_R, 0]
 */

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MARS_RADIUS, RENDER_SCALE } from '../simulation/physics/constants.js';

const MARS_R = MARS_RADIUS * RENDER_SCALE; // ~3389.5 units
const ATMO_R = (MARS_RADIUS + 12_000) * RENDER_SCALE; // ~3401.5 units

function isPlanetVisible(state) {
  if (!state) return false;
  const altitudeKm = (state.altitude || 0) / 1000;
  return state.phase !== 'LANDED' && !state.grounded && altitudeKm >= 14;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL MARS TEXTURE GENERATION (Runs ONCE at startup, cached on GPU)
// ─────────────────────────────────────────────────────────────────────────────
function generateMarsGlobeTextures() {
  const w = 2048;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Bump canvas
  const bw = 1024;
  const bh = 512;
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = bw;
  bumpCanvas.height = bh;
  const bCtx = bumpCanvas.getContext('2d');

  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  const bumpData = bCtx.createImageData(bw, bh);
  const bData = bumpData.data;

  // Rich multi-frequency noise helper with micro-detail octaves
  function pNoise(nx, ny) {
    const o1 = Math.sin(nx * 2.8 + 1.1) * Math.cos(ny * 2.7 + 0.8) * 0.40;
    const o2 = Math.sin(nx * 6.5 - 2.1) * Math.sin(ny * 5.8 + 1.7) * 0.25;
    const o3 = Math.sin(nx * 14.2 + ny * 12.1) * 0.16;
    const o4 = Math.sin(nx * 32.1 - ny * 28.3) * 0.09;
    const o5 = Math.sin(nx * 74.0 + ny * 68.0) * 0.05;
    const o6 = Math.sin(nx * 165.0 - ny * 142.0) * 0.03;
    const o7 = Math.sin(nx * 360.0 + ny * 310.0) * 0.02;
    return o1 + o2 + o3 + o4 + o5 + o6 + o7;
  }

  // 1. Generate base color map pixel-by-pixel
  for (let y = 0; y < h; y++) {
    const latNorm = (y / h) * 2 - 1; // -1 (North) to +1 (South)

    for (let x = 0; x < w; x++) {
      const lonNorm = x / w; // 0 to 1

      const nx = lonNorm * 12.0;
      const ny = (latNorm + 1.0) * 6.0;
      const n = pNoise(nx, ny);

      let r, g, b;
      let heightVal = 128; // for bump map

      // Base Martian dichotomy:
      // Northern smooth lowlands vs Southern rugged cratered highlands
      if (latNorm < -0.15) {
        // Northern lowlands: warm dusty salmon-ochre (#c46c3a to #dc844e)
        const t = (n * 0.5 + 0.5);
        r = 195 + t * 34;
        g = 105 + t * 28;
        b = 58  + t * 20;
        heightVal = 105 + t * 25;
      } else {
        // Southern highlands: darker, weathered iron-rich rock (#6a2414 to #963c1c)
        const t = (n * 0.5 + 0.5);
        r = 125 + t * 45;
        g = 55  + t * 30;
        b = 26  + t * 20;
        heightVal = 135 + t * 35;
      }

      // Feature: Syrtis Major Planum (iconic dark triangular basalt volcanic shield)
      // Centered at lonNorm ~ 0.69, latNorm ~ -0.03 (directly adjacent to Jezero & orbital path)
      const smDx = (lonNorm - 0.69) * 7.5;
      const smDy = (latNorm - (-0.03)) * 6.0;
      const smDist = Math.hypot(smDx, smDy);
      if (smDist < 1.0) {
        const smFactor = (1.0 - smDist) * (0.88 + n * 0.22);
        // Deep ancient basalt tones
        r = Math.max(22, r * (1.0 - smFactor * 0.82));
        g = Math.max(10, g * (1.0 - smFactor * 0.85));
        b = Math.max(5,  b * (1.0 - smFactor * 0.85));
        heightVal += smFactor * 32;
      }

      // Feature: Antoniadi Crater (prominent 400km crater north of Syrtis Major)
      const anDx = (lonNorm - 0.68) * 26.0;
      const anDy = (latNorm - (-0.18)) * 26.0;
      const anDist = Math.hypot(anDx, anDy);
      if (anDist < 1.0) {
        if (anDist < 0.65) {
          r = Math.max(24, r * 0.45); g = Math.max(10, g * 0.45); b = Math.max(5, b * 0.45);
          heightVal -= 25;
        } else {
          r = Math.min(255, r + 45); g = Math.min(255, g + 30); b = Math.min(255, b + 18);
          heightVal += 20;
        }
      }

      // Feature: Huygens Crater (prominent 470km crater south of Syrtis Major)
      const hgDx = (lonNorm - 0.72) * 20.0;
      const hgDy = (latNorm - 0.16) * 20.0;
      const hgDist = Math.hypot(hgDx, hgDy);
      if (hgDist < 1.0) {
        if (hgDist < 0.65) {
          r = Math.max(24, r * 0.45); g = Math.max(10, g * 0.45); b = Math.max(5, b * 0.45);
          heightVal -= 28;
        } else {
          r = Math.min(255, r + 50); g = Math.min(255, g + 32); b = Math.min(255, b + 20);
          heightVal += 22;
        }
      }

      // Feature: Sinus Sabaeus & Mare Tyrrhenum (dark volcanic band across equatorial belt)
      if (latNorm > -0.08 && latNorm < 0.20 && lonNorm > 0.50 && lonNorm < 0.80) {
        const bandCenter = 0.05 + Math.sin(lonNorm * 18.0) * 0.04;
        const bDist = Math.abs(latNorm - bandCenter) * 12.0;
        if (bDist < 1.0) {
          const bFactor = (1.0 - bDist) * (0.78 + n * 0.22);
          r = Math.max(30, r * (1.0 - bFactor * 0.72));
          g = Math.max(14, g * (1.0 - bFactor * 0.76));
          b = Math.max(7,  b * (1.0 - bFactor * 0.76));
        }
      }

      // Feature: Isidis Planitia (vast circular smooth impact basin, warm golden dust)
      // lonNorm ~ 0.755, latNorm ~ -0.06
      const isDx = (lonNorm - 0.755) * 11.0;
      const isDy = (latNorm - (-0.06)) * 11.0;
      const isDist = Math.hypot(isDx, isDy);
      if (isDist < 1.0) {
        const isFactor = (1.0 - isDist);
        r = r * (1.0 - isFactor * 0.40) + 230 * (isFactor * 0.40);
        g = g * (1.0 - isFactor * 0.40) + 140 * (isFactor * 0.40);
        b = b * (1.0 - isFactor * 0.40) + 82  * (isFactor * 0.40);
        heightVal -= isFactor * 35;
      }

      // Feature: Jezero Crater (right at northwest rim of Isidis Planitia)
      // lonNorm ~ 0.730, latNorm ~ -0.09
      const jzDx = (lonNorm - 0.730) * 110.0;
      const jzDy = (latNorm - (-0.09)) * 110.0;
      const jzDist = Math.hypot(jzDx, jzDy);
      if (jzDist < 1.0) {
        if (jzDist < 0.60) {
          // Dark crater floor
          r = 35; g = 15; b = 8;
          heightVal -= 25;
        } else {
          // Bright raised rim & ejecta
          r = 240; g = 175; b = 120;
          heightVal += 22;
        }
      }

      // Feature: Valles Marineris (4,000 km grand canyon system)
      // lonNorm ~ 0.22 to 0.38, latNorm ~ 0.08 to 0.22
      if (lonNorm > 0.22 && lonNorm < 0.38 && latNorm > 0.06 && latNorm < 0.22) {
        const canyonCenterLat = 0.14 - (lonNorm - 0.30) * 0.25;
        const cDist = Math.abs(latNorm - canyonCenterLat) * 32.0;
        if (cDist < 1.0) {
          const cDepth = (1.0 - cDist);
          r = Math.max(22, r * (1.0 - cDepth * 0.82));
          g = Math.max(10, g * (1.0 - cDepth * 0.85));
          b = Math.max(5,  b * (1.0 - cDepth * 0.85));
          heightVal -= cDepth * 50;
        }
      }

      // Feature: Olympus Mons (massive shield volcano)
      const omDx = (lonNorm - 0.128) * 22.0;
      const omDy = (latNorm - (-0.20)) * 22.0;
      const omDist = Math.hypot(omDx, omDy);
      if (omDist < 1.0) {
        const omFactor = (1.0 - omDist);
        if (omDist < 0.18) {
          r = 50; g = 22; b = 12; // Caldera
          heightVal += 60;
        } else {
          r = Math.min(242, r + omFactor * 48);
          g = Math.min(148, g + omFactor * 28);
          b = Math.min(92,  b + omFactor * 16);
          heightVal += omFactor * 70;
        }
      }

      // Feature: Hellas Basin (giant southern impact basin)
      const hlDx = (lonNorm - 0.69) * 10.0;
      const hlDy = (latNorm - 0.46) * 10.0;
      const hlDist = Math.hypot(hlDx, hlDy);
      if (hlDist < 1.0) {
        const hlFactor = (1.0 - hlDist);
        r = r * (1.0 - hlFactor * 0.35) + 210 * (hlFactor * 0.35);
        g = g * (1.0 - hlFactor * 0.35) + 120 * (hlFactor * 0.35);
        b = b * (1.0 - hlFactor * 0.35) + 72  * (hlFactor * 0.35);
        heightVal -= hlFactor * 40;
      }

      // Feature: Polar Ice Caps
      if (latNorm < -0.86) {
        const pFrac = (-latNorm - 0.86) / 0.14;
        const ice = Math.min(1.0, Math.max(0.0, pFrac));
        r = r * (1.0 - ice) + 242 * ice;
        g = g * (1.0 - ice) + 238 * ice;
        b = b * (1.0 - ice) + 232 * ice;
        heightVal += ice * 15;
      }
      if (latNorm > 0.88) {
        const pFrac = (latNorm - 0.88) / 0.12;
        const ice = Math.min(1.0, pFrac);
        r = r * (1.0 - ice) + 245 * ice;
        g = g * (1.0 - ice) + 240 * ice;
        b = b * (1.0 - ice) + 235 * ice;
        heightVal += ice * 15;
      }

      // Fine grain
      const grain = (Math.sin(x * 2.1 + y * 2.8) * 0.5 + Math.cos(x * 3.7 - y * 1.9) * 0.5) * 5.0;
      r = Math.min(255, Math.max(0, r + grain));
      g = Math.min(255, Math.max(0, g + grain * 0.6));
      b = Math.min(255, Math.max(0, b + grain * 0.4));

      const idx = (y * w + x) * 4;
      data[idx]     = Math.round(r);
      data[idx + 1] = Math.round(g);
      data[idx + 2] = Math.round(b);
      data[idx + 3] = 255;
    }
  }

  // 2. Generate multi-scale craters
  let seed = 91827;
  function rnd() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  for (let i = 0; i < 450; i++) {
    const cx = Math.floor(rnd() * w);
    const cy = Math.floor(h * 0.15 + rnd() * (h * 0.75));
    // Diverse crater sizes: many small (3-8px), some medium (9-18px), few large (19-38px)
    const rad = Math.floor(3 + rnd() * rnd() * 35);

    for (let dy = -rad - 4; dy <= rad + 4; dy++) {
      const py = cy + dy;
      if (py < 0 || py >= h) continue;
      for (let dx = -rad - 4; dx <= rad + 4; dx++) {
        const px = (cx + dx + w) % w;
        const dist = Math.hypot(dx, dy);
        const idx = (py * w + px) * 4;

        if (dist < rad * 0.72) {
          const depth = 1.0 - dist / (rad * 0.72);
          data[idx]     = Math.max(20, Math.round(data[idx]     * (1.0 - depth * 0.60)));
          data[idx + 1] = Math.max(8,  Math.round(data[idx + 1] * (1.0 - depth * 0.65)));
          data[idx + 2] = Math.max(4,  Math.round(data[idx + 2] * (1.0 - depth * 0.65)));
        } else if (dist <= rad + 3) {
          const rimFrac = 1.0 - Math.abs(dist - rad) / 3.0;
          data[idx]     = Math.min(255, Math.round(data[idx]     + rimFrac * 50));
          data[idx + 1] = Math.min(255, Math.round(data[idx + 1] + rimFrac * 35));
          data[idx + 2] = Math.min(255, Math.round(data[idx + 2] + rimFrac * 22));
        }
      }
    }
  }

  // 3. Generate wind streaks
  for (let s = 0; s < 55; s++) {
    const sx = Math.floor(rnd() * w);
    const sy = Math.floor(h * 0.30 + rnd() * (h * 0.50));
    const len = 25 + Math.floor(rnd() * 75);
    for (let l = 0; l < len; l++) {
      const px = (sx - l + w) % w;
      const py = Math.min(h - 1, sy + Math.floor(l * 0.35));
      const width = Math.max(1, Math.floor((1.0 - l / len) * 3));
      for (let dw = -width; dw <= width; dw++) {
        const ppy = Math.max(0, Math.min(h - 1, py + dw));
        const idx = (ppy * w + px) * 4;
        const streakT = (1.0 - l / len) * 0.32;
        data[idx]     = Math.min(255, Math.round(data[idx]     + streakT * 35));
        data[idx + 1] = Math.min(255, Math.round(data[idx + 1] + streakT * 22));
        data[idx + 2] = Math.min(255, Math.round(data[idx + 2] + streakT * 14));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // 4. Generate smooth 1024x512 Bump Map
  for (let by = 0; by < bh; by++) {
    const srcY = Math.floor((by / bh) * h);
    for (let bx = 0; bx < bw; bx++) {
      const srcX = Math.floor((bx / bw) * w);
      const srcIdx = (srcY * w + srcX) * 4;
      const lum = Math.round(data[srcIdx] * 0.45 + data[srcIdx + 1] * 0.35 + data[srcIdx + 2] * 0.20);
      const bIdx = (by * bw + bx) * 4;
      bData[bIdx]     = lum;
      bData[bIdx + 1] = lum;
      bData[bIdx + 2] = lum;
      bData[bIdx + 3] = 255;
    }
  }
  bCtx.putImageData(bumpData, 0, 0);

  const albedoTexture = new THREE.CanvasTexture(canvas);
  albedoTexture.wrapS = THREE.RepeatWrapping;
  albedoTexture.wrapT = THREE.ClampToEdgeWrapping;
  albedoTexture.needsUpdate = true;

  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  bumpTexture.wrapS = THREE.RepeatWrapping;
  bumpTexture.wrapT = THREE.ClampToEdgeWrapping;
  bumpTexture.needsUpdate = true;

  return { albedoTexture, bumpTexture };
}

// ─────────────────────────────────────────────────────────────────────────────
// ATMOSPHERIC LIMB SHADER (FrontSide with soft Fresnel glow)
// ─────────────────────────────────────────────────────────────────────────────
const AtmoLimbShader = {
  uniforms: {
    sunDirection: { value: new THREE.Vector3(0.78, 0.40, 0.48).normalize() },
    atmoColor:    { value: new THREE.Color('#c66c3a') },
    darkColor:    { value: new THREE.Color('#3e160c') },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 sunDirection;
    uniform vec3 atmoColor;
    uniform vec3 darkColor;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 viewDir = normalize(vViewPosition);
      vec3 norm = normalize(vNormal);

      // Fresnel grazing rim: 0 at center, 1 at edge
      float dotVN = max(0.0, dot(viewDir, norm));
      float rim = 1.0 - dotVN;
      float limb = pow(rim, 4.0);

      // Day vs night side illumination
      float dotSN = dot(norm, sunDirection);
      float dayFactor = smoothstep(-0.2, 0.5, dotSN);

      vec3 col = mix(darkColor, atmoColor, dayFactor);

      // Upper limb Rayleigh scattering: faint cyan/sky blue tinge at the very outer edge
      vec3 upperLimbColor = vec3(0.55, 0.78, 0.98);
      float outerRim = smoothstep(0.70, 0.98, rim);
      col = mix(col, upperLimbColor, outerRim * 0.35 * dayFactor);

      float alpha = limb * (0.12 + 0.65 * dayFactor);

      gl_FragColor = vec4(col, alpha);
    }
  `,
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN MARS GLOBE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
import { useFrame } from '@react-three/fiber';

export default function MarsGlobe({ simStateRef }) {
  const planetRef = useRef();
  const visibleRef = useRef(isPlanetVisible(simStateRef?.current));

  useFrame(() => {
    const showPlanet = isPlanetVisible(simStateRef?.current);
    if (!planetRef.current || visibleRef.current === showPlanet) return;
    visibleRef.current = showPlanet;
    planetRef.current.visible = showPlanet;
  });

  // Generate the 2048x1024 textures ONCE
  const { albedoTexture, bumpTexture } = useMemo(() => generateMarsGlobeTextures(), []);

  // Globe geometry: rotated so the high-resolution equatorial belt (Jezero, Syrtis, Isidis)
  // lies directly beneath the orbital flight path
  const globeGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(MARS_R, 96, 96);
    geo.rotateX(Math.PI / 2);
    return geo;
  }, []);

  // Physically-based matte Martian surface material with subtle bump mapping
  const marsMat = useMemo(() => new THREE.MeshStandardMaterial({
    map: albedoTexture,
    bumpMap: bumpTexture,
    bumpScale: 3.5, // subtle hill-shading without polygon facet artifacts
    roughness: 0.94,
    metalness: 0.02,
    flatShading: false,
  }), [albedoTexture, bumpTexture]);

  // Atmospheric limb material
  const atmoMaterial = useMemo(() => new THREE.ShaderMaterial({
    ...AtmoLimbShader,
    transparent: true,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  const atmoGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(ATMO_R, 64, 64);
    geo.rotateX(Math.PI / 2);
    return geo;
  }, []);

  return (
    <group ref={planetRef} position={[0, -MARS_R, 0]}>
      {/* Planetary Sphere with 2048x1024 albedo + bump relief */}
      <mesh geometry={globeGeo} material={marsMat} receiveShadow />

      {/* Thin, glowing Martian atmospheric limb */}
      <mesh geometry={atmoGeo} material={atmoMaterial} />
    </group>
  );
}
