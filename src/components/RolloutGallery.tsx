import type { Rollout } from '../types';
import { useRolloutMiniVrms } from './RolloutMiniVrm';

type RolloutGalleryProps = {
  rollouts: Rollout[];
  selectedId: string;
  bestId: string;
  onSelect: (id: string) => void;
};

const sourceName = (rollout: Rollout) => {
  if (rollout.source === 'local-student') return `student g${rollout.motion.residualPolicy?.generation ?? 0}`;
  if (rollout.source === 'momask-live') return 'MoMask live';
  if (rollout.source === 'baseline') return 'baseline prior';
  return 'prepared search';
};

export function RolloutGallery({ rollouts, selectedId, bestId, onSelect }: RolloutGalleryProps) {
  const { canvasRef, galleryRef, registerPreview } = useRolloutMiniVrms();
  return (
    <div className="rollout-gallery-shell">
      <canvas className="rollout-gallery-canvas" ref={canvasRef} aria-hidden="true" />
      <div className="rollout-gallery" ref={galleryRef} aria-label="Motion rollout search history">
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
              <div className="rollout-preview" ref={(preview) => registerPreview(rollout.id, preview)}>
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
    </div>
  );
}
