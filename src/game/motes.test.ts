import { describe, expect, it } from 'vitest';
import { buildGalaxy, DEFAULT_MAPPING } from '../data/mapping';
import { MOCK_PROFILE } from '../data/mockProfile';
import { MAX_MOTES_PER_PLANET, maxScore, motesForGalaxy } from './motes';

const FIXED_NOW = new Date('2026-07-01T00:00:00Z').getTime();
const GALAXY = buildGalaxy(MOCK_PROFILE, DEFAULT_MAPPING, FIXED_NOW);

describe('motesForGalaxy', () => {
  it('is deterministic for the same galaxy', () => {
    expect(motesForGalaxy(GALAXY)).toEqual(motesForGalaxy(GALAXY));
  });

  it('gives active repos richer fields than dormant ones', () => {
    const motes = motesForGalaxy(GALAXY);
    const perPlanet = new Map<string, number>();
    for (const mote of motes) {
      perPlanet.set(mote.repoId, (perPlanet.get(mote.repoId) ?? 0) + 1);
    }
    const active = GALAXY.planets.find((p) => p.activity > 0.7);
    const dormant = GALAXY.planets.find((p) => p.activity === 0);
    expect(active).toBeDefined();
    expect(dormant).toBeDefined();
    expect(perPlanet.get(active!.repoId)!).toBeGreaterThan(perPlanet.get(dormant!.repoId)!);
    for (const count of perPlanet.values()) {
      expect(count).toBeLessThanOrEqual(MAX_MOTES_PER_PLANET);
      expect(count).toBeGreaterThan(0);
    }
  });

  it("spawns motes outside each planet's clearance envelope", () => {
    const motes = motesForGalaxy(GALAXY);
    const byId = new Map(GALAXY.planets.map((p) => [p.repoId, p]));
    for (const mote of motes) {
      const planet = byId.get(mote.repoId)!;
      const distance = Math.hypot(...mote.offset);
      expect(distance).toBeGreaterThan(planet.clearance);
    }
  });

  it('values active motes higher and sums a sane max score', () => {
    const motes = motesForGalaxy(GALAXY);
    expect(motes.some((m) => m.value === 2)).toBe(true);
    expect(motes.some((m) => m.value === 1)).toBe(true);
    expect(maxScore(motes)).toBeGreaterThan(motes.length);
  });

  it('handles an empty galaxy', () => {
    const empty = buildGalaxy({ ...MOCK_PROFILE, repos: [] }, DEFAULT_MAPPING, FIXED_NOW);
    expect(motesForGalaxy(empty)).toEqual([]);
    expect(maxScore([])).toBe(0);
  });
});
