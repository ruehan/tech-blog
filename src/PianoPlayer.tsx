import { useEffect, useMemo, useRef, useState } from 'react';
import catalog from '../content/piano-tracks.json';
import { Icon } from './Icons';
import { PianoAudio } from './piano-audio';
import { decodePianoMidi, type PianoTrack } from './piano-midi';
import './piano-player.css';

const tracks: PianoTrack[] = catalog;
const clock = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

export function PianoPlayer({ onClose, onEngine }: { onClose: () => void; onEngine: (engine: PianoAudio | null) => void }) {
  const engine = useMemo(() => new PianoAudio(), []);
  const dialog = useRef<HTMLDialogElement>(null);
  const audioRequest = useRef<AbortController | null>(null);
  const [selected, setSelected] = useState(tracks[0]?.id ?? '');
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(65);
  const [duration, setDuration] = useState(0);
  const [omitted, setOmitted] = useState(0);

  useEffect(() => {
    onEngine(engine); dialog.current!.showModal();
    const visibility = () => { if (document.hidden) { audioRequest.current?.abort(); engine.pause(); setPreparing(false); setPlaying(false); } };
    document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(() => { setTime(engine.time); setPlaying(engine.playing); }, 100);
    return () => {
      clearInterval(timer); document.removeEventListener('visibilitychange', visibility);
      audioRequest.current?.abort(); engine.dispose(); onEngine(null);
      dialog.current?.close();
    };
  }, [engine, onEngine]);

  useEffect(() => {
    const track = tracks.find(track => track.id === selected);
    if (!track) return;
    const controller = new AbortController();
    audioRequest.current?.abort(); engine.setSong();
    setError(''); setLoading(true); setPreparing(false); setDuration(0); setTime(0); setPlaying(false); setOmitted(0);
    void (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${track.file.replace(/^\//, '')}`, { signal: controller.signal });
        if (!response.ok) throw new Error('곡을 불러오지 못했어요. 다시 시도해주세요.');
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('MIDI 파일은 5MB 이하로 준비해주세요.');
        const song = decodePianoMidi(bytes, track.tracks);
        if (controller.signal.aborted) return;
        engine.setSong(song); setDuration(song.duration); setOmitted(song.omitted);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '곡을 읽지 못했어요.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => { controller.abort(); audioRequest.current?.abort(); engine.stop(); };
  }, [selected, retry, engine]);

  async function toggle() {
    if (engine.playing) { engine.pause(); setPlaying(false); return; }
    const controller = new AbortController(); audioRequest.current?.abort(); audioRequest.current = controller;
    setPreparing(true); setError('');
    try { await engine.play(controller.signal); if (!controller.signal.aborted) setPlaying(engine.playing); }
    catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '재생하지 못했어요. 다시 시도해주세요.'); }
    finally { if (!controller.signal.aborted) setPreparing(false); }
  }

  return <dialog className="piano-player" ref={dialog} aria-labelledby="piano-player-title"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onKeyDown={event => event.stopPropagation()}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <header><h2 id="piano-player-title"><Icon name="piano" size={17}/>피아노</h2><button type="button" className="icon-button" aria-label="피아노 닫기" onClick={onClose}><Icon name="close" size={18}/></button></header>
    <div className="piano-track-list" aria-label="음악 목록">
      {tracks.map(track => <button type="button" key={track.id} aria-pressed={selected === track.id} onClick={() => setSelected(track.id)}><span>{track.title}</span><small>{track.artist}</small></button>)}
      {!tracks.length && <p>아직 등록된 곡이 없어요.</p>}
    </div>
    {error && <p className="piano-error" role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>다시 불러오기</button></p>}
    {omitted > 0 && <p className="piano-note">88건반 범위 밖의 음표 {omitted}개는 제외했어요.</p>}
    <div className="piano-transport">
      <button className="piano-play" type="button" disabled={loading || preparing || !duration} aria-label={playing ? '곡 일시정지' : '곡 재생'} onClick={() => void toggle()}><Icon name={playing ? 'pause' : 'play'} size={18}/></button>
      <button className="icon-button" type="button" disabled={!duration || preparing} aria-label="곡 처음으로" onClick={() => { engine.stop(); setTime(0); setPlaying(false); }}><Icon name="reset" size={16}/></button>
      <div className="piano-progress"><progress aria-label="곡 진행" max={duration || 1} value={time}/><span>{loading ? '곡 불러오는 중' : preparing ? '피아노 준비 중' : `${clock(time)} / ${clock(duration)}`}</span></div>
    </div>
    <footer><label>음량<input type="range" aria-label="피아노 음량" min="0" max="100" value={volume} onChange={event => { const value = Number(event.target.value); setVolume(value); engine.setVolume(value / 100); }}/></label><a href="/audio/piano/ATTRIBUTION.txt" target="_blank" rel="noopener noreferrer">음원 출처</a></footer>
  </dialog>;
}
