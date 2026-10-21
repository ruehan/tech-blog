import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { NumberKeyframeTrack, QuaternionKeyframeTrack, InterpolateDiscrete, InterpolateLinear } from 'three';
import { optimizeModel } from '../scripts/optimize-model.mjs';

test('compressed models retain geometry, material indices, interaction roots and sampled animation poses', async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  for (const file of ['interactive/room.glb', 'worlds/computer-desktop.glb', 'worlds/apex-circuit.glb', 'worlds/formula-car-animated.glb']) {
    const input = await readFile(`blog-room-v27/${file}`);
    const output = await optimizeModel(input);
    assert.ok(output.length < input.length * 0.7, `${file}: meaningful size reduction`);
    const before = (await io.readBinary(input)).getRoot();
    const after = (await io.readBinary(output)).getRoot();
    assert.deepEqual(after.listMaterials().map(m => [m.getName(), m.getExtras()]), before.listMaterials().map(m => [m.getName(), m.getExtras()]));
    assert.deepEqual(after.listNodes().map(n => [n.getName(), n.getMatrix(), n.getExtras()]), before.listNodes().map(n => [n.getName(), n.getMatrix(), n.getExtras()]));
    assert.equal(after.listMeshes().length, before.listMeshes().length);
    for (const [index, mesh] of before.listMeshes().entries()) {
      const target = after.listMeshes()[index];
      assert.equal(target.listPrimitives().length, mesh.listPrimitives().length);
      for (const [p, primitive] of mesh.listPrimitives().entries()) {
        const next = target.listPrimitives()[p];
        const sourceAccessors = [primitive.getIndices(), ...primitive.listAttributes(), ...primitive.listTargets().flatMap(t => t.listAttributes())];
        const targetAccessors = [next.getIndices(), ...primitive.listSemantics().map(semantic => next.getAttribute(semantic)), ...primitive.listTargets().flatMap((t, i) => t.listSemantics().map(semantic => next.listTargets()[i].getAttribute(semantic)))];
        assert.equal(targetAccessors.length, sourceAccessors.length);
        for (const [a, accessor] of sourceAccessors.entries()) {
          if (!accessor) { assert.equal(targetAccessors[a], null); continue; }
          const values = accessor.getArray()!;
          const result = targetAccessors[a]!.getArray()!;
          assert.equal(result.length, values.length);
          if (a === 0 && primitive.getMode() === 4) {
            // Meshopt may rotate a triangle's three indices, preserving its winding and geometry.
            for (let i = 0; i < values.length; i += 3) {
              assert.ok([0, 1, 2].some(offset => [0, 1, 2].every(corner => values[i + corner] === result[i + (corner + offset) % 3])), `${file}: identical oriented triangle`);
            }
          } else assert.ok(values.every((value, i) => value === result[i]), `${file}: exact vertex/morph values`);
        }
      }
    }
    assert.deepEqual(after.listAnimations().map(a => a.getName()), before.listAnimations().map(a => a.getName()));
    for (const [index, animation] of before.listAnimations().entries()) {
      const next = after.listAnimations()[index];
      assert.equal(next.listChannels().length, animation.listChannels().length);
      for (const [c, channel] of animation.listChannels().entries()) {
        const target = next.listChannels()[c];
        assert.equal(target.getTargetNode()!.getName(), channel.getTargetNode()!.getName());
        assert.equal(target.getTargetPath(), channel.getTargetPath());
        const source = channel.getSampler()!;
        const result = target.getSampler()!;
        assert.equal(result.getInterpolation(), source.getInterpolation());
        const Track = channel.getTargetPath() === 'rotation' ? QuaternionKeyframeTrack : NumberKeyframeTrack;
        const interpolation = source.getInterpolation() === 'STEP' ? InterpolateDiscrete : InterpolateLinear;
        const from = new Track('value', source.getInput()!.getArray()!, source.getOutput()!.getArray()!, interpolation).createInterpolant();
        const to = new Track('value', result.getInput()!.getArray()!, result.getOutput()!.getArray()!, interpolation).createInterpolant();
        const times = source.getInput()!.getArray()!;
        assert.equal(result.getInput()!.getArray()!.at(-1), times.at(-1));
        for (let k = 0; k < times.length; k++) for (const time of [times[k], (times[k] + times[Math.min(k + 1, times.length - 1)]) / 2]) {
          const expected = from.evaluate(time);
          const actual = to.evaluate(time);
          assert.ok(expected.every((v: number, i: number) => Math.abs(v - actual[i]) < 1e-6), `${file}: ${animation.getName()} at ${time}`);
        }
      }
    }
  }
});
