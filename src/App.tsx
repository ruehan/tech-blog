import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { RoomHandle } from './Room';
import { Icon } from './Icons';
import { defaultView, worlds, type ViewId, type WorldId } from './worlds';

const WorldScene = lazy(() => import('./WorldScene'));
class SceneBoundary extends Component<{ children: ReactNode; onRetry: () => void; onError: () => void }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(error: Error) { console.error('World loading failed:', error); this.props.onError(); }
  render() { return this.state.error ? <div className="error-panel" role="alert"><Icon name="info"/><span className="sr-only">공간을 불러오지 못했어요. 연결 상태를 확인한 뒤 다시 시도해주세요.</span><button className="icon-button" aria-label="다시 불러오기" onClick={this.props.onRetry}><Icon name="reset"/></button></div> : this.props.children; }
}

export default function App() {
  const [world, setWorld] = useState<WorldId>('room');
  const [view, setView] = useState<ViewId>('overview');
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [lightsOn, setLightsOn] = useState(true);
  const [labels, setLabels] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(0);
  const [folderOpen, setFolderOpen] = useState(false);
  const roomRef = useRef<RoomHandle>(null);
  const config = worlds[world];
  const navigate = useCallback((next: WorldId) => {
    if (next === world) return;
    setWorld(next); setReady(false); setFailed(false); setBusy(false); setView(defaultView(next)); setFolderOpen(false);
    document.body.style.cursor = '';
  }, [world]);
  const onReady = useCallback(() => setReady(true), []);
  const resetCamera = useCallback(() => setReset(n => n + 1), []);
  const toggleLights = useCallback(() => setLightsOn(on => !on), []);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (busy) roomRef.current?.cancel();
      else if (world !== 'room') navigate('room');
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [busy, world, navigate]);

  return <main className={`app ${world} ${view}-view ${world === 'room' && !lightsOn ? 'night' : ''}`} data-world={world} data-view={view} data-ready={ready}>
    <header className="header">
      <a className="brand" href="#room" onClick={event => { event.preventDefault(); navigate('room'); }} aria-label="Hangyu's room, 메인 방으로"><span>hangyu<span className="brand-light"> / room</span></span></a>
    </header>

    <div className="viewport" aria-label={`${config.label} 3D 뷰어. 드래그로 회전하고 스크롤로 확대합니다.`}>
      <SceneBoundary key={world} onRetry={() => window.location.reload()} onError={() => { setFailed(true); setReady(false); }}>
        <Suspense fallback={null}><WorldScene world={world} view={view} paused={paused} lightsOn={lightsOn} labels={labels} reset={reset} busy={busy} roomRef={roomRef} onNavigate={navigate} onReady={onReady} onBusy={setBusy} onLights={toggleLights} onResetCamera={resetCamera} folderOpen={folderOpen} onFolderToggle={() => setFolderOpen(open => !open)}/></Suspense>
      </SceneBoundary>
    </div>
    {!ready && !failed && <div className="loading" role="status" aria-label={`${config.label}에 들어가는 중`}><span className="loading-orbit"/></div>}

    <aside className="tools" aria-label="화면 설정">
      {world === 'room' && <button className="icon-button" disabled={!ready || busy} aria-label={lightsOn ? '조명 끄기' : '조명 켜기'} onClick={toggleLights}><Icon name={lightsOn ? 'sun' : 'moon'}/></button>}
      <button className="icon-button" aria-label={paused ? '애니메이션 재생' : '애니메이션 일시정지'} aria-pressed={paused} onClick={() => setPaused(value => !value)}><Icon name={paused ? 'play' : 'pause'}/></button>
      <button className="icon-button" disabled={!ready} aria-label="시점 초기화" onClick={() => { if (busy) roomRef.current?.cancel(); setView(defaultView(world)); resetCamera(); }}><Icon name="reset"/></button>
    </aside>

    {ready && <div className="world-actions">
      {busy ? <button className="icon-button" aria-label="연출 건너뛰기" onClick={() => roomRef.current?.cancel()}><Icon name="arrow"/></button> : world === 'room' ? <>
        <button className="icon-button" aria-label="책" disabled={paused} onClick={() => roomRef.current?.activate('featured_book')}><Icon name="book"/></button>
        <button className="icon-button" aria-label="음악" disabled={paused} onClick={() => roomRef.current?.activate('bass')}><Icon name="music"/></button>
        <span className="action-divider"/><button className="icon-button" aria-label={`안내 ${labels ? '숨기기' : '보기'}`} aria-pressed={labels} onClick={() => setLabels(value => !value)}><Icon name="markers"/></button>
      </> : world === 'desktop' ? <button className="icon-button" aria-label={`Projects 폴더 ${folderOpen ? '닫기' : '열기'}`} aria-pressed={folderOpen} onClick={() => setFolderOpen(value => !value)}><Icon name="desktop"/></button> : <div className="view-switch"><button className="icon-button" aria-label="운전석 시점" aria-pressed={view === 'cockpit'} onClick={() => setView('cockpit')}><Icon name="steering"/></button><button className="icon-button" aria-label="서킷 전체" aria-pressed={view === 'overview'} onClick={() => setView('overview')}><Icon name="circuit"/></button><button className="icon-button" aria-label="차량 가까이" aria-pressed={view === 'car'} onClick={() => setView('car')}><Icon name="focus"/></button></div>}
    </div>}

    <footer className="footer">
      {world !== 'room' && <button className="icon-button back-button" aria-label="방으로 돌아가기" onClick={() => navigate('room')}><Icon name="back"/></button>}
      <nav className="world-nav" aria-label="월드 선택">
        {(Object.entries(worlds) as [WorldId, typeof config][]).map(([id, item]) => <button key={id} aria-label={`${item.label} ${item.number}`} aria-current={id === world ? 'page' : undefined} onClick={() => navigate(id)}><Icon name={id}/></button>)}
      </nav>
    </footer>
    <span className="sr-only" role="status">{failed ? `${config.label} 로딩 실패` : ready ? `${config.label} 준비 완료` : `${config.label} 로딩 중`}</span>
  </main>;
}
