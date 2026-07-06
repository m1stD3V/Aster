import type { Profile } from './types';

const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_PREFIX = 'galaxy:profile:';

interface CacheEntry {
  savedAt: number;
  profile: Profile;
}

/** localStorage can throw (private mode, quota); treat it as best-effort. */
export function readCache(login: string): Profile | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + login);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry.profile || Date.now() - entry.savedAt > CACHE_TTL_MS) return null;
    return entry.profile;
  } catch {
    return null;
  }
}

export function writeCache(login: string, profile: Profile): void {
  try {
    const entry: CacheEntry = { savedAt: Date.now(), profile };
    localStorage.setItem(CACHE_PREFIX + login, JSON.stringify(entry));
  } catch {
    // Best-effort cache; ignore storage failures.
  }
}
