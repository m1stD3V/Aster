import { readCache, writeCache } from './cache';
import { ProfileError } from './github';
import type { Profile, ProfileSource, Repo } from './types';

/**
 * Anonymous data path via the REST API, which (unlike GraphQL) accepts
 * unauthenticated requests. This is what a public deployment such as
 * GitHub Pages uses, so no token ever ships to the client. Limits are
 * modest (60 core requests per hour per IP, 10 searches per minute);
 * errors explain that calmly and the mock stays on screen.
 */
const REST_BASE = 'https://api.github.com';
const REST_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

const asString = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v : fallback;
const asStringOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const asNumber = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * Adapter: one REST repository object to our Repo type. Exported for
 * unit tests. REST reports the language name but not GitHub's color;
 * the bundled language color table fills that gap at render time.
 */
export function restToRepo(raw: unknown): Repo | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const name = asStringOrNull(r.name);
  if (!name) return null;
  return {
    id: asString(r.node_id, `rest-${name}`),
    name,
    description: asStringOrNull(r.description),
    stars: asNumber(r.stargazers_count),
    forks: asNumber(r.forks_count),
    language: asStringOrNull(r.language),
    languageColor: null,
    createdAt: asString(r.created_at, new Date(0).toISOString()),
    pushedAt: asString(r.pushed_at, asString(r.created_at, new Date(0).toISOString())),
    isFork: r.fork === true,
    isArchived: r.archived === true,
  };
}

/** Adapter: REST user object plus repo list to a normalized Profile. */
export function restToProfile(
  rawUser: unknown,
  rawRepos: unknown[],
  requestedLogin: string,
): Profile {
  const u =
    typeof rawUser === 'object' && rawUser !== null
      ? (rawUser as Record<string, unknown>)
      : {};
  return {
    login: asString(u.login, requestedLogin),
    name: asStringOrNull(u.name),
    avatarUrl: asStringOrNull(u.avatar_url),
    followers: asNumber(u.followers),
    createdAt: asString(u.created_at, new Date(0).toISOString()),
    repos: rawRepos.map(restToRepo).filter((r): r is Repo => r !== null),
  };
}

async function restGet(path: string): Promise<Response> {
  try {
    return await fetch(`${REST_BASE}${path}`, { headers: REST_HEADERS });
  } catch {
    throw new ProfileError('Could not reach GitHub. Check your connection.', 'network');
  }
}

function guardStatus(response: Response, login: string): void {
  if (response.status === 404) {
    throw new ProfileError(`No GitHub user named "${login}".`, 'not-found');
  }
  if (response.status === 403 || response.status === 429) {
    throw new ProfileError(
      'Anonymous GitHub limit reached. Try again in a minute.',
      'rate-limited',
    );
  }
  if (!response.ok) {
    throw new ProfileError(`GitHub returned ${response.status}.`, 'bad-response');
  }
}

export function createRestSource(): ProfileSource {
  const memory = new Map<string, Profile>();

  return {
    kind: 'github',
    async getProfile(login: string): Promise<Profile> {
      const cachedInMemory = memory.get(login);
      if (cachedInMemory) return cachedInMemory;
      const cachedInStorage = readCache(login);
      if (cachedInStorage) {
        memory.set(login, cachedInStorage);
        return cachedInStorage;
      }

      // Two requests: the user, and their top 100 repos by stars via
      // search (mirrors the GraphQL ordering so galaxies match).
      const userResponse = await restGet(`/users/${encodeURIComponent(login)}`);
      guardStatus(userResponse, login);

      const repoResponse = await restGet(
        `/search/repositories?q=${encodeURIComponent(`user:${login}`)}&sort=stars&order=desc&per_page=100`,
      );
      guardStatus(repoResponse, login);

      let rawUser: unknown;
      let rawSearch: unknown;
      try {
        rawUser = await userResponse.json();
        rawSearch = await repoResponse.json();
      } catch {
        throw new ProfileError('GitHub sent an unreadable response.', 'bad-response');
      }

      const items =
        typeof rawSearch === 'object' &&
        rawSearch !== null &&
        Array.isArray((rawSearch as Record<string, unknown>).items)
          ? ((rawSearch as Record<string, unknown>).items as unknown[])
          : [];

      const profile = restToProfile(rawUser, items, login);
      memory.set(login, profile);
      writeCache(login, profile);
      return profile;
    },
  };
}
