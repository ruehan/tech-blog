import { MathUtils, PerspectiveCamera } from 'three';
import { lensToVerticalFov } from './animation.ts';

export const ROOM_SETTLE_SECONDS = 0.65;

/** Blend into the closer resting view after the authored opening has finished. */
export function applyRoomRestZoom(camera: PerspectiveCamera, progress = 1) {
  camera.zoom *= MathUtils.lerp(1, 1.1, MathUtils.smootherstep(progress, 0, 1));
  camera.updateProjectionMatrix();
}

/** Use the exported camera for both the resting view and every animation frame. */
export function applyRoomCamera(camera: PerspectiveCamera, source: PerspectiveCamera, lens?: number[]) {
  source.updateWorldMatrix(true, false);
  source.getWorldPosition(camera.position);
  source.getWorldQuaternion(camera.quaternion);
  // Preserve the authored horizontal framing on narrow screens without moving
  // the camera. Apply exactly the same aspect adaptation during cinematics.
  const frameAspect = Math.min(camera.aspect, source.aspect);
  camera.fov = lens
    ? lensToVerticalFov(lens[0], lens[1], frameAspect)
    : MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(source.fov) / 2) * source.aspect / frameAspect));
  camera.near = source.near;
  camera.far = source.far;
  camera.zoom = source.zoom;
  camera.updateProjectionMatrix();
}
