/** Clamp x into the closed range [a, b]. */
export const clamp = (x: number, a: number, b: number): number =>
  Math.min(b, Math.max(a, x));

/** Linear interpolation from a to b by t (t is not clamped). */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Normalized log scale of a value against the max in its set, output 0..1.
 * log1p keeps 0 valid and compresses unbounded metrics (stars, forks, followers)
 * so a 3-star repo and a 40k-star repo both land on a usable visual range.
 */
export const logNorm = (v: number, max: number): number =>
  max <= 0 ? 0 : Math.log1p(Math.max(0, v)) / Math.log1p(max);

/** Mutable 3D point. THREE.Vector3 satisfies this structurally. */
export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Position on a slightly elliptical, inclined orbit, written into `out`
 * to avoid per-frame allocations. The ellipse lies in the XZ plane with
 * semi-axes a and b, then tilts about the X axis by `inclination` radians.
 */
export function orbitPoint(
  a: number,
  b: number,
  angle: number,
  inclination: number,
  out: Point3,
): Point3 {
  const x = a * Math.cos(angle);
  const flat = b * Math.sin(angle);
  out.x = x;
  out.y = flat * Math.sin(inclination);
  out.z = flat * Math.cos(inclination);
  return out;
}
