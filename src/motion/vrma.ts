import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import type { VRM } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export async function loadVrmaClip(url: string, vrm: VRM) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const animation = gltf.userData.vrmAnimations?.[0];
  if (!animation) throw new Error('The VRMA asset did not contain a VRM animation.');
  return createVRMAnimationClip(animation, vrm);
}
