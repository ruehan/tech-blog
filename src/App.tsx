import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import type { RoomHandle } from './Room';
import { Icon } from './Icons';
import { defaultView, worlds, type ViewId, type WorldId } from './worlds';
import { Book, ContentMetadata, Library, ReadingPage } from './Blog';
import { Journal } from './Journal';
import { useRoute } from './navigation';

const WorldScene = lazy(() => import('./WorldScene'));
class SceneBoundary extends Component<{ children: ReactNode; onRetry: () => void; onError: () => void }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(error: Error) { console.error('World loading failed:', error); this.props.onError(); }
  render() { return this.state.error ? <div className="error-panel" role="alert"><Icon name="info"/><span className="sr-only">공간을 불러오지 못했어요. 연결 상태를 확인한 뒤 다시 시도해주세요.</span><button className="icon-button" aria-label="다시 불러오기" onClick={this.props.onRetry}><Icon name="reset"/></button></div> : this.props.children; }
}

function RailButton({ icon, label, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string }) {
  return <button className="rail-button" aria-label={label} title={label} {...props}><Icon name={icon}/></button>;
}

export default function App() {
  const { route, go } = useRoute();
  const journalOpen = route.path === '/journal' || route.path.startsWith('/journal/');
  const inSpace = route.path === '/';
  const bookOpen = route.path === '/posts' || route.path.startsWith('/posts/');
  const libraryOpen = bookOpen || route.path === '/projects';
  const [spaceMounted, setSpaceMounted] = useState(inSpace);
  const folderPending = useRef(false);
  const openPosts = useCallback(() => go('/posts'), [go]);
  const openProjects = useCallback(() => {
    if (!folderPending.current) return;
    folderPending.current = false;
    go('/projects');
  }, [go]);
  const [world, setWorld] = useState<WorldId>('room');
  const [view, setView] = useState<ViewId>('overview');
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [lightsOn, setLightsOn] = useState(true);
  const [labels, setLabels] = useState(true);
  const [optimized, setOptimized] = useState(() => {
    try { return localStorage.getItem('room-render-mode') !== 'normal'; }
    catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('room-render-mode', optimized ? 'optimized' : 'normal'); }
    catch { /* Rendering controls also work when storage is unavailable. */ }
  }, [optimized]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(0);
  const [folderOpen, setFolderOpen] = useState(false);
  const roomRef = useRef<RoomHandle>(null);
  useEffect(() => {
    if (inSpace) setSpaceMounted(true);
    if (journalOpen) {
      setSpaceMounted(false); setReady(false); setBusy(false); setFailed(false);
      setFolderOpen(false); folderPending.current = false; document.body.style.cursor = '';
    }
  }, [inSpace, journalOpen]);
  const config = worlds[world];
  const navigate = useCallback((next: WorldId) => {
    if (next === world) return;
    folderPending.current = false;
    setWorld(next); setReady(false); setFailed(false); setBusy(false); setView(defaultView(next)); setFolderOpen(false);
    document.body.style.cursor = '';
  }, [world]);
  const onReady = useCallback(() => setReady(true), []);
  const resetCamera = useCallback(() => setReset(n => n + 1), []);
  const toggleLights = useCallback(() => setLightsOn(on => !on), []);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !inSpace) return;
      if (busy) roomRef.current?.cancel();
      else if (world !== 'room') navigate('room');
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [busy, world, navigate, inSpace]);

  const contentNavigate = useCallback((href: string) => {
    if (href === '/') navigate('room');
    go(href);
  }, [navigate, go]);
  const toggleFolder = useCallback(() => {
    folderPending.current = !folderOpen;
    setFolderOpen(!folderOpen);
  }, [folderOpen]);
  const cancelPendingFolder = () => {
    if (!folderPending.current) return;
    folderPending.current = false;
    setFolderOpen(false);
  };
  const jumpToWorld = (next: WorldId) => {
    cancelPendingFolder();
    if (world === 'room' && busy) roomRef.current?.cancel();
    if (next === world) { setView(defaultView(next)); resetCamera(); }
    else navigate(next);
  };
  const openContent = (href: string) => {
    cancelPendingFolder();
    if (world === 'room' && busy) roomRef.current?.cancel();
    go(href);
  };

  if (journalOpen) return <><ContentMetadata route={route}/><Journal route={route} go={contentNavigate}/></>;

  return <><ContentMetadata route={route}/>{spaceMounted && <main inert={!inSpace} aria-hidden={!inSpace || undefined} className={`app ${!inSpace ? 'space-inactive' : ''} ${!inSpace && !libraryOpen ? 'space-covered' : ''} ${world} ${view}-view ${world === 'room' && !lightsOn ? 'night' : ''}`} data-world={world} data-view={view} data-ready={ready}>
    <header className="header">
      <a className="brand" href="#room" onClick={event => { event.preventDefault(); jumpToWorld('room'); }} aria-label="Hangyu's room, 메인 방으로"><span>hangyu<span className="brand-light"> / room</span></span></a>
    </header>

    <div className="viewport" aria-label={`${config.label} 3D 뷰어. 드래그로 회전하고 스크롤로 확대합니다.`}>
      <SceneBoundary key={world} onRetry={() => window.location.reload()} onError={() => { setFailed(true); setReady(false); }}>
        <Suspense fallback={null}><WorldScene world={world} view={view} optimized={optimized} paused={paused || !inSpace} active={inSpace} onRead={openPosts} lightsOn={lightsOn} labels={labels} reset={reset} busy={busy} roomRef={roomRef} onNavigate={navigate} onReady={onReady} onBusy={setBusy} onLights={toggleLights} onResetCamera={resetCamera} folderOpen={folderOpen} onFolderToggle={toggleFolder} onFolderOpened={openProjects}/></Suspense>
      </SceneBoundary>
    </div>
    {!ready && !failed && <div className="loading" role="status" aria-label={`${config.label}에 들어가는 중`}><span className="loading-orbit"/></div>}

    <aside className="room-rail" aria-label="공간 메뉴">
      <div className="rail-group"><button className="rail-button rail-mode" aria-label="일반 블로그로 보기" title="일반 블로그로 보기" onClick={() => openContent('/journal')}>2D</button></div>
      <nav className="rail-group" aria-label="빠른 이동">
        <RailButton icon="room" label="나의 방 01" aria-current={world === 'room' ? 'page' : undefined} onClick={() => jumpToWorld('room')}/>
        <RailButton icon="book" label="글 목록 열기" onClick={() => openContent('/posts')}/>
        <RailButton icon="folder" label="프로젝트 목록 열기" onClick={() => openContent('/projects')}/>
        <RailButton icon="desktop" label="컴퓨터 02" aria-current={world === 'desktop' ? 'page' : undefined} onClick={() => jumpToWorld('desktop')}/>
        <RailButton icon="circuit" label="서킷 03" aria-current={world === 'circuit' ? 'page' : undefined} onClick={() => jumpToWorld('circuit')}/>
      </nav>
      {ready && <div className="rail-group" role="group" aria-label="공간 조작">
        {busy ? <RailButton icon="arrow" label="연출 건너뛰기" onClick={() => roomRef.current?.skip()}/> : world === 'room' ?
          <RailButton icon="music" label="음악" disabled={paused} onClick={() => roomRef.current?.activate('bass')}/>
        : world === 'desktop' ? <RailButton icon="folder" label={`Projects 폴더 ${folderOpen ? '닫기' : '열기'}`} aria-pressed={folderOpen} onClick={toggleFolder}/>
        : <><RailButton icon="steering" label="운전석 시점" aria-pressed={view === 'cockpit'} onClick={() => setView('cockpit')}/><RailButton icon="circuit" label="서킷 전체" aria-pressed={view === 'overview'} onClick={() => setView('overview')}/><RailButton icon="focus" label="차량 가까이" aria-pressed={view === 'car'} onClick={() => setView('car')}/></>}
      </div>}
      <div className="rail-group rail-settings" role="group" aria-label="화면 설정">
        <button className="rail-button rail-quality" role="switch" aria-label="60fps 최적화" aria-checked={optimized} title={optimized ? '최적화 모드 · 클릭하면 일반 화질' : '일반 모드 · 클릭하면 60fps 최적화'} onClick={() => setOptimized(value => !value)}>
          <span>{optimized ? '최적화' : '일반'}</span><span className="rail-switch-track" aria-hidden="true"/>
        </button>
        {world === 'room' && <RailButton icon={lightsOn ? 'sun' : 'moon'} label={lightsOn ? '조명 끄기' : '조명 켜기'} disabled={!ready || busy} onClick={toggleLights}/>}
        <RailButton icon={paused ? 'play' : 'pause'} label={paused ? '애니메이션 재생' : '애니메이션 일시정지'} aria-pressed={paused} onClick={() => setPaused(value => !value)}/>
        <RailButton icon="reset" label="시점 초기화" disabled={!ready} onClick={() => { if (busy) roomRef.current?.cancel(); setView(defaultView(world)); resetCamera(); }}/>
        {world === 'room' && <RailButton icon="markers" label={`안내 ${labels ? '숨기기' : '보기'}`} aria-pressed={labels} disabled={!ready || busy} onClick={() => setLabels(value => !value)}/>}
      </div>
    </aside>
    <span className="sr-only" role="status">{failed ? `${config.label} 로딩 실패` : ready ? `${config.label} 준비 완료` : `${config.label} 로딩 중`}</span>
  </main>}
    {!spaceMounted && libraryOpen && <div className="library-background"><span className="brand">hangyu<span className="brand-light"> / room</span></span></div>}
    {bookOpen && <Book route={route} go={contentNavigate} onClose={() => go('/')}/>}
    {route.path === '/projects' && <Library route={route} go={contentNavigate} onClose={() => go('/')}/>}
    {!inSpace && !libraryOpen && <ReadingPage route={route} go={contentNavigate} onReturn={() => go('/')}/>}
  </>;
}
