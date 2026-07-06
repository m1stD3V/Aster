import { Html, Trail, useCursor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { orbitPoint } from '../lib/math';
import { range, rngFromString } from '../lib/prng';
import { useGalaxyStore } from '../state/store';
import { useMotionScale } from '../hooks/useReducedMotion';

/**
 * Shared materials and geometry for the orbiter, built once. The model
 * is primitives only: white hull, black thermal protection tiles, gray
 * engine bells, an HDR exhaust glow that blooms.
 */
const WHITE_HULL = new THREE.MeshStandardMaterial({
  color: '#E6E9EF',
  roughness: 0.5,
  metalness: 0.1,
});
const DARK_TILE = new THREE.MeshStandardMaterial({
  color: '#20242D',
  roughness: 0.85,
  metalness: 0,
  side: THREE.DoubleSide,
});
const WING_SKIN = new THREE.MeshStandardMaterial({
  color: '#D8DCE2',
  roughness: 0.55,
  metalness: 0.08,
  side: THREE.DoubleSide,
});
const ENGINE_BELL = new THREE.MeshStandardMaterial({
  color: '#6A6F78',
  roughness: 0.4,
  metalness: 0.8,
});
const EXHAUST = new THREE.MeshBasicMaterial({
  // HDR blue-white so the engines read as burning through bloom.
  color: new THREE.Color('#9FC5FF').multiplyScalar(1.7),
  toneMapped: false,
});

/** Delta wing footprint: x outboard, shape-Y forward (becomes +Z). */
function wingGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.15);
  shape.lineTo(0.5, -0.32);
  shape.lineTo(0.5, -0.46);
  shape.lineTo(0, -0.46);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/** Swept vertical stabilizer: shape-X backward (becomes -Z), Y up. */
function finGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.26, 0);
  shape.lineTo(0.2, 0.32);
  shape.lineTo(0.1, 0.32);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
  geometry.rotateY(Math.PI / 2);
  geometry.translate(0.015, 0, 0);
  return geometry;
}

const WING = wingGeometry();
const FIN = finGeometry();

const NO_RAYCAST = () => null;

/**
 * The orbiter itself, nose along +Z, roughly 1.3 units long.
 * Exported separately so it can be posed for closeups and testing.
 */
export function ShuttleModel() {
  return (
    <group>
      {/* Fuselage and payload bay. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} material={WHITE_HULL}>
        <cylinderGeometry args={[0.15, 0.17, 1.05, 14]} />
      </mesh>
      {/* Nose taper plus the black thermal cap Discovery wears. */}
      <mesh
        position={[0, -0.01, 0.66]}
        rotation={[Math.PI / 2, 0, 0]}
        material={WHITE_HULL}
      >
        <coneGeometry args={[0.145, 0.32, 14]} />
      </mesh>
      <mesh position={[0, -0.02, 0.8]} rotation={[Math.PI / 2, 0, 0]} material={DARK_TILE}>
        <coneGeometry args={[0.07, 0.14, 12]} />
      </mesh>
      {/* Cockpit windows. */}
      <mesh position={[0, 0.1, 0.52]} material={DARK_TILE}>
        <boxGeometry args={[0.16, 0.06, 0.1]} />
      </mesh>
      {/* Black tile belly. */}
      <mesh position={[0, -0.13, 0.05]} material={DARK_TILE}>
        <boxGeometry args={[0.26, 0.045, 1.0]} />
      </mesh>
      {/* Delta wings; the left one is the mirrored twin. */}
      <mesh
        position={[0.13, -0.07, 0]}
        geometry={WING}
        material={WING_SKIN}
        raycast={NO_RAYCAST}
      />
      <mesh
        position={[-0.13, -0.07, 0]}
        scale={[-1, 1, 1]}
        geometry={WING}
        material={WING_SKIN}
        raycast={NO_RAYCAST}
      />
      {/* Vertical stabilizer. */}
      <mesh
        position={[0, 0.14, -0.28]}
        geometry={FIN}
        material={WING_SKIN}
        raycast={NO_RAYCAST}
      />
      {/* OMS pods flanking the tail. */}
      <mesh position={[0.11, 0.09, -0.45]} material={WHITE_HULL}>
        <sphereGeometry args={[0.085, 10, 10]} />
      </mesh>
      <mesh position={[-0.11, 0.09, -0.45]} material={WHITE_HULL}>
        <sphereGeometry args={[0.085, 10, 10]} />
      </mesh>
      {/* Three main engine bells. */}
      {[
        [-0.07, -0.03],
        [0.07, -0.03],
        [0, 0.08],
      ].map(([x, y], i) => (
        <mesh
          key={i}
          position={[x, y, -0.56]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={ENGINE_BELL}
          raycast={NO_RAYCAST}
        >
          <coneGeometry args={[0.055, 0.12, 10, 1, true]} />
        </mesh>
      ))}
      {/* Exhaust glow, the only part that blooms. */}
      <mesh position={[0, 0, -0.64]} material={EXHAUST} raycast={NO_RAYCAST}>
        <sphereGeometry args={[0.055, 10, 10]} />
      </mesh>
    </group>
  );
}

/**
 * Discovery on patrol: cruises the system on a seeded inclined ellipse.
 * Pure decoration, no gameplay; deterministic like everything else, so
 * the same login flies the same route.
 */
export function Shuttle() {
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

  // Trail samples the ship's world position from its first frame; without
  // this the initial buffer anchors at the origin and draws a stray line
  // from the star until it decays.
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    orbitPoint(path.a, path.b, path.phase, path.inclination, g.position);
  }, [path]);

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
      scale={1.1}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <Trail width={0.8} length={9} color="#4A6E96" attenuation={(w) => w * w}>
        <ShuttleModel />
      </Trail>

      {hovered && (
        <Html
          position={[0, 0.9, 0]}
          center
          className="planet-label"
          style={{ pointerEvents: 'none' }}
        >
          OV-103 Discovery
        </Html>
      )}
    </group>
  );
}
