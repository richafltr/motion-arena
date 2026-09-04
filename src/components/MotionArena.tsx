import { useEffect, useRef } from 'react';
import { Cpu, Github, Radio } from 'lucide-react';
import { experimentStore, useExperimentStore } from '../state/experimentStore';
import { MotionPane } from './MotionPane';
import { RolloutStrip } from './RolloutStrip';
import { Timeline } from './Timeline';

export function MotionArena() {
  const renderer = useExperimentStore((state) => state.renderer);
  const webmcp = useExperimentStore((state) => state.webmcp);
  const previousTime = useRef(performance.now());

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      const delta = Math.min(0.05, (now - previousTime.current) / 1000);
      previousTime.current = now;
      const state = experimentStore.getState();
      if (state.playback.playing) {
        state.setPlaybackTime((state.playback.time + delta * state.playback.speed) % state.duration);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Motion Arena home">
          <span className="brand-mark">MA</span>
          <span>Motion Arena</span>
          <em>01</em>
        </a>
        <div className="status-line">
          <span title="Renderer"><Cpu size={13} />{renderer === 'checking' ? 'Renderer' : renderer.toUpperCase()}</span>
          <span className={webmcp === 'available' ? 'status-good' : ''} title="Browser-native agent tools">
            <Radio size={13} />WebMCP {webmcp === 'available' ? 'live' : webmcp === 'checking' ? 'checking' : 'unavailable'}
          </span>
          <a href="https://github.com/richafltr/motion-arena" target="_blank" rel="noreferrer"><Github size={14} />Source</a>
        </div>
      </header>

      <section className="arena-heading">
        <div>
          <span className="eyebrow">OpenAI WebMCP Challenge · Episode mocap-heldout-014</span>
          <h1>Reconstruct the missing motion.</h1>
        </div>
        <p>Two bodies. One clock. Hidden reward.</p>
      </section>

      <div className="arena-grid">
        <MotionPane side="candidate" label="Current reconstruction" sublabel="mutable candidate" />
        <div className="versus" aria-hidden="true">VS</div>
        <MotionPane side="truth" label="Ground truth" sublabel="immutable held-out" />
      </div>

      <Timeline />
      <RolloutStrip />
    </main>
  );
}
