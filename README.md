# Motion Arena

A browser-native, RL-style evaluation arena for the [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/). A frontier agent repeatedly generates or refines a human-motion reconstruction, receives deterministic aggregate reward, and hillclimbs toward a held-out mocap trajectory.

The first milestone is intentionally inference-free: it delivers the complete arena, motion playback architecture, canonical state, deterministic mock rollout loop, and WebMCP surface without bundling MoMask or exposing hidden ground-truth tokens.

## Stack

- Vite, React 19, strict TypeScript
- Three.js WebGPU renderer with WebGL2 fallback
- `@pixiv/three-vrm` + `@pixiv/three-vrm-animation`
- Zustand as the single experiment state shared by UI and WebMCP

## Run locally

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run lint
npm run build
```

Set `VITE_MOMASK_API_URL` to the Modal service origin when its compatible `POST /rollouts` endpoint is ready. The store automatically switches to the remote adapter and uses the returned motion asset. Without it, all rollouts remain deterministic and browser-local. `?forceWebgl=1&disableWebmcp=1` exercises both fallback paths.

## WebMCP tools

`inspect_episode`, `run_rollout`, `inspect_reward`, `refine_span`, and `submit_best` are registered through `document.modelContext`. Tool handlers call the same Zustand actions as the visible controls. Reward inspection returns aggregate scores only.

## Motion assets

Both panes load the same MIT-licensed pixiv VRM 1.0 sample. The right pane retargets one of ten local CMU-derived BVH clips onto the VRM normalized skeleton; a human-only dice control samples a new hidden episode and its natural-language caption. Mock candidates are deterministic quaternion attenuation variants of a cloned VRMA clip. Drag either viewport to orbit both cameras together through 360°, or scroll to zoom.

The selected held-out BVH path is deliberately absent from WebMCP tool results. Only the caption, mask, episode state, and aggregate rewards are exposed to the agent.

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for source and license attribution.

## License

MIT © 2026 Motion Arena contributors.
