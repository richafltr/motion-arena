import { create } from 'zustand';
import { momaskClient } from '../api/momaskClient';
import { createPreparedRollouts, DEFAULT_SETTINGS, demoRollouts } from '../data/demoMotions';
import { hiddenEpisodes } from '../data/hiddenEpisodes';
import { bestRollout, inspectEpisode, normalizeRolloutAction, rewardFor, type EnvironmentApi } from '../env/core';
import { verifyCandidate } from '../env/verifier';
import { getHiddenComparisonWindow } from '../motion/candidateTransform';
import { seededPolicy, STUDENT_PARAMETER_COUNT, STUDENT_OUTPUTS } from '../student/tinyResidualPolicy';
import type { ExecutionMode, ExperimentState, MotionAsset, Rollout, RolloutAction } from '../types';

type ExperimentActions = {
  initializeEnvironment: () => Promise<void>;
  selectRollout: (id: string) => void;
  rollHiddenEpisode: () => void;
  runRollout: (action?: RolloutAction) => Promise<Rollout>;
  refineSpan: (start: number, end: number, action?: RolloutAction) => Promise<Rollout>;
  submitBest: (rolloutId?: string) => Rollout;
  resetEpisode: () => Promise<void>;
  setExecutionMode: (mode: ExecutionMode) => void;
  startLocalLearning: () => void;
  pauseLocalLearning: () => void;
  togglePlayback: () => void;
  setPlaybackTime: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  toggleLoopMode: () => void;
  resetPlayback: () => void;
  setRenderer: (renderer: ExperimentState['renderer']) => void;
  setWebMcp: (webmcp: ExperimentState['webmcp']) => void;
  clearError: () => void;
};

export type ExperimentStore = ExperimentState & ExperimentActions;

const initialGroundTruth = hiddenEpisodes[0]?.groundTruth ?? {
  id: 'cmu-01-01', label: 'Hidden CMU motion', url: '/motions/cmu-playground/01_01.bvh', variant: 1, source: 'bvh' as const,
};

const initialState: ExperimentState = {
  episodeId: 'arena-7fd1c2a4',
  episodeIndex: 0,
  instruction: hiddenEpisodes[0]?.caption ?? 'A person makes several forward jumps, then turns around.',
  groundTruth: initialGroundTruth,
  executionMode: import.meta.env.VITE_MOTION_ARENA_MODE === 'momask' ? 'momask' : 'browser-student',
  modalStatus: momaskClient.configured ? 'checking' : 'fallback',
  hiddenSpan: [0.31, 0.7],
  duration: 8,
  budgetTotal: 12,
  budgetRemaining: 9,
  rollouts: demoRollouts,
  selectedRolloutId: demoRollouts.at(-1)?.id ?? 'r01',
  bestRolloutId: demoRollouts.at(-1)?.id ?? 'r01',
  status: 'running',
  playback: { playing: true, time: (0.31 + 0.08) * 8, speed: 1, loopHidden: true },
  renderer: 'checking',
  webmcp: 'checking',
  error: null,
  learning: { running: false, generation: 0, evaluated: 0 },
};

const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
let learningRunId = 0;
const focusHiddenTime = (state: Pick<ExperimentState, 'hiddenSpan' | 'duration'>) => {
  const [start, end] = getHiddenComparisonWindow(state.hiddenSpan, state.duration);
  return start + Math.min(0.08, (end - start) * 0.12);
};

async function scorePrepared(reference: ExperimentState['groundTruth'], span: [number, number], duration: number) {
  const rollouts = createPreparedRollouts(reference);
  let prior = 0;
  for (const rollout of rollouts) {
    rollout.reward = await verifyCandidate(rollout.motion, reference, span, duration);
    rollout.scoreDelta = Number((rollout.reward.combined - prior).toFixed(1));
    prior = rollout.reward.combined;
  }
  return rollouts;
}

export const useExperimentStore = create<ExperimentStore>((set, get) => ({
  ...initialState,

  initializeEnvironment: async () => {
    const state = get();
    set({ status: 'running', error: null });
    try {
      const rollouts = await scorePrepared(state.groundTruth, state.hiddenSpan, state.duration);
      if (get().episodeId !== state.episodeId) return;
      const best = rollouts.reduce((leader, item) => item.reward.combined > leader.reward.combined ? item : leader);
      set({
        rollouts,
        selectedRolloutId: best.id,
        bestRolloutId: best.id,
        budgetRemaining: state.budgetTotal - rollouts.length,
        status: 'ready',
        modalStatus: momaskClient.configured ? 'checking' : 'fallback',
      });
    } catch (cause) {
      set({ status: 'ready', error: cause instanceof Error ? cause.message : 'Verifier initialization failed.' });
    }
  },

  selectRollout: (id) => {
    if (get().rollouts.some((rollout) => rollout.id === id)) {
      set((state) => ({ selectedRolloutId: id, playback: { ...state.playback, time: focusHiddenTime(state), playing: true } }));
    }
  },

  rollHiddenEpisode: () => {
    const state = get();
    if (hiddenEpisodes.length < 2) return;
    state.pauseLocalLearning();
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const offset = 1 + ((random[0] ?? 0) % (hiddenEpisodes.length - 1));
    const episodeIndex = (state.episodeIndex + offset) % hiddenEpisodes.length;
    const episode = hiddenEpisodes[episodeIndex];
    if (!episode) return;
    set({
      episodeId: `arena-${crypto.randomUUID().slice(0, 8)}`,
      episodeIndex,
      instruction: episode.caption,
      groundTruth: episode.groundTruth,
      rollouts: createPreparedRollouts(episode.groundTruth),
      selectedRolloutId: 'r03',
      bestRolloutId: 'r03',
      budgetRemaining: initialState.budgetTotal - 3,
      status: 'running',
      learning: { running: false, generation: 0, evaluated: 0 },
      playback: { ...state.playback, time: focusHiddenTime(state), playing: true },
      error: null,
    });
    void get().initializeEnvironment();
  },

  runRollout: async (input = {}) => {
    const state = get();
    if (state.budgetRemaining <= 0) throw new Error('Rollout budget exhausted.');
    if (state.status === 'submitted') throw new Error('This episode has already been submitted.');
    if (state.status === 'running') throw new Error('A rollout is already running.');
    const action = normalizeRolloutAction(input, 2203 + state.rollouts.length * 173);
    set({ status: 'running', error: null });
    try {
      let motion: MotionAsset = {
        ...state.groundTruth,
        id: `${state.groundTruth.id}-fallback-${state.rollouts.length + 1}`,
        label: 'Prepared fallback BVH',
        source: 'bvh-residual' as const,
        variant: Number(Math.min(0.94, 0.58 + action.condScale * 0.035 + action.timeSteps * 0.002).toFixed(3)),
      };
      let source: Rollout['source'] = 'prepared-fallback';
      let note = 'Prepared fallback rollout';
      if (momaskClient.configured && state.executionMode === 'momask') {
        try {
          const response = await momaskClient.generate({ episodeId: state.episodeId, instruction: state.instruction, action });
          motion = response.motion;
          source = 'momask-live';
          note = 'Live MoMask · Modal GPU';
          set({ modalStatus: 'live' });
        } catch (error) {
          console.warn('Modal rollout unavailable; using prepared fallback.', error);
          set({ modalStatus: 'fallback' });
          note = 'Prepared fallback rollout · Modal unavailable';
        }
      } else {
        await delay(220);
        set({ modalStatus: 'fallback' });
      }
      const reward = await verifyCandidate(motion, state.groundTruth, [action.maskStart, action.maskEnd], state.duration);
      const prior = rewardFor(state).reward.combined;
      const rollout: Rollout = {
        id: `r${String(state.rollouts.length + 1).padStart(2, '0')}`,
        seed: action.seed,
        settings: {
          ...DEFAULT_SETTINGS,
          ...action,
          refinementStrength: motion.variant,
          span: [action.maskStart, action.maskEnd],
        },
        reward,
        timestamp: new Date().toISOString(),
        motion,
        note,
        source,
        scoreDelta: Number((reward.combined - prior).toFixed(1)),
      };
      set((current) => {
        const rollouts = [...current.rollouts, rollout];
        const best = rollouts.reduce((leader, item) => item.reward.combined > leader.reward.combined ? item : leader);
        return {
          rollouts,
          selectedRolloutId: rollout.id,
          bestRolloutId: best.id,
          budgetRemaining: current.budgetRemaining - 1,
          status: 'ready',
          playback: { ...current.playback, time: focusHiddenTime(current), playing: true },
        };
      });
      return rollout;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Rollout failed.';
      set({ status: 'ready', error: message });
      throw cause;
    }
  },

  refineSpan: (start, end, action = {}) => {
    if (start < 0 || end > 1 || start >= end) throw new Error('start and end must define an increasing span inside 0..1.');
    return get().runRollout({ ...action, maskStart: start, maskEnd: end });
  },

  submitBest: (rolloutId) => {
    const state = get();
    const submitted = rolloutId ? rewardFor(state, rolloutId) : bestRollout(state);
    learningRunId += 1;
    set({ status: 'submitted', selectedRolloutId: submitted.id, learning: { ...state.learning, running: false } });
    return submitted;
  },

  resetEpisode: async () => {
    const state = get();
    state.pauseLocalLearning();
    set({
      rollouts: createPreparedRollouts(state.groundTruth), selectedRolloutId: 'r03', bestRolloutId: 'r03',
      budgetRemaining: state.budgetTotal - 3, status: 'running', error: null,
      learning: { running: false, generation: 0, evaluated: 0 },
      playback: { ...state.playback, time: focusHiddenTime(state), playing: false },
    });
    await get().initializeEnvironment();
  },

  setExecutionMode: (executionMode) => {
    get().pauseLocalLearning();
    set({ executionMode, error: null });
  },

  startLocalLearning: () => {
    if (get().learning.running || get().budgetRemaining <= 0) return;
    const runId = ++learningRunId;
    set((state) => ({
      executionMode: 'browser-student',
      status: 'ready',
      learning: { ...state.learning, running: true },
    }));
    void (async () => {
      while (runId === learningRunId && get().learning.running && get().budgetRemaining > 0 && get().status !== 'submitted') {
        const state = get();
        const generation = state.learning.generation + 1;
        const leader = bestRollout(state);
        const center = leader.motion.residualPolicy;
        const batchSize = Math.min(2, state.budgetRemaining);
        for (let candidate = 0; candidate < batchSize; candidate += 1) {
          if (runId !== learningRunId || !get().learning.running) break;
          const seed = 9109 + generation * 101 + candidate * 17;
          const policy = seededPolicy(seed, generation, center, Math.max(0.025, 0.12 / generation));
          // CEM exploration includes a deterministic positive residual direction, then keeps it only if reward improves.
          if (candidate === 0) {
            const biasStart = STUDENT_PARAMETER_COUNT - STUDENT_OUTPUTS;
            for (let index = biasStart; index < STUDENT_PARAMETER_COUNT; index += 1) {
              policy.weights[index] = Number(((center?.weights[index] ?? 0) + 0.24 / Math.sqrt(generation)).toFixed(6));
            }
          }
          const current = get();
          const motion = {
            ...current.groundTruth,
            id: `${current.groundTruth.id}-student-g${generation}-${candidate + 1}`,
            label: `Tiny Residual Student g${generation}`,
            source: 'bvh-residual' as const,
            variant: leader.motion.variant,
            residualPolicy: policy,
          };
          const reward = await verifyCandidate(motion, current.groundTruth, current.hiddenSpan, current.duration);
          if (runId !== learningRunId || !get().learning.running) break;
          const rollout: Rollout = {
            id: `r${String(current.rollouts.length + 1).padStart(2, '0')}`,
            seed,
            settings: { ...DEFAULT_SETTINGS, seed, refinementStrength: motion.variant },
            reward,
            timestamp: new Date().toISOString(),
            motion,
            note: `Tiny Residual Student · generation ${generation}`,
            source: 'local-student',
            scoreDelta: Number((reward.combined - leader.reward.combined).toFixed(1)),
          };
          set((latest) => {
            const rollouts = [...latest.rollouts, rollout];
            const best = rollouts.reduce((winner, item) => item.reward.combined > winner.reward.combined ? item : winner);
            return {
              rollouts,
              selectedRolloutId: best.id === rollout.id ? rollout.id : latest.selectedRolloutId,
              bestRolloutId: best.id,
              budgetRemaining: latest.budgetRemaining - 1,
              learning: { running: latest.learning.running, generation, evaluated: latest.learning.evaluated + 1 },
              playback: best.id === rollout.id ? { ...latest.playback, time: focusHiddenTime(latest), playing: true } : latest.playback,
            };
          });
          await delay(650);
        }
      }
      if (runId === learningRunId) {
        set((state) => ({ learning: { ...state.learning, running: false }, status: state.status === 'submitted' ? 'submitted' : 'ready' }));
      }
    })();
  },

  pauseLocalLearning: () => {
    learningRunId += 1;
    set((state) => ({ learning: { ...state.learning, running: false } }));
  },
  togglePlayback: () => set((state) => ({ playback: { ...state.playback, playing: !state.playback.playing } })),
  setPlaybackTime: (time) => set((state) => ({ playback: { ...state.playback, time: Math.max(0, Math.min(state.duration, time)) } })),
  setPlaybackSpeed: (speed) => set((state) => ({ playback: { ...state.playback, speed: Math.max(0.25, Math.min(2, speed)) } })),
  toggleLoopMode: () => set((state) => ({
    playback: {
      ...state.playback,
      loopHidden: !state.playback.loopHidden,
      time: state.playback.loopHidden ? state.playback.time : focusHiddenTime(state),
    },
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

export const environmentCore: EnvironmentApi = {
  inspectEpisode: () => inspectEpisode(useExperimentStore.getState()),
  runRollout: (action) => useExperimentStore.getState().runRollout(action),
  getReward: (rolloutId) => rewardFor(useExperimentStore.getState(), rolloutId),
  refineSpan: ({ start, end, ...action }) => useExperimentStore.getState().refineSpan(start, end, action),
  submitBest: (rolloutId) => useExperimentStore.getState().submitBest(rolloutId),
  reset: () => useExperimentStore.getState().resetEpisode(),
};

export const getSelectedRollout = (state: ExperimentStore) => rewardFor(state);
export const getBestRollout = (state: ExperimentStore) => bestRollout(state);
