import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { lerp } from '../lib/math';
import { range, rngFromString, type Rng } from '../lib/prng';
import { useGalaxyStore } from '../state/store';
import { useMotionScale } from '../hooks/useReducedMotion';
import { radialGradientTexture } from './textures';

const FIELD_INNER = 90;
const FIELD_OUTER = 170;
/** Share of stars in the brighter, larger layer. */
const BRIGHT_SHARE = 0.12;
/** Extra faint stars concentrated into the galactic band. */
const BAND_COUNT = 1700;
/** Angular thickness of the band, roughly like the real Milky Way. */
const BAND_SPREAD = 0.16;

/**
 * Rough blackbody tint: most stars read blue-white, some are sun-like,
 * a few are orange and red giants. Written into the color array at i.
 */
function starTint(rng: Rng, lum: number, colors: Float32Array, i: number): void {
  const t = rng();
  let r: number;
  let g: number;
  let b: number;
  if (t < 0.55) {
    // Hot: blue-white.
    r = 0.82;
    g = 0.89;
    b = 1.0;
  } else if (t < 0.85) {
    // Sun-like: warm white.
    r = 1.0;
    g = 0.95;
    b = 0.85;
  } else if (t < 0.96) {
    // Cool: orange.
    r = 1.0;
    g = 0.78;
    b = 0.55;
  } else {
    // Red giants, rare.
    r = 1.0;
    g = 0.55;
    b = 0.4;
  }
  colors[i * 3] = r * lum;
  colors[i * 3 + 1] = g * lum;
  colors[i * 3 + 2] = b * lum;
}

/** Uniformly distributed point on a spherical shell, written into arrays. */
function shellPoint(rng: Rng, positions: Float32Array, i: number): void {
  const y = range(rng, -1, 1);
  const theta = range(rng, 0, Math.PI * 2);
  const r = lerp(FIELD_INNER, FIELD_OUTER, rng());
  const flat = Math.sqrt(1 - y * y);
  positions[i * 3] = r * flat * Math.cos(theta);
  positions[i * 3 + 1] = r * y;
  positions[i * 3 + 2] = r * flat * Math.sin(theta);
}

function buildLayer(rng: Rng, count: number, minLum: number, maxLum: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    shellPoint(rng, positions, i);
    // A few values above 1 let bloom pick out the brightest stars.
    starTint(rng, range(rng, minLum, maxLum), colors, i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * The galactic band: thousands of faint stars gathered around a seeded
 * great circle, the way the Milky Way crosses a dark sky.
 */
function buildBand(rng: Rng): THREE.BufferGeometry {
  const positions = new Float32Array(BAND_COUNT * 3);
  const colors = new Float32Array(BAND_COUNT * 3);
  const tilt = new THREE.Euler(
    range(rng, 0.6, 1.1),
    range(rng, 0, Math.PI * 2),
    range(rng, 0, 0.5),
  );
  const point = new THREE.Vector3();
  for (let i = 0; i < BAND_COUNT; i++) {
    const theta = range(rng, 0, Math.PI * 2);
    // Sum of three draws approximates a gaussian around the band plane.
    const gauss = (rng() + rng() + rng() - 1.5) * BAND_SPREAD;
    const r = lerp(FIELD_INNER * 1.1, FIELD_OUTER, rng());
    point
      .set(Math.cos(theta), gauss, Math.sin(theta))
      .normalize()
      .multiplyScalar(r)
      .applyEuler(tilt);
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
    starTint(rng, range(rng, 0.12, 0.4), colors, i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Deterministic instanced background starfield. drei's Stars uses
 * Math.random, so this builds its own geometry from the login seed.
 */
export function Starfield() {
  const login = useGalaxyStore((s) => s.galaxy.login);
  const count = useGalaxyStore((s) => s.galaxy.backgroundStarCount);
  const motionScale = useMotionScale();
  const group = useRef<THREE.Group>(null);

  const { dim, bright, band } = useMemo(() => {
    const rng = rngFromString(`${login}:starfield`);
    const brightCount = Math.round(count * BRIGHT_SHARE);
    return {
      dim: buildLayer(rng, count - brightCount, 0.3, 0.65),
      bright: buildLayer(rng, brightCount, 0.85, 1.6),
      band: buildBand(rng),
    };
  }, [login, count]);

  // Round soft sprite so stars render as points of light, not raw
  // GL_POINTS squares.
  const starSprite = useMemo(
    () =>
      radialGradientTexture([
        [0, 'rgba(255, 255, 255, 1)'],
        [0.4, 'rgba(255, 255, 255, 0.5)'],
        [1, 'rgba(255, 255, 255, 0)'],
      ]),
    [],
  );

  useEffect(
    () => () => {
      dim.dispose();
      bright.dispose();
      band.dispose();
      starSprite.dispose();
    },
    [dim, bright, band, starSprite],
  );

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.004 * motionScale;
  });

  return (
    <group ref={group}>
      <points geometry={dim}>
        <pointsMaterial
          size={0.7}
          map={starSprite}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </points>
      <points geometry={bright}>
        <pointsMaterial
          size={1.5}
          map={starSprite}
          sizeAttenuation
          vertexColors
          transparent
          depthWrite={false}
        />
      </points>
      <points geometry={band}>
        <pointsMaterial
          size={0.45}
          map={starSprite}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
