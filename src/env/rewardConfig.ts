export const REWARD_WEIGHTS = {
  poseMatch: 0.55,
  rootMatch: 0.20,
  velocityMatch: 0.15,
  contactMatch: 0.10,
} as const;

// CMU BVH clips in this demo do not carry authoritative foot-contact labels.
// The unavailable contact weight is redistributed proportionally across real signals.
export const ACTIVE_REWARD_WEIGHTS = {
  poseMatch: REWARD_WEIGHTS.poseMatch / 0.9,
  rootMatch: REWARD_WEIGHTS.rootMatch / 0.9,
  velocityMatch: REWARD_WEIGHTS.velocityMatch / 0.9,
} as const;

export const ALLOWED_PARAMETER_RANGES = {
  seed: [0, 2_147_483_647],
  temperature: [0.1, 1.5],
  condScale: [0.5, 8],
  topK: [1, 100],
  timeSteps: [4, 64],
  residualTemperature: [0, 1.5],
  residualCondScale: [0.5, 8],
} satisfies Record<string, [number, number]>;
