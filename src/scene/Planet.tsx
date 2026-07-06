import { Html, useCursor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PlanetParams } from '../data/mapping';
import { orbitPoint } from '../lib/math';
import { rngFromString, xfnv1a } from '../lib/prng';
import { useGalaxyStore } from '../state/store';
import { useMotionScale } from '../hooks/useReducedMotion';
import { createPlanetMaterial } from './materials';
import { radialRingGeometry, ringTexture } from './textures';

/**
 * Shared unit geometries, scaled per instance. Created once for the app's
 * lifetime and passed by reference, so 60 planets cost 2 geometries.
 * R3F does not dispose externally created objects, which is what we want here.
 */
const UNIT_SPHERE = new THREE.SphereGeometry(1, 48, 48);
const MOON_SPHERE = new THREE.SphereGeometry(1, 12, 12);
const MOON_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#8A8F9C',
  roughness: 1,
  metalness: 0,
});

const SLATE_BASE = '#2A3142';
const HOVER_SCALE = 1.09;
const ORBIT_SEGMENTS = 96;

/** Empty raycast: rings, moons, and guides never steal pointer events. */
const NO_RAYCAST = () => null;

interface PlanetProps {
  params: PlanetParams;
}

/** One repository: shader-surfaced sphere plus ring, moons, orbit guide. */
export function Planet({ params }: PlanetProps) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const moonRefs = useRef<Array<THREE.Mesh | null>>([]);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const selectRepo = useGalaxyStore((s) => s.selectRepo);
  const selected = useGalaxyStore((s) => s.selectedRepoId === params.repoId);
  const motionScale = useMotionScale();

  // Ringed and large planets read as gas giants (banded), small ones as
  // rocky worlds. The seed varies the pattern per repo, deterministically.
  const material = useMemo(() => {
    const tint = new THREE.Color(params.color);
    return createPlanetMaterial({
      seed: (xfnv1a(params.repoId) % 1000) / 10,
      baseColor: new THREE.Color(SLATE_BASE).lerp(tint, 0.4),
      tint,
      atmosphere: tint.clone().lerp(new THREE.Color('#AFC4E8'), 0.45),
      banded: params.ring ? 1 : params.radius > 0.95 ? 0.8 : 0,
    });
  }, [params.repoId, params.color, params.ring, params.radius]);
  useEffect(() => () => material.dispose(), [material]);

  const ringColor = useMemo(
    () => new THREE.Color(params.color).lerp(new THREE.Color('#8B93A7'), 0.35),
    [params.color],
  );

  const ringAssets = useMemo(() => {
    if (!params.ring) return null;
    return {
      geometry: radialRingGeometry(params.ring.innerRadius, params.ring.outerRadius),
      texture: ringTexture(rngFromString(`${params.repoId}:ring`)),
    };
  }, [params.ring, params.repoId]);
  useEffect(
    () => () => {
      ringAssets?.geometry.dispose();
      ringAssets?.texture.dispose();
    },
    [ringAssets],
  );

  // Faint orbit guide traced with the exact ellipse the planet flies,
  // so the system reads as structure instead of scattered bodies.
  const orbitGeometry = useMemo(() => {
    const positions = new Float32Array(ORBIT_SEGMENTS * 3);
    const p = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < ORBIT_SEGMENTS; i++) {
      const angle = (i / ORBIT_SEGMENTS) * Math.PI * 2;
      orbitPoint(params.orbitA, params.orbitB, angle, params.inclination, p);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [params.orbitA, params.orbitB, params.inclination]);
  useEffect(() => () => orbitGeometry.dispose(), [orbitGeometry]);

  const emphasized = hovered || selected;

  useFrame((state, delta) => {
    const g = group.current;
    const b = body.current;
    if (!g || !b) return;
    const t = state.clock.elapsedTime * motionScale;

    // Position is a pure function of time, so CameraRig can compute the
    // same point when focusing without any per-frame state sharing.
    const angle = params.initialAngle + params.orbitSpeed * t;
    orbitPoint(params.orbitA, params.orbitB, angle, params.inclination, g.position);

    b.rotation.y += params.spinSpeed * delta * motionScale;
    const targetScale = params.radius * (hovered ? HOVER_SCALE : 1);
    easing.damp3(b.scale, [targetScale, targetScale, targetScale], 0.15, delta);
    easing.damp(material.uniforms.uEmphasis, 'value', emphasized ? 1 : 0, 0.2, delta);

    for (let i = 0; i < params.moons.length; i++) {
      const moon = moonRefs.current[i];
      const m = params.moons[i];
      if (!moon || !m) continue;
      orbitPoint(
        m.orbitRadius,
        m.orbitRadius,
        m.phase + m.speed * t,
        m.inclination,
        moon.position,
      );
    }
  });

  return (
    <>
      <lineLoop geometry={orbitGeometry} raycast={NO_RAYCAST}>
        <lineBasicMaterial
          color={emphasized ? '#5EEAD4' : '#8B93A7'}
          transparent
          opacity={emphasized ? 0.22 : 0.07}
          depthWrite={false}
        />
      </lineLoop>

      <group ref={group}>
        <mesh
          ref={body}
          scale={params.radius}
          onClick={(e) => {
            e.stopPropagation();
            selectRepo(params.repoId);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
          geometry={UNIT_SPHERE}
          material={material}
        />

        {params.ring && ringAssets && (
          <mesh
            rotation={[Math.PI / 2 + params.ring.inclination, 0, 0]}
            raycast={NO_RAYCAST}
          >
            <primitive object={ringAssets.geometry} attach="geometry" />
            <meshBasicMaterial
              map={ringAssets.texture}
              color={ringColor}
              transparent
              opacity={Math.min(0.85, params.ring.opacity * 2.4)}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}

        {params.moons.map((moon, i) => (
          <mesh
            key={i}
            ref={(el) => {
              moonRefs.current[i] = el;
            }}
            scale={moon.size}
            geometry={MOON_SPHERE}
            material={MOON_MATERIAL}
            raycast={NO_RAYCAST}
          />
        ))}

        {emphasized && (
          <Html
            position={[0, params.radius + 0.7, 0]}
            center
            className="planet-label"
            style={{ pointerEvents: 'none' }}
          >
            {params.name}
          </Html>
        )}
      </group>
    </>
  );
}
