import { Pause, Play, RotateCcw } from 'lucide-react';
import { useExperimentStore } from '../state/experimentStore';

export function Timeline() {
  const playback = useExperimentStore((state) => state.playback);
  const duration = useExperimentStore((state) => state.duration);
  const hiddenSpan = useExperimentStore((state) => state.hiddenSpan);
  const togglePlayback = useExperimentStore((state) => state.togglePlayback);
  const resetPlayback = useExperimentStore((state) => state.resetPlayback);
  const setPlaybackTime = useExperimentStore((state) => state.setPlaybackTime);
  const setPlaybackSpeed = useExperimentStore((state) => state.setPlaybackSpeed);
  const toggleLoopMode = useExperimentStore((state) => state.toggleLoopMode);
  const normalizedTime = playback.time / duration;
  const isHidden = normalizedTime >= hiddenSpan[0] && normalizedTime <= hiddenSpan[1];

  return (
    <div className="timeline">
      <div className="transport">
        <button className="icon-button" onClick={togglePlayback} aria-label={playback.playing ? 'Pause' : 'Play'}>
          {playback.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        <button className="icon-button icon-button--quiet" onClick={resetPlayback} aria-label="Reset playback">
          <RotateCcw size={15} />
        </button>
        <span className="timecode">{playback.time.toFixed(2)} / {duration.toFixed(2)}s</span>
        <button className={`frame-zone${isHidden ? ' frame-zone--hidden' : ''}`} onClick={toggleLoopMode} title="Toggle hidden-span comparison loop">
          {playback.loopHidden ? 'Hidden comparison · looping' : isHidden ? 'Full motion · hidden frame' : 'Full motion · known frame'}
        </button>
      </div>
      <input
        className="scrubber"
        aria-label="Synchronized motion time"
        type="range"
        min="0"
        max={duration}
        step="0.01"
        value={playback.time}
        onChange={(event) => setPlaybackTime(Number(event.target.value))}
      />
      <select
        className="speed-select"
        aria-label="Playback speed"
        value={playback.speed}
        onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
      >
        <option value="0.5">0.5×</option>
        <option value="1">1×</option>
        <option value="1.5">1.5×</option>
        <option value="2">2×</option>
      </select>
    </div>
  );
}
