import type { InferenceSettings, MotionAsset, RewardMetrics, Rollout } from '../types';

export const AVATAR_URL = '/models/arena-avatar.vrm';
export const CANDIDATE_MOTION_URL = '/motions/candidate-base.vrma';

export const DEFAULT_SETTINGS: InferenceSettings = {
  temperature: 0.7,
  condScale: 3.5,
  topK: 50,
  timeSteps: 18,
  residualTemperature: 0.4,
  residualCondScale: 2.5,
  refinementStrength: 0.6,
};

const pendingReward: RewardMetrics = {
  combined: 0,
  poseMatch: 0,
  rootMatch: 0,
  velocityMatch: 0,
  contactMatch: null,
};

const tiers = [
  { variant: 0.48, label: 'baseline', seed: 1207 },
  { variant: 0.67, label: 'medium', seed: 1344 },
  { variant: 0.82, label: 'strong', seed: 1481 },
] as const;

/** Three honest prepared BVH transformations, rescored against each active reference at runtime. */
export function createPreparedRollouts(reference: MotionAsset): Rollout[] {
  return tiers.map((tier, index) => ({
    id: `r${String(index + 1).padStart(2, '0')}`,
    seed: tier.seed,
    settings: { ...DEFAULT_SETTINGS, seed: tier.seed, refinementStrength: tier.variant },
    reward: { ...pendingReward },
    timestamp: new Date(Date.UTC(2026, 8, 3, 19, index * 3)).toISOString(),
    motion: {
      id: `${reference.id}-${tier.label}`,
      label: `Prepared ${tier.label} BVH`,
      url: reference.url,
      variant: tier.variant,
      source: 'bvh-residual',
    },
    note: `Prepared fallback rollout · ${tier.label}`,
    source: index === 0 ? 'baseline' : 'prepared-fallback',
    scoreDelta: 0,
  }));
}

export const demoRollouts = createPreparedRollouts({
  id: 'cmu-01-01',
  label: 'Hidden CMU motion',
  url: '/motions/cmu-playground/01_01.bvh',
  variant: 1,
  source: 'bvh',
});
