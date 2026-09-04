# Agent environment

Motion Arena is an episodic search environment. Codex or another frontier model is the policy/search agent; no frontier-model weights are trained. Each rollout selects frozen MoMask inference parameters (or an honestly labeled prepared fallback), then receives exact deterministic verifier reward.

## HTTP actions

| Action | Route | Result |
| --- | --- | --- |
| Inspect | `GET /env/inspect` | instruction, hidden interval, mode, scores, budget, allowed ranges |
| Rollout | `POST /env/rollout` | candidate id, metadata, aggregate verifier reward |
| Reward | `GET /env/reward/:id` | aggregate pose/root/velocity/contact/combined scores |
| Refine | `POST /env/refine` | targeted-span rollout and reward |
| Submit | `POST /env/submit` | final aggregate result |
| Reset | `POST /env/reset` | fresh deterministic episode state |

The browser WebMCP tools use the same action/result types and scoring implementation.

## Example five-rollout hillclimb

```bash
npm run env -- inspect
npm run env -- rollout '{"seed":17,"temperature":0.85,"condScale":2.8,"topK":60,"timeSteps":16}'
npm run env -- rollout '{"seed":18,"temperature":0.65,"condScale":3.8,"topK":45,"timeSteps":20}'
npm run env -- reward r05
npm run env -- refine '{"start":0.31,"end":0.50,"seed":19,"temperature":0.55,"condScale":4.4}'
npm run env -- refine '{"start":0.50,"end":0.70,"seed":20,"temperature":0.48,"condScale":4.8}'
npm run env -- rollout '{"seed":21,"temperature":0.5,"condScale":5.0,"topK":32,"timeSteps":28}'
npm run env -- submit '{}'
```

The agent should inspect, propose a bounded action, compare `scoreDelta` and per-signal aggregates, then refine the weakest region. Raw reference joints and hidden token IDs are intentionally absent.
