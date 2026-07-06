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
    // Slight blue-to-warm variation; a few values above 1 let bloom pick
    // out the brightest stars without lighting up the whole field.
    const lum = range(rng, minLum, maxLum);
    const warmth = range(rng, -0.08, 0.06);
    colors[i * 3] = lum * (1 + warmth);
    colors[i * 3 + 1] = lum;
    colors[i * 3 + 2] = lum * (1 - warmth * 0.8);
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

  const { dim, bright } = useMemo(() => {
    const rng = rngFromString(`${login}:starfield`);
    const brightCount = Math.round(count * BRIGHT_SHARE);
    return {
      dim: buildLayer(rng, count - brightCount, 0.3, 0.65),
      bright: buildLayer(rng, brightCount, 0.85, 1.6),
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
      starSprite.dispose();
    },
    [dim, bright, starSprite],
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
    </group>
  );
}
