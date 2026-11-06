import { PianoKeyTimeline, type PianoNote, type PianoSong } from './piano-midi';

const sampleNotes = Array.from({ length: 15 }, (_, i) => 24 + i * 6);
const sampleName = (midi: number) => `${midi % 12 === 0 ? 'C' : 'Fs'}${Math.floor(midi / 12) - 1}`;
const nearest = (midi: number) => sampleNotes.reduce((best, note) => Math.abs(note - midi) < Math.abs(best - midi) ? note : best);

/** Audio and keyboard visuals share the AudioContext clock, independent of render FPS. */
export class PianoAudio {
  private context?: AudioContext;
  private output?: GainNode;
  private buffers = new Map<number, AudioBuffer>();
  private voices = new Set<AudioBufferSourceNode>();
  private timer?: ReturnType<typeof setInterval>;
  private origin = 0;
  private offset = 0;
  private cursor = 0;
  private generation = 0;
  private disposed = false;
  private volume = 0.65;
  private timeline?: PianoKeyTimeline;
  song?: PianoSong;
  playing = false;

  setSong(song?: PianoSong) {
    this.stop(); this.song = song;
    this.timeline = song ? new PianoKeyTimeline(song.notes) : undefined;
  }
  get time() { return this.playing && this.context ? Math.min(this.song!.duration, Math.max(0, this.context.currentTime - this.origin)) : this.offset; }
  keys() { return this.playing ? this.timeline?.at(this.time) : undefined; }
  setVolume(value: number) {
    this.volume = value;
    if (this.output && this.context) this.output.gain.setTargetAtTime(value * 0.45, this.context.currentTime, 0.02);
  }
  async play(signal: AbortSignal) {
    if (!this.song || this.disposed || this.playing) return;
    const generation = ++this.generation;
    const context = this.context ??= new AudioContext();
    if (!this.output) { this.output = context.createGain(); this.output.gain.value = this.volume * 0.45; this.output.connect(context.destination); }
    // Called from the play button, before the first network await.
    await context.resume();
    const needed = [...new Set(this.song.notes.map(note => nearest(note.midi)))];
    await Promise.all(needed.map(async midi => {
      if (this.buffers.has(midi)) return;
      const response = await fetch(`${import.meta.env.BASE_URL}audio/piano/${sampleName(midi)}.mp3`, { signal });
      if (!response.ok) throw new Error('피아노 소리를 불러오지 못했어요. 다시 재생해주세요.');
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (!this.disposed) this.buffers.set(midi, buffer);
    }));
    if (signal.aborted || this.disposed || generation !== this.generation) return;
    if (context.state !== 'running') throw new Error('소리를 시작하지 못했어요. 재생 버튼을 다시 눌러주세요.');
    if (this.offset >= this.song.duration) this.offset = 0;
    this.origin = context.currentTime - this.offset;
    this.cursor = 0;
    this.playing = true;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 25);
  }
  private schedule() {
    if (!this.playing || !this.context || !this.song) return;
    const time = this.time;
    if (this.context.currentTime - this.origin >= this.song.duration + 0.15 || this.context.state !== 'running') { this.pause(); return; }
    while (this.cursor < this.song.notes.length && this.song.notes[this.cursor].time <= time + 0.1) {
      const note = this.song.notes[this.cursor++];
      if (note.time + note.soundDuration > time) this.voice(note, time);
    }
  }
  private voice(note: PianoNote, time: number) {
    const context = this.context!;
    const sample = nearest(note.midi);
    const buffer = this.buffers.get(sample)!;
    const elapsed = Math.max(0, time - note.time);
    const rate = 2 ** ((note.midi - sample) / 12);
    if (elapsed * rate >= buffer.duration) return;
    const start = Math.max(context.currentTime, this.origin + note.time);
    const end = this.origin + note.time + note.soundDuration;
    if (end <= start) return;
    const source = context.createBufferSource();
    source.buffer = buffer; source.playbackRate.value = rate;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(note.velocity, Math.min(start + 0.008, end));
    envelope.gain.setValueAtTime(note.velocity, end);
    envelope.gain.linearRampToValueAtTime(0, end + 0.12);
    source.connect(envelope); envelope.connect(this.output!);
    this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); envelope.disconnect(); };
    source.start(start, elapsed * rate); source.stop(end + 0.13);
  }
  pause() {
    this.offset = this.time; this.playing = false; this.generation++;
    clearInterval(this.timer);
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }
  stop() { this.pause(); this.offset = 0; }
  dispose() { this.stop(); this.disposed = true; this.buffers.clear(); void this.context?.close(); }
}
