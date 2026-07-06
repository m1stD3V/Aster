import {
  Bloom,
  EffectComposer,
  Noise,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Post chain, in order: Bloom, a whisper of film grain, Vignette, then
 * ACES Filmic tone mapping last. The Canvas runs flat (no built-in tone
 * mapping) so ACES is applied exactly once, here. Bloom is selective by
 * luminance: the sun shader and corona sit above the threshold via HDR
 * values, planets stay below it and read as matte bodies.
 */
export function Effects() {
  return (
    <EffectComposer>
      <Bloom
        mipmapBlur
        luminanceThreshold={0.75}
        luminanceSmoothing={0.25}
        intensity={0.9}
      />
      <Noise premultiply opacity={0.5} />
      <Vignette offset={0.3} darkness={0.6} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
