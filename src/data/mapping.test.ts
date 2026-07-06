import { describe, expect, it } from 'vitest';
import { buildGalaxy, DEFAULT_MAPPING } from './mapping';
import { MOCK_PROFILE } from './mockProfile';
import type { Profile, Repo } from './types';

const FIXED_NOW = new Date('2026-07-01T00:00:00Z').getTime();

function makeRepo(overrides: Partial<Repo> & { id: string }): Repo {
  return {
    name: overrides.id,
    description: null,
    stars: 0,
    forks: 0,
    language: null,
    languageColor: null,
    createdAt: '2020-01-01T00:00:00Z',
    pushedAt: '2020-01-01T00:00:00Z',
    isFork: false,
    isArchived: false,
    ...overrides,
  };
}

function makeProfile(repos: Repo[], followers = 100): Profile {
  return {
    login: 'test-user',
    name: null,
    avatarUrl: null,
    followers,
    createdAt: '2015-01-01T00:00:00Z',
    repos,
  };
}

describe('buildGalaxy determinism', () => {
  it('identical input yields identical output', () => {
    const a = buildGalaxy(MOCK_PROFILE, DEFAULT_MAPPING, FIXED_NOW);
    const b = buildGalaxy(MOCK_PROFILE, DEFAULT_MAPPING, FIXED_NOW);
    expect(a).toEqual(b);
  });

  it('different logins produce different layouts', () => {
    const other = { ...MOCK_PROFILE, login: 'someone-else' };
    const a = buildGalaxy(MOCK_PROFILE, DEFAULT_MAPPING, FIXED_NOW);
    const b = buildGalaxy(other, DEFAULT_MAPPING, FIXED_NOW);
    expect(a.planets[0].initialAngle).not.toBe(b.planets[0].initialAngle);
  });
});

describe('buildGalaxy filtering and capping', () => {
  it('excludes forks and archived repos by default', () => {
    const profile = makeProfile([
      makeRepo({ id: 'own', stars: 10 }),
      makeRepo({ id: 'forked', stars: 50, isFork: true }),
      makeRepo({ id: 'old', stars: 50, isArchived: true }),
    ]);
    const galaxy = buildGalaxy(profile, DEFAULT_MAPPING, FIXED_NOW);
    expect(galaxy.planets.map((p) => p.repoId)).toEqual(['own']);
  });

  it('includes forks and archived when configured', () => {
    const profile = makeProfile([
      makeRepo({ id: 'own', stars: 10 }),
      makeRepo({ id: 'forked', stars: 50, isFork: true }),
    ]);
    const galaxy = buildGalaxy(
      profile,
      { ...DEFAULT_MAPPING, includeForks: true },
      FIXED_NOW,
    );
    expect(galaxy.planets).toHaveLength(2);
  });

  it('caps planets and demotes the tail to specks', () => {
    const repos = Array.from({ length: 80 }, (_, i) =>
      makeRepo({ id: `repo-${i}`, stars: 1000 - i }),
    );
    const galaxy = buildGalaxy(makeProfile(repos), DEFAULT_MAPPING, FIXED_NOW);
    expect(galaxy.planets).toHaveLength(DEFAULT_MAPPING.maxPlanets);
    expect(galaxy.specks).toHaveLength(80 - DEFAULT_MAPPING.maxPlanets);
    // Specks sit beyond every planet orbit.
    for (const speck of galaxy.specks) {
      expect(speck.orbitRadius).toBeGreaterThan(galaxy.maxOrbit);
    }
  });
});

describe('buildGalaxy metric mapping', () => {
  it('scales planet radius with stars and floors tiny repos', () => {
    const profile = makeProfile([
      makeRepo({ id: 'big', stars: 5000 }),
      makeRepo({ id: 'tiny', stars: 0 }),
    ]);
    const galaxy = buildGalaxy(profile, DEFAULT_MAPPING, FIXED_NOW);
    const big = galaxy.planets.find((p) => p.repoId === 'big');
    const tiny = galaxy.planets.find((p) => p.repoId === 'tiny');
    expect(big).toBeDefined();
    expect(tiny).toBeDefined();
    expect(big!.radius).toBeCloseTo(DEFAULT_MAPPING.maxPlanetRadius);
    expect(tiny!.radius).toBe(DEFAULT_MAPPING.minPlanetRadius);
  });

  it('clamps moons to the configured max', () => {
    const profile = makeProfile([
      makeRepo({ id: 'popular', stars: 100, forks: 9000 }),
      makeRepo({ id: 'quiet', stars: 5, forks: 0 }),
    ]);
    const galaxy = buildGalaxy(profile, DEFAULT_MAPPING, FIXED_NOW);
    const popular = galaxy.planets.find((p) => p.repoId === 'popular');
    const quiet = galaxy.planets.find((p) => p.repoId === 'quiet');
    expect(popular!.moons).toHaveLength(DEFAULT_MAPPING.maxMoons);
    expect(quiet!.moons).toHaveLength(0);
  });

  it('gives rings to the top-starred repos only', () => {
    const galaxy = buildGalaxy(MOCK_PROFILE, DEFAULT_MAPPING, FIXED_NOW);
    const helio = galaxy.planets.find((p) => p.name === 'helio');
    const sandbox = galaxy.planets.find((p) => p.name === 'sandbox-2026');
    expect(helio!.ring).not.toBeNull();
    expect(sandbox!.ring).toBeNull();
  });

  it('orbits newer repos closer to the star', () => {
    const profile = makeProfile([
      makeRepo({ id: 'ancient', stars: 10, createdAt: '2016-01-01T00:00:00Z' }),
      makeRepo({ id: 'fresh', stars: 10, createdAt: '2026-01-01T00:00:00Z' }),
    ]);
    const galaxy = buildGalaxy(profile, DEFAULT_MAPPING, FIXED_NOW);
    const ancient = galaxy.planets.find((p) => p.repoId === 'ancient');
    const fresh = galaxy.planets.find((p) => p.repoId === 'fresh');
    expect(fresh!.orbitA).toBeLessThan(ancient!.orbitA);
  });

  it('marks sparse profiles as young systems', () => {
    const young = buildGalaxy(
      makeProfile([makeRepo({ id: 'only', stars: 2 })]),
      DEFAULT_MAPPING,
      FIXED_NOW,
    );
    expect(young.isYoungSystem).toBe(true);
    const grown = buildGalaxy(MOCK_PROFILE, DEFAULT_MAPPING, FIXED_NOW);
    expect(grown.isYoungSystem).toBe(false);
  });

  it('handles an empty repo list without planets or NaN', () => {
    const galaxy = buildGalaxy(makeProfile([], 0), DEFAULT_MAPPING, FIXED_NOW);
    expect(galaxy.planets).toHaveLength(0);
    expect(galaxy.isYoungSystem).toBe(true);
    expect(Number.isFinite(galaxy.starRadius)).toBe(true);
    expect(Number.isFinite(galaxy.backgroundStarCount)).toBe(true);
  });

  it('keeps planet emissive under the bloom threshold', () => {
    const galaxy = buildGalaxy(MOCK_PROFILE, DEFAULT_MAPPING, FIXED_NOW);
    for (const planet of galaxy.planets) {
      expect(planet.emissiveIntensity).toBeLessThan(0.75);
    }
    expect(galaxy.starIntensity).toBeGreaterThan(1);
  });
});
