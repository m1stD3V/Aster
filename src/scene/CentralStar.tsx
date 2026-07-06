import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGalaxyStore } from '../state/store';
import { hexWithAlpha, radialGradientTexture } from './textures';

const CORE_COLOR = '#FFF6E6';
const CORONA_COLOR = '#FFD27F';
const LIGHT_COLOR = '#FFD9A0';

/** The user as a star: warm emissive core, additive corona, gentle pulse. */
export function CentralStar() {
  const galaxy = useGalaxyStore((s) => s.galaxy);
  const selectRepo = useGalaxyStore((s) => s.selectRepo);
  const group = useRef<THREE.Group>(null);

  // Core color pushed above 1 so selective bloom lifts the star while
  // planets, which stay under the luminance threshold, read as matte.
  const coreColor = useMemo(
    () => new THREE.Color(CORE_COLOR).multiplyScalar(galaxy.starIntensity),
    [galaxy.starIntensity],
  );

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

  useFrame((state) => {
    // Small, slow breathing; amplitude kept tiny so it reads as alive,
    // not animated.
    const pulse = 1 + 0.015 * Math.sin(state.clock.elapsedTime * 0.6);
    group.current?.scale.setScalar(pulse);
  });

  const coronaScale = galaxy.starRadius * 4.6;

  return (
    <group ref={group}>
      <mesh onClick={() => selectRepo(null)}>
        <sphereGeometry args={[galaxy.starRadius, 48, 48]} />
        <meshBasicMaterial color={coreColor} toneMapped={false} />
      </mesh>
      <sprite scale={[coronaScale, coronaScale, 1]} raycast={() => null}>
        <spriteMaterial
          map={coronaTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.85}
        />
      </sprite>
      {/* Decay 0 keeps the outer orbits lit; falloff is implied by the
          visual scale instead of physically correct attenuation. */}
      <pointLight color={LIGHT_COLOR} intensity={2.6} decay={0} />
    </group>
  );
}
