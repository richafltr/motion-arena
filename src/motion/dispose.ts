import type { Material, Mesh, Object3D, Texture } from 'three';

export function disposeScene(root: Object3D) {
  root.traverse((object) => {
    const mesh = object as Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials as Material[]) {
      for (const value of Object.values(material)) {
        if (value && typeof value === 'object' && 'isTexture' in value) (value as Texture).dispose();
      }
      material.dispose();
    }
  });
}
