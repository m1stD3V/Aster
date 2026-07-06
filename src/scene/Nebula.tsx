import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useMotionScale } from '../hooks/useReducedMotion';
import { hexWithAlpha, radialGradientTexture } from './textures';

/** Background gradient: #05060A at the top toward #0A0E1A at the bottom. */
const GRADIENT_TOP = new THREE.Color('#05060A');
const GRADIENT_BOTTOM = new THREE.Color('#0A0E1A');

const DOME_VERTEX = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DOME_FRAGMENT = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  varying vec3 vWorldPosition;
  void main() {
    float h = clamp(normalize(vWorldPosition).y * 0.5 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
  }
`;

interface NebulaLayer {
  color: string;
  position: [number, number, number];
  scale: [number, number];
  opacity: number;
  /** Slow in-plane rotation, radians per second. */
  drift: number;
}

/** Faint additive sprites: atmosphere, not wallpaper. */
const LAYERS: NebulaLayer[] = [
  {
    color: '#6D5DFC',
    position: [-70, 25, -110],
    scale: [150, 110],
    opacity: 0.16,
    drift: 0.004,
  },
  {
    color: '#2A2160',
    position: [80, -18, -130],
    scale: [190, 140],
    opacity: 0.2,
    drift: -0.003,
  },
  {
    color: '#1FD1C3',
    position: [30, 45, -150],
    scale: [120, 95],
    opacity: 0.09,
    drift: 0.002,
  },
  {
    color: '#B06AB3',
    position: [-30, -55, -100],
    scale: [110, 85],
    opacity: 0.08,
    drift: 0.005,
  },
];

/** Sky dome (vertical gradient, never pure black) plus drifting nebula sprites. */
export function Nebula() {
  const motionScale = useMotionScale();
  const materialRefs = useRef<Array<THREE.SpriteMaterial | null>>([]);

  const domeUniforms = useMemo(
    () => ({
      topColor: { value: GRADIENT_TOP },
      bottomColor: { value: GRADIENT_BOTTOM },
    }),
    [],
  );

  const textures = useMemo(
    () =>
      LAYERS.map((layer) =>
        radialGradientTexture([
          [0, hexWithAlpha(layer.color, 0.55)],
          [0.45, hexWithAlpha(layer.color, 0.18)],
          [1, hexWithAlpha(layer.color, 0)],
        ]),
      ),
    [],
  );
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);

  useFrame((_, delta) => {
    for (let i = 0; i < LAYERS.length; i++) {
      const mat = materialRefs.current[i];
      if (mat) mat.rotation += LAYERS[i].drift * delta * motionScale;
    }
  });

  return (
    <group>
      <mesh raycast={() => null}>
        <sphereGeometry args={[400, 24, 24]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          uniforms={domeUniforms}
          vertexShader={DOME_VERTEX}
          fragmentShader={DOME_FRAGMENT}
        />
      </mesh>

      {LAYERS.map((layer, i) => (
        <sprite
          key={layer.color}
          position={layer.position}
          scale={[layer.scale[0], layer.scale[1], 1]}
          raycast={() => null}
        >
          <spriteMaterial
            ref={(el) => {
              materialRefs.current[i] = el;
            }}
            map={textures[i]}
            transparent
            opacity={layer.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  );
}
