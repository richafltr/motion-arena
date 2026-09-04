import type { ResidualPolicy } from '../types';

export const STUDENT_INPUTS = 3;
export const STUDENT_HIDDEN = 8;
export const STUDENT_OUTPUTS = 10;
export const STUDENT_PARAMETER_COUNT =
  STUDENT_INPUTS * STUDENT_HIDDEN + STUDENT_HIDDEN +
  STUDENT_HIDDEN * STUDENT_HIDDEN + STUDENT_HIDDEN +
  STUDENT_HIDDEN * STUDENT_OUTPUTS + STUDENT_OUTPUTS;
export const STUDENT_SIZE_BYTES = STUDENT_PARAMETER_COUNT * Float32Array.BYTES_PER_ELEMENT;

const silu = (value: number) => value / (1 + Math.exp(-value));

export const STUDENT_JOINTS = [
  'Root', 'Hips', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg',
  'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm',
] as const;

export function createZeroPolicy(generation = 0): ResidualPolicy {
  return { architecture: '3-8-8-10', weights: Array(STUDENT_PARAMETER_COUNT).fill(0), generation };
}

export function evaluatePolicy(policy: ResidualPolicy | undefined, normalizedTime: number, spanPosition: number): number[] {
  if (!policy || policy.weights.length !== STUDENT_PARAMETER_COUNT) return Array(STUDENT_OUTPUTS).fill(0);
  const input = [normalizedTime * 2 - 1, Math.sin(normalizedTime * Math.PI * 2), spanPosition * 2 - 1];
  const { weights } = policy;
  let cursor = 0;
  const hidden1 = Array(STUDENT_HIDDEN).fill(0) as number[];
  for (let output = 0; output < STUDENT_HIDDEN; output += 1) {
    let sum = 0;
    for (let item = 0; item < STUDENT_INPUTS; item += 1) sum += input[item]! * weights[cursor++]!;
    hidden1[output] = silu(sum + weights[STUDENT_INPUTS * STUDENT_HIDDEN + output]!);
  }
  cursor = STUDENT_INPUTS * STUDENT_HIDDEN + STUDENT_HIDDEN;
  const hidden2 = Array(STUDENT_HIDDEN).fill(0) as number[];
  const hidden2Bias = cursor + STUDENT_HIDDEN * STUDENT_HIDDEN;
  for (let output = 0; output < STUDENT_HIDDEN; output += 1) {
    let sum = 0;
    for (let item = 0; item < STUDENT_HIDDEN; item += 1) sum += hidden1[item]! * weights[cursor++]!;
    hidden2[output] = silu(sum + weights[hidden2Bias + output]!);
  }
  cursor = hidden2Bias + STUDENT_HIDDEN;
  const outputBias = cursor + STUDENT_HIDDEN * STUDENT_OUTPUTS;
  return Array.from({ length: STUDENT_OUTPUTS }, (_, output) => {
    let sum = 0;
    for (let item = 0; item < STUDENT_HIDDEN; item += 1) sum += hidden2[item]! * weights[cursor + item * STUDENT_OUTPUTS + output]!;
    return Math.tanh(sum + weights[outputBias + output]!) * 0.45;
  });
}

export function seededPolicy(seed: number, generation: number, center?: ResidualPolicy, sigma = 0.18): ResidualPolicy {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(1e-7, random()))) * Math.cos(2 * Math.PI * random());
  const base = center?.weights ?? createZeroPolicy().weights;
  return {
    architecture: '3-8-8-10',
    generation,
    weights: base.map((value) => Number((value + gaussian() * sigma).toFixed(6))),
  };
}

export function boundaryBlend(time: number, span: [number, number]): number {
  const [start, end] = span;
  if (time <= start || time >= end) return 0;
  const edge = Math.min(0.12, (end - start) * 0.25);
  const smooth = (value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * (3 - 2 * clamped);
  };
  return Math.min(smooth((time - start) / edge), smooth((end - time) / edge), 1);
}
