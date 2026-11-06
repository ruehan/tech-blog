import * as midiModule from '@tonejs/midi';

// Vite uses the ESM build; Node validation uses the package's CommonJS build.
const { Midi } = (Reflect.get(midiModule, 'default') ?? midiModule) as typeof midiModule;

export interface PianoNote { midi: number; time: number; duration: number; soundDuration: number; velocity: number }
export interface PianoSong { notes: PianoNote[]; duration: number; omitted: number }
export interface PianoTrack { id: string; title: string; artist: string; file: string; tracks?: number[] }

/** Tempo changes are resolved by the MIDI parser; key release and pedal release stay separate. */
export function decodePianoMidi(bytes: ArrayBuffer, selectedTracks?: number[]): PianoSong {
  const header = new DataView(bytes);
  if (bytes.byteLength < 14 || header.getUint32(0) !== 0x4d546864 || header.getUint16(8) > 1 || (header.getUint16(12) & 0x8000)) {
    throw new Error('일반 MIDI 파일(형식 0·1, 박자 기준 시간)을 선택해주세요.');
  }
  let midi;
  try { midi = new Midi(bytes); }
  catch { throw new Error('MIDI 파일을 읽지 못했어요. 파일이 손상되지 않았는지 확인해주세요.'); }
  if (selectedTracks?.some(index => !Number.isInteger(index) || index < 0 || index >= midi.tracks.length)) throw new Error('곡에 지정된 트랙 번호를 확인해주세요.');
  const notes: PianoNote[] = [];
  let omitted = 0;
  midi.tracks.forEach((track, index) => {
    if (track.instrument.percussion || selectedTracks && !selectedTracks.includes(index)) return;
    const pedal = track.controlChanges[64] ?? [];
    track.notes.forEach((note, noteIndex) => {
      if (note.midi < 21 || note.midi > 108) { omitted++; return; }
      if (![note.time, note.duration, note.velocity].every(Number.isFinite) || note.time < 0 || note.duration <= 0) return;
      const end = note.time + note.duration;
      let control;
      for (const event of pedal) { if (event.time > end) break; control = event; }
      let release = end;
      if (control && control.value >= 0.5) {
        release = pedal.find(event => event.time > end && event.value < 0.5)?.time ?? Math.max(end, midi.duration);
        const repeated = track.notes.slice(noteIndex + 1).find(next => next.midi === note.midi && next.time >= end);
        if (repeated) release = Math.min(release, repeated.time);
      }
      notes.push({ midi: note.midi, time: note.time, duration: note.duration, soundDuration: release - note.time, velocity: note.velocity });
    });
  });
  notes.sort((a, b) => a.time - b.time || a.midi - b.midi);
  if (!notes.length) throw new Error('88건반 범위에서 연주할 음표가 없어요.');
  if (notes.length > 30000) throw new Error('음표가 너무 많아요. 피아노 트랙만 남긴 MIDI를 사용해주세요.');
  return { notes, omitted, duration: Math.max(...notes.map(note => note.time + note.soundDuration)) };
}

/** Reference counts retain overlapping notes on the same key; reset when seeking backwards. */
export class PianoKeyTimeline {
  private events: { time: number; midi: number; change: number }[];
  private counts = new Map<number, number>();
  private cursor = 0;
  private previous = -1;
  constructor(notes: PianoNote[]) {
    this.events = notes.flatMap(note => [{ time: note.time, midi: note.midi, change: 1 }, { time: note.time + note.duration, midi: note.midi, change: -1 }])
      .sort((a, b) => a.time - b.time || a.change - b.change);
  }
  at(time: number) {
    if (time < this.previous) { this.cursor = 0; this.counts.clear(); }
    while (this.cursor < this.events.length && this.events[this.cursor].time <= time) {
      const event = this.events[this.cursor++];
      const count = (this.counts.get(event.midi) ?? 0) + event.change;
      if (count > 0) this.counts.set(event.midi, count); else this.counts.delete(event.midi);
    }
    this.previous = time;
    return this.counts;
  }
}
