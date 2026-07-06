import { Html, useCursor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PlanetParams } from '../data/mapping';
import { orbitPoint } from '../lib/math';
import { useGalaxyStore } from '../state/store';
import { useMotionScale } from '../hooks/useReducedMotion';

/**
 * Shared unit geometries, scaled per instance. Created once for the app's
 * lifetime and passed by reference, so 60 planets cost 2 geometries.
 * R3F does not dispose externally created objects, which is what we want here.
 */
const UNIT_SPHERE = new THREE.SphereGeometry(1, 32, 32);
const MOON_SPHERE = new THREE.SphereGeometry(1, 12, 12);
const MOON_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#7E8698',
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

/** One repository: sphere plus optional ring, moons, orbit guide, and motion. */
export function Planet({ params }: PlanetProps) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const moonRefs = useRef<Array<THREE.Mesh | null>>([]);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const selectRepo = useGalaxyStore((s) => s.selectRepo);
  const selected = useGalaxyStore((s) => s.selectedRepoId === params.repoId);
  const motionScale = useMotionScale();

  // Language tint over the slate base: enough color to identify the
  // language, desaturated enough to stay in the palette.
  const { surfaceColor, emissiveColor, ringColor, atmosphereColor } = useMemo(() => {
    const tint = new THREE.Color(params.color);
    return {
      surfaceColor: new THREE.Color(SLATE_BASE).lerp(tint, 0.45),
      emissiveColor: tint.clone().multiplyScalar(0.55),
      // Rings drift toward slate so saturated language colors stay quiet.
      ringColor: tint.clone().lerp(new THREE.Color('#8B93A7'), 0.4),
      atmosphereColor: tint.clone().lerp(new THREE.Color('#AFC4E8'), 0.4),
    };
  }, [params.color]);

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

  const emphasized = hovered || selected;

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
        >
          <meshStandardMaterial
            color={surfaceColor}
            emissive={emissiveColor}
            emissiveIntensity={params.emissiveIntensity * (emphasized ? 2 : 1)}
            roughness={0.78}
            metalness={0.08}
          />
        </mesh>

        {/* Soft additive shell: a hint of atmosphere so the silhouette
            does not end in a hard edge. */}
        <mesh scale={params.radius * 1.14} geometry={UNIT_SPHERE} raycast={NO_RAYCAST}>
          <meshBasicMaterial
            color={atmosphereColor}
            transparent
            opacity={0.055}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {params.ring && (
          <mesh
            rotation={[Math.PI / 2 + params.ring.inclination, 0, 0]}
            raycast={NO_RAYCAST}
          >
            <ringGeometry args={[params.ring.innerRadius, params.ring.outerRadius, 64]} />
            <meshBasicMaterial
              color={ringColor}
              transparent
              opacity={params.ring.opacity}
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
