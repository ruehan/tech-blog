import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import midiPackage from '@tonejs/midi';
import { decodePianoMidi, PianoKeyTimeline } from '../src/piano-midi.ts';
import { checkPianoCatalog } from '../scripts/check-piano.mjs';

const { Midi } = midiPackage;
const bytes = (midi: InstanceType<typeof Midi>) => new Uint8Array(midi.toArray()).buffer;

test('MIDI decoding follows tempo changes, track selection, sustain and 88-key range', () => {
  const midi = new Midi();
  midi.header.tempos = [{ ticks: 0, bpm: 120 }, { ticks: 480, bpm: 60 }];
  midi.header.update();
  const track = midi.addTrack();
  track.addNote({ midi: 60, ticks: 0, durationTicks: 240, velocity: 0.7 });
  track.addNote({ midi: 64, ticks: 480, durationTicks: 480, velocity: 0.5 });
  track.addNote({ midi: 10, ticks: 0, durationTicks: 240 });
  track.addCC({ number: 64, ticks: 0, value: 1 });
  track.addCC({ number: 64, ticks: 480, value: 0 });
  const drum = midi.addTrack(); drum.channel = 9; drum.addNote({ midi: 40, ticks: 0, durationTicks: 240 });
  const song = decodePianoMidi(bytes(midi));
  assert.equal(song.notes.length, 2); assert.equal(song.omitted, 1);
  assert.equal(song.notes[0].duration, 0.25); assert.equal(song.notes[0].soundDuration, 0.5);
  assert.equal(song.notes[1].time, 0.5); assert.equal(song.notes[1].duration, 1);
  assert.equal(song.duration, 1.5);
  assert.throws(() => decodePianoMidi(bytes(midi), [9]), /트랙 번호/);
  assert.throws(() => decodePianoMidi(bytes(midi), [1]), /음표가 없어요/);
});

test('overlapping key holds survive note-off and reset when playback restarts', () => {
  const notes = [0, 0.25].map(time => ({ midi: 60, time, duration: 0.5, soundDuration: 1, velocity: 1 }));
  const timeline = new PianoKeyTimeline(notes);
  assert.equal(timeline.at(0.3).get(60), 2);
  assert.equal(timeline.at(0.5).get(60), 1);
  assert.equal(timeline.at(0.75).size, 0);
  assert.equal(timeline.at(0.1).get(60), 1);
});

test('catalog references playable, self-contained MIDI files', async () => {
  await checkPianoCatalog();
  const catalog = JSON.parse(await readFile('content/piano-tracks.json', 'utf8'));
  for (const track of catalog) {
    const buffer = await readFile(`public${track.file}`);
    assert.ok(decodePianoMidi(new Uint8Array(buffer).buffer).notes.length > 0);
  }
  assert.throws(() => decodePianoMidi(new ArrayBuffer(3)), /MIDI/);
});
