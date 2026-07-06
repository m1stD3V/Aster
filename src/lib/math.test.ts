import { describe, expect, it } from 'vitest';
import { clamp, lerp, logNorm, orbitPoint } from './math';

describe('clamp', () => {
  it('clamps below, inside, and above', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('lerp', () => {
  it('interpolates endpoints and midpoint', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

describe('logNorm', () => {
  it('returns 0 when max is 0 or negative', () => {
    expect(logNorm(5, 0)).toBe(0);
    expect(logNorm(5, -3)).toBe(0);
  });

  it('maps 0 to 0 and max to 1', () => {
    expect(logNorm(0, 100)).toBe(0);
    expect(logNorm(100, 100)).toBe(1);
  });

  it('compresses large values: half the max maps well above 0.5', () => {
    expect(logNorm(50, 100)).toBeGreaterThan(0.5);
    expect(logNorm(50, 100)).toBeLessThan(1);
  });

  it('treats negative values as 0', () => {
    expect(logNorm(-10, 100)).toBe(0);
  });
});

describe('orbitPoint', () => {
  it('starts on the positive x axis at angle 0', () => {
    const p = orbitPoint(10, 8, 0, 0.3, { x: 0, y: 0, z: 0 });
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(0);
  });

  it('inclination tilts the flat component into y', () => {
    const flat = orbitPoint(10, 10, Math.PI / 2, 0, { x: 0, y: 0, z: 0 });
    expect(flat.y).toBeCloseTo(0);
    expect(flat.z).toBeCloseTo(10);

    const tilted = orbitPoint(10, 10, Math.PI / 2, Math.PI / 2, { x: 0, y: 0, z: 0 });
    expect(tilted.y).toBeCloseTo(10);
    expect(tilted.z).toBeCloseTo(0);
  });

  it('writes into and returns the provided output object', () => {
    const out = { x: 0, y: 0, z: 0 };
    expect(orbitPoint(5, 5, 1, 0, out)).toBe(out);
  });
});
