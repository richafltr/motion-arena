import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreparedRollouts, DEFAULT_SETTINGS } from '../src/data/demoMotions';
import { hiddenEpisodes } from '../src/data/hiddenEpisodes';
import { bestRollout, inspectEpisode, normalizeRolloutAction, rewardFor } from '../src/env/core';
import { verifyCandidate } from '../src/env/verifier';
import type { ExperimentState, MotionAsset, Rollout, RolloutAction } from '../src/types';

if (!('ProgressEvent' in globalThis)) {
  Object.defineProperty(globalThis, 'ProgressEvent', {
    value: class ProgressEvent {
      lengthComputable: boolean;
      loaded: number;
      total: number;
      constructor(_type: string, init: { lengthComputable?: boolean; loaded?: number; total?: number } = {}) {
        this.lengthComputable = init.lengthComputable ?? false;
        this.loaded = init.loaded ?? 0;
        this.total = init.total ?? 0;
      }
    },
  });
}

const port = Number(process.env.PORT ?? 5173);
const root = fileURLToPath(new URL('../dist', import.meta.url));
const modalEndpoint = process.env.MOMASK_API_URL?.replace(/\/$/, '');
const initialEpisode = hiddenEpisodes[0]!;
const baseUrl = `http://127.0.0.1:${port}`;
const absoluteAsset = (asset: MotionAsset): MotionAsset => ({ ...asset, url: new URL(asset.url, baseUrl).href });
const groundTruth = absoluteAsset(initialEpisode.groundTruth);

let state: ExperimentState = {
  episodeId: 'local-arena-01', episodeIndex: 0, instruction: initialEpisode.caption, groundTruth,
  executionMode: process.env.MOTION_ARENA_MODE === 'browser-student' ? 'browser-student' : 'momask',
  modalStatus: modalEndpoint ? 'checking' : 'fallback', hiddenSpan: [0.31, 0.7], duration: 8,
  budgetTotal: 12, budgetRemaining: 9, rollouts: createPreparedRollouts(groundTruth),
  selectedRolloutId: 'r03', bestRolloutId: 'r03', status: 'running',
  playback: { playing: false, time: 0, speed: 1 }, renderer: 'checking', webmcp: 'checking', error: null,
  learning: { running: false, generation: 0, evaluated: 0 },
};

async function initialize() {
  const rollouts = createPreparedRollouts(state.groundTruth);
  let prior = 0;
  for (const rollout of rollouts) {
    rollout.reward = await verifyCandidate(rollout.motion, state.groundTruth, state.hiddenSpan, state.duration);
    rollout.scoreDelta = Number((rollout.reward.combined - prior).toFixed(1));
    prior = rollout.reward.combined;
  }
  const best = rollouts.reduce((leader, item) => item.reward.combined > leader.reward.combined ? item : leader);
  state = { ...state, rollouts, selectedRolloutId: best.id, bestRolloutId: best.id, status: 'ready', budgetRemaining: 9 };
}

async function runRollout(input: RolloutAction = {}) {
  if (state.budgetRemaining <= 0) throw new Error('Rollout budget exhausted.');
  const action = normalizeRolloutAction(input, 4001 + state.rollouts.length * 137);
  let motion: MotionAsset = {
    ...state.groundTruth,
    id: `${state.groundTruth.id}-local-${state.rollouts.length + 1}`,
    label: 'Prepared fallback BVH', source: 'bvh-residual',
    variant: Number(Math.min(0.96, 0.58 + action.condScale * 0.035 + action.timeSteps * 0.002).toFixed(3)),
  };
  let source: Rollout['source'] = 'prepared-fallback';
  let note = 'Prepared fallback rollout';
  if (modalEndpoint) {
    try {
      const response = await fetch(`${modalEndpoint}/rollouts`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: state.instruction, ...action }),
      });
      if (!response.ok) throw new Error(`Modal returned ${response.status}`);
      const payload = await response.json() as { motion: MotionAsset };
      motion = payload.motion;
      source = 'momask-live'; note = 'Live MoMask · Modal GPU';
      state.modalStatus = 'live';
    } catch {
      state.modalStatus = 'fallback';
    }
  }
  const reward = await verifyCandidate(motion, state.groundTruth, [action.maskStart, action.maskEnd], state.duration);
  const rollout: Rollout = {
    id: `r${String(state.rollouts.length + 1).padStart(2, '0')}`,
    seed: action.seed, settings: { ...DEFAULT_SETTINGS, ...action, refinementStrength: motion.variant, span: [action.maskStart, action.maskEnd] },
    reward, timestamp: new Date().toISOString(), motion, note, source,
    scoreDelta: Number((reward.combined - rewardFor(state).reward.combined).toFixed(1)),
  };
  const rollouts = [...state.rollouts, rollout];
  const best = rollouts.reduce((leader, item) => item.reward.combined > leader.reward.combined ? item : leader);
  state = { ...state, rollouts, selectedRolloutId: rollout.id, bestRolloutId: best.id, budgetRemaining: state.budgetRemaining - 1 };
  return rollout;
}

const publicRollout = (rollout: Rollout) => ({
  rolloutId: rollout.id,
  seed: rollout.seed,
  settings: rollout.settings,
  source: rollout.source,
  note: rollout.note,
  reward: rollout.reward,
  scoreDelta: rollout.scoreDelta,
  rolloutsRemaining: state.budgetRemaining,
});

const json = (response: import('node:http').ServerResponse, status: number, value: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  response.end(JSON.stringify(value, null, 2));
};

async function body(request: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown> : {};
}

const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.bvh': 'text/plain', '.vrm': 'model/gltf-binary', '.vrma': 'model/gltf-binary' };

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', baseUrl);
    if (request.method === 'OPTIONS') return json(response, 204, {});
    if (url.pathname === '/env/inspect') return json(response, 200, inspectEpisode(state));
    if (url.pathname.startsWith('/env/reward/')) {
      const rollout = rewardFor(state, decodeURIComponent(url.pathname.slice('/env/reward/'.length)));
      return json(response, 200, { rolloutId: rollout.id, ...rollout.reward, scoreDelta: rollout.scoreDelta, rolloutsRemaining: state.budgetRemaining });
    }
    if (url.pathname === '/env/rollout' && request.method === 'POST') return json(response, 200, publicRollout(await runRollout(await body(request) as RolloutAction)));
    if (url.pathname === '/env/refine' && request.method === 'POST') {
      const input = await body(request) as RolloutAction & { start?: number; end?: number };
      if (typeof input.start !== 'number' || typeof input.end !== 'number' || input.start >= input.end) throw new Error('Valid start/end are required.');
      return json(response, 200, publicRollout(await runRollout({ ...input, maskStart: input.start, maskEnd: input.end })));
    }
    if (url.pathname === '/env/submit' && request.method === 'POST') {
      const input = await body(request);
      const rollout = typeof input.rolloutId === 'string' ? rewardFor(state, input.rolloutId) : bestRollout(state);
      state = { ...state, status: 'submitted', selectedRolloutId: rollout.id };
      return json(response, 200, { submitted: true, rolloutId: rollout.id, reward: rollout.reward });
    }
    if (url.pathname === '/env/reset' && request.method === 'POST') {
      state.status = 'running'; await initialize(); return json(response, 200, inspectEpisode(state));
    }

    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const candidate = normalize(join(root, relative));
    const path = candidate.startsWith(root) && await stat(candidate).then((value) => value.isFile()).catch(() => false) ? candidate : join(root, 'index.html');
    response.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream' });
    response.end(await readFile(path));
  } catch (error) {
    json(response, 400, { error: error instanceof Error ? error.message : 'Request failed.' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Motion Arena + environment adapter listening on http://localhost:${port}`);
  void initialize();
});
