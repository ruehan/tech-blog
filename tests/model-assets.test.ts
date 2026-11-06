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
  for (const file of ['blog-room-v28/interactive/room-with-piano.glb', ...['computer-desktop.glb', 'apex-circuit.glb', 'formula-car-animated.glb'].map(name => `blog-room-v27/worlds/${name}`)]) {
    const input = await readFile(file);
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

test('v28 piano bindings include all 88 keys and preserve legacy sidecar targets', async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const root = (await io.readBinary(await readFile('blog-room-v28/interactive/room-with-piano.glb'))).getRoot();
  const manifest = JSON.parse(await readFile('blog-room-v28/interactive/manifest.json', 'utf8'));
  const runtime = JSON.parse(await readFile('blog-room-v28/interactive/runtime-tracks.json', 'utf8')).clips;
  const nodes = root.listNodes();
  const piano = nodes.find(node => node.getName() === manifest.piano.root)!;
  assert.equal(piano.getExtras().interaction_id, 'grand_piano');
  assert.deepEqual(manifest.piano.keys.map(key => key.midi), Array.from({ length: 88 }, (_, i) => i + 21));
  for (const key of manifest.piano.keys) {
    const node = nodes.find(node => node.getName() === key.node)!;
    assert.equal(node.getExtras().interaction_id, `piano_note_${key.midi}`);
    assert.ok(piano.listChildren().includes(node));
    const clip = root.listAnimations().find(clip => clip.getName() === `Press_${key.note.replace('#', 'sharp')}`)!;
    assert.equal(clip.listChannels().length, 1);
    assert.equal(clip.listChannels()[0].getTargetNode(), node);
  }
  const performance = root.listAnimations().find(clip => clip.getName() === manifest.piano.performance_clip)!;
  assert.equal(performance.listChannels().filter(channel => channel.getTargetNode()?.getName() === 'WEB_Camera_Main').length, 2);
  assert.equal(new Set(performance.listChannels().map(channel => channel.getTargetNode())).size, 89);
  for (const [name, duration] of [['Music_Click', 15], ['Piano_Performance', 14]] as const) {
    const track = runtime[name];
    assert.equal(track.camera_lens_mm_and_sensor_width_mm.length, duration * track.fps + 1);
  }
  const old = (await io.readBinary(await readFile('blog-room-v27/interactive/room.glb'))).getRoot();
  assert.deepEqual(root.listMaterials().slice(0, old.listMaterials().length).map(m => m.getName()), old.listMaterials().map(m => m.getName()));
  assert.deepEqual(nodes.slice(0, old.listNodes().length).map(n => n.getName()), old.listNodes().map(n => n.getName()));
});
