import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { SpeckParams } from '../data/mapping';
import { useGalaxyStore } from '../state/store';
import { Planet } from './Planet';

/** All repo planets, plus the instanced long tail. */
export function Planets() {
  const galaxy = useGalaxyStore((s) => s.galaxy);
  return (
    <group>
      {galaxy.planets.map((p) => (
        <Planet key={p.repoId} params={p} />
      ))}
      <Specks specks={galaxy.specks} />
    </group>
  );
}

/**
 * Repos beyond the planet cap render as one InstancedMesh of faint,
 * static specks past the outermost orbit: present, cheap, honest.
 */
function Specks({ specks }: { specks: SpeckParams[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    specks.forEach((s, i) => {
      m.setPosition(
        Math.cos(s.angle) * s.orbitRadius,
        s.y,
        Math.sin(s.angle) * s.orbitRadius,
      );
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [specks]);

  if (specks.length === 0) return null;

  return (
    // Keyed by length: instance count is fixed at construction time.
    <instancedMesh
      key={specks.length}
      ref={ref}
      args={[undefined, undefined, specks.length]}
    >
      <sphereGeometry args={[0.06, 6, 6]} />
      <meshBasicMaterial color="#8B93A7" />
    </instancedMesh>
  );
}
