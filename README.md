# Motion Arena

Motion Arena is a browser-native, RL-ready motion reconstruction environment for the OpenAI WebMCP Challenge. A policy repeatedly changes a candidate motion, receives deterministic aggregate reward over a hidden interval, and hillclimbs toward a held-out mocap trajectory. The same typed environment powers React, WebMCP, the tiny browser student, the Modal adapter, and the local HTTP/CLI harness.

```text
                    FRONTIER AGENT
                         │
                       WebMCP
                         │
                         ▼
                  MOTION ARENA
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
       Tiny Residual              Full MoMask
       Student                    Modal GPU
       Browser                    Frontier search
             │                       │
             └───────────┬───────────┘
                         ▼
                Candidate Motion
                         │
                         ▼
                 Hidden Verifier
                         │
                         ▼
                      Reward
                         │
                         └──────────→ next rollout
```

## What is real

- Two synchronized, orbitable VRM views with Three.js WebGPU and WebGL2 fallback.
- Canonical BVH verifier operating before cosmetic VRM retargeting. It scores pose, root trajectory, and joint velocity over the hidden interval. Scores are deterministic and normalized to 0–100.
- Reward weights live in one config: pose 0.55, root 0.20, velocity 0.15, contact 0.10. CMU files have no authoritative contact labels, so contact is `null` and its weight is proportionally redistributed; no metric is fabricated.
- Tiny Residual Student: a `3 → 8 SiLU → 8 SiLU → 10 tanh` MLP with 194 float parameters / 776 bytes. It modifies root translation and nine important joints only inside the hidden interval with smooth boundary blending. A bounded asynchronous CEM-style search sees scalar reward and keeps improved policies.
- Candidate priors combine joint/root attenuation with deterministic joint-specific temporal lag inside the hidden span, so weak reconstructions are visibly different while known context remains locked. The comparison loop stays inside the fully reconstructed interior rather than lingering at exact boundary blends; the viewer can switch back to full-motion playback at any time.
- Live mini-VRM rollout cards make the search legible like a game tree: baseline, prepared search, and student generations show their actual synchronized candidate pose plus score, delta, seed, selected state, and best state. One low-power WebGL renderer, one avatar, scissored viewports, 12 fps previews, and offscreen skipping keep the gallery bounded as history grows.
- Five WebMCP tools calling the same environment actions as the visible controls.
- `?mode=spectator` shows candidate and reference. `?mode=agent` hides the reference motion and asset.
- Three prepared BVH degradation tiers (baseline, medium, strong) receive real verifier scores at runtime, so the public demo remains functional when Modal is cold.

## What is conditional

Full MoMask remains frozen behind `VITE_MOMASK_API_URL` in the browser or `MOMASK_API_URL` locally. A compatible `POST /rollouts` response must include a BVH `MotionAsset`. A successful request is labeled `Live MoMask · Modal GPU`; missing, failed, or unverifiable requests are labeled `Prepared fallback rollout`. The app never presents fallback output as live inference.

## Run

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run lint
npm run build
```

Docker research mode serves the built arena, verifier, and environment adapter:

```bash
docker compose up --build
```

Then open <http://localhost:5173> or use the CLI against the running adapter:

```bash
npm run env -- inspect
npm run env -- rollout '{"seed":17,"temperature":0.7,"condScale":3.8,"topK":40,"timeSteps":20}'
npm run env -- reward r04
npm run env -- refine '{"start":0.35,"end":0.62,"seed":18}'
npm run env -- submit '{}'
```

See [`docs/AGENT_ENVIRONMENT.md`](./docs/AGENT_ENVIRONMENT.md) for a five-rollout frontier-agent hillclimb and [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) for the 60-second demo.

## WebMCP advantage

`inspect_episode`, `run_rollout`, `inspect_reward`, `refine_span`, and `submit_best` are registered through `document.modelContext`. They expose the useful agent action space—not DOM click wrappers—and visibly mutate the same canonical arena state. Reward responses contain aggregates only; hidden BVH arrays, asset URLs, and MoMask token IDs are never returned.

## Project map

- `src/env/`: framework-independent contracts, parameter ranges, scoring weights, and canonical BVH verifier
- `src/student/`: tiny residual MLP and deterministic policy perturbations
- `src/state/experimentStore.ts`: the single live episode state used by UI and WebMCP
- `src/api/momaskClient.ts`: frozen Modal MoMask adapter
- `src/webmcp/`: five browser-native tools
- `server/` and `scripts/env.ts`: local HTTP and CLI adapters over the same contracts
- `src/motion/`: BVH/VRMA loading, calibrated retargeting, synchronized playback, camera sync

## Attribution and license

Motion Arena is MIT licensed. It builds on [MoMask](https://github.com/EricGuo5513/momask-codes), [three-vrm](https://github.com/pixiv/three-vrm), [three-vrm-animation](https://github.com/pixiv/three-vrm), and the [bvh2vrma](https://github.com/vrm-c/bvh2vrma) retargeting approach. Mocap examples are from the CMU Graphics Lab Motion Capture Database; HumanML3D is the intended text/motion convention for MoMask-facing captions. Exact asset and license details are in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) and [`public/motions/README.md`](./public/motions/README.md).
