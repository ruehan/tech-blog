import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshStandardMaterial, RectAreaLight } from 'three';
import { sampleInto, type RuntimeClip } from '../src/animation.ts';
import { compileRuntimeClips } from '../src/runtime-tracks.ts';

test('sidecar bindings preserve interpolation, material aliases, and light units without per-frame output allocation', () => {
  const output: number[] = [];
  assert.equal(sampleInto([[1, 2], [3, 4]], 0.25, output, 2), output);
  assert.deepEqual(output, [2, 3]);
  assert.deepEqual(sampleInto([[1, 2], [3, 4]], 100, output, 2), [3, 4]);
  assert.deepEqual(sampleInto([[1, 2], [3, 4]], -1, output, 2), [1, 2]);
  assert.deepEqual(sampleInto([], 0, output), []);
  const a = new MeshStandardMaterial(), b = new MeshStandardMaterial();
  const light = new RectAreaLight();
  const clip: RuntimeClip = {
    fps: 2,
    materials: [{ bindings: [{ gltf_material_indices: [7, 7, 8] }], channels: {
      baseColor: [[0, 0.2, 0.4], [1, 0.6, 0.8]], emissiveColor: [[0, 0, 0], [1, 1, 1]], emissiveStrength: [[0], [4]],
    } }], lights: [{ node: 'lamp', source_blender_watts: [[100], [300]] }],
  };
  const compiled = compileRuntimeClips({ smooth: clip, step: { ...clip, interpolation: 'STEP' } }, new Map([[7, [a, b]]]), new Map([['lamp', light]]));
  compiled.get('smooth')!(0.25);
  assert.deepEqual(a.color.toArray(), [0.5, 0.4, 0.6000000000000001]);
  assert.deepEqual(b.color.toArray(), a.color.toArray());
  assert.deepEqual(a.emissive.toArray(), [0.5, 0.5, 0.5]);
  assert.equal(a.emissiveIntensity, 2);
  assert.equal(light.intensity, 2);
  compiled.get('step')!(0.25);
  assert.equal(a.emissiveIntensity, 0);
  assert.equal(light.intensity, 1);
});
