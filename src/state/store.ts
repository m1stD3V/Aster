import { create } from 'zustand';
import { createGithubSource, isValidLogin, ProfileError } from '../data/github';
import { createRestSource } from '../data/githubRest';
import { buildGalaxy, type GalaxyModel } from '../data/mapping';
import { MOCK_PROFILE } from '../data/mockProfile';
import type { Profile, ProfileSource } from '../data/types';
import { readGameRecord, writeGameRecord } from '../game/persistence';

export type LoadStatus = 'idle' | 'loading' | 'error';

/** Sentinel selection id for the central star (the profile itself). */
export const STAR_ID = '__you__';

/** One survey mission lasts this long. */
export const MISSION_SECONDS = 90;

export interface MissionResult {
  score: number;
  bestScore: number;
  newBest: boolean;
  surveyedThisRun: number;
  surveyedTotal: number;
  planetCount: number;
}

interface GalaxyState {
  profile: Profile;
  /** Derived once per profile so the scene stays a pure read of state. */
  galaxy: GalaxyModel;
  sourceKind: 'mock' | 'github';
  status: LoadStatus;
  /** Calm inline notice (errors, fallbacks). Null when all is well. */
  message: string | null;
  selectedRepoId: string | null;
  /** 'view' is the observatory; 'flight' hands Discovery to the player. */
  mode: 'view' | 'flight';
  score: number;
  /** Whole seconds remaining, updated at most once per second. */
  secondsLeft: number;
  /** Summary of the last finished mission, shown until dismissed. */
  missionResult: MissionResult | null;
  loadProfile: (login: string) => Promise<void>;
  /** Return to the bundled sample galaxy from a real profile. */
  loadMock: () => void;
  selectRepo: (id: string | null) => void;
  dismissMessage: () => void;
  startMission: () => void;
  collectMote: (value: number) => void;
  tickMission: (secondsLeft: number) => void;
  /** Ends the run, persists best and atlas, and surfaces the summary. */
  endMission: (surveyedRepoIds: string[]) => void;
  dismissMissionResult: () => void;
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
  mode: 'view',
  score: 0,
  secondsLeft: MISSION_SECONDS,
  missionResult: null,

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

  startMission() {
    set({
      mode: 'flight',
      score: 0,
      secondsLeft: MISSION_SECONDS,
      missionResult: null,
      selectedRepoId: null,
    });
  },

  collectMote(value) {
    set((state) => ({ score: state.score + value }));
  },

  tickMission(secondsLeft) {
    set({ secondsLeft });
  },

  endMission(surveyedRepoIds) {
    const { galaxy, score } = get();
    const record = readGameRecord(galaxy.login);
    const surveyedTotal = new Set([...record.surveyedRepoIds, ...surveyedRepoIds]);
    const newBest = score > record.bestScore;
    writeGameRecord(galaxy.login, {
      bestScore: Math.max(score, record.bestScore),
      surveyedRepoIds: [...surveyedTotal],
    });
    set({
      mode: 'view',
      missionResult: {
        score,
        bestScore: Math.max(score, record.bestScore),
        newBest,
        surveyedThisRun: surveyedRepoIds.length,
        surveyedTotal: surveyedTotal.size,
        planetCount: galaxy.planets.length,
      },
    });
  },

  dismissMissionResult() {
    set({ missionResult: null });
  },
}));
