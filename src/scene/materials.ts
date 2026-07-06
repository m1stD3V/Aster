import * as THREE from 'three';

/**
 * Procedural shader materials for the realism pass. Everything is
 * computed in-shader from seeds, so surfaces stay deterministic and
 * no texture assets ship. Planets ignore scene lights on purpose:
 * the star sits at the world origin, so the day/night terminator is
 * an analytic dot product, far cheaper than real shadows.
 */

/** Compact value noise plus fbm, shared by the planet and sun shaders. */
const NOISE_GLSL = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }
`;

const SURFACE_VERTEX = /* glsl */ `
  varying vec3 vObjPos;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vObjPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const PLANET_FRAGMENT = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uTint;
  uniform vec3 uAtmosphere;
  uniform float uSeed;
  uniform float uBanded;
  uniform float uEmphasis;
  varying vec3 vObjPos;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  ${NOISE_GLSL}
  void main() {
    // Sample patterns in object space so the surface rotates with the mesh.
    vec3 sp = normalize(vObjPos);
    vec3 seedOff = vec3(uSeed * 13.37, uSeed * 7.7, uSeed * 3.1);

    // Gas giants: latitude bands warped by turbulence.
    float turbulence = fbm(sp * 3.0 + seedOff);
    float bands = sin(sp.y * 14.0 + (turbulence - 0.5) * 5.0) * 0.5 + 0.5;
    bands = mix(bands, fbm(sp * vec3(2.0, 9.0, 2.0) + seedOff), 0.35);
    // Rocky worlds: continents from thresholded fbm.
    float rocky = smoothstep(0.32, 0.72, fbm(sp * 4.5 + seedOff));
    float pattern = mix(rocky, bands, uBanded);

    vec3 dark = uBaseColor * 0.42;
    vec3 light = mix(uBaseColor, uTint, 0.55) * 1.08;
    vec3 surface = mix(dark, light, pattern);
    // Fine grain so close-ups do not read as flat gradients.
    surface *= 0.9 + 0.2 * fbm(sp * 14.0 + seedOff);

    // The star is at the world origin: terminator from a single dot.
    vec3 wn = normalize(vWorldNormal);
    vec3 toStar = normalize(-vWorldPos);
    float diff = clamp((dot(wn, toStar) + 0.12) / 1.12, 0.0, 1.0);
    diff = pow(diff, 1.3);
    vec3 warm = vec3(1.0, 0.88, 0.74);
    vec3 cool = vec3(0.10, 0.14, 0.24);
    vec3 lit = surface * (cool * 0.38 + warm * diff * 1.0);

    // Fresnel atmosphere, strongest where sunlight grazes the limb.
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - clamp(dot(viewDir, wn), 0.0, 1.0), 2.6);
    lit += uAtmosphere * fresnel * (0.2 + 0.8 * diff) * (0.4 + uEmphasis * 0.6);

    // Faint identity glow so the language tint reads on the night side.
    lit += uTint * 0.04 * (1.0 + uEmphasis * 1.5);

    gl_FragColor = vec4(lit, 1.0);
  }
`;

const SUN_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec3 vObjPos;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  ${NOISE_GLSL}
  void main() {
    vec3 sp = normalize(vObjPos);
    // Two drifting octave sets read as slow convective granulation.
    float g1 = fbm(sp * 4.0 + vec3(0.0, uTime * 0.020, uTime * 0.013));
    float g2 = fbm(sp * 9.5 - vec3(uTime * 0.017, 0.0, uTime * 0.011));
    float granulation = 0.74 + 0.34 * g1 + 0.18 * g2;

    // Limb darkening: photospheres dim toward the edge of the disc.
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float ndv = clamp(dot(viewDir, normalize(vWorldNormal)), 0.0, 1.0);
    float limb = 0.42 + 0.58 * pow(ndv, 0.6);

    vec3 core = vec3(1.0, 0.965, 0.90);
    vec3 edge = vec3(1.0, 0.78, 0.50);
    vec3 col = mix(edge, core, pow(ndv, 0.8)) * granulation * limb * uIntensity;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface PlanetMaterialOptions {
  seed: number;
  baseColor: THREE.Color;
  tint: THREE.Color;
  atmosphere: THREE.Color;
  /** 0 = rocky continents, 1 = full gas giant banding. */
  banded: number;
}

export function createPlanetMaterial(opts: PlanetMaterialOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SURFACE_VERTEX,
    fragmentShader: PLANET_FRAGMENT,
    uniforms: {
      uBaseColor: { value: opts.baseColor },
      uTint: { value: opts.tint },
      uAtmosphere: { value: opts.atmosphere },
      uSeed: { value: opts.seed },
      uBanded: { value: opts.banded },
      uEmphasis: { value: 0 },
    },
  });
}

/** HDR sun surface; intensity above 1 is what selective bloom picks up. */
export function createSunMaterial(intensity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SUN_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: intensity },
    },
  });
}
