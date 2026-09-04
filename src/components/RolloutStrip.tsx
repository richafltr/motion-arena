import { BrainCircuit, Check, Pause, RotateCcw, Sparkles } from 'lucide-react';
import { getBestRollout, getSelectedRollout, useExperimentStore } from '../state/experimentStore';
import { RolloutGallery } from './RolloutGallery';
import { ScoreDisplay } from './ScoreDisplay';

export function RolloutStrip() {
  const state = useExperimentStore();
  const agentView = new URLSearchParams(window.location.search).get('mode') === 'agent';
  const selected = getSelectedRollout(state);
  const best = getBestRollout(state);

  const handleRollout = () => { void state.runRollout(); };
  const sourceLabel = selected?.source === 'momask-live'
    ? 'Live MoMask rollout'
    : selected?.source === 'local-student'
      ? 'Tiny Residual Student'
      : 'Prepared fallback rollout';

  return (
    <section className="rollout-strip" aria-label="Episode rollout controls">
      <div className="briefing-row">
        <div className="instruction-block">
          <span className="eyebrow">Ground-truth caption · {agentView ? 'motion + asset withheld' : 'motion visible, asset withheld'}</span>
          <p>“{state.instruction}”</p>
        </div>
        <div className="score-cluster">
          <ScoreDisplay label="Current" value={selected?.reward.combined ?? 0} />
          <ScoreDisplay label="Best" value={best?.reward.combined ?? 0} accent />
          <div className="budget">
            <span>Budget</span>
            <strong>{state.budgetRemaining}<small> / {state.budgetTotal}</small></strong>
          </div>
          <button
            className="rollout-button"
            onClick={handleRollout}
            disabled={state.status === 'running' || state.budgetRemaining === 0}
          >
            <Sparkles size={15} />
            {state.status === 'running' ? 'Rolling…' : 'Run rollout'}
          </button>
        </div>
      </div>

      <div className="research-row">
        <div className="metric-grid" aria-label="Deterministic verifier metrics">
          <span><em>Pose</em><strong>{selected?.reward.poseMatch.toFixed(1)}</strong></span>
          <span><em>Root</em><strong>{selected?.reward.rootMatch.toFixed(1)}</strong></span>
          <span><em>Velocity</em><strong>{selected?.reward.velocityMatch.toFixed(1)}</strong></span>
          <span><em>Contact</em><strong>{selected?.reward.contactMatch?.toFixed(1) ?? 'N/A'}</strong></span>
        </div>
        <div className="learning-controls">
          <div className="mode-switch" aria-label="Execution mode">
            <button className={state.executionMode === 'browser-student' ? 'active' : ''} onClick={() => state.setExecutionMode('browser-student')}>Local student</button>
            <button className={state.executionMode === 'momask' ? 'active' : ''} onClick={() => state.setExecutionMode('momask')}>Full MoMask</button>
          </div>
          {state.learning.running ? (
            <button className="learning-button" onClick={state.pauseLocalLearning}><Pause size={13} /> Pause</button>
          ) : (
            <button className="learning-button" onClick={state.startLocalLearning} disabled={state.budgetRemaining === 0 || state.status === 'submitted'}><BrainCircuit size={13} /> Start local learning</button>
          )}
          <button className="research-icon" onClick={() => { void state.resetEpisode(); }} aria-label="Reset episode"><RotateCcw size={13} /></button>
        </div>
      </div>

      <div className="research-status">
        <span className="mode-pill">{state.executionMode === 'browser-student' ? 'LOCAL STUDENT · browser' : `FULL MOMASK · ${state.modalStatus === 'live' ? 'Modal live' : 'fallback'}`}</span>
        <span>generation {state.learning.generation}</span>
        <span>evaluated {state.learning.evaluated}</span>
        <span>{sourceLabel}</span>
      </div>

      <div className="mask-section">
        <div className="mask-labels"><span>Known</span><span>Hidden</span><span>Known</span></div>
        <div className="mask-bar" aria-label="Known hidden known temporal mask">
          <div style={{ flex: state.hiddenSpan[0] }} />
          <div className="mask-hidden" style={{ flex: state.hiddenSpan[1] - state.hiddenSpan[0] }}>
            <span>agent reconstructs</span>
          </div>
          <div style={{ flex: 1 - state.hiddenSpan[1] }} />
        </div>
      </div>

      <div className="rollout-search-heading">
        <div><span className="eyebrow">Roll-out search</span><p>Each card is a candidate policy. Click one to replay it on the LEFT.</p></div>
        <div className="rollout-meta">
          <span>{selected?.id.toUpperCase()}</span>
          <span>seed {selected?.seed}</span>
          <span>cfg {selected?.settings.condScale.toFixed(2)}</span>
          {state.status === 'submitted' && <span className="submitted"><Check size={12} /> submitted</span>}
        </div>
      </div>
      <RolloutGallery rollouts={state.rollouts} selectedId={state.selectedRolloutId} bestId={state.bestRolloutId} onSelect={state.selectRollout} />
      {state.error && <button className="error-toast" onClick={state.clearError}>{state.error}</button>}
    </section>
  );
}
