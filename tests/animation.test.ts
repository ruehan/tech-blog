import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sample, blenderPosition, lensToVerticalFov, type RuntimeClip } from '../src/animation.ts';

test('24fps sidecar interpolation clamps endpoints and preserves step transitions', () => {
  const values = [[0, 20], [10, 30], [20, 40]];
  assert.deepEqual(sample(values, 1 / 48), [5, 25]);
  assert.deepEqual(sample(values, -1), values[0]);
  assert.deepEqual(sample(values, 99), values[2]);
  assert.deepEqual(sample(values, 1 / 48, 24, true), values[0]);
  assert.deepEqual(sample(values, 1 / 24, 24, true), values[1]);
  assert.deepEqual(sample([], 1), []);
});

test('Blender coordinates and camera lens convert to glTF conventions', () => {
  assert.deepEqual(blenderPosition([[1, 0, 0, 9], [0, 1, 0, -11], [0, 0, 1, 8], [0, 0, 0, 1]]), [9, 8, 11]);
  assert.ok(Math.abs(lensToVerticalFov(50, 36, 16 / 9) - 22.895) < 0.01);
});

test('all room sidecar bindings resolve to the supplied GLB materials', () => {
  const binary = readFileSync('blog-room-v27/interactive/room.glb');
  const gltf = JSON.parse(binary.subarray(20, 20 + binary.readUInt32LE(12)).toString());
  const runtime = JSON.parse(readFileSync('blog-room-v27/interactive/runtime-tracks.json', 'utf8'));
  const manifest = JSON.parse(readFileSync('blog-room-v27/interactive/manifest.json', 'utf8'));
  for (const [name, clip] of Object.entries(runtime.clips) as [string, RuntimeClip][]) {
    for (const track of clip.materials) {
      for (const binding of track.bindings) for (const index of binding.gltf_material_indices) assert.ok(gltf.materials[index], `${name}: missing material ${index}`);
      for (const values of Object.values(track.channels)) assert.ok(sample(values, 0).every(Number.isFinite));
    }
    for (const light of clip.lights) assert.ok(manifest.light_setup.some((entry: { name: string }) => entry.name === light.node));
  }
  for (const root of Object.values(manifest.interaction_roots)) assert.ok(gltf.nodes.some((node: { name: string }) => node.name === root));
});
