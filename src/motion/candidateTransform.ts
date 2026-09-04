import { boundaryBlend, evaluatePolicy, STUDENT_JOINTS } from '../student/tinyResidualPolicy';
import type { ResidualPolicy } from '../types';

const MAX_PHASE_LAG_SECONDS = 1.35;

const CHANNEL_LAG_SCALE: Partial<Record<(typeof STUDENT_JOINTS)[number], number>> = {
  Root: 0.72,
  Hips: 0.84,
  LeftUpLeg: 1.18,
  RightUpLeg: 0.76,
  LeftLeg: 1.08,
  RightLeg: 0.68,
  LeftArm: 0.82,
  RightArm: 1.16,
  LeftForeArm: 0.72,
  RightForeArm: 1.06,
};

/** The interior where candidate error is fully expressed, excluding the locked boundary blend. */
export function getHiddenComparisonWindow(hiddenSpan: [number, number], duration: number): [number, number] {
  const edge = Math.min(0.12, (hiddenSpan[1] - hiddenSpan[0]) * 0.25);
  const inset = Math.min(0.015, Math.max(0, (hiddenSpan[1] - hiddenSpan[0] - edge * 2) * 0.08));
  const start = (hiddenSpan[0] + edge + inset) * duration;
  const end = (hiddenSpan[1] - edge - inset) * duration;
  if (end - start >= 0.45) return [start, end];
  const center = ((hiddenSpan[0] + hiddenSpan[1]) / 2) * duration;
  return [Math.max(0, center - 0.25), Math.min(duration, center + 0.25)];
}

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
  const lagScale = channel === null ? 1 : CHANNEL_LAG_SCALE[channel] ?? 1;
  const lag = Math.max(0, 1 - strength) * MAX_PHASE_LAG_SECONDS * lagScale * blend;
  return {
    blend,
    strength,
    sourceTime: Math.max(0, Math.min(duration, time - lag)),
  };
}
