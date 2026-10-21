import { MathUtils, Mesh, type MeshStandardMaterial, type Object3D, type PerspectiveCamera, type RectAreaLight } from 'three';

export const ROOM_ALIGNMENT_SECONDS = 0.65;

/** Snapshot the displayed frame before replacing any animation actions. */
export function captureRoomPose(root: Object3D, camera: PerspectiveCamera, materials: MeshStandardMaterial[], lights: Iterable<RectAreaLight>) {
  const nodes: { object: Object3D; position: Object3D['position']; quaternion: Object3D['quaternion']; scale: Object3D['scale']; morphs?: number[] }[] = [];
  root.traverse(object => nodes.push({
    object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(),
    morphs: object instanceof Mesh ? object.morphTargetInfluences?.slice() : undefined,
  }));
  return {
    nodes,
    materials: materials.map(material => ({ material, color: material.color.clone(), emissive: material.emissive.clone(), strength: material.emissiveIntensity })),
    lights: [...lights].map(light => ({ light, intensity: light.intensity })),
    camera: { object: camera, position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov, zoom: camera.zoom, near: camera.near, far: camera.far },
  };
}

export type RoomPose = ReturnType<typeof captureRoomPose>;

/** Both poses belong to the same scene. Freeze animation time while aligning. */
export function blendRoomPose(from: RoomPose, to: RoomPose, progress: number) {
  const weight = MathUtils.smootherstep(progress, 0, 1);
  for (const [index, target] of to.nodes.entries()) {
    const start = from.nodes[index];
    target.object.position.lerpVectors(start.position, target.position, weight);
    target.object.quaternion.slerpQuaternions(start.quaternion, target.quaternion, weight);
    target.object.scale.lerpVectors(start.scale, target.scale, weight);
    if (target.object instanceof Mesh && target.object.morphTargetInfluences && target.morphs && start.morphs) {
      const influences = target.object.morphTargetInfluences;
      const fromMorphs = start.morphs;
      target.morphs.forEach((value, i) => { influences[i] = MathUtils.lerp(fromMorphs[i], value, weight); });
    }
  }
  for (const [index, target] of to.materials.entries()) {
    const start = from.materials[index];
    target.material.color.lerpColors(start.color, target.color, weight);
    target.material.emissive.lerpColors(start.emissive, target.emissive, weight);
    target.material.emissiveIntensity = MathUtils.lerp(start.strength, target.strength, weight);
  }
  for (const [index, target] of to.lights.entries()) target.light.intensity = MathUtils.lerp(from.lights[index].intensity, target.intensity, weight);
  const camera = to.camera.object;
  camera.position.lerpVectors(from.camera.position, to.camera.position, weight);
  camera.quaternion.slerpQuaternions(from.camera.quaternion, to.camera.quaternion, weight);
  for (const key of ['fov', 'zoom', 'near', 'far'] as const) camera[key] = MathUtils.lerp(from.camera[key], to.camera[key], weight);
  camera.updateProjectionMatrix();
}
