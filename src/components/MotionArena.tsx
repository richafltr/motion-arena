import { useEffect, useRef } from 'react';
import { Cpu, Dices, Github, Radio } from 'lucide-react';
import { experimentStore, useExperimentStore } from '../state/experimentStore';
import { MotionPane } from './MotionPane';
import { RolloutStrip } from './RolloutStrip';
import { Timeline } from './Timeline';

export function MotionArena() {
  const renderer = useExperimentStore((state) => state.renderer);
  const webmcp = useExperimentStore((state) => state.webmcp);
  const episodeId = useExperimentStore((state) => state.episodeId);
  const rollHiddenEpisode = useExperimentStore((state) => state.rollHiddenEpisode);
  const executionMode = useExperimentStore((state) => state.executionMode);
  const agentView = new URLSearchParams(window.location.search).get('mode') === 'agent';
  const previousTime = useRef(performance.now());

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      const delta = Math.min(0.05, (now - previousTime.current) / 1000);
      previousTime.current = now;
      const state = experimentStore.getState();
      if (state.playback.playing) {
        const hiddenStart = state.hiddenSpan[0] * state.duration;
        const hiddenEnd = state.hiddenSpan[1] * state.duration;
        const next = state.playback.time + delta * state.playback.speed;
        state.setPlaybackTime(state.playback.loopHidden
          ? (next < hiddenStart || next >= hiddenEnd ? hiddenStart + 0.02 : next)
          : next % state.duration);
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
          <span className="execution-badge">{executionMode === 'browser-student' ? 'Local student · browser' : 'Full MoMask · Modal'}</span>
          <span className={webmcp === 'available' ? 'status-good' : ''} title="Browser-native agent tools">
            <Radio size={13} />WebMCP {webmcp === 'available' ? 'live' : webmcp === 'checking' ? 'checking' : 'unavailable'}
          </span>
          <a href="https://github.com/richafltr/motion-arena" target="_blank" rel="noreferrer"><Github size={14} />Source</a>
        </div>
      </header>

      <section className="arena-heading">
        <div>
          <span className="eyebrow">OpenAI WebMCP Challenge · Episode {episodeId}</span>
          <h1>Reconstruct the missing motion.</h1>
        </div>
        <div className="arena-actions">
          <p>Two bodies. One clock. Hidden reward.</p>
          <button className="dice-button" onClick={rollHiddenEpisode} aria-label="Human only: roll a new hidden BVH episode">
            <Dices size={15} /> Roll hidden BVH
          </button>
        </div>
      </section>

      <div className={`arena-grid${agentView ? ' arena-grid--agent' : ''}`}>
        <MotionPane side="candidate" label="Current reconstruction" sublabel="mutable surrogate" />
        {!agentView && <><div className="versus" aria-hidden="true">VS</div><MotionPane side="truth" label="Ground truth" sublabel="hidden CMU BVH · immutable" /></>}
      </div>

      <Timeline />
      <RolloutStrip />
    </main>
  );
}
