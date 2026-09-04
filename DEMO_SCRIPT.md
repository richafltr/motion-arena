# 60-second demo

**0–10s:** Open `?mode=spectator`. Show the synchronized, orbitable candidate and held-out CMU ground truth. Scrub once to demonstrate the shared clock.

**10–22s:** Point out the looping hidden comparison, real pose/root/velocity verifier metrics, and live mini-VRM baseline → medium → strong rollout cards. The cards share the same clock and show the actual candidate poses. Click the baseline and best prepared cards to replay their visibly different LEFT motions.

**22–38s:** Press **Start local learning**. Watch the 194-parameter Tiny Residual Student spend the remaining budget and replace the LEFT motion whenever scalar-reward CEM search finds a new best.

**38–50s:** Invoke WebMCP `inspect_episode`, then `run_rollout` or `refine_span`. Show that the same visible history, LEFT motion, score, and budget update.

**50–56s:** Open `?mode=agent`; the reference disappears while instruction, actions, and aggregate reward remain.

**56–60s:** Show the execution switch. Explain that Modal is honestly labeled **live** only after a verified MoMask response; otherwise the demo uses **prepared fallback** and browser learning still works.
