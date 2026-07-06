import type { GalaxyModel } from '../data/mapping';
import { clamp } from '../lib/math';
import { range, rngFromString } from '../lib/prng';

/**
 * Stardust motes: the harvest of a survey mission. Each planet emits
 * motes in a loose shell around it; the count is driven by the repo's
 * recent push activity plus a little size, so an actively developed
 * repo is a rich field and a dormant one is barren. That is the core
 * loop: shipping code raises the score ceiling of your own galaxy.
 */

export interface Mote {
  /** The planet (repo) this mote belongs to, for the survey atlas. */
  repoId: string;
  /** Offset from the planet's center, fixed in the planet's frame. */
  offset: [number, number, number];
  /** Score value; activity makes motes worth more too. */
  value: number;
}

const BASE_MOTES = 2;
const ACTIVITY_MOTES = 8;
const SIZE_MOTES = 3;
export const MAX_MOTES_PER_PLANET = BASE_MOTES + ACTIVITY_MOTES + SIZE_MOTES;

/** Deterministic per login: the same galaxy offers the same course. */
export function motesForGalaxy(galaxy: GalaxyModel): Mote[] {
  const motes: Mote[] = [];
  for (const planet of galaxy.planets) {
    const rng = rngFromString(`${galaxy.login}/${planet.repoId}:motes`);
    const count = Math.round(
      BASE_MOTES +
        planet.activity * ACTIVITY_MOTES +
        clamp(planet.radius / 1.15, 0, 1) * SIZE_MOTES,
    );
    const shellInner = planet.clearance + 0.6;
    for (let i = 0; i < count; i++) {
      // Loose shell just outside the planet's envelope so grabbing a
      // mote means a genuine close flyby, rings and moons dodged.
      const theta = range(rng, 0, Math.PI * 2);
      const y = range(rng, -0.45, 0.45);
      const flat = Math.sqrt(Math.max(0, 1 - y * y));
      const r = shellInner + range(rng, 0, 1.6);
      motes.push({
        repoId: planet.repoId,
        offset: [flat * Math.cos(theta) * r, y * r, flat * Math.sin(theta) * r],
        value: planet.activity > 0.3 ? 2 : 1,
      });
    }
  }
  return motes;
}

/** Perfect-run score for the mission summary. */
export function maxScore(motes: Mote[]): number {
  return motes.reduce((sum, m) => sum + m.value, 0);
}
