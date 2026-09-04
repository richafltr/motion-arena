import { AnimationMixer, LoopRepeat, type AnimationAction, type AnimationClip, type Object3D } from 'three';

export class SynchronizedMotionPlayer {
  readonly mixer: AnimationMixer;
  private action: AnimationAction | null = null;

  constructor(root: Object3D) {
    this.mixer = new AnimationMixer(root);
  }

  setClip(clip: AnimationClip) {
    this.action?.stop();
    this.mixer.uncacheClip(clip);
    this.action = this.mixer.clipAction(clip);
    this.action.setLoop(LoopRepeat, Infinity).play();
  }

  seek(time: number) {
    this.mixer.setTime(time);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
