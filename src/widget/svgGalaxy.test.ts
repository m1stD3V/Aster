import { describe, expect, it } from 'vitest';
import { MOCK_PROFILE } from '../data/mockProfile';
import { galaxySvg, mixHex } from './svgGalaxy';

const FIXED_NOW = new Date('2026-07-01T00:00:00Z').getTime();

describe('mixHex', () => {
  it('mixes endpoints and midpoints', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('expands shorthand hex', () => {
    expect(mixHex('#fff', '#fff', 0.5)).toBe('#ffffff');
  });
});

describe('galaxySvg', () => {
  it('is deterministic: identical input, identical markup', () => {
    expect(galaxySvg(MOCK_PROFILE, FIXED_NOW)).toBe(galaxySvg(MOCK_PROFILE, FIXED_NOW));
  });

  it('renders one animated group per planet', () => {
    const svg = galaxySvg(MOCK_PROFILE, FIXED_NOW);
    const planetCount = MOCK_PROFILE.repos.filter((r) => !r.isFork && !r.isArchived).length;
    expect(svg.match(/<mpath href="#orbit/g)).toHaveLength(planetCount);
    expect(svg).toContain('animateMotion');
    expect(svg).toContain(`@${MOCK_PROFILE.login}`);
  });

  it('produces valid finite geometry (no NaN) even for empty profiles', () => {
    const empty = { ...MOCK_PROFILE, repos: [], followers: 0 };
    const svg = galaxySvg(empty, FIXED_NOW);
    expect(svg).not.toContain('NaN');
    expect(svg).toContain('<svg');
  });

  it('escapes markup-sensitive characters in the login', () => {
    const hostile = { ...MOCK_PROFILE, login: 'a<b&c' };
    const svg = galaxySvg(hostile, FIXED_NOW);
    expect(svg).not.toContain('a<b');
    expect(svg).toContain('a&lt;b&amp;c');
  });
});
