import { create } from 'zustand';
import { momaskClient } from '../api/momaskClient';
import { createDeterministicRollout, demoRollouts } from '../data/demoMotions';
import { hiddenEpisodes } from '../data/hiddenEpisodes';
import type { ExperimentState, Rollout } from '../types';

type ExperimentActions = {
  selectRollout: (id: string) => void;
  rollHiddenEpisode: () => void;
  runRollout: (span?: [number, number]) => Promise<Rollout>;
  submitBest: () => Rollout;
  togglePlayback: () => void;
  setPlaybackTime: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  resetPlayback: () => void;
  setRenderer: (renderer: ExperimentState['renderer']) => void;
  setWebMcp: (webmcp: ExperimentState['webmcp']) => void;
  clearError: () => void;
};

export type ExperimentStore = ExperimentState & ExperimentActions;

const initialState: ExperimentState = {
  episodeId: 'arena-7fd1c2a4',
  episodeIndex: 0,
  instruction: hiddenEpisodes[0]?.caption ?? 'A person makes several forward jumps, then turns around.',
  groundTruth: hiddenEpisodes[0]?.groundTruth ?? {
    id: 'cmu-01-01', label: 'Hidden CMU motion', url: '/motions/cmu-playground/01_01.bvh', variant: 1, source: 'bvh',
  },
  hiddenSpan: [0.31, 0.7],
  duration: 8,
  budgetTotal: 12,
  budgetRemaining: 8,
  rollouts: demoRollouts,
  selectedRolloutId: demoRollouts.at(-1)?.id ?? 'r01',
  bestRolloutId: demoRollouts.at(-1)?.id ?? 'r01',
  status: 'ready',
  playback: { playing: true, time: 0, speed: 1 },
  renderer: 'checking',
  webmcp: 'checking',
  error: null,
};

const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export const useExperimentStore = create<ExperimentStore>((set, get) => ({
  ...initialState,

  selectRollout: (id) => {
    if (get().rollouts.some((rollout) => rollout.id === id)) {
      set((state) => ({ selectedRolloutId: id, playback: { ...state.playback, time: 0 } }));
    }
  },

  rollHiddenEpisode: () => {
    const state = get();
    if (hiddenEpisodes.length < 2) return;
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const offset = 1 + ((random[0] ?? 0) % (hiddenEpisodes.length - 1));
    const episodeIndex = (state.episodeIndex + offset) % hiddenEpisodes.length;
    const episode = hiddenEpisodes[episodeIndex];
    if (!episode) return;
    const rollouts = demoRollouts.map((rollout) => ({ ...rollout, timestamp: new Date().toISOString() }));
    set({
      episodeId: `arena-${crypto.randomUUID().slice(0, 8)}`,
      episodeIndex,
      instruction: episode.caption,
      groundTruth: episode.groundTruth,
      rollouts,
      selectedRolloutId: rollouts.at(-1)?.id ?? 'r04',
      bestRolloutId: rollouts.at(-1)?.id ?? 'r04',
      budgetRemaining: initialState.budgetRemaining,
      status: 'ready',
      playback: { ...state.playback, time: 0, playing: true },
      error: null,
    });
  },

  runRollout: async (span) => {
    const state = get();
    if (state.budgetRemaining <= 0) {
      const message = 'Rollout budget exhausted.';
      set({ error: message });
      throw new Error(message);
    }
    if (state.status === 'running') {
      throw new Error('A rollout is already running.');
    }

    set({ status: 'running', error: null });
    try {
      const candidate = createDeterministicRollout(get().rollouts.length, span);
      if (momaskClient.mode === 'mock') await delay(620);
      const rollout = momaskClient.mode === 'remote'
        ? {
            ...candidate,
            motion: (await momaskClient.generate({
              episodeId: state.episodeId,
              seed: candidate.seed,
              settings: candidate.settings,
            })).motion,
            note: 'MoMask endpoint rollout',
          }
        : candidate;

      set((current) => {
        const rollouts = [...current.rollouts, rollout];
        const best = rollouts.reduce((leader, item) =>
          item.reward.combined > leader.reward.combined ? item : leader,
        );
        return {
          rollouts,
          selectedRolloutId: rollout.id,
          bestRolloutId: best.id,
          budgetRemaining: current.budgetRemaining - 1,
          status: 'ready',
          playback: { ...current.playback, time: 0, playing: true },
        };
      });
      return rollout;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Rollout failed.';
      set({ status: 'ready', error: message });
      throw cause;
    }
  },

  submitBest: () => {
    const state = get();
    const best = state.rollouts.find((rollout) => rollout.id === state.bestRolloutId);
    if (!best) throw new Error('No best rollout is available.');
    set({ status: 'submitted', selectedRolloutId: best.id });
    return best;
  },

  togglePlayback: () => set((state) => ({ playback: { ...state.playback, playing: !state.playback.playing } })),
  setPlaybackTime: (time) => set((state) => ({
    playback: { ...state.playback, time: Math.max(0, Math.min(state.duration, time)) },
  })),
  setPlaybackSpeed: (speed) => set((state) => ({
    playback: { ...state.playback, speed: Math.max(0.25, Math.min(2, speed)) },
  })),
  resetPlayback: () => set((state) => ({ playback: { ...state.playback, time: 0, playing: false } })),
  setRenderer: (renderer) => set({ renderer }),
  setWebMcp: (webmcp) => set({ webmcp }),
  clearError: () => set({ error: null }),
}));

export const experimentStore = {
  getState: useExperimentStore.getState,
  subscribe: useExperimentStore.subscribe,
};

export const getSelectedRollout = (state: ExperimentStore) =>
  state.rollouts.find((rollout) => rollout.id === state.selectedRolloutId) ?? state.rollouts[0];

export const getBestRollout = (state: ExperimentStore) =>
  state.rollouts.find((rollout) => rollout.id === state.bestRolloutId) ?? state.rollouts[0];
