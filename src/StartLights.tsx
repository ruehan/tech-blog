import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import './start-lights.css';

type Phase = 'idle' | 'waiting' | 'go' | 'result' | 'early' | 'cancelled' | 'missed';
type Round = { phase: Phase; lights: number; result?: number; record?: boolean };
const storageKey = 'journal-start-lights-best';
const active = (phase: Phase) => phase === 'waiting' || phase === 'go';

function readBest() {
  try {
    const value = Number(localStorage.getItem(storageKey));
    return Number.isInteger(value) && value > 0 && value <= 10_000 ? value : null;
  } catch { return null; }
}

export function StartLights() {
  const [round, setRound] = useState<Round>({ phase: 'idle', lights: 0 });
  const [best, setBest] = useState(readBest);
  const current = useRef(round);
  const bestRef = useRef(best);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const frame = useRef(0);
  const startedAt = useRef(0);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  }
  function update(next: Round) {
    current.current = next;
    setRound(next);
  }
  function cancel() {
    if (!active(current.current.phase)) return;
    clearTimers();
    update({ phase: 'cancelled', lights: 0 });
  }
  useEffect(() => {
    const visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearTimers();
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  function press() {
    if (document.hidden) return;
    if (current.current.phase === 'waiting') {
      clearTimers();
      update({ phase: 'early', lights: current.current.lights });
      return;
    }
    if (current.current.phase === 'go') {
      const elapsed = performance.now() - startedAt.current;
      clearTimers();
      if (elapsed > 10_000) { update({ phase: 'missed', lights: 0 }); return; }
      const result = Math.max(1, Math.round(elapsed));
      const record = bestRef.current === null || result < bestRef.current;
      if (record) {
        bestRef.current = result;
        setBest(result);
        try { localStorage.setItem(storageKey, String(result)); }
        catch { /* The game and session record still work without storage. */ }
      }
      update({ phase: 'result', lights: 0, result, record });
      return;
    }
    clearTimers();
    update({ phase: 'waiting', lights: 1 });
    for (let count = 2; count <= 5; count++) {
      timers.current.push(setTimeout(() => {
        if (current.current.phase === 'waiting') update({ phase: 'waiting', lights: count });
      }, (count - 1) * 650));
    }
    // The fully lit delay changes every round so a fixed rhythm cannot predict it.
    timers.current.push(setTimeout(() => {
      frame.current = requestAnimationFrame(() => {
        if (current.current.phase !== 'waiting' || document.hidden) return;
        // Commit the lights-out frame before starting the reaction clock.
        flushSync(() => update({ phase: 'go', lights: 0 }));
        startedAt.current = performance.now();
        timers.current.push(setTimeout(() => update({ phase: 'missed', lights: 0 }), 10_000));
      });
    }, 2_600 + 1_000 + Math.random() * 2_000));
  }

  const message = round.phase === 'waiting' ? '불이 꺼질 때까지…' : round.phase === 'go' ? '지금!' : round.phase === 'early' ? '너무 빨랐어요' : round.phase === 'cancelled' ? '잠시 멈췄어요' : round.phase === 'missed' ? '시간이 지났어요' : round.phase === 'result' ? `${round.result} ms` : '불이 꺼지면 누르세요';
  const action = active(round.phase) ? '클릭 · Space · Enter' : round.phase === 'idle' ? '시작하기' : '다시 도전';
  return <section className="start-lights" aria-labelledby="start-lights-title" data-phase={round.phase}>
    <h2 id="start-lights-title">스타트 라이트</h2>
    <button className="start-lights-pad" type="button" aria-label="스타트 라이트 게임" aria-describedby="start-lights-help start-lights-status" onBlur={cancel}
      onPointerDown={event => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.currentTarget.focus({ preventScroll: true });
        press();
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') { cancel(); return; }
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        if (!event.repeat) press();
      }}
      onClick={event => { if (event.detail === 0) press(); }}>
      <span className="start-lights-bank" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <span className="start-light-pair" data-lit={index < round.lights} key={index}><i/><i/></span>)}</span>
      <span className={`start-lights-readout${round.phase === 'result' ? ' has-result' : ''}`} aria-hidden="true">{message}</span>
      <span className="start-lights-action" aria-hidden="true">{action}</span>
    </button>
    <span id="start-lights-status" className="sr-only" role="status" aria-live="polite" aria-atomic="true">{message}{round.record ? ', 새 최고 기록' : ''}</span>
    <p id="start-lights-help" className="sr-only">버튼을 눌러 시작한 뒤, 다섯 등이 모두 꺼지면 다시 누르세요. 클릭, 터치, Space, Enter로 반응하고 Esc로 취소할 수 있습니다.</p>
    <div className="start-lights-best"><span>{round.record ? '새 최고 기록' : '최고 기록'}</span><span>{best === null ? '—' : `${best} ms`}</span></div>
  </section>;
}
