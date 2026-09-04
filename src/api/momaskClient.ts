import type { InferenceSettings, MotionAsset } from '../types';

export type MoMaskRolloutRequest = {
  episodeId: string;
  seed: number;
  settings: InferenceSettings;
};

export type MoMaskRolloutResponse = {
  motion: MotionAsset;
};

const endpoint = import.meta.env.VITE_MOMASK_API_URL?.replace(/\/$/, '');

export const momaskClient = {
  mode: endpoint ? ('remote' as const) : ('mock' as const),
  endpoint,

  async generate(request: MoMaskRolloutRequest): Promise<MoMaskRolloutResponse> {
    if (!endpoint) {
      throw new Error('MoMask API is not configured; the arena is using deterministic local rollouts.');
    }

    const response = await fetch(`${endpoint}/rollouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`MoMask rollout failed (${response.status}).`);
    return response.json() as Promise<MoMaskRolloutResponse>;
  },
};
