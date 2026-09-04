export type RewardMetrics = {
  combined: number;
  poseMatch: number;
  rootMatch: number;
  velocityMatch: number;
  contactMatch: number | null;
  tokenAccuracy?: number;
};

export type InferenceSettings = {
  seed?: number;
  temperature: number;
  condScale: number;
  topK: number;
  timeSteps: number;
  residualTemperature: number;
  residualCondScale: number;
  refinementStrength: number;
  span?: [number, number];
};

export type ExecutionMode = 'browser-student' | 'momask';
export type RolloutSource = 'baseline' | 'prepared-fallback' | 'local-student' | 'momask-live';

export type ResidualPolicy = {
  architecture: '3-8-8-9';
  weights: number[];
  generation: number;
};

export type MotionAsset = {
  id: string;
  label: string;
  url: string;
  variant: number;
  source: 'bvh' | 'vrma' | 'mock-derived' | 'bvh-residual';
  residualPolicy?: ResidualPolicy;
};

export type HiddenEpisode = {
  id: string;
  caption: string;
  sourceDescription: string;
  subject: number;
  trial: number;
  groundTruth: MotionAsset;
};

export type Rollout = {
  id: string;
  seed: number;
  settings: InferenceSettings;
  reward: RewardMetrics;
  timestamp: string;
  motion: MotionAsset;
  note: string;
  source: RolloutSource;
  scoreDelta: number;
};

export type EpisodeStatus = 'ready' | 'running' | 'submitted';

export type ExperimentState = {
  episodeId: string;
  episodeIndex: number;
  instruction: string;
  groundTruth: MotionAsset;
  executionMode: ExecutionMode;
  modalStatus: 'live' | 'fallback' | 'checking';
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
  learning: {
    running: boolean;
    generation: number;
    evaluated: number;
  };
};

export type RolloutAction = Partial<Pick<InferenceSettings,
  'temperature' | 'condScale' | 'topK' | 'timeSteps' | 'residualTemperature' | 'residualCondScale'
>> & {
  seed?: number;
  maskStart?: number;
  maskEnd?: number;
};

export type EpisodeInspection = {
  episodeId: string;
  instruction: string;
  duration: number;
  hiddenInterval: [number, number];
  executionMode: ExecutionMode;
  currentScore: number;
  bestScore: number;
  rolloutsRemaining: number;
  allowedParameterRanges: Record<string, [number, number]>;
};
