import { experimentStore, getBestRollout, getSelectedRollout } from '../state/experimentStore';

type ToolResult = { content: Array<{ type: 'text'; text: string }> };
type WebMcpTool = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<ToolResult> | ToolResult;
};
type ModelContext = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<void>;
};

declare global {
  interface Document { modelContext?: ModelContext; }
}

const result = (value: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
});

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
      description: 'Inspect the active motion reconstruction episode, mask, selected rollout, and remaining budget.',
      execute: () => {
        const state = experimentStore.getState();
        const selected = getSelectedRollout(state);
        return result({
          episodeId: state.episodeId,
          instruction: state.instruction,
          temporalMask: { knownPrefixEnd: state.hiddenSpan[0], hiddenEnd: state.hiddenSpan[1] },
          durationSeconds: state.duration,
          selectedRolloutId: selected?.id,
          budgetRemaining: state.budgetRemaining,
          status: state.status,
        });
      },
    },
    {
      name: 'run_rollout',
      description: 'Run one deterministic candidate generation, spend one budget unit, and play it on the left.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const rollout = await experimentStore.getState().runRollout();
        return result({ rolloutId: rollout.id, seed: rollout.seed, aggregateReward: rollout.reward, budgetRemaining: experimentStore.getState().budgetRemaining });
      },
    },
    {
      name: 'inspect_reward',
      description: 'Read aggregate reward signals for a rollout. Hidden ground-truth tokens are never returned.',
      inputSchema: {
        type: 'object',
        properties: { rolloutId: { type: 'string', description: 'Rollout id; defaults to the selected rollout.' } },
      },
      execute: ({ rolloutId }) => {
        const state = experimentStore.getState();
        const rollout = typeof rolloutId === 'string'
          ? state.rollouts.find((item) => item.id === rolloutId)
          : getSelectedRollout(state);
        if (!rollout) throw new Error('Unknown rollout id.');
        return result({ rolloutId: rollout.id, ...rollout.reward });
      },
    },
    {
      name: 'refine_span',
      description: 'Spend one rollout to deterministically refine a normalized time span and play the result on the left.',
      inputSchema: {
        type: 'object',
        properties: {
          start: { type: 'number', minimum: 0, maximum: 1 },
          end: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['start', 'end'],
      },
      execute: async ({ start, end }) => {
        if (typeof start !== 'number' || typeof end !== 'number' || start < 0 || end > 1 || start >= end) {
          throw new Error('start and end must define an increasing normalized span inside 0..1.');
        }
        const rollout = await experimentStore.getState().runRollout([start, end]);
        return result({ rolloutId: rollout.id, refinedSpan: [start, end], aggregateReward: rollout.reward });
      },
    },
    {
      name: 'submit_best',
      description: 'Submit the highest-scoring rollout currently in the arena.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        const best = experimentStore.getState().submitBest();
        return result({ submitted: true, rolloutId: best.id, score: best.reward.combined, bestKnown: getBestRollout(experimentStore.getState())?.id });
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
