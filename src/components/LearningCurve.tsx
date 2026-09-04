import type { Rollout } from '../types';

const WIDTH = 640;
const HEIGHT = 76;
const PAD_X = 14;
const PAD_Y = 10;

export function LearningCurve({ rollouts }: { rollouts: Rollout[] }) {
  const bestSoFar = rollouts.reduce<number[]>((curve, rollout) => {
    curve.push(Math.max(curve.at(-1) ?? 0, rollout.reward.combined));
    return curve;
  }, []);
  const floor = Math.max(0, Math.floor((Math.min(...bestSoFar, 100) - 10) / 10) * 10);
  const x = (index: number) => PAD_X + (bestSoFar.length <= 1 ? 0 : index / (bestSoFar.length - 1)) * (WIDTH - PAD_X * 2);
  const y = (score: number) => HEIGHT - PAD_Y - ((score - floor) / Math.max(1, 100 - floor)) * (HEIGHT - PAD_Y * 2);
  const points = bestSoFar.map((score, index) => `${x(index).toFixed(1)},${y(score).toFixed(1)}`).join(' ');
  const first = bestSoFar[0] ?? 0;
  const latest = bestSoFar.at(-1) ?? 0;
  const area = bestSoFar.length > 0
    ? `M ${x(0)} ${HEIGHT - PAD_Y} L ${bestSoFar.map((score, index) => `${x(index)} ${y(score)}`).join(' L ')} L ${x(bestSoFar.length - 1)} ${HEIGHT - PAD_Y} Z`
    : '';

  return (
    <section className="learning-curve" aria-label={`Best-so-far reward improved from ${first.toFixed(1)} to ${latest.toFixed(1)}`}>
      <div className="learning-curve-heading">
        <span>Learning curve · best so far</span>
        <strong>{first.toFixed(1)} <em>→</em> {latest.toFixed(1)} <small>+{Math.max(0, latest - first).toFixed(1)}</small></strong>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Best reward by rollout">
        <line className="curve-goal" x1={PAD_X} y1={y(100)} x2={WIDTH - PAD_X} y2={y(100)} />
        <text className="curve-goal-label" x={WIDTH - PAD_X} y={y(100) + 7}>TRUTH · 100</text>
        <path className="curve-area" d={area} />
        <polyline className="curve-line" points={points} />
        {bestSoFar.map((score, index) => (
          <circle key={`${index}-${score}`} className={index === bestSoFar.length - 1 ? 'curve-point curve-point--latest' : 'curve-point'} cx={x(index)} cy={y(score)} r={index === bestSoFar.length - 1 ? 3.7 : 2.2}>
            <title>{`Rollout ${index + 1}: best reward ${score.toFixed(1)}`}</title>
          </circle>
        ))}
      </svg>
    </section>
  );
}
