import { describe, expect, it } from 'vitest';
import { restToProfile, restToRepo } from './githubRest';

const REST_REPO = {
  node_id: 'R_abc123',
  name: 'helio',
  description: 'A rendering engine.',
  stargazers_count: 42,
  forks_count: 7,
  language: 'TypeScript',
  created_at: '2020-01-01T00:00:00Z',
  pushed_at: '2026-06-01T00:00:00Z',
  fork: false,
  archived: false,
};

describe('restToRepo', () => {
  it('normalizes a REST repository object', () => {
    const repo = restToRepo(REST_REPO);
    expect(repo).toEqual({
      id: 'R_abc123',
      name: 'helio',
      description: 'A rendering engine.',
      stars: 42,
      forks: 7,
      language: 'TypeScript',
      languageColor: null,
      createdAt: '2020-01-01T00:00:00Z',
      pushedAt: '2026-06-01T00:00:00Z',
      isFork: false,
      isArchived: false,
    });
  });

  it('rejects nodes without a name', () => {
    expect(restToRepo({ stargazers_count: 5 })).toBeNull();
    expect(restToRepo(null)).toBeNull();
    expect(restToRepo('nonsense')).toBeNull();
  });

  it('defaults missing or malformed fields calmly', () => {
    const repo = restToRepo({ name: 'bare' });
    expect(repo).not.toBeNull();
    expect(repo!.stars).toBe(0);
    expect(repo!.language).toBeNull();
    expect(repo!.isFork).toBe(false);
  });
});

describe('restToProfile', () => {
  it('normalizes the user and filters bad repo nodes', () => {
    const profile = restToProfile(
      {
        login: 'octocat',
        name: 'The Octocat',
        avatar_url: 'https://example.test/a.png',
        followers: 99,
        created_at: '2011-01-25T00:00:00Z',
      },
      [REST_REPO, null, { no_name: true }],
      'octocat',
    );
    expect(profile.login).toBe('octocat');
    expect(profile.followers).toBe(99);
    expect(profile.repos).toHaveLength(1);
  });

  it('survives a malformed user object', () => {
    const profile = restToProfile(undefined, [], 'fallback-login');
    expect(profile.login).toBe('fallback-login');
    expect(profile.followers).toBe(0);
    expect(profile.repos).toEqual([]);
  });
});
