import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { STAR_ID, useGalaxyStore } from '../state/store';
import { useMotionScale } from '../hooks/useReducedMotion';
import { createSunMaterial } from './materials';
import { hexWithAlpha, radialGradientTexture } from './textures';

const CORE_COLOR = '#FFF6E6';
const CORONA_COLOR = '#FFD27F';
const LIGHT_COLOR = '#FFD9A0';

/**
 * The user as a star: a shader photosphere with slow granulation and
 * limb darkening, an additive corona, and a gentle breathing pulse.
 * The surface is HDR (intensity above 1) so selective bloom lifts it.
 */
export function CentralStar() {
  const galaxy = useGalaxyStore((s) => s.galaxy);
  const selectRepo = useGalaxyStore((s) => s.selectRepo);
  const motionScale = useMotionScale();
  const group = useRef<THREE.Group>(null);
  const surface = useRef<THREE.Mesh>(null);

  const sunMaterial = useMemo(
    () => createSunMaterial(galaxy.starIntensity),
    [galaxy.starIntensity],
  );
  useEffect(() => () => sunMaterial.dispose(), [sunMaterial]);

  const coronaTexture = useMemo(
    () =>
      radialGradientTexture([
        [0, hexWithAlpha(CORE_COLOR, 0.9)],
        [0.25, hexWithAlpha(CORONA_COLOR, 0.4)],
        [0.6, hexWithAlpha(CORONA_COLOR, 0.08)],
        [1, hexWithAlpha(CORONA_COLOR, 0)],
      ]),
    [],
  );
  useEffect(() => () => coronaTexture.dispose(), [coronaTexture]);

  useFrame((state, delta) => {
    // Small, slow breathing; amplitude kept tiny so it reads as alive,
    // not animated. Granulation drifts on the same reduced-motion scale.
    const pulse = 1 + 0.015 * Math.sin(state.clock.elapsedTime * 0.6);
    group.current?.scale.setScalar(pulse);
    const material = surface.current?.material as THREE.ShaderMaterial | undefined;
    if (material) material.uniforms.uTime.value += delta * motionScale;
  });

  const coronaScale = galaxy.starRadius * 4.6;

  return (
    <group ref={group}>
      <mesh
        ref={surface}
        onClick={(e) => {
          e.stopPropagation();
          selectRepo(STAR_ID);
        }}
        material={sunMaterial}
      >
        <sphereGeometry args={[galaxy.starRadius, 64, 64]} />
      </mesh>
      <sprite scale={[coronaScale, coronaScale, 1]} raycast={() => null}>
        <spriteMaterial
          map={coronaTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.8}
        />
      </sprite>
      {/* Decay 0 keeps the outer orbits lit for moons and the probe;
          planets light themselves analytically in their shader. */}
      <pointLight color={LIGHT_COLOR} intensity={2.6} decay={0} />
    </group>
  );
}
