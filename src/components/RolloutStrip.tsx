import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { getBestRollout, getSelectedRollout, useExperimentStore } from '../state/experimentStore';
import { ScoreDisplay } from './ScoreDisplay';

export function RolloutStrip() {
  const state = useExperimentStore();
  const selected = getSelectedRollout(state);
  const best = getBestRollout(state);

  const handleRollout = () => { void state.runRollout(); };

  return (
    <section className="rollout-strip" aria-label="Episode rollout controls">
      <div className="briefing-row">
        <div className="instruction-block">
          <span className="eyebrow">Ground-truth caption · motion visible, asset withheld</span>
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

      <div className="history-row">
        <div className="progression" aria-label="Score progression">
          {state.rollouts.map((rollout, index) => (
            <span key={rollout.id}>
              <button
                className={rollout.id === state.selectedRolloutId ? 'active' : ''}
                onClick={() => state.selectRollout(rollout.id)}
                title={`${rollout.id.toUpperCase()} · seed ${rollout.seed} · ${rollout.note}`}
              >
                {rollout.reward.combined.toFixed(1)}
              </button>
              {index < state.rollouts.length - 1 && <ArrowRight size={12} />}
            </span>
          ))}
        </div>
        <div className="rollout-meta">
          <span>{selected?.id.toUpperCase()}</span>
          <span>seed {selected?.seed}</span>
          <span>g {selected?.settings.guidance.toFixed(2)}</span>
          {state.status === 'submitted' && <span className="submitted"><Check size={12} /> submitted</span>}
        </div>
      </div>
      {state.error && <button className="error-toast" onClick={state.clearError}>{state.error}</button>}
    </section>
  );
}
