import { boundaryBlend, evaluatePolicy, STUDENT_JOINTS } from '../student/tinyResidualPolicy';
import type { ResidualPolicy } from '../types';

const MAX_PHASE_LAG_SECONDS = 0.42;

export function getCandidateTransform(
  variant: number,
  policy: ResidualPolicy | undefined,
  channel: (typeof STUDENT_JOINTS)[number] | null,
  time: number,
  duration: number,
  hiddenSpan: [number, number],
) {
  const normalizedTime = time / duration;
  const blend = boundaryBlend(normalizedTime, hiddenSpan);
  const spanPosition = (normalizedTime - hiddenSpan[0]) / Math.max(0.001, hiddenSpan[1] - hiddenSpan[0]);
  const outputIndex = channel === null ? -1 : STUDENT_JOINTS.indexOf(channel);
  const residual = outputIndex >= 0 ? evaluatePolicy(policy, normalizedTime, spanPosition)[outputIndex] ?? 0 : 0;
  const strength = Math.max(0.1, Math.min(1.08, variant + residual * blend));
  const lag = Math.max(0, 1 - strength) * MAX_PHASE_LAG_SECONDS * blend;
  return {
    blend,
    strength,
    sourceTime: Math.max(0, Math.min(duration, time - lag)),
  };
}
