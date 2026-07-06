import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { motesForGalaxy } from '../game/motes';
import { orbitPoint } from '../lib/math';
import { MISSION_SECONDS, useGalaxyStore } from '../state/store';
import { useMotionScale } from '../hooks/useReducedMotion';
import { ShuttleModel } from './Shuttle';

/**
 * Flight mode: the player takes Discovery out on a survey mission.
 * WASD or arrows steer, Shift boosts, Escape ends the run early.
 * Motes ride along with their planets, so harvesting means flying
 * genuine intercepts against moving worlds. All game state that
 * changes every frame lives in refs; the store only hears about
 * discrete events (collections, whole-second ticks, mission end).
 */

const BASE_SPEED = 13;
const BOOST_SPEED = 26;
const YAW_RATE = 1.7;
const PITCH_RATE = 1.2;
const COLLECT_RADIUS = 2.4;
const WORLD_LIMIT = 140;

const MOTE_GEOMETRY = new THREE.IcosahedronGeometry(0.22, 0);
const MOTE_MATERIAL = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#FFD27F').multiplyScalar(1.5),
  toneMapped: false,
});

interface Keys {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  boost: boolean;
}

export function FlightController() {
  const galaxy = useGalaxyStore((s) => s.galaxy);
  const active = useGalaxyStore((s) => s.mode === 'flight');
  const collectMote = useGalaxyStore((s) => s.collectMote);
  const tickMission = useGalaxyStore((s) => s.tickMission);
  const endMission = useGalaxyStore((s) => s.endMission);
  const motionScale = useMotionScale();

  const ship = useRef<THREE.Group>(null);
  const motesRef = useRef<THREE.InstancedMesh>(null);

  const motes = useMemo(() => motesForGalaxy(galaxy), [galaxy]);
  const planetById = useMemo(
    () => new Map(galaxy.planets.map((p) => [p.repoId, p])),
    [galaxy],
  );

  // Per-run mutable state, reset on every launch.
  const run = useRef({
    yaw: Math.PI,
    pitch: 0,
    elapsed: 0,
    lastWholeSecond: MISSION_SECONDS,
    collected: [] as boolean[],
    surveyed: new Set<string>(),
    pos: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    scratch: new THREE.Vector3(),
    planetPos: new THREE.Vector3(),
    matrix: new THREE.Matrix4(),
    quat: new THREE.Quaternion(),
    euler: new THREE.Euler(0, 0, 0, 'YXZ'),
  });
  const keys = useRef<Keys>({
    left: false,
    right: false,
    up: false,
    down: false,
    boost: false,
  });

  // Reset the run whenever a mission starts.
  useEffect(() => {
    if (!active) return;
    const r = run.current;
    r.yaw = Math.PI * 0.75;
    r.pitch = -0.05;
    r.elapsed = 0;
    r.lastWholeSecond = MISSION_SECONDS;
    r.collected = motes.map(() => false);
    r.surveyed = new Set();
    r.pos.set(galaxy.maxOrbit * 0.4, 3, galaxy.maxOrbit * 0.5);
  }, [active, motes, galaxy]);

  // Keyboard: refs only; no re-renders on input.
  useEffect(() => {
    if (!active) return;
    const setKey = (code: string, downState: boolean): boolean => {
      const k = keys.current;
      switch (code) {
        case 'ArrowLeft':
        case 'KeyA':
          k.left = downState;
          return true;
        case 'ArrowRight':
        case 'KeyD':
          k.right = downState;
          return true;
        case 'ArrowUp':
        case 'KeyW':
          k.up = downState;
          return true;
        case 'ArrowDown':
        case 'KeyS':
          k.down = downState;
          return true;
        case 'ShiftLeft':
        case 'ShiftRight':
          k.boost = downState;
          return true;
        default:
          return false;
      }
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        endMission([...run.current.surveyed]);
        return;
      }
      if (setKey(e.code, true)) e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => {
      if (setKey(e.code, false)) e.preventDefault();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [active, endMission]);

  useFrame((state, delta) => {
    if (!active) return;
    const s = ship.current;
    const instanced = motesRef.current;
    if (!s || !instanced) return;
    const r = run.current;
    const k = keys.current;
    const t = state.clock.elapsedTime;

    // Clock: report whole seconds only, end at zero.
    r.elapsed += delta;
    const secondsLeft = Math.max(0, Math.ceil(MISSION_SECONDS - r.elapsed));
    if (secondsLeft !== r.lastWholeSecond) {
      r.lastWholeSecond = secondsLeft;
      tickMission(secondsLeft);
    }
    if (r.elapsed >= MISSION_SECONDS) {
      endMission([...r.surveyed]);
      return;
    }

    // Steering and integration.
    const yawInput = (k.left ? 1 : 0) - (k.right ? 1 : 0);
    const pitchInput = (k.up ? 1 : 0) - (k.down ? 1 : 0);
    r.yaw += yawInput * YAW_RATE * delta;
    r.pitch = THREE.MathUtils.clamp(r.pitch + pitchInput * PITCH_RATE * delta, -1.15, 1.15);
    r.euler.set(r.pitch, r.yaw, 0);
    r.quat.setFromEuler(r.euler);
    r.forward.set(0, 0, 1).applyQuaternion(r.quat);
    const speed = k.boost ? BOOST_SPEED : BASE_SPEED;
    r.pos.addScaledVector(r.forward, speed * delta);
    // Soft world edge: slide back inside the sphere of play.
    if (r.pos.length() > WORLD_LIMIT) r.pos.setLength(WORLD_LIMIT);

    s.position.copy(r.pos);
    s.quaternion.copy(r.quat);
    // Banked turns sell the flying.
    easing.damp(s.rotation, 'z', -yawInput * 0.55, 0.18, delta);

    // Chase camera: behind and above, looking past the nose.
    r.scratch
      .copy(r.pos)
      .addScaledVector(r.forward, -7)
      .addScaledVector(THREE.Object3D.DEFAULT_UP, 2.4);
    easing.damp3(state.camera.position, r.scratch, 0.22, delta);
    r.scratch.copy(r.pos).addScaledVector(r.forward, 6);
    state.camera.lookAt(r.scratch);

    // Motes ride their planets; collect on close flyby.
    for (let i = 0; i < motes.length; i++) {
      const mote = motes[i];
      if (r.collected[i]) continue;
      const planet = planetById.get(mote.repoId);
      if (!planet) continue;
      // Same clock scaling as Planet.tsx so motes sit exactly on their
      // worlds, including under reduced motion.
      const angle = planet.initialAngle + planet.orbitSpeed * t * motionScale;
      orbitPoint(planet.orbitA, planet.orbitB, angle, planet.inclination, r.planetPos);
      r.scratch.set(
        r.planetPos.x + mote.offset[0],
        r.planetPos.y + mote.offset[1],
        r.planetPos.z + mote.offset[2],
      );
      if (r.scratch.distanceTo(r.pos) < COLLECT_RADIUS) {
        r.collected[i] = true;
        r.surveyed.add(mote.repoId);
        collectMote(mote.value);
        r.matrix.makeScale(0, 0, 0);
      } else {
        const pulse = 1 + 0.25 * Math.sin(t * 3 + i * 1.7);
        r.matrix.makeScale(pulse, pulse, pulse);
        r.matrix.setPosition(r.scratch);
      }
      instanced.setMatrixAt(i, r.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <group>
      <group ref={ship} scale={1.1}>
        <ShuttleModel />
      </group>
      <instancedMesh
        key={motes.length}
        ref={motesRef}
        args={[MOTE_GEOMETRY, MOTE_MATERIAL, Math.max(1, motes.length)]}
        raycast={() => null}
      />
    </group>
  );
}
