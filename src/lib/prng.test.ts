import { describe, expect, it } from 'vitest';
import { mulberry32, range, rngFromString, xfnv1a } from './prng';

describe('xfnv1a', () => {
  it('is deterministic for the same string', () => {
    expect(xfnv1a('octocat')).toBe(xfnv1a('octocat'));
  });

  it('differs between strings', () => {
    expect(xfnv1a('octocat')).not.toBe(xfnv1a('octodog'));
  });

  it('returns a 32-bit unsigned integer', () => {
    const h = xfnv1a('anything');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(h)).toBe(true);
  });

  it('handles the empty string', () => {
    expect(xfnv1a('')).toBe(2166136261);
  });
});

describe('mulberry32', () => {
  it('produces an identical sequence for an identical seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('stays in [0, 1)', () => {
    const rng = mulberry32(999);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('rngFromString and range', () => {
  it('same login yields the same draws', () => {
    const a = rngFromString('torvalds');
    const b = rngFromString('torvalds');
    expect(range(a, 0, 10)).toBe(range(b, 0, 10));
  });

  it('range respects bounds', () => {
    const rng = rngFromString('bounds');
    for (let i = 0; i < 500; i++) {
      const v = range(rng, 2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThan(5);
    }
  });
});
