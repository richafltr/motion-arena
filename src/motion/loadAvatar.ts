import { MToonMaterialLoaderPlugin, VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { MToonNodeMaterial } from '@pixiv/three-vrm/nodes';
import { VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export async function loadAvatar(url: string, renderer: 'webgpu' | 'webgl2'): Promise<VRM> {
  const loader = new GLTFLoader();
  loader.crossOrigin = 'anonymous';
  loader.register((parser) => {
    if (renderer === 'webgpu') {
      const mtoonMaterialPlugin = new MToonMaterialLoaderPlugin(parser, { materialType: MToonNodeMaterial });
      return new VRMLoaderPlugin(parser, { mtoonMaterialPlugin });
    }
    return new VRMLoaderPlugin(parser);
  });
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) throw new Error('The avatar asset did not contain VRM metadata.');
  VRMUtils.removeUnnecessaryVertices(vrm.scene);
  VRMUtils.combineSkeletons(vrm.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((object) => { object.frustumCulled = false; });
  if (vrm.lookAt) {
    const proxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
    proxy.name = 'lookAtQuaternionProxy';
    vrm.scene.add(proxy);
  }
  return vrm;
}
