import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import {
  AnimationClip,
  AnimationUtils,
  Quaternion,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
  type KeyframeTrack,
} from 'three';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import { STUDENT_JOINTS } from '../student/tinyResidualPolicy';
import type { ResidualPolicy } from '../types';
import { getCandidateTransform } from './candidateTransform';

const CMU_TO_VRM: Record<string, VRMHumanBoneName> = {
  Hips: 'hips',
  LowerBack: 'spine',
  Spine: 'chest',
  Spine1: 'upperChest',
  Neck: 'neck',
  Head: 'head',
  LeftShoulder: 'leftShoulder',
  LeftArm: 'leftUpperArm',
  LeftForeArm: 'leftLowerArm',
  LeftHand: 'leftHand',
  RightShoulder: 'rightShoulder',
  RightArm: 'rightUpperArm',
  RightForeArm: 'rightLowerArm',
  RightHand: 'rightHand',
  LeftUpLeg: 'leftUpperLeg',
  LeftLeg: 'leftLowerLeg',
  LeftFoot: 'leftFoot',
  LeftToeBase: 'leftToes',
  RightUpLeg: 'rightUpperLeg',
  RightLeg: 'rightLowerLeg',
  RightFoot: 'rightFoot',
  RightToeBase: 'rightToes',
};

const CMU_VERTICAL_TO_METERS = 0.055;
const CMU_HORIZONTAL_TO_METERS = 0.02;
const CMU_FPS = 120;
const restQuaternion = new Quaternion();
const frameQuaternion = new Quaternion();

export type BvhRetargetOptions = {
  duration: number;
  startSeconds?: number;
  variant?: number;
  hiddenSpan?: [number, number];
  residualPolicy?: ResidualPolicy;
};

/** Retargets a MotionBuilder-friendly CMU BVH onto the VRM normalized skeleton. */
export async function loadBvhClip(url: string, vrm: VRM, options: BvhRetargetOptions): Promise<AnimationClip> {
  const result = await new BVHLoader().loadAsync(url);
  const startFrame = Math.max(1, Math.floor((options.startSeconds ?? 0) * CMU_FPS));
  const availableFrames = Math.floor(result.clip.duration * CMU_FPS);
  const endFrame = Math.min(availableFrames, startFrame + Math.floor(options.duration * CMU_FPS));
  const segment = AnimationUtils.subclip(result.clip, `cmu-${url.split('/').at(-1)}`, startFrame, endFrame, CMU_FPS);
  const tracks: KeyframeTrack[] = [];

  for (const sourceTrack of segment.tracks) {
    const separator = sourceTrack.name.lastIndexOf('.');
    const sourceBone = sourceTrack.name.slice(0, separator);
    const property = sourceTrack.name.slice(separator + 1);
    const humanBone = CMU_TO_VRM[sourceBone];
    if (!humanBone) continue;
    const target = vrm.humanoid.getNormalizedBoneNode(humanBone);
    if (!target) continue;

    if (property === 'quaternion') {
      const sourceRestTrack = result.clip.tracks.find((track) => track.name === sourceTrack.name);
      if (!sourceRestTrack || sourceRestTrack.values.length < 4) continue;
      restQuaternion.fromArray(sourceRestTrack.values, 0).invert();
      const values = Array.from(sourceTrack.values);
      const interpolant = sourceTrack.InterpolantFactoryMethodLinear(new Float32Array(4));
      for (let index = 0; index < values.length; index += 4) {
        const keyframe = index / 4;
        const time = sourceTrack.times[keyframe] ?? 0;
        const hiddenSpan = options.hiddenSpan ?? [0, 1];
        const channel = STUDENT_JOINTS.includes(sourceBone as (typeof STUDENT_JOINTS)[number])
          ? sourceBone as (typeof STUDENT_JOINTS)[number]
          : null;
        const transform = options.variant === undefined
          ? { blend: 0, strength: 1, sourceTime: time }
          : getCandidateTransform(options.variant, options.residualPolicy, channel, time, options.duration, hiddenSpan);
        frameQuaternion
          .fromArray(interpolant.evaluate(transform.sourceTime))
          .premultiply(restQuaternion)
          .normalize()
          .slerp(new Quaternion(), transform.blend * (1 - transform.strength))
          .toArray(values, index);
      }
      tracks.push(new QuaternionKeyframeTrack(
        `${target.name}.quaternion`,
        Array.from(sourceTrack.times),
        values,
      ));
    } else if (sourceBone === 'Hips' && property === 'position') {
      const values = Array.from(sourceTrack.values);
      const originX = values[0] ?? 0;
      const originZ = values[2] ?? 0;
      const interpolant = sourceTrack.InterpolantFactoryMethodLinear(new Float32Array(3));
      for (let index = 0; index < values.length; index += 3) {
        const keyframe = index / 3;
        const time = sourceTrack.times[keyframe] ?? 0;
        const hiddenSpan = options.hiddenSpan ?? [0, 1];
        const transform = options.variant === undefined
          ? { blend: 0, strength: 1, sourceTime: time }
          : getCandidateTransform(options.variant, options.residualPolicy, 'Root', time, options.duration, hiddenSpan);
        const sampled = interpolant.evaluate(transform.sourceTime);
        const strength = 1 - transform.blend + transform.blend * transform.strength;
        values[index] = ((sampled[0] ?? 0) - originX) * CMU_HORIZONTAL_TO_METERS * strength;
        values[index + 1] = (sampled[1] ?? 0) * CMU_VERTICAL_TO_METERS;
        values[index + 2] = ((sampled[2] ?? 0) - originZ) * CMU_HORIZONTAL_TO_METERS * strength;
      }
      tracks.push(new VectorKeyframeTrack(`${target.name}.position`, Array.from(sourceTrack.times), values));
    }
  }

  if (tracks.length === 0) throw new Error(`BVH retargeting produced no humanoid tracks for ${url}.`);
  return new AnimationClip(`retargeted-${url.split('/').at(-1)}`, segment.duration, tracks).optimize();
}

export function fitClipDuration(source: AnimationClip, duration: number): AnimationClip {
  const clip = source.clone();
  if (clip.duration <= 0 || Math.abs(clip.duration - duration) < 0.001) return clip;
  const scale = duration / clip.duration;
  clip.tracks.forEach((track) => track.scale(scale));
  clip.duration = duration;
  return clip;
}
