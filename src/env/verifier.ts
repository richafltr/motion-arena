import { AnimationUtils, Quaternion, type KeyframeTrack, Vector3 } from 'three';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import type { MotionAsset, RewardMetrics } from '../types';
import { ACTIVE_REWARD_WEIGHTS } from './rewardConfig';
import { STUDENT_JOINTS } from '../student/tinyResidualPolicy';
import { getCandidateTransform } from '../motion/candidateTransform';

const FPS = 120;
const SAMPLE_COUNT = 72;
const POSE_JOINTS = [
  'Hips', 'LowerBack', 'Spine', 'Spine1', 'Neck', 'Head',
  'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
];

type ClipTracks = {
  quaternions: Map<string, KeyframeTrack>;
  positions: Map<string, KeyframeTrack>;
  rest: Map<string, Quaternion>;
};

const clipCache = new Map<string, Promise<ClipTracks>>();
const identity = new Quaternion();

function round(value: number) {
  return Number(Math.max(0, Math.min(100, value)).toFixed(1));
}

function loadCanonical(url: string, duration: number): Promise<ClipTracks> {
  const key = `${url}:${duration}`;
  const cached = clipCache.get(key);
  if (cached) return cached;
  const pending = new BVHLoader().loadAsync(url).then((result) => {
    const endFrame = Math.min(Math.floor(result.clip.duration * FPS), 1 + Math.floor(duration * FPS));
    const segment = AnimationUtils.subclip(result.clip, `verify-${url}`, 1, endFrame, FPS);
    const quaternions = new Map<string, KeyframeTrack>();
    const positions = new Map<string, KeyframeTrack>();
    const rest = new Map<string, Quaternion>();
    for (const track of segment.tracks) {
      const dot = track.name.lastIndexOf('.');
      const bone = track.name.slice(0, dot);
      const property = track.name.slice(dot + 1);
      if (property === 'quaternion') {
        quaternions.set(bone, track);
        const original = result.clip.tracks.find((item) => item.name === track.name);
        if (original?.values.length) rest.set(bone, new Quaternion().fromArray(original.values, 0));
      } else if (property === 'position') positions.set(bone, track);
    }
    return { quaternions, positions, rest };
  });
  clipCache.set(key, pending);
  return pending;
}

function sampleTrack(track: KeyframeTrack | undefined, time: number, size: number): number[] {
  if (!track) return Array(size).fill(0);
  return Array.from(track.InterpolantFactoryMethodLinear(new Float32Array(size)).evaluate(time));
}

function canonicalDelta(tracks: ClipTracks, bone: string, time: number) {
  const values = sampleTrack(tracks.quaternions.get(bone), time, 4);
  const rest = tracks.rest.get(bone) ?? identity;
  return new Quaternion().fromArray(values).premultiply(rest.clone().invert()).normalize();
}

function candidateDelta(asset: MotionAsset, tracks: ClipTracks, bone: string, time: number, duration: number, hidden: [number, number]) {
  const transform = getCandidateTransform(
    asset.variant,
    asset.residualPolicy,
    STUDENT_JOINTS.includes(bone as (typeof STUDENT_JOINTS)[number]) ? bone as (typeof STUDENT_JOINTS)[number] : null,
    time,
    duration,
    hidden,
  );
  const delta = canonicalDelta(tracks, bone, transform.sourceTime);
  const { blend, strength } = transform;
  if (blend <= 0) return delta;
  return identity.clone().slerp(delta, 1 - blend + blend * strength).normalize();
}

function rootPosition(asset: MotionAsset, tracks: ClipTracks, time: number, duration: number, hidden: [number, number]) {
  const transform = getCandidateTransform(asset.variant, asset.residualPolicy, 'Root', time, duration, hidden);
  const values = sampleTrack(tracks.positions.get('Hips'), transform.sourceTime, 3);
  const origin = sampleTrack(tracks.positions.get('Hips'), 0, 3);
  const strength = 1 - transform.blend + transform.blend * transform.strength;
  return new Vector3(
    (values[0]! - origin[0]!) * strength,
    values[1]!,
    (values[2]! - origin[2]!) * strength,
  );
}

/** Scores canonical BVH channels before any cosmetic VRM retargeting. */
export async function verifyCandidate(
  candidate: MotionAsset,
  reference: MotionAsset,
  hidden: [number, number],
  duration: number,
): Promise<RewardMetrics> {
  if (!candidate.url.endsWith('.bvh')) throw new Error('The production verifier requires a canonical BVH candidate.');
  const [candidateTracks, referenceTracks] = await Promise.all([
    loadCanonical(candidate.url, duration),
    loadCanonical(reference.url, duration),
  ]);
  let poseError = 0;
  let velocityError = 0;
  let rootError = 0;
  let rootScale = 0;
  let samples = 0;
  let velocitySamples = 0;
  const previousCandidate = new Map<string, Quaternion>();
  const previousReference = new Map<string, Quaternion>();

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const normalized = hidden[0] + (hidden[1] - hidden[0]) * (index / (SAMPLE_COUNT - 1));
    const time = normalized * duration;
    for (const bone of POSE_JOINTS) {
      if (!referenceTracks.quaternions.has(bone) || !candidateTracks.quaternions.has(bone)) continue;
      const candidateQuaternion = candidateDelta(candidate, candidateTracks, bone, time, duration, hidden);
      const referenceQuaternion = canonicalDelta(referenceTracks, bone, time);
      poseError += candidateQuaternion.angleTo(referenceQuaternion);
      samples += 1;
      const priorCandidate = previousCandidate.get(bone);
      const priorReference = previousReference.get(bone);
      if (priorCandidate && priorReference) {
        velocityError += Math.abs(priorCandidate.angleTo(candidateQuaternion) - priorReference.angleTo(referenceQuaternion));
        velocitySamples += 1;
      }
      previousCandidate.set(bone, candidateQuaternion);
      previousReference.set(bone, referenceQuaternion);
    }
    const candidateRoot = rootPosition(candidate, candidateTracks, time, duration, hidden);
    const referenceValues = sampleTrack(referenceTracks.positions.get('Hips'), time, 3);
    const referenceOrigin = sampleTrack(referenceTracks.positions.get('Hips'), 0, 3);
    const referenceRoot = new Vector3(
      referenceValues[0]! - referenceOrigin[0]!,
      referenceValues[1]!,
      referenceValues[2]! - referenceOrigin[2]!,
    );
    rootError += candidateRoot.distanceTo(referenceRoot);
    rootScale += Math.max(1, referenceRoot.length());
  }

  const poseMatch = round(100 * Math.exp(-(poseError / Math.max(1, samples)) / 0.48));
  const rootMatch = round(100 * Math.exp(-(rootError / Math.max(1, rootScale)) * 5));
  const velocityMatch = round(100 * Math.exp(-(velocityError / Math.max(1, velocitySamples)) / 0.06));
  const combined = round(
    poseMatch * ACTIVE_REWARD_WEIGHTS.poseMatch +
    rootMatch * ACTIVE_REWARD_WEIGHTS.rootMatch +
    velocityMatch * ACTIVE_REWARD_WEIGHTS.velocityMatch,
  );
  return { combined, poseMatch, rootMatch, velocityMatch, contactMatch: null };
}

export function clearVerifierCache() {
  clipCache.clear();
}
