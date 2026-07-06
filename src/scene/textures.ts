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
