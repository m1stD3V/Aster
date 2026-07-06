import * as THREE from 'three';

/**
 * Soft radial gradient texture, generated once per mount on a canvas.
 * Used for the star corona and nebula sprites; cheap, resolution
 * independent enough at these blur levels, and fully deterministic.
 */
export function radialGradientTexture(
  stops: ReadonlyArray<readonly [number, string]>,
  size = 256,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [offset, color] of stops) g.addColorStop(offset, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Hex color to an rgba() string with the given alpha, for gradient stops. */
export function hexWithAlpha(hex: string, alpha: number): string {
  const c = new THREE.Color(hex);
  const to255 = (v: number) => Math.round(v * 255);
  return `rgba(${to255(c.r)}, ${to255(c.g)}, ${to255(c.b)}, ${alpha})`;
}

/**
 * RingGeometry with UVs remapped so u runs from the inner to the outer
 * edge. Three's default planar UVs cannot express radial banding.
 */
export function radialRingGeometry(
  inner: number,
  outer: number,
  segments = 96,
): THREE.RingGeometry {
  const geometry = new THREE.RingGeometry(inner, outer, segments, 1);
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.sqrt(x * x + y * y);
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  return geometry;
}

/**
 * Seeded 1D band pattern for planetary rings: layered sine densities,
 * a couple of Cassini-like gaps, and faded edges. Deterministic per rng.
 */
export function ringTexture(rng: () => number): THREE.CanvasTexture {
  const width = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 2;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const f1 = 18 + rng() * 22;
    const f2 = 47 + rng() * 40;
    const p1 = rng() * Math.PI * 2;
    const p2 = rng() * Math.PI * 2;
    const gapA = 0.28 + rng() * 0.2;
    const gapB = 0.62 + rng() * 0.22;
    for (let x = 0; x < width; x++) {
      const t = x / (width - 1);
      let alpha = 0.55 + 0.3 * Math.sin(t * f1 + p1) + 0.2 * Math.sin(t * f2 + p2);
      // Division gaps and soft inner/outer edges.
      const notch = (center: number, width_: number) =>
        1 - Math.exp(-((t - center) ** 2) / (2 * width_ ** 2));
      alpha *= notch(gapA, 0.016) * notch(gapB, 0.01);
      alpha *= Math.min(1, t / 0.06) * Math.min(1, (1 - t) / 0.1);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
      ctx.fillRect(x, 0, 1, 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
