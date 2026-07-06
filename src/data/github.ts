import { readCache, writeCache } from './cache';
import { PROFILE_QUERY } from './query';
import type { Profile, ProfileSource, Repo } from './types';

const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';

/** Calm, user-facing failures. The store shows `message` inline and keeps the mock. */
export class ProfileError extends Error {
  constructor(
    message: string,
    readonly reason: 'not-found' | 'rate-limited' | 'network' | 'bad-response',
  ) {
    super(message);
    this.name = 'ProfileError';
  }
}

/** Shape of the GraphQL response, kept loose and guarded field by field. */
interface GraphQLUser {
  login?: unknown;
  name?: unknown;
  avatarUrl?: unknown;
  createdAt?: unknown;
  followers?: { totalCount?: unknown };
  repositories?: { nodes?: unknown };
}

interface GraphQLResponse {
  data?: { user?: GraphQLUser | null };
  errors?: Array<{ type?: string; message?: string }>;
}

const asString = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v : fallback;
const asStringOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const asNumber = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * Adapter: normalize one GraphQL repository node into our Repo type.
 * Returns null for nodes too malformed to render rather than throwing,
 * so one bad node never sinks the whole galaxy.
 */
function toRepo(node: unknown): Repo | null {
  if (typeof node !== 'object' || node === null) return null;
  const n = node as Record<string, unknown>;
  const name = asStringOrNull(n.name);
  if (!name) return null;
  const lang =
    typeof n.primaryLanguage === 'object' && n.primaryLanguage !== null
      ? (n.primaryLanguage as Record<string, unknown>)
      : null;
  return {
    id: asString(n.id, `repo-${name}`),
    name,
    description: asStringOrNull(n.description),
    stars: asNumber(n.stargazerCount),
    forks: asNumber(n.forkCount),
    language: lang ? asStringOrNull(lang.name) : null,
    languageColor: lang ? asStringOrNull(lang.color) : null,
    createdAt: asString(n.createdAt, new Date(0).toISOString()),
    pushedAt: asString(n.pushedAt, asString(n.createdAt, new Date(0).toISOString())),
    isFork: n.isFork === true,
    isArchived: n.isArchived === true,
  };
}

function toProfile(user: GraphQLUser, requestedLogin: string): Profile {
  const nodes = Array.isArray(user.repositories?.nodes) ? user.repositories.nodes : [];
  return {
    login: asString(user.login, requestedLogin),
    name: asStringOrNull(user.name),
    avatarUrl: asStringOrNull(user.avatarUrl),
    followers: asNumber(user.followers?.totalCount),
    createdAt: asString(user.createdAt, new Date(0).toISOString()),
    repos: nodes.map(toRepo).filter((r): r is Repo => r !== null),
  };
}

/**
 * Token-backed data path via GraphQL: one request, generous rate limits,
 * and GitHub's own language colors. Used automatically when a token is
 * configured; public deployments use the anonymous REST source instead
 * (see githubRest.ts). Results are cached in memory and localStorage
 * for 30 minutes so interactions never refetch.
 */
export function createGithubSource(token: string): ProfileSource {
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

      let response: Response;
      try {
        response = await fetch(GRAPHQL_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: PROFILE_QUERY, variables: { login } }),
        });
      } catch {
        throw new ProfileError('Could not reach GitHub. Check your connection.', 'network');
      }

      if (response.status === 401) {
        throw new ProfileError('GitHub rejected the token in .env.', 'bad-response');
      }
      if (response.status === 403 || response.status === 429) {
        throw new ProfileError(
          'GitHub rate limit reached. Try again later.',
          'rate-limited',
        );
      }
      if (!response.ok) {
        throw new ProfileError(`GitHub returned ${response.status}.`, 'bad-response');
      }

      let body: GraphQLResponse;
      try {
        body = (await response.json()) as GraphQLResponse;
      } catch {
        throw new ProfileError('GitHub sent an unreadable response.', 'bad-response');
      }

      if (body.errors?.some((e) => e.type === 'RATE_LIMITED')) {
        throw new ProfileError(
          'GitHub rate limit reached. Try again later.',
          'rate-limited',
        );
      }
      const user = body.data?.user;
      if (!user) {
        throw new ProfileError(`No GitHub user named "${login}".`, 'not-found');
      }

      const profile = toProfile(user, login);
      memory.set(login, profile);
      writeCache(login, profile);
      return profile;
    },
  };
}

/** GitHub logins: alphanumerics and single hyphens, max 39 chars. */
export function isValidLogin(login: string): boolean {
  return /^[a-zA-Z0-9](?:-?[a-zA-Z0-9]){0,38}$/.test(login);
}
