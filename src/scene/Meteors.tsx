import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { range, rngFromString } from '../lib/prng';
import { useGalaxyStore } from '../state/store';
import { useReducedMotion } from '../hooks/useReducedMotion';

const STREAK_LENGTH = 7;
const FLIGHT_SECONDS = 1.1;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Occasional shooting stars in the far background. The streak is baked
 * into the mesh (a gradient-faded cylinder) rather than a trail, so
 * teleporting between spawn points leaves no artifacts. Spawn timing
 * and paths come from a seeded rng, so even the meteor shower is the
 * same for the same login.
 */
export function Meteors() {
  const login = useGalaxyStore((s) => s.galaxy.login);
  const reducedMotion = useReducedMotion();
  const streak = useRef<THREE.Mesh>(null);

  const rng = useMemo(() => rngFromString(`${login}:meteors`), [login]);

  // White-hot core fading to nothing along the streak's length.
  const gradient = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      g.addColorStop(0.35, 'rgba(190, 214, 255, 0.35)');
      g.addColorStop(1, 'rgba(190, 214, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 2, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => gradient.dispose(), [gradient]);

  // Flight state lives in refs; no per-frame allocations.
  const flight = useRef({
    active: false,
    nextAt: 4,
    t0: 0,
    from: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
  });

  useFrame((state) => {
    const mesh = streak.current;
    if (!mesh) return;
    const f = flight.current;
    const t = state.clock.elapsedTime;

    if (!f.active) {
      mesh.visible = false;
      if (t < f.nextAt || reducedMotion) return;
      // Spawn on the upper background shell, flying roughly tangentially.
      const theta = range(rng, 0, Math.PI * 2);
      const y = range(rng, 0.15, 0.75);
      const flat = Math.sqrt(1 - y * y);
      const radius = range(rng, 100, 140);
      f.from.set(
        flat * Math.cos(theta) * radius,
        y * radius,
        flat * Math.sin(theta) * radius,
      );
      f.velocity
        .set(range(rng, -1, 1), range(rng, -0.9, -0.3), range(rng, -1, 1))
        .normalize()
        .multiplyScalar(range(rng, 42, 60) / FLIGHT_SECONDS);
      f.t0 = t;
      f.active = true;
      mesh.quaternion.setFromUnitVectors(UP, f.velocity.clone().normalize());
    }

    const progress = (t - f.t0) / FLIGHT_SECONDS;
    if (progress >= 1) {
      f.active = false;
      f.nextAt = t + range(rng, 7, 16);
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.copy(f.from).addScaledVector(f.velocity, progress * FLIGHT_SECONDS);
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.opacity = Math.sin(progress * Math.PI);
  });

  return (
    <mesh ref={streak} visible={false} raycast={() => null}>
      <cylinderGeometry args={[0.05, 0.16, STREAK_LENGTH, 6, 1, true]} />
      <meshBasicMaterial
        map={gradient}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
