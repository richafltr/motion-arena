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
      for (let index = 0; index < values.length; index += 4) {
        frameQuaternion
          .fromArray(values, index)
          .premultiply(restQuaternion)
          .normalize()
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
      for (let index = 0; index < values.length; index += 3) {
        values[index] = ((values[index] ?? 0) - originX) * CMU_HORIZONTAL_TO_METERS;
        values[index + 1] = (values[index + 1] ?? 0) * CMU_VERTICAL_TO_METERS;
        values[index + 2] = ((values[index + 2] ?? 0) - originZ) * CMU_HORIZONTAL_TO_METERS;
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
