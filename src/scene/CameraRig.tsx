import { OrbitControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { useEffect, useMemo, useRef, type ComponentRef } from 'react';
import * as THREE from 'three';
import { clamp, orbitPoint } from '../lib/math';
import { STAR_ID, useGalaxyStore } from '../state/store';
import { useMotionScale, useReducedMotion } from '../hooks/useReducedMotion';

type ControlsRef = ComponentRef<typeof OrbitControls>;

/** Seconds of no input before the idle auto-orbit resumes. */
const IDLE_DELAY = 4;
/** Rule-of-thirds nudge: the star sits slightly off-center at rest. */
const HOME_TARGET = new THREE.Vector3(1.4, -0.5, 0);
/** Fixed home viewing direction; distance depends on the galaxy's extent. */
const HOME_DIRECTION = new THREE.Vector3(0.55, 0.38, 1).normalize();

/**
 * OrbitControls plus two gentle behaviors on top: an idle auto-orbit that
 * user input smoothly interrupts, and eased focus flights when a planet is
 * selected or released. All motion uses damped easing, never linear cuts.
 */
export function CameraRig() {
  const controls = useRef<ControlsRef>(null);
  const galaxy = useGalaxyStore((s) => s.galaxy);
  const selectedRepoId = useGalaxyStore((s) => s.selectedRepoId);
  const flight = useGalaxyStore((s) => s.mode === 'flight');
  const reducedMotion = useReducedMotion();
  const motionScale = useMotionScale();

  const selectedPlanet = useMemo(
    () => galaxy.planets.find((p) => p.repoId === selectedRepoId) ?? null,
    [galaxy, selectedRepoId],
  );

  const starFocused = selectedRepoId === STAR_ID;

  // A young system frames tight and intimate; a large one pulls back to
  // take in the whole disc.
  // Frame the inner two-thirds; the legacy rim cropping out of frame
  // reads cinematic and rewards zooming out.
  const homeDistance = galaxy.isYoungSystem ? 24 : clamp(galaxy.maxOrbit * 1.0, 15, 75);
  const maxDistance = Math.max(galaxy.maxOrbit * 2.5, 40);
  const minDistance = galaxy.starRadius + 3.5;

  // Scratch vectors, allocated once per rig, mutated per frame.
  const planetPos = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const offsetDir = useRef(new THREE.Vector3());
  const interacting = useRef(false);
  const idleFor = useRef(0);
  const returning = useRef(true);
  const prevSelected = useRef<string | null>(null);

  // Fly home whenever the galaxy itself changes (new profile loaded).
  useEffect(() => {
    returning.current = true;
  }, [galaxy]);

  // Ease home when a mission hands the camera back.
  useEffect(() => {
    if (!flight) returning.current = true;
  }, [flight]);

  useFrame((state, delta) => {
    if (flight) return;
    const c = controls.current;
    if (!c) return;
    const t = state.clock.elapsedTime;

    if (selectedRepoId !== prevSelected.current) {
      if (selectedRepoId === null) returning.current = true;
      prevSelected.current = selectedRepoId;
    }

    if (starFocused) {
      // Sun visit: ease in toward the photosphere along the current view.
      returning.current = false;
      const viewDistance = galaxy.starRadius * 3.2 + 4.5;
      offsetDir.current.copy(state.camera.position).normalize();
      desired.current.copy(offsetDir.current).multiplyScalar(viewDistance);
      easing.damp3(c.target, [0, 0, 0], 0.4, delta);
      easing.damp3(state.camera.position, desired.current, 0.55, delta);
    } else if (selectedPlanet) {
      returning.current = false;
      // The planet keeps orbiting while focused, so recompute its position
      // with the same pure formula Planet.tsx uses and chase it smoothly.
      const angle =
        selectedPlanet.initialAngle + selectedPlanet.orbitSpeed * t * motionScale;
      orbitPoint(
        selectedPlanet.orbitA,
        selectedPlanet.orbitB,
        angle,
        selectedPlanet.inclination,
        planetPos.current,
      );
      const viewDistance = selectedPlanet.radius * 6.5 + 3.5;
      offsetDir.current.copy(state.camera.position).sub(planetPos.current).normalize();
      desired.current
        .copy(planetPos.current)
        .addScaledVector(offsetDir.current, viewDistance);

      easing.damp3(c.target, planetPos.current, 0.35, delta);
      easing.damp3(state.camera.position, desired.current, 0.5, delta);
    } else if (returning.current) {
      desired.current.copy(HOME_DIRECTION).multiplyScalar(homeDistance).add(HOME_TARGET);
      easing.damp3(c.target, HOME_TARGET, 0.5, delta);
      easing.damp3(state.camera.position, desired.current, 0.7, delta);
      if (state.camera.position.distanceTo(desired.current) < 0.05) {
        returning.current = false;
      }
    }

    // Idle time accrues in the frame loop itself so it shares the frame
    // clock; onStart and onEnd only flip the interaction flag.
    idleFor.current = interacting.current ? 0 : idleFor.current + delta;
    const idle = idleFor.current > IDLE_DELAY;
    c.autoRotate =
      idle && !selectedPlanet && !starFocused && !returning.current && !reducedMotion;
  });

  // Flight mode owns the camera; unmount the controls entirely.
  if (flight) return null;

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      minDistance={minDistance}
      maxDistance={maxDistance}
      autoRotateSpeed={0.25}
      onStart={() => {
        // Any user input cancels flights and pauses the idle drift.
        returning.current = false;
        interacting.current = true;
      }}
      onEnd={() => {
        interacting.current = false;
        idleFor.current = 0;
      }}
    />
  );
}
