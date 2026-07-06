/** One repository, normalized from either the mock or the GitHub API. */
export interface Repo {
  id: string;
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  /** Primary language name, null when GitHub reports none. */
  language: string | null;
  /** GitHub's hex color for the language, null when unknown. */
  languageColor: string | null;
  /** ISO date string. */
  createdAt: string;
  /** ISO date string of the last push. */
  pushedAt: string;
  isFork: boolean;
  isArchived: boolean;
}

/** A normalized GitHub profile: the single input to galaxy generation. */
export interface Profile {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  followers: number;
  /** ISO date the account was created. */
  createdAt: string;
  repos: Repo[];
}

/**
 * Strategy seam for data. The scene and store depend on this interface,
 * never on fetch or the mock directly, so sources swap freely.
 */
export interface ProfileSource {
  readonly kind: 'mock' | 'github';
  getProfile(login: string): Promise<Profile>;
}
