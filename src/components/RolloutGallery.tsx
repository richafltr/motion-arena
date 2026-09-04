import type { CSSProperties } from 'react';
import type { Rollout } from '../types';

type RolloutGalleryProps = {
  rollouts: Rollout[];
  selectedId: string;
  bestId: string;
  onSelect: (id: string) => void;
};

type MotionStyle = CSSProperties & {
  '--swing': string;
  '--phase': string;
  '--tempo': string;
};

const sourceName = (rollout: Rollout) => {
  if (rollout.source === 'local-student') return `student g${rollout.motion.residualPolicy?.generation ?? 0}`;
  if (rollout.source === 'momask-live') return 'MoMask live';
  if (rollout.source === 'baseline') return 'baseline prior';
  return 'prepared search';
};

function MotionGlyph({ rollout }: { rollout: Rollout }) {
  const uncertainty = Math.max(5, Math.min(22, (100 - rollout.reward.combined) * 0.34));
  const style = {
    '--swing': `${uncertainty}deg`,
    '--phase': `${-((rollout.seed % 17) / 10)}s`,
    '--tempo': `${1.05 + (rollout.seed % 5) * 0.08}s`,
  } as MotionStyle;
  return (
    <svg className="motion-glyph" viewBox="0 0 96 70" aria-hidden="true" style={style}>
      <path className="motion-window" d="M8 59 H88" />
      <g className="motion-echo motion-echo--one" transform="translate(-10 0)">
        <circle cx="48" cy="14" r="5" /><path d="M48 19V40M48 24L37 36M48 24L58 34M48 40L40 57M48 40L57 57" />
      </g>
      <g className="motion-echo motion-echo--two" transform="translate(10 0)">
        <circle cx="48" cy="14" r="5" /><path d="M48 19V40M48 24L37 36M48 24L58 34M48 40L40 57M48 40L57 57" />
      </g>
      <g className="motion-figure">
        <circle cx="48" cy="14" r="5" />
        <path className="motion-torso" d="M48 19V40" />
        <g className="motion-limb motion-limb--left-arm"><path d="M48 24L36 38" /></g>
        <g className="motion-limb motion-limb--right-arm"><path d="M48 24L60 38" /></g>
        <g className="motion-limb motion-limb--left-leg"><path d="M48 40L39 59" /></g>
        <g className="motion-limb motion-limb--right-leg"><path d="M48 40L58 59" /></g>
      </g>
    </svg>
  );
}

export function RolloutGallery({ rollouts, selectedId, bestId, onSelect }: RolloutGalleryProps) {
  return (
    <div className="rollout-gallery" aria-label="Motion rollout search history">
      {rollouts.map((rollout, index) => {
        const selected = rollout.id === selectedId;
        const best = rollout.id === bestId;
        return (
          <button
            key={rollout.id}
            className={`rollout-card${selected ? ' selected' : ''}${best ? ' best' : ''}`}
            onClick={() => onSelect(rollout.id)}
            aria-label={`Replay rollout ${index + 1}, score ${rollout.reward.combined.toFixed(1)}`}
          >
            <div className="rollout-preview">
              <MotionGlyph rollout={rollout} />
              <span className="rollout-source">{sourceName(rollout)}</span>
            </div>
            <div className="rollout-card-score">
              <span>#{String(index + 1).padStart(2, '0')}</span>
              <strong>{rollout.reward.combined.toFixed(1)}</strong>
              {best && <em>best</em>}
            </div>
            <div className="rollout-card-meta">
              <span>{rollout.scoreDelta >= 0 ? '+' : ''}{rollout.scoreDelta.toFixed(1)}</span>
              <span>seed {rollout.seed}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
