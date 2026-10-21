// Loaded by the browser test through Vite, with no diagnostics in the app bundle.
import { _roots, addAfterEffect } from '@react-three/fiber';
import { Box3, Object3D, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';

type RoomFrame = { zoom: number; fov: number; quaternion: number[]; position: number[]; controlsEnabled: boolean; editorScale: number; time: number; hover: { book: number; monitor: number; simulator: number; music: number[] } };
let frames: RoomFrame[] = [];
let unsubscribe: (() => void) | undefined;

export function startRoomCapture() {
  unsubscribe?.();
  frames = [];
  unsubscribe = addAfterEffect(() => {
    const canvas = document.querySelector('canvas');
    const state = canvas && _roots.get(canvas)?.store.getState();
    if (!state || !(state.camera instanceof PerspectiveCamera)) return;
    const editor = state.scene.getObjectByName('WEB_Editor_sidebar');
    if (!editor) return;
    frames.push({
      zoom: state.camera.zoom,
      fov: state.camera.fov,
      quaternion: state.camera.quaternion.toArray(),
      position: state.camera.position.toArray(),
      controlsEnabled: state.controls?.enabled ?? false,
      editorScale: editor.scale.x,
      time: performance.now(),
      hover: {
        book: state.scene.getObjectByName('WEB_INT_FeatureBook')!.position.z,
        monitor: state.scene.getObjectByName('WEB_Monitor_Cues_Hover_Top')!.scale.y,
        simulator: state.scene.getObjectByName('WEB_Sim_Cues_Hover_Top')!.scale.y,
        music: [0, 1, 2, 3].map(index => {
          const string = state.scene.getObjectByName(`WEB_Bass_string${index ? `_${String(index).padStart(3, '0')}` : ''}`);
          return (string as Object3D & { morphTargetInfluences: number[] }).morphTargetInfluences[0];
        }),
      },
    });
  });
}

export function roomMeshPoints(id: string) {
  const canvas = document.querySelector('canvas')!;
  const { scene, camera } = _roots.get(canvas)!.store.getState();
  const rect = canvas.getBoundingClientRect();
  const raycaster = new Raycaster();
  const points = new Map<string, { x: number; y: number; mesh: string }>();
  scene.updateMatrixWorld(true);
  scene.traverse(object => {
    if (!('isMesh' in object)) return;
    const center = new Box3().setFromObject(object).getCenter(new Vector3()).project(camera);
    if (center.z < -1 || center.z > 1) return;
    raycaster.setFromCamera(new Vector2(center.x, center.y), camera);
    const hit = raycaster.intersectObjects(scene.children, true)[0]?.object;
    let ancestor = hit;
    while (ancestor && !ancestor.userData.interaction_id) ancestor = ancestor.parent ?? undefined;
    if (!hit || ancestor?.userData.interaction_id !== id) return;
    const x = rect.left + (center.x + 1) * rect.width / 2;
    const y = rect.top + (1 - center.y) * rect.height / 2;
    if (document.elementFromPoint(x, y) !== canvas) return;
    points.set(hit.name, { x, y, mesh: hit.name });
  });
  return [...points.values()];
}

export function readRoomCapture(stop = false) {
  if (stop) unsubscribe?.();
  return frames;
}

export function readWorldCamera() {
  const canvas = document.querySelector('canvas')!;
  const camera = _roots.get(canvas)!.store.getState().camera as PerspectiveCamera;
  return { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov, zoom: camera.zoom, near: camera.near };
}

export function readBookPose() {
  const canvas = document.querySelector('canvas')!;
  const { scene } = _roots.get(canvas)!.store.getState();
  return {
    pageScale: scene.getObjectByName('WEB_ArticlePage_Control')!.scale.toArray(),
    cover: scene.getObjectByName('WEB_Pivot_BookFrontCover')!.quaternion.toArray(),
  };
}

export function readFolderPose() {
  const canvas = document.querySelector('canvas')!;
  const { scene } = _roots.get(canvas)!.store.getState();
  let rotation: number[] | undefined;
  scene.traverse(object => {
    if (object.userData.desktop_component === 'Projects front hinge') rotation = object.quaternion.toArray();
  });
  return rotation;
}
