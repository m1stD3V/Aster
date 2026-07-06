import { Html, Trail, useCursor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { orbitPoint } from '../lib/math';
import { range, rngFromString } from '../lib/prng';
import { useGalaxyStore } from '../state/store';
import { useMotionScale } from '../hooks/useReducedMotion';

/** Shared hull materials; one probe per scene, but consistent with the
    reuse rule everywhere else. */
const HULL_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#B9C2D4',
  roughness: 0.45,
  metalness: 0.7,
});
const PANEL_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#24457A',
  roughness: 0.4,
  metalness: 0.5,
  emissive: '#1B3B72',
  emissiveIntensity: 0.25,
});
const ENGINE_MATERIAL = new THREE.MeshBasicMaterial({
  // HDR teal so the engine reads through bloom as a tiny running light.
  color: new THREE.Color('#5EEAD4').multiplyScalar(1.6),
  toneMapped: false,
});

const NO_RAYCAST = () => null;

/**
 * A lone survey probe cruising the system on a seeded inclined ellipse.
 * Pure decoration: no gameplay, just a sign of life. Deterministic like
 * everything else, so the same login flies the same route.
 */
export function Voyager() {
  const galaxy = useGalaxyStore((s) => s.galaxy);
  const motionScale = useMotionScale();
  const group = useRef<THREE.Group>(null);
  const ahead = useRef(new THREE.Vector3());
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const path = useMemo(() => {
    const rng = rngFromString(`${galaxy.login}:voyager`);
    const reach = Math.max(galaxy.maxOrbit, 8);
    return {
      a: reach * range(rng, 0.65, 0.85),
      b: reach * range(rng, 0.45, 0.6),
      inclination: range(rng, 0.35, 0.6) * (rng() < 0.5 ? -1 : 1),
      phase: range(rng, 0, Math.PI * 2),
      // Slow cruise, a touch faster than the outer planets so it visibly
      // travels rather than orbits.
      speed: range(rng, 0.05, 0.07),
      bob: range(rng, 0.4, 1),
    };
  }, [galaxy]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime * motionScale;
    const angle = path.phase + t * path.speed;

    orbitPoint(path.a, path.b, angle, path.inclination, g.position);
    g.position.y += Math.sin(t * 0.4) * path.bob;

    // Aim the nose a little way down the flight path.
    orbitPoint(path.a, path.b, angle + 0.05, path.inclination, ahead.current);
    ahead.current.y += Math.sin((t + 0.12) * 0.4) * path.bob;
    g.lookAt(ahead.current);
  });

  return (
    <group
      ref={group}
      scale={0.85}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <Trail width={0.9} length={9} color="#2E9C8F" attenuation={(w) => w * w}>
        {/* Hull, nose forward along +z to match lookAt. */}
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={HULL_MATERIAL}>
            <cylinderGeometry args={[0.12, 0.14, 0.6, 10]} />
          </mesh>
          <mesh
            position={[0, 0, 0.45]}
            rotation={[Math.PI / 2, 0, 0]}
            material={HULL_MATERIAL}
          >
            <coneGeometry args={[0.12, 0.3, 10]} />
          </mesh>
          {/* Solar wings. */}
          <mesh position={[0.5, 0, 0]} material={PANEL_MATERIAL} raycast={NO_RAYCAST}>
            <boxGeometry args={[0.75, 0.02, 0.3]} />
          </mesh>
          <mesh position={[-0.5, 0, 0]} material={PANEL_MATERIAL} raycast={NO_RAYCAST}>
            <boxGeometry args={[0.75, 0.02, 0.3]} />
          </mesh>
          {/* Engine light, the only part that blooms. */}
          <mesh position={[0, 0, -0.36]} material={ENGINE_MATERIAL} raycast={NO_RAYCAST}>
            <sphereGeometry args={[0.07, 10, 10]} />
          </mesh>
        </group>
      </Trail>

      {hovered && (
        <Html
          position={[0, 0.9, 0]}
          center
          className="planet-label"
          style={{ pointerEvents: 'none' }}
        >
          survey probe {galaxy.login}-01
        </Html>
      )}
    </group>
  );
}
