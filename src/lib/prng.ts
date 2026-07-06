/**
 * FNV-1a hash of a string to a 32-bit unsigned seed.
 * Chosen for speed and good avalanche on short strings like logins.
 */
export function xfnv1a(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A deterministic pseudo-random source, drop-in shape for Math.random. */
export type Rng = () => number;

/**
 * mulberry32: tiny, fast, well-distributed 32-bit PRNG.
 * Every procedural draw in the scene goes through this so the same
 * login always produces the same galaxy. Math.random is banned in
 * scene generation for exactly that reason.
 */
export function mulberry32(seed: number): Rng {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience: seeded RNG straight from a string (login). */
export const rngFromString = (str: string): Rng => mulberry32(xfnv1a(str));

/** Draw a value in [min, max) from an rng. */
export const range = (rng: Rng, min: number, max: number): number =>
  min + (max - min) * rng();
