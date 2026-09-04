import { create } from 'zustand';
import { momaskClient } from '../api/momaskClient';
import { createDeterministicRollout, demoRollouts } from '../data/demoMotions';
import type { ExperimentState, Rollout } from '../types';

type ExperimentActions = {
  selectRollout: (id: string) => void;
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
  episodeId: 'mocap-heldout-014',
  instruction: 'A person steps forward, plants the left foot, then turns and reaches across the body.',
  hiddenSpan: [0.31, 0.7],
  duration: 3.63,
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
