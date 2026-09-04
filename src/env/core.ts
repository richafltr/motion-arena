import type { EpisodeInspection, ExperimentState, Rollout, RolloutAction } from '../types';
import { ALLOWED_PARAMETER_RANGES } from './rewardConfig';

export const clamp = (value: number, [min, max]: [number, number]) => Math.max(min, Math.min(max, value));

export function inspectEpisode(state: ExperimentState): EpisodeInspection {
  const current = state.rollouts.find((rollout) => rollout.id === state.selectedRolloutId);
  const best = state.rollouts.find((rollout) => rollout.id === state.bestRolloutId);
  return {
    episodeId: state.episodeId,
    instruction: state.instruction,
    duration: state.duration,
    hiddenInterval: state.hiddenSpan,
    executionMode: state.executionMode,
    currentScore: current?.reward.combined ?? 0,
    bestScore: best?.reward.combined ?? 0,
    rolloutsRemaining: state.budgetRemaining,
    allowedParameterRanges: ALLOWED_PARAMETER_RANGES,
  };
}

export function normalizeRolloutAction(action: RolloutAction = {}, fallbackSeed = 2203): Required<RolloutAction> {
  return {
    seed: Math.round(clamp(action.seed ?? fallbackSeed, ALLOWED_PARAMETER_RANGES.seed)),
    temperature: clamp(action.temperature ?? 0.7, ALLOWED_PARAMETER_RANGES.temperature),
    condScale: clamp(action.condScale ?? 3.5, ALLOWED_PARAMETER_RANGES.condScale),
    topK: Math.round(clamp(action.topK ?? 50, ALLOWED_PARAMETER_RANGES.topK)),
    timeSteps: Math.round(clamp(action.timeSteps ?? 18, ALLOWED_PARAMETER_RANGES.timeSteps)),
    residualTemperature: clamp(action.residualTemperature ?? 0.4, ALLOWED_PARAMETER_RANGES.residualTemperature),
    residualCondScale: clamp(action.residualCondScale ?? 2.5, ALLOWED_PARAMETER_RANGES.residualCondScale),
    maskStart: clamp(action.maskStart ?? 0.31, [0, 1]),
    maskEnd: clamp(action.maskEnd ?? 0.7, [0, 1]),
  };
}

export function rewardFor(state: ExperimentState, rolloutId?: string): Rollout {
  const id = rolloutId ?? state.selectedRolloutId;
  const rollout = state.rollouts.find((item) => item.id === id);
  if (!rollout) throw new Error(`Unknown rollout id: ${id}`);
  return rollout;
}

export function bestRollout(state: ExperimentState): Rollout {
  const best = state.rollouts.find((rollout) => rollout.id === state.bestRolloutId);
  if (!best) throw new Error('No best rollout is available.');
  return best;
}

export type EnvironmentApi = {
  inspectEpisode: () => EpisodeInspection;
  runRollout: (action?: RolloutAction) => Promise<Rollout>;
  getReward: (rolloutId?: string) => Rollout;
  refineSpan: (action: RolloutAction & { start: number; end: number }) => Promise<Rollout>;
  submitBest: (rolloutId?: string) => Rollout;
  reset: () => Promise<void>;
};
