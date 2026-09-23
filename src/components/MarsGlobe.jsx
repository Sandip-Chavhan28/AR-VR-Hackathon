/**
 * MarsGlobe.jsx – Procedural 3D Mars globe with authentic Martian color palette.
 *
 * Requirements (items 1, 2, 5):
 *   - Palette: dark rusty red (#5A2418), deep rust (#7A3020), Mars red (#963D28), dust (#B85A38)
 *   - Completely matte, non-glossy surface (roughness 1.0, metalness 0.0)
 *   - Believable terminator transition from warm dusty red/orange day side to deep brown night side
 *   - Subtle, thin atmospheric limb (dusty orange-red, visible at horizon)
 *   - Preserves coordinates: globe centre at (0, -MARS_R, 0), top tangent at y=0.
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MARS_RADIUS, ENTRY_INTERFACE_ALTITUDE, RENDER_SCALE } from '../simulation/physics/constants.js';

const MARS_R       = MARS_RADIUS * RENDER_SCALE; // ~3389.5 units
const ATMO_R       = (MARS_RADIUS + ENTRY_INTERFACE_ALTITUDE * 0.75) * RENDER_SCALE;
const OUTER_ATMO_R = (MARS_RADIUS + ENTRY_INTERFACE_ALTITUDE * 1.35) * RENDER_SCALE;

// Palette in linear color space for sRGB output + ACESFilmic tone mapping
const COL_DARK_MARS  = new THREE.Color('#5A2418').convertSRGBToLinear(); // deep shadow-brown
const COL_DEEP_RUST  = new THREE.Color('#7A3020').convertSRGBToLinear(); // base rock/regolith
const COL_MARS_RED   = new THREE.Color('#963D28').convertSRGBToLinear(); // mid-tone iron oxide
const COL_DUST       = new THREE.Color('#B85A38').convertSRGBToLinear(); // lighter highland dust
const COL_BASALT     = new THREE.Color('#3A1810').convertSRGBToLinear(); // dark volcanic lowlands
const COL_POLAR_ICE  = new THREE.Color('#C8B0A4').convertSRGBToLinear(); // dusty carbon dioxide / water frost

// Deterministic 2D noise (no Math.random)
function dn(a, b) {
  return Math.sin(a * 13.7 + b * 7.3 + 1.4) * 0.5 + 0.5;
}

export default function MarsGlobe() {
  const surfaceRef = useRef();

  // Very slow planetary rotation (0.002 rad/s)
  useFrame((_, delta) => {
    if (surfaceRef.current) surfaceRef.current.rotation.y += delta * 0.002;
  });

  // Procedural vertex-colored Mars globe geometry
  const globeGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(MARS_R, 128, 128);
    const pos = geo.attributes.position;
    const colors = [];

    const tempColor = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const nx = pos.getX(i) / MARS_R;
      const ny = pos.getY(i) / MARS_R;
      const nz = pos.getZ(i) / MARS_R;

      const lat = ny;                             // -1 south to +1 north
      const lon = Math.atan2(nz, nx);             // -π to +π
      const lonDeg = ((lon * 180 / Math.PI) + 360) % 360;

      // 1. Regional dust vs deep rust baseline blend
      const dustBlend = dn(lon * 2.4, lat * 2.1) * 0.7 + dn(lon * 5.1, lat * 4.3) * 0.3;
      tempColor.copy(COL_DEEP_RUST).lerp(COL_DUST, dustBlend * 0.7);

      // 2. Valles Marineris — deep equatorial canyon system
      if (Math.abs(lat) < 0.20 && lonDeg > 260 && lonDeg < 340) {
        const canyonDepth = Math.cos((lat / 0.20) * Math.PI * 0.5);
        tempColor.lerp(COL_DARK_MARS, canyonDepth * 0.65);
      }

      // 3. Tharsis volcanic plateau (slightly elevated, dusty ochre)
      if (lat > -0.05 && lat < 0.35 && lonDeg > 220 && lonDeg < 280) {
        tempColor.lerp(COL_MARS_RED, 0.4);
      }

      // 4. Syrtis Major — dark volcanic basalt plain
      const syrtis = Math.sin(lon * 2.0 + 0.8) * Math.cos(lat * 2.7 + 1.2);
      if (syrtis < -0.42) {
        tempColor.lerp(COL_BASALT, 0.55);
      }

      // 5. Hellas Basin — southern deep impact basin
      const hellasDist = Math.sqrt((lat + 0.45) ** 2 + (lon - 1.2) ** 2);
      if (hellasDist < 0.38) {
        const d = (1 - hellasDist / 0.38);
        tempColor.lerp(COL_DARK_MARS, d * 0.5);
      }

      // 6. Polar Ice Caps (Planum Boreum / Planum Australe)
      const capLat = 0.82;
      if (Math.abs(lat) > capLat) {
        const iceFactor = Math.min(1.0, (Math.abs(lat) - capLat) / (1.0 - capLat));
        tempColor.lerp(COL_POLAR_ICE, iceFactor * 0.85);
      }

      colors.push(tempColor.r, tempColor.g, tempColor.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Matte, physically believable Martian regolith material
  const marsMat = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1.0,   // fully matte
    metalness: 0.0,   // non-metallic
    flatShading: false,
  }), []);

  // Atmospheric limb: thin dusty orange-red rim
  const atmoMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color('#963D28'),
    transparent: true,
    opacity: 0.09,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  const outerAtmoMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color('#7A3020'),
    transparent: true,
    opacity: 0.04,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  return (
    <group position={[0, -MARS_R, 0]}>
      {/* Planetary Sphere */}
      <mesh ref={surfaceRef} geometry={globeGeo} material={marsMat} receiveShadow />

      {/* Atmospheric Rim Shells */}
      <mesh material={atmoMat}>
        <sphereGeometry args={[ATMO_R, 48, 48]} />
      </mesh>
      <mesh material={outerAtmoMat}>
        <sphereGeometry args={[OUTER_ATMO_R, 36, 36]} />
      </mesh>
    </group>
  );
}
