import { useCallback, useEffect, useRef, useState } from 'react';
import { ContentMetadata, useReadingPosition } from './reading-runtime';
import { ApexArticle, ApexProject } from './ApexArticle';
import { ApexAbout } from './ApexAbout';
import { ApexSearch } from './ApexSearch';
import { allTags, filterPosts, formatDate, posts } from './content';
import { apexProjects, writingPath } from './apex-data';
import { Icon } from './Icons';
import { ImageViewer } from './ImageViewer';
import { JournalReadingSettings, useReadingPreferences } from './JournalReadingSettings';
import { PostSort } from './PostSort';
import { parsePostSort, postSortSearch, sortPosts } from './post-sort';
import { RouteLink, useRoute, type Navigate, type Route } from './navigation';
import { SearchHighlight } from './SearchHighlight';
import { searchPreview } from './search';
import { profile } from './profile';

const menus = [['/writing', '개발'], ['/projects', '프로젝트'], ['/races/', '레이스 기록'], ['/about', '소개']];

export function ApexApp() {
  const { route, go: navigate } = useRoute();
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const go = useCallback<Navigate>(href => {
    if (timer.current) return;
    const target = new URL(href, window.location.href);
    const change = () => {
      timer.current = null; setLoading(false);
      if (target.origin !== location.origin || target.pathname === '/' || /^\/(room|posts|races)(\/|$)/.test(target.pathname)) location.assign(target.href);
      else navigate(target.pathname + target.search + target.hash);
    };
    if (target.pathname.replace(/\/$/, '') === route.path || matchMedia('(prefers-reduced-motion: reduce)').matches) change();
    else { setLoading(true); timer.current = setTimeout(change, 1000); }
  }, [navigate, route.path]);
  useEffect(() => {
    const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setLoading(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('keydown', escape);
    window.addEventListener('popstate', cancel);
    return () => { cancel(); window.removeEventListener('keydown', escape); window.removeEventListener('popstate', cancel); };
  }, []);
  return <><ContentMetadata route={route}/><ApexPage route={route} go={go} loading={loading}/>
    <div className={`page-loader${loading ? ' is-loading' : ''}`} aria-hidden={!loading}><div className="page-loader-content"><div className="page-loader-brand" aria-hidden="true"><span>hangyu</span><i>/</i><span>apex</span></div><div className="page-loader-motion" aria-hidden="true"><span/><span/><span/></div><p role="status">페이지를 불러오는 중</p></div></div>
  </>;
}

export function ApexPage({ route, go, loading = false }: { route: Route; go: Navigate; loading?: boolean }) {
  const path = writingPath(route.path);
  const isWriting = path === '/writing';
  const isProjects = path === '/projects';
  const isAbout = path === '/about';
  const post = posts.find(item => path === `/writing/${item.slug}`);
  const project = apexProjects.find(item => path === `/projects/${item.slug}`);
  const scroll = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const reading = useReadingPreferences();
  const query = new URLSearchParams(route.search);
  const tag = query.get('tag') ?? '';
  const search = query.get('q') ?? '';
  const sort = parsePostSort(query.get('sort'));
  const [draftSearch, setDraftSearch] = useState(search);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => setSearchOpen(false), [path]);
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('apex-theme') === 'dark'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('apex-theme', dark ? 'dark' : 'light'); } catch { /* Storage is optional. */ }
  }, [dark]);
  useEffect(() => { setDraftSearch(search); }, [search]);
  useReadingPosition(scroll, path + route.search);
  useEffect(() => {
    if (isWriting && query.get('search') === '1') searchInput.current?.focus();
  }, [isWriting, route.search]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName) || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      setSearchOpen(true);
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [isWriting, go]);
  const visiblePosts = sortPosts(filterPosts(tag, search), sort);
  function filterHref(nextTag = tag, nextSearch = draftSearch) {
    const params = new URLSearchParams(postSortSearch('', sort));
    if (nextTag) params.set('tag', nextTag);
    if (nextSearch.trim()) params.set('q', nextSearch.trim());
    return `/writing${params.size ? `?${params}` : ''}`;
  }
  const active = post || isWriting ? '/writing' : project || isProjects ? '/projects' : path;
  return <div className="apex-site" data-theme={dark ? 'night' : 'day'} ref={scroll} style={reading.style} inert={loading || undefined}>
    <ImageViewer routeKey={path + route.search}>
      <a className="skip" href="#main">본문으로 건너뛰기</a>
      <header className="header"><div className="header-inner">
        <RouteLink className="wordmark" to="/" go={go} aria-label="HANGYU APEX 홈">hangyu<span className="slash">/</span>apex</RouteLink>
        <nav aria-label="주 메뉴">{menus.map(([href, title]) => <RouteLink key={href} to={href} go={go} aria-current={active === href ? 'page' : undefined}>{title}</RouteLink>)}</nav>
        <div className="tools">
          {post && <JournalReadingSettings preferences={reading.preferences} onChange={reading.setPreferences}/>}
          <button className="icon-button" aria-label="글 검색" onClick={() => setSearchOpen(true)}><Icon name="search"/></button>
          <button className="icon-button" aria-label={dark ? '라이트 모드로 변경' : '다크 모드로 변경'} onClick={() => setDark(value => !value)}><Icon name={dark ? 'sun' : 'moon'}/></button>
        </div>
      </div></header>
      <main id="main" tabIndex={-1} aria-busy={loading}>
        {isWriting ? <div className="wrap archive-page">
          <header className="page-heading"><h1 tabIndex={-1}>개발</h1><p>만들면서 배운 것, 막혔던 문제, 다시 읽고 싶은 메모.</p></header>
          <div className="archive-layout"><aside className="archive-sidebar"><h2>주제</h2>
            <div className="topic-buttons" role="group" aria-label="태그 필터">{['', ...allTags].map(value => <button key={value} type="button" onClick={() => go(filterHref(value))} aria-pressed={tag === value}>{value || '전체'}</button>)}</div>
            <p className="archive-note">완성된 답이 아니어도,<br/>다음에 다시 꺼내 볼 수 있도록.</p>
          </aside><div className="archive-main">
            <div className="archive-tools"><form className="archive-search" role="search" onSubmit={event => { event.preventDefault(); go(filterHref()); }}>
              <Icon name="search"/><input ref={searchInput} type="search" aria-label="개발 글 검색" placeholder="제목이나 기술 이름으로 찾기" value={draftSearch} onChange={event => { setDraftSearch(event.target.value); go(filterHref(tag, event.target.value)); }}/>
            </form><div className="archive-count"><span role="status">{visiblePosts.length}개의 글</span><PostSort value={sort} onChange={value => go(`/writing${postSortSearch(route.search, value)}`)}/></div></div>
            {(tag || search) && <p className="filter-reset"><RouteLink to={filterHref('', '')} go={go} className="text-link">필터 지우기</RouteLink></p>}
            <div id="writing-archive">{visiblePosts.map(item => {
              const preview = search ? searchPreview(item, search) : { text: item.description, anchor: '' };
              return <RouteLink className="post archive-entry" key={item.slug} to={`/writing/${item.slug}${route.search}${preview.anchor ? `#${encodeURIComponent(preview.anchor)}` : ''}`} go={go}><div>
                <div className="post-meta"><span>{item.tags[0] || '개발 노트'}</span><time dateTime={item.date}>{formatDate(item.date)}</time><span>{item.minutes}분 읽기</span>{item.draft && <span>초안</span>}</div>
                <h2><SearchHighlight text={item.title} query={search}/></h2><p><SearchHighlight text={preview.text} query={search}/></p>
                <div className="post-tags">{item.tags.map(value => <span key={value}>{value}</span>)}</div>
              </div></RouteLink>;
            })}</div>
            {!visiblePosts.length && <div className="empty"><h2>{posts.length ? '찾는 기록이 없습니다.' : '아직 등록된 글이 없어요.'}</h2><p>검색어나 주제를 바꿔 보세요.</p><RouteLink to={filterHref('', '')} go={go} className="text-link">전체 기록 보기</RouteLink></div>}
          </div></div>
        </div> : isProjects ? <div className="wrap projects-page">
          <header className="page-heading"><h1 tabIndex={-1}>프로젝트</h1><p>작동하는 화면 뒤에 있는 고민과 선택들.</p></header>
          {apexProjects.map((item, index) => <section className={`case-preview${index % 2 ? ' alternate' : ''}`} key={item.slug}>
            <RouteLink to={`/projects/${item.slug}`} go={go} className="case-visual" aria-label={`${item.title} 자세히 보기`}>{item.cover ? <img src={item.cover.src} alt={item.cover.alt} loading="lazy"/> : <div className="apex-project-art"><span>{String(index + 1).padStart(2, '0')} / PROJECT</span><strong>{item.title}</strong><p>{item.tags.join(' · ')}</p></div>}</RouteLink>
            <div className="case-description"><span className="project-status">{item.status}</span><h2><RouteLink to={`/projects/${item.slug}`} go={go}>{item.title}</RouteLink></h2><p>{item.description}</p>
              <dl className="project-facts"><div><dt>사용한 기술</dt><dd>{item.tags.join(', ')}</dd></div><div><dt>프로젝트</dt><dd>{item.subtitle}</dd></div></dl>
              <RouteLink to={`/projects/${item.slug}`} go={go} className="text-link">만든 과정 보기</RouteLink>
            </div>
          </section>)}
        </div> : post ? <ApexArticle post={post} go={go} scroll={scroll} search={route.search} query={search}/>
          : project ? <ApexProject project={project} go={go} scroll={scroll}/>
          : isAbout ? <ApexAbout go={go}/>
            : <div className="wrap missing-page"><h1 tabIndex={-1}>페이지를 찾을 수 없습니다.</h1><p>주소가 바뀌었거나 아직 없는 페이지입니다.</p><RouteLink className="text-link" to="/writing" go={go}>개발 기록으로</RouteLink></div>}
      </main>
      <footer className="wrap footer"><div className="footer-top"><RouteLink className="wordmark" to="/" go={go}>hangyu<span className="slash">/</span>apex</RouteLink><button className="text-link" onClick={() => scroll.current?.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>맨 위로</button></div><div className="footer-bottom"><span>© {new Date().getFullYear()} HANGYU / APEX</span><span>만들고 배우는 과정을 기록합니다.</span><nav aria-label="연락처"><a href="/room">3D 방 ↗</a><a href={profile.github} target="_blank" rel="noopener noreferrer">GitHub ↗</a><a href={`mailto:${profile.email}`}>이메일 ↗</a></nav></div></footer>
      {searchOpen && <ApexSearch go={go} onClose={() => setSearchOpen(false)}/>}
    </ImageViewer>
  </div>;
}
