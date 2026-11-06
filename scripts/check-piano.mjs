import { readFile } from 'node:fs/promises';
import midiPackage from '@tonejs/midi';

export async function checkPianoCatalog() {
  const catalog = JSON.parse(await readFile('content/piano-tracks.json', 'utf8'));
  if (!Array.isArray(catalog)) throw new Error('piano-tracks.json: 곡 목록은 배열이어야 합니다.');
  const ids = new Set();
  for (const track of catalog) {
    if (!track || typeof track.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(track.id) || ids.has(track.id)
      || typeof track.title !== 'string' || !track.title.trim() || typeof track.artist !== 'string'
      || typeof track.file !== 'string' || !/^\/music\/piano\/[a-zA-Z0-9_-]+\.midi?$/.test(track.file)) {
      throw new Error('piano-tracks.json: 고유 id, title, artist, /music/piano/파일.mid 경로를 확인해주세요.');
    }
    ids.add(track.id);
    const bytes = await readFile(`public${track.file}`);
    if (bytes.length < 14 || bytes.length > 5 * 1024 * 1024 || bytes.toString('ascii', 0, 4) !== 'MThd' || bytes.readUInt16BE(8) > 1 || bytes.readUInt16BE(12) & 0x8000) throw new Error(`${track.file}: 형식 0·1의 일반 MIDI(5MB 이하)가 필요합니다.`);
    const midi = new midiPackage.Midi(bytes);
    if (track.tracks !== undefined && (!Array.isArray(track.tracks) || !track.tracks.length || track.tracks.some(i => !Number.isInteger(i) || i < 0 || i >= midi.tracks.length))) throw new Error(`${track.file}: tracks는 MIDI의 0부터 시작하는 트랙 번호 목록이어야 합니다.`);
    const notes = midi.tracks.flatMap((entry, i) => entry.instrument.percussion || track.tracks && !track.tracks.includes(i) ? [] : entry.notes.filter(note => note.midi >= 21 && note.midi <= 108 && note.duration > 0));
    if (!notes.length || notes.length > 30000) throw new Error(`${track.file}: 연주 가능한 피아노 음표는 1~30000개여야 합니다.`);
  }
}
