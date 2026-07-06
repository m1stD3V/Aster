import { clamp, lerp, logNorm } from '../lib/math';
import { range, rngFromString } from '../lib/prng';
import { languageColor } from './languageColors';
import type { Profile, Repo } from './types';

/**
 * Tunable mapping rules. New metric-to-visual behavior should land here
 * as config and data, not as edits to render code (Open/Closed).
 */
export interface MappingConfig {
  includeForks: boolean;
  includeArchived: boolean;
  /** Hard cap on full planets; the long tail becomes distant specks. */
  maxPlanets: number;
  minPlanetRadius: number;
  maxPlanetRadius: number;
  /** Distance of the newest repo's orbit from the star. */
  innerOrbit: number;
  /** Spacing between consecutive orbits. */
  orbitGap: number;
  /** Star-normalized threshold (0..1) above which a planet earns rings. */
  ringThreshold: number;
  maxMoons: number;
}

export const DEFAULT_MAPPING: MappingConfig = {
  includeForks: false,
  includeArchived: false,
  maxPlanets: 60,
  minPlanetRadius: 0.42,
  maxPlanetRadius: 1.5,
  innerOrbit: 6,
  orbitGap: 2.4,
  ringThreshold: 0.58,
  maxMoons: 5,
};

/**
 * Followers have no in-profile max to normalize against, so the central
 * star scales against a fixed reference. 25k followers is "very large"
 * on GitHub; log scaling keeps small counts visible.
 */
const FOLLOWER_REFERENCE_MAX = 25_000;

export interface MoonParams {
  size: number;
  orbitRadius: number;
  /** Radians per second around the parent planet. */
  speed: number;
  phase: number;
  inclination: number;
}

export interface RingParams {
  innerRadius: number;
  outerRadius: number;
  opacity: number;
  inclination: number;
}

export interface PlanetParams {
  repoId: string;
  name: string;
  radius: number;
  /** Ellipse semi-axes; b slightly under a for a subtle non-circular feel. */
  orbitA: number;
  orbitB: number;
  inclination: number;
  initialAngle: number;
  /** Radians per second around the star. */
  orbitSpeed: number;
  /** Radians per second of self-rotation. */
  spinSpeed: number;
  /** Language tint (hex). */
  color: string;
  /** Faint inner glow; stays under the bloom threshold. */
  emissiveIntensity: number;
  ring: RingParams | null;
  moons: MoonParams[];
}

/** A long-tail repo rendered as a faint distant point, not a full planet. */
export interface SpeckParams {
  repoId: string;
  orbitRadius: number;
  angle: number;
  y: number;
}

export interface GalaxyModel {
  login: string;
  starRadius: number;
  /** Emissive intensity above 1 so selective bloom lifts the star. */
  starIntensity: number;
  backgroundStarCount: number;
  planets: PlanetParams[];
  specks: SpeckParams[];
  /** Outermost planet orbit, used for camera framing and speck placement. */
  maxOrbit: number;
  /** Few repos: frame tight and caption the scene instead of a barren wide shot. */
  isYoungSystem: boolean;
}

/** Base angular speed; divided by sqrt(orbit) for a Kepler-like falloff. */
const BASE_ORBIT_SPEED = 0.16;

function buildMoons(
  repo: Repo,
  maxForks: number,
  planetRadius: number,
  config: MappingConfig,
  rng: () => number,
): MoonParams[] {
  // Forks are derivatives of the repo, so moons (derivatives of the planet)
  // are the natural read. Log-normalized against the profile's fork max.
  const count = clamp(
    Math.round(logNorm(repo.forks, maxForks) * config.maxMoons),
    0,
    config.maxMoons,
  );
  const moons: MoonParams[] = [];
  for (let i = 0; i < count; i++) {
    moons.push({
      // Kept small and tight so a five-moon planet reads as attended,
      // not cluttered.
      size: planetRadius * range(rng, 0.09, 0.15),
      orbitRadius: planetRadius * (1.75 + i * 0.5) + range(rng, 0, 0.2),
      speed: range(rng, 0.35, 0.9),
      phase: range(rng, 0, Math.PI * 2),
      inclination: range(rng, -0.6, 0.6),
    });
  }
  return moons;
}

/**
 * Pure galaxy generation: identical Profile in, identical model out.
 * Every random draw is seeded from login plus repo name, so a repo keeps
 * its orbit character even if the surrounding set changes slightly.
 * `now` is injectable for tests; it only affects background star density
 * and is quantized to whole years so reloads stay stable.
 */
export function buildGalaxy(
  profile: Profile,
  config: MappingConfig = DEFAULT_MAPPING,
  now: number = Date.now(),
): GalaxyModel {
  const candidates = profile.repos.filter(
    (r) => (config.includeForks || !r.isFork) && (config.includeArchived || !r.isArchived),
  );

  // Top repos by stars become planets; the long tail becomes specks so
  // huge accounts stay performant and readable.
  const byStars = [...candidates].sort((a, b) => b.stars - a.stars);
  const planetRepos = byStars.slice(0, config.maxPlanets);
  const tailRepos = byStars.slice(config.maxPlanets);

  const maxStars = planetRepos.reduce((m, r) => Math.max(m, r.stars), 0);
  const maxForks = planetRepos.reduce((m, r) => Math.max(m, r.forks), 0);

  // Age maps to orbital distance: newest repos orbit close in, the oldest
  // form the legacy rim, so the galaxy reads chronologically from center out.
  // Rank order (not raw dates) guarantees even spacing with no collisions.
  const byAge = [...planetRepos].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const orbitIndex = new Map(byAge.map((r, i) => [r.id, i]));

  const planets: PlanetParams[] = planetRepos.map((repo) => {
    const rng = rngFromString(`${profile.login}/${repo.name}`);
    const starNorm = logNorm(repo.stars, maxStars);
    const radius = Math.max(
      config.minPlanetRadius,
      lerp(config.minPlanetRadius, config.maxPlanetRadius, starNorm),
    );
    const orbitA =
      config.innerOrbit +
      (orbitIndex.get(repo.id) ?? 0) * config.orbitGap +
      range(rng, -0.35, 0.35);
    const hasRings = starNorm > config.ringThreshold && repo.stars >= 20;

    return {
      repoId: repo.id,
      name: repo.name,
      radius,
      orbitA,
      orbitB: orbitA * range(rng, 0.95, 1.0),
      inclination: range(rng, -0.22, 0.22),
      initialAngle: range(rng, 0, Math.PI * 2),
      orbitSpeed: (BASE_ORBIT_SPEED / Math.sqrt(orbitA)) * range(rng, 0.85, 1.15),
      spinSpeed: range(rng, 0.06, 0.28),
      color: languageColor(repo.language, repo.languageColor),
      // Brightness follows stars but stays well under the bloom threshold
      // so planets read as solid matte bodies, not light sources.
      emissiveIntensity: lerp(0.08, 0.38, starNorm),
      ring: hasRings
        ? {
            // Thin and translucent per the style bible; density and
            // brightness still rise with stars, just quietly.
            innerRadius: radius * 1.65,
            outerRadius: radius * lerp(2.05, 2.35, starNorm),
            opacity: lerp(0.1, 0.26, starNorm),
            inclination: range(rng, -0.5, 0.5),
          }
        : null,
      moons: buildMoons(repo, maxForks, radius, config, rng),
    };
  });

  const maxOrbit = planets.reduce((m, p) => Math.max(m, p.orbitA), config.innerOrbit);

  const specks: SpeckParams[] = tailRepos.map((repo) => {
    const rng = rngFromString(`${profile.login}/${repo.name}`);
    return {
      repoId: repo.id,
      orbitRadius: maxOrbit + range(rng, 1.5, 7),
      angle: range(rng, 0, Math.PI * 2),
      y: range(rng, -1.2, 1.2),
    };
  });

  const followerNorm = logNorm(profile.followers, FOLLOWER_REFERENCE_MAX);
  const isYoungSystem = planets.length <= 3;

  // Older accounts get denser background skies. Quantizing age to whole
  // years keeps the count stable across reloads within a year.
  const accountYears = Math.max(
    0,
    Math.floor((now - new Date(profile.createdAt).getTime()) / (365.25 * 86_400_000)),
  );
  const backgroundStarCount = Math.round(
    clamp(1400 + accountYears * 130 + candidates.length * 8, 1400, 3200),
  );

  return {
    login: profile.login,
    // A young system's star grows slightly so a sparse scene still has
    // a strong protagonist.
    starRadius: lerp(1.5, 2.6, followerNorm) + (isYoungSystem ? 0.2 : 0),
    starIntensity: lerp(1.9, 3.1, followerNorm),
    backgroundStarCount,
    planets,
    specks,
    maxOrbit,
    isYoungSystem,
  };
}
