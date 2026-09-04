export type RewardMetrics = {
  combined: number;
  poseMatch: number;
  rootMatch: number;
  velocityContact: number;
  tokenAccuracy?: number;
};

export type InferenceSettings = {
  temperature: number;
  guidance: number;
  refinementStrength: number;
  span?: [number, number];
};

export type MotionAsset = {
  id: string;
  label: string;
  url: string;
  variant: number;
  source: 'vrma' | 'mock-derived';
};

export type Rollout = {
  id: string;
  seed: number;
  settings: InferenceSettings;
  reward: RewardMetrics;
  timestamp: string;
  motion: MotionAsset;
  note: string;
};

export type EpisodeStatus = 'ready' | 'running' | 'submitted';

export type ExperimentState = {
  episodeId: string;
  instruction: string;
  hiddenSpan: [number, number];
  duration: number;
  budgetTotal: number;
  budgetRemaining: number;
  rollouts: Rollout[];
  selectedRolloutId: string;
  bestRolloutId: string;
  status: EpisodeStatus;
  playback: {
    playing: boolean;
    time: number;
    speed: number;
  };
  renderer: 'checking' | 'webgpu' | 'webgl2' | 'unavailable';
  webmcp: 'checking' | 'available' | 'unavailable';
  error: string | null;
};
