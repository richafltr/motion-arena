import { environmentCore, experimentStore } from '../state/experimentStore';
import type { RolloutAction } from '../types';

type ToolResult = { content: Array<{ type: 'text'; text: string }> };
type WebMcpTool = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<ToolResult> | ToolResult;
};
type ModelContext = { registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<void> };

declare global { interface Document { modelContext?: ModelContext } }

const result = (value: unknown): ToolResult => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
const rolloutProperties = {
  seed: { type: 'number', minimum: 0, maximum: 2147483647 },
  temperature: { type: 'number', minimum: 0.1, maximum: 1.5 },
  condScale: { type: 'number', minimum: 0.5, maximum: 8 },
  topK: { type: 'number', minimum: 1, maximum: 100 },
  timeSteps: { type: 'number', minimum: 4, maximum: 64 },
  residualTemperature: { type: 'number', minimum: 0, maximum: 1.5 },
  residualCondScale: { type: 'number', minimum: 0.5, maximum: 8 },
};

function publicReward(rolloutId?: string) {
  const rollout = environmentCore.getReward(rolloutId);
  return {
    rolloutId: rollout.id,
    combinedScore: rollout.reward.combined,
    pose: rollout.reward.poseMatch,
    root: rollout.reward.rootMatch,
    velocity: rollout.reward.velocityMatch,
    contact: rollout.reward.contactMatch,
    scoreDelta: rollout.scoreDelta,
    rolloutsRemaining: experimentStore.getState().budgetRemaining,
  };
}

export async function registerWebMcpTools(): Promise<() => void> {
  const context = new URLSearchParams(window.location.search).has('disableWebmcp') ? undefined : document.modelContext;
  if (!context) {
    experimentStore.getState().setWebMcp('unavailable');
    return () => undefined;
  }
  const controller = new AbortController();
  const tools: WebMcpTool[] = [
    {
      name: 'inspect_episode',
      description: 'Inspect the instruction, hidden interval, execution mode, scores, budget, and allowed search ranges.',
      execute: () => result(environmentCore.inspectEpisode()),
    },
    {
      name: 'run_rollout',
      description: 'Generate and verify one candidate with MoMask search parameters; the LEFT motion updates visibly.',
      inputSchema: { type: 'object', properties: rolloutProperties },
      execute: async (input) => result(publicReward((await environmentCore.runRollout(input as RolloutAction)).id)),
    },
    {
      name: 'inspect_reward',
      description: 'Read deterministic aggregate verifier signals. Ground-truth arrays and hidden tokens are never returned.',
      inputSchema: { type: 'object', properties: { rolloutId: { type: 'string' } } },
      execute: ({ rolloutId }) => result(publicReward(typeof rolloutId === 'string' ? rolloutId : undefined)),
    },
    {
      name: 'refine_span',
      description: 'Generate and verify a candidate targeted at one normalized temporal span.',
      inputSchema: {
        type: 'object',
        properties: { start: { type: 'number', minimum: 0, maximum: 1 }, end: { type: 'number', minimum: 0, maximum: 1 }, ...rolloutProperties },
        required: ['start', 'end'],
      },
      execute: async ({ start, end, ...input }) => {
        if (typeof start !== 'number' || typeof end !== 'number') throw new Error('start and end are required numbers.');
        const rollout = await environmentCore.refineSpan({ ...(input as RolloutAction), start, end });
        return result({ refinedSpan: [start, end], ...publicReward(rollout.id) });
      },
    },
    {
      name: 'submit_best',
      description: 'End the episode and submit the best aggregate-scoring rollout.',
      inputSchema: { type: 'object', properties: { rolloutId: { type: 'string' } } },
      execute: ({ rolloutId }) => {
        const rollout = environmentCore.submitBest(typeof rolloutId === 'string' ? rolloutId : undefined);
        return result({ submitted: true, ...publicReward(rollout.id) });
      },
    },
  ];
  try {
    await Promise.all(tools.map((tool) => context.registerTool(tool, { signal: controller.signal })));
    experimentStore.getState().setWebMcp('available');
  } catch (error) {
    console.warn('WebMCP registration failed.', error);
    experimentStore.getState().setWebMcp('unavailable');
  }
  return () => controller.abort();
}
