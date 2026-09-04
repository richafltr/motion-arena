import { Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type CameraPose = { position: Vector3; target: Vector3 };
type Listener = (pose: CameraPose, source: symbol) => void;

let pose: CameraPose = {
  position: new Vector3(0, 1.15, 4.6),
  target: new Vector3(0, 1, 0),
};
const listeners = new Set<Listener>();

export function connectSynchronizedCamera(camera: PerspectiveCamera, controls: OrbitControls) {
  const source = Symbol('motion-pane-camera');
  let applying = false;
  camera.position.copy(pose.position);
  controls.target.copy(pose.target);
  controls.update();

  const onChange = () => {
    if (applying) return;
    pose = { position: camera.position.clone(), target: controls.target.clone() };
    listeners.forEach((listener) => listener(pose, source));
  };
  const receive: Listener = (next, sender) => {
    if (sender === source) return;
    applying = true;
    camera.position.copy(next.position);
    controls.target.copy(next.target);
    controls.update();
    applying = false;
  };

  controls.addEventListener('change', onChange);
  listeners.add(receive);
  return () => {
    controls.removeEventListener('change', onChange);
    listeners.delete(receive);
  };
}
