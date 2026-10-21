import { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { AnimationMixer, Mesh, MeshStandardMaterial } from 'three';
import { asset } from './worlds';

export function useModel(file: string) {
  const gltf = useGLTF(asset(file));
  const model = useMemo(() => {
    const root = gltf.scene.clone(true);
    const materials = new Map<number, MeshStandardMaterial[]>();
    const clones = new Map<MeshStandardMaterial, MeshStandardMaterial>();
    root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const cloneMaterial = (original: MeshStandardMaterial) => {
        if (clones.has(original)) return clones.get(original)!;
        const material = original.clone();
        clones.set(original, material);
        const index = gltf.parser.associations.get(original)?.materials;
        if (index !== undefined) materials.set(index, [...materials.get(index) ?? [], material]);
        return material;
      };
      object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
    });
    return { root, materials, ownedMaterials: [...clones.values()], mixer: new AnimationMixer(root), animations: gltf.animations };
  }, [gltf]);
  useEffect(() => () => {
    model.mixer.stopAllAction();
    model.mixer.uncacheRoot(model.root);
    model.ownedMaterials.forEach(m => m.dispose());
  }, [model]);
  return model;
}
