import type { AnimationClip, QuaternionKeyframeTrack } from 'three';
import { Quaternion } from 'three';

/** Creates a deterministic reconstruction variant while preserving the source truth clip. */
export function createCandidateClip(source: AnimationClip, fidelity: number): AnimationClip {
  const clip = source.clone();
  const identity = new Quaternion();
  const current = new Quaternion();

  for (const track of clip.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    const values = (track as QuaternionKeyframeTrack).values;
    for (let index = 0; index < values.length; index += 4) {
      current.fromArray(values, index);
      identity.clone().slerp(current, fidelity).normalize().toArray(values, index);
    }
  }
  clip.name = `candidate-${fidelity.toFixed(3)}`;
  return clip;
}
