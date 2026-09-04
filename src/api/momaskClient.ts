import type { MotionAsset, RolloutAction } from '../types';

export type MoMaskRolloutRequest = {
  episodeId: string;
  instruction: string;
  action: Required<RolloutAction>;
};

export type MoMaskRolloutResponse = {
  motion: MotionAsset;
  metadata?: Record<string, unknown>;
};

const endpoint = import.meta.env.VITE_MOMASK_API_URL?.replace(/\/$/, '');

export const momaskClient = {
  configured: Boolean(endpoint),
  endpoint,

  async generate(request: MoMaskRolloutRequest): Promise<MoMaskRolloutResponse> {
    if (!endpoint) {
      throw new Error('MoMask API is not configured.');
    }

    const response = await fetch(`${endpoint}/rollouts`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        episodeId: request.episodeId,
        prompt: request.instruction,
        seed: request.action.seed,
        temperature: request.action.temperature,
        condScale: request.action.condScale,
        topK: request.action.topK,
        timeSteps: request.action.timeSteps,
        residualTemperature: request.action.residualTemperature,
        residualCondScale: request.action.residualCondScale,
        maskStart: request.action.maskStart,
        maskEnd: request.action.maskEnd,
      }),
    });
    if (!response.ok) throw new Error(`MoMask rollout failed (${response.status}).`);
    return response.json() as Promise<MoMaskRolloutResponse>;
  },
};
