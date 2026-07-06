import { create } from 'zustand';
import { createGithubSource, isValidLogin, ProfileError } from '../data/github';
import { createRestSource } from '../data/githubRest';
import { buildGalaxy, type GalaxyModel } from '../data/mapping';
import { MOCK_PROFILE } from '../data/mockProfile';
import type { Profile, ProfileSource } from '../data/types';

export type LoadStatus = 'idle' | 'loading' | 'error';

/** Sentinel selection id for the central star (the profile itself). */
export const STAR_ID = '__you__';

interface GalaxyState {
  profile: Profile;
  /** Derived once per profile so the scene stays a pure read of state. */
  galaxy: GalaxyModel;
  sourceKind: 'mock' | 'github';
  status: LoadStatus;
  /** Calm inline notice (errors, fallbacks). Null when all is well. */
  message: string | null;
  selectedRepoId: string | null;
  loadProfile: (login: string) => Promise<void>;
  /** Return to the bundled sample galaxy from a real profile. */
  loadMock: () => void;
  selectRepo: (id: string | null) => void;
  dismissMessage: () => void;
}

/**
 * Strategy selection: a configured token gets the GraphQL source
 * (higher limits, GitHub's language colors); otherwise the anonymous
 * REST source, which is what public deployments use so no token ever
 * ships to the client. Dependency inversion: the store talks to
 * ProfileSource, never to fetch directly.
 */
const token: string | undefined = import.meta.env.VITE_GITHUB_TOKEN;
const githubSource: ProfileSource = token ? createGithubSource(token) : createRestSource();

export const useGalaxyStore = create<GalaxyState>((set, get) => ({
  profile: MOCK_PROFILE,
  galaxy: buildGalaxy(MOCK_PROFILE),
  sourceKind: 'mock',
  status: 'idle',
  message: null,
  selectedRepoId: null,

  async loadProfile(login: string) {
    const trimmed = login.trim();
    if (!isValidLogin(trimmed)) {
      set({ message: 'That does not look like a GitHub username.', status: 'error' });
      return;
    }
    set({ status: 'loading', message: null, selectedRepoId: null });
    try {
      const profile = await githubSource.getProfile(trimmed);
      if (profile.repos.length === 0) {
        set({
          profile,
          galaxy: buildGalaxy(profile),
          sourceKind: 'github',
          status: 'idle',
          message: 'This account has no public repositories yet.',
        });
        return;
      }
      set({
        profile,
        galaxy: buildGalaxy(profile),
        sourceKind: 'github',
        status: 'idle',
        message: null,
      });
    } catch (err) {
      // Degrade calmly: report why, keep whatever galaxy is on screen.
      const message =
        err instanceof ProfileError
          ? err.message
          : 'Something went wrong loading that profile.';
      set({ status: 'error', message });
      if (get().sourceKind !== 'mock' && get().profile.repos.length === 0) {
        set({
          profile: MOCK_PROFILE,
          galaxy: buildGalaxy(MOCK_PROFILE),
          sourceKind: 'mock',
        });
      }
    }
  },

  loadMock() {
    set({
      profile: MOCK_PROFILE,
      galaxy: buildGalaxy(MOCK_PROFILE),
      sourceKind: 'mock',
      status: 'idle',
      message: null,
      selectedRepoId: null,
    });
  },

  selectRepo(id) {
    set({ selectedRepoId: id });
  },

  dismissMessage() {
    set({ message: null });
  },
}));
