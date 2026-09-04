import type { Rollout } from '../types';

export const AVATAR_URL = '/models/arena-avatar.vrm';
export const CANDIDATE_MOTION_URL = '/motions/candidate-base.vrma';

const scores = [61.2, 73.8, 79.4, 87.1];
const variants = [0.48, 0.66, 0.81, 0.93];

export const demoRollouts: Rollout[] = scores.map((score, index) => ({
  id: `r${String(index + 1).padStart(2, '0')}`,
  seed: 1207 + index * 137,
  settings: {
    temperature: Number((0.86 - index * 0.09).toFixed(2)),
    guidance: Number((2.2 + index * 0.35).toFixed(2)),
    refinementStrength: variants[index] ?? 0.5,
  },
  reward: {
    combined: score,
    poseMatch: Number((score + 2.9).toFixed(1)),
    rootMatch: Number((score - 1.7).toFixed(1)),
    velocityContact: Number((score - 4.1).toFixed(1)),
  },
  timestamp: new Date(Date.UTC(2026, 8, 3, 19, index * 3)).toISOString(),
  motion: {
    id: `candidate-${index + 1}`,
    label: `Candidate ${index + 1}`,
    url: CANDIDATE_MOTION_URL,
    variant: variants[index] ?? 0.5,
    source: 'mock-derived',
  },
  note: index === 3 ? 'Best reconstruction' : `Deterministic refinement ${index + 1}`,
}));

export function createDeterministicRollout(index: number, span?: [number, number]): Rollout {
  const seed = 2203 + index * 173;
  const capped = Math.min(index, 9);
  const score = Number(Math.min(95.8, 88.4 + capped * 1.08 + (seed % 7) * 0.08).toFixed(1));
  const variant = Number(Math.min(0.995, 0.94 + capped * 0.007).toFixed(3));

  return {
    id: `r${String(index + 1).padStart(2, '0')}`,
    seed,
    settings: {
      temperature: Number(Math.max(0.18, 0.54 - capped * 0.025).toFixed(2)),
      guidance: Number((3.6 + capped * 0.17).toFixed(2)),
      refinementStrength: variant,
      ...(span ? { span } : {}),
    },
    reward: {
      combined: score,
      poseMatch: Number(Math.min(98.2, score + 2.2).toFixed(1)),
      rootMatch: Number(Math.min(97.4, score + 0.7).toFixed(1)),
      velocityContact: Number(Math.max(0, score - 2.8).toFixed(1)),
    },
    timestamp: new Date().toISOString(),
    motion: {
      id: `candidate-${index + 1}`,
      label: `Candidate ${index + 1}`,
      url: CANDIDATE_MOTION_URL,
      variant,
      source: 'mock-derived',
    },
    note: span ? `Refined hidden span ${span[0].toFixed(2)}–${span[1].toFixed(2)}` : 'Deterministic mock rollout',
  };
}
