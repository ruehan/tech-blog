import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PerspectiveCamera, MathUtils, Vector3 } from 'three';
import { applyRoomCamera } from '../src/room-camera.ts';

const binary = readFileSync('blog-room-v27/interactive/room.glb');
const jsonLength = binary.readUInt32LE(12);
const gltf = JSON.parse(binary.subarray(20, 20 + jsonLength).toString());
const cameraIndex = gltf.nodes.findIndex((node: { name: string }) => node.name === 'WEB_Camera_Main');
const node = gltf.nodes[cameraIndex];
const projection = gltf.cameras[node.camera].perspective;

function sourceCamera() {
  const camera = new PerspectiveCamera(MathUtils.radToDeg(projection.yfov), projection.aspectRatio, projection.znear, projection.zfar);
  camera.position.fromArray(node.translation);
  camera.quaternion.fromArray(node.rotation);
  return camera;
}

function frameCamera(name: string, last = false) {
  const camera = sourceCamera();
  const clip = gltf.animations.find((animation: { name: string }) => animation.name === name);
  for (const channel of clip.channels) {
    if (channel.target.node !== cameraIndex) continue;
    const accessor = gltf.accessors[clip.samplers[channel.sampler].output];
    const view = gltf.bufferViews[accessor.bufferView];
    const width = accessor.type === 'VEC4' ? 4 : 3;
    const offset = 28 + jsonLength + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + (last ? accessor.count - 1 : 0) * (view.byteStride ?? width * 4);
    const values = Array.from({ length: width }, (_, i) => binary.readFloatLE(offset + i * 4));
    if (channel.target.path === 'translation') camera.position.fromArray(values);
    if (channel.target.path === 'rotation') camera.quaternion.fromArray(values);
  }
  return camera;
}

test('animation camera adapter preserves the original GLB projection without extra zoom', () => {
  const source = sourceCamera();
  const output = new PerspectiveCamera(28, source.aspect, 0.1, 150);
  applyRoomCamera(output, source);
  assert.ok(output.position.distanceTo(source.position) < 1e-8);
  assert.ok(output.quaternion.clone().normalize().angleTo(source.quaternion.clone().normalize()) < 1e-6);
  assert.ok(Math.abs(output.fov - source.fov) < 1e-10);
  assert.equal(output.near, source.near);
  assert.equal(output.far, source.far);
  assert.equal(output.zoom, source.zoom);
});

test('matching authored camera poses retain identical projection across animation clips', () => {
  for (const aspect of [16 / 9, 1280 / 730, 390 / 544]) {
    const resting = new PerspectiveCamera(50, aspect);
    applyRoomCamera(resting, sourceCamera());
    resting.updateMatrixWorld(true);
    for (const name of ['Book_Click', 'Music_Click', 'Room_Opening']) {
      const animated = new PerspectiveCamera(50, aspect);
      applyRoomCamera(animated, frameCamera(name, name === 'Room_Opening'), name === 'Music_Click' ? [50, 36] : undefined);
      animated.updateMatrixWorld(true);
      for (const point of [[0, 1, 0], [-3, 0, 2], [3, 3, -2]]) {
        const expected = new Vector3(...point).project(resting);
        const actual = new Vector3(...point).project(animated);
        assert.ok(expected.distanceTo(actual) < 1e-6, `${name}: mismatched framing at aspect ${aspect}`);
      }
    }
  }
});
