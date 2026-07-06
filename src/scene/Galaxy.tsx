import { CameraRig } from './CameraRig';
import { CentralStar } from './CentralStar';
import { Effects } from './Effects';
import { Nebula } from './Nebula';
import { Planets } from './Planets';
import { Starfield } from './Starfield';
import { Shuttle } from './Shuttle';

/**
 * Scene root: a pure function of store state. Lights live here; the warm
 * key light is inside CentralStar so it scales with the star.
 */
export function Galaxy() {
  return (
    <>
      {/* Soft cool fill so planet dark sides never go fully black. */}
      <hemisphereLight args={['#3A4A6B', '#0B0E18', 0.35]} />
      {/* Faint cool rim from behind the scene for planet edge definition. */}
      <directionalLight position={[-14, 8, -12]} intensity={0.5} color="#7FB2FF" />

      <Nebula />
      <Starfield />
      <CentralStar />
      <Planets />
      <Shuttle />

      <Effects />
      <CameraRig />
    </>
  );
}
