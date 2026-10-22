import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PostArticle, ProjectArticle, useReadingPosition } from './Blog';
import { allTags, filterPosts, formatDate, posts, projects } from './content';
import { Icon } from './Icons';
import { RouteLink, type Navigate, type Route } from './navigation';
import { ProjectShowcase } from './ProjectShowcase';
import { DeskObjects } from './DeskObjects';
import { JournalToc } from './JournalToc';
import { JournalReadingSettings, useReadingPreferences } from './JournalReadingSettings';
import { ImageViewer } from './ImageViewer';
import { SearchHighlight } from './SearchHighlight';
import { searchPreview } from './search';
import { About } from './About';
import { PostSort } from './PostSort';
import { parsePostSort, postSortSearch, sortPosts } from './post-sort';
import './journal.css';
import './journal-theme.css';
import './journal-reading.css';

const number = (value: number) => String(value).padStart(2, '0');

export function Journal({ route, go }: { route: Route; go: Navigate }) {
  const reading = useReadingPreferences();
  const scroll = useRef<HTMLDivElement>(null);
  const isAbout = route.path === '/about';
  const isIndex = route.path === '/journal';
  const isProjects = route.path === '/journal/projects';
  const project = projects.find(item => route.path === `/journal/projects/${item.slug}`);
  const isProject = !!project;
  const post = posts.find(item => route.path === `/journal/posts/${item.slug}`);
  const query = new URLSearchParams(route.search);
  const tag = query.get('tag') ?? '';
  const search = query.get('q') ?? '';
  const sort = parsePostSort(query.get('sort'));
  const [draftSearch, setDraftSearch] = useState(search);
  const [deskArrangement] = useState(() => Math.floor(Math.random() * 0x100000000));
  const [night, setNight] = useState(() => {
    try { return localStorage.getItem('journal-theme') === 'night'; }
    catch { return false; }
  });
  function toggleTheme() {
    const next = !night;
    setNight(next);
    try { localStorage.setItem('journal-theme', next ? 'night' : 'day'); }
    catch { /* Reading still works when browser storage is unavailable. */ }
  }
  const searchInput = useRef<HTMLInputElement>(null);
  const restoreSearchFocus = useRef(false);
  useEffect(() => setDraftSearch(search), [search]);
  useEffect(() => {
    if (!restoreSearchFocus.current) return;
    restoreSearchFocus.current = false;
    searchInput.current?.focus({ preventScroll: true });
  }, [route.path, route.search]);
  useReadingPosition(scroll, route.path + route.search);
  const visiblePosts = sortPosts(filterPosts(tag, search), sort);
  const postIndex = visiblePosts.findIndex(item => item.slug === post?.slug);
  const previousPost = postIndex > 0 ? visiblePosts[postIndex - 1] : undefined;
  const nextPost = postIndex >= 0 ? visiblePosts[postIndex + 1] : undefined;
  function filterHref(nextTag: string, nextSearch = search) {
    const params = new URLSearchParams(postSortSearch('', sort));
    if (nextTag) params.set('tag', nextTag);
    if (nextSearch.trim()) params.set('q', nextSearch.trim());
    return `/journal${params.size ? `?${params}` : ''}`;
  }
  function submitSearch(event: FormEvent) {
    event.preventDefault(); go(filterHref(tag, draftSearch));
  }
  function clearSearch() {
    setDraftSearch('');
    const href = filterHref(tag, '');
    restoreSearchFocus.current = href !== route.path + route.search;
    go(href);
    searchInput.current?.focus({ preventScroll: true });
  }

  return <div className="journal" data-theme={night ? 'night' : 'day'} ref={scroll} style={reading.style}>
    <ImageViewer routeKey={route.path + route.search}>
    <a className="journal-skip" href="#journal-main">본문으로 건너뛰기</a>
    <header className="journal-header">
      <RouteLink className="brand" to="/journal" go={go}>hangyu<span className="brand-light"> / room</span></RouteLink>
    </header>
    <nav className="journal-rail" aria-label="블로그 메뉴">
      <RouteLink className="rail-button" to="/journal" go={go} aria-label="글 기록" aria-current={isIndex || post ? 'page' : undefined} title="글 기록"><Icon name="notes"/><span className="journal-tooltip">글 기록</span></RouteLink>
      <RouteLink className="rail-button" to="/journal/projects" go={go} aria-label="프로젝트" aria-current={isProjects || isProject ? 'page' : undefined} title="프로젝트"><Icon name="folder"/><span className="journal-tooltip">프로젝트</span></RouteLink>
      <RouteLink className="rail-button" to="/about" go={go} aria-label="소개" aria-current={isAbout ? 'page' : undefined} title="소개"><Icon name="person"/><span className="journal-tooltip">소개</span></RouteLink>
      <span className="journal-rail-divider"/>
      <JournalReadingSettings preferences={reading.preferences} onChange={reading.setPreferences}/>
      <button className="rail-button" type="button" onClick={toggleTheme} aria-label="밤에 읽기" aria-pressed={night} title={night ? '밝게 읽기' : '밤에 읽기'}><Icon name={night ? 'sun' : 'moon'}/><span className="journal-tooltip">{night ? '밝게 읽기' : '밤에 읽기'}</span></button>
      <RouteLink className="rail-button" to="/" go={go} aria-label="3D 방으로" title="3D 방으로"><Icon name="room"/><span className="journal-tooltip">3D 방으로</span></RouteLink>
    </nav>

    <main className={`journal-main${isAbout ? ' journal-with-about' : ''}${isIndex ? ' journal-with-desk' : ''}${post || isProject ? ' journal-with-reading' : ''}${post?.sections.length ? ' journal-with-toc' : ''}`} id="journal-main" tabIndex={-1}>
      {isAbout ? <About go={go}/> : isIndex ? <div className="journal-index-layout">
          <section className="journal-entries" aria-labelledby="entries-heading">
            <div className="journal-section-heading"><h1 id="entries-heading" tabIndex={-1}>글 <span>{posts.length}</span></h1><PostSort value={sort} onChange={value => go(`/journal${postSortSearch(route.search, value)}`)}/></div>
            <form className="journal-search" role="search" onSubmit={submitSearch}><label className="sr-only" htmlFor="journal-search">글 검색</label><input ref={searchInput} id="journal-search" type="search" placeholder="제목·본문 검색" value={draftSearch} onChange={event => setDraftSearch(event.target.value)}/>{(draftSearch || search) && <button type="button" aria-label="검색어 지우기" onClick={clearSearch}><Icon name="close" size={16}/></button>}<button type="submit" aria-label="검색"><Icon name="search" size={18}/></button></form>
            <nav className="journal-tags" aria-label="태그 필터"><RouteLink to={filterHref('')} go={go} aria-current={!tag ? 'true' : undefined}>전체</RouteLink>{allTags.map(value => <RouteLink key={value} to={filterHref(value)} go={go} aria-current={tag === value ? 'true' : undefined}>{value}</RouteLink>)}</nav>
            {(search || tag) && <div className="journal-results" role="status"><span>{search && `“${search}” · `}{visiblePosts.length}개의 기록</span><RouteLink to={filterHref('', '')} go={go}>필터 지우기 <Icon name="close" size={13}/></RouteLink></div>}
            <div className="journal-post-list">{visiblePosts.map(item => {
              const preview = search ? searchPreview(item, search) : { text: item.description, anchor: '' };
              return <RouteLink key={item.slug} className="journal-entry" to={`/journal/posts/${item.slug}${route.search}${preview.anchor ? `#${encodeURIComponent(preview.anchor)}` : ''}`} go={go}>
              <div className={`journal-spine journal-spine-${posts.indexOf(item) % 3}`} aria-hidden="true"><Icon name={['book', 'focus', 'steering'][posts.indexOf(item) % 3]} size={22}/><span>{number(posts.indexOf(item) + 1)}</span></div>
              <div className="journal-entry-body"><div className="journal-entry-meta"><span><SearchHighlight text={item.tags.join(' / ')} query={search}/></span>{item.draft && <span className="draft-label">초안</span>}</div><h2><SearchHighlight text={item.title} query={search}/></h2><p className={search ? 'search-excerpt' : undefined}><SearchHighlight text={preview.text} query={search}/></p><div className="journal-entry-bottom"><time dateTime={item.date}>{formatDate(item.date)}</time><span>{item.minutes}분 읽기</span><Icon name="arrow" size={18}/></div></div>
            </RouteLink>; })}</div>
            {!visiblePosts.length && <div className="journal-empty"><Icon name={posts.length ? "search" : "book"} size={28}/><h3>{posts.length ? '아직 찾는 기록이 없어요.' : '아직 등록된 글이 없어요.'}</h3>{!!posts.length && <><p>다른 단어나 태그로 찾아보세요.</p><RouteLink to={filterHref('', '')} go={go}>전체 기록 보기 <Icon name="arrow" size={16}/></RouteLink></>}</div>}
          </section>
          <DeskObjects arrangement={deskArrangement} go={go}/>
      </div> : isProjects ? <>
        <div className="journal-section-heading journal-project-heading"><h1 tabIndex={-1}>프로젝트</h1></div>
        {projects.map(item => <ProjectShowcase key={item.slug} project={item} go={go}/>)}
        {!projects.length && <section className="journal-empty"><Icon name="folder" size={28}/><h2>아직 등록된 프로젝트가 없어요.</h2></section>}
      </> : post ? <div className="journal-reading">
        <div className="journal-reading-margin"><RouteLink to={`/journal${route.search}`} go={go}><Icon name="back" size={16}/> 기록 목록</RouteLink></div>
        <PostArticle key={post.slug} post={post} go={go} listPath="/journal" articleBase="/journal/posts" searchQuery={search} listSearch={route.search} toc={<JournalToc key={post.slug} post={post} scrollRef={scroll}/>} footer={
          <nav className="journal-pagination" aria-label="글 이동">
            <div className="journal-neighbours">
              {previousPost && <RouteLink className="journal-previous" to={`/journal/posts/${previousPost.slug}${route.search}`} go={go}><span><Icon name="back" size={15}/> 이전 글</span><strong>{previousPost.title}</strong></RouteLink>}
              {nextPost && <RouteLink className="journal-next" to={`/journal/posts/${nextPost.slug}${route.search}`} go={go}><span>다음 글 <Icon name="arrow" size={15}/></span><strong>{nextPost.title}</strong></RouteLink>}
            </div>
            <RouteLink className="journal-list-link" to={`/journal${route.search}`} go={go}><Icon name="notes" size={16}/> 글 목록</RouteLink>
          </nav>
        }/>
      </div> : project ? <div className="journal-project-reading"><ProjectArticle project={project} go={go} listPath="/journal/projects" articleBase="/journal/posts"/></div> : <section className="journal-empty journal-missing"><h1 tabIndex={-1}>페이지를 찾을 수 없습니다.</h1><RouteLink to="/journal" go={go}>기록 목록으로 <Icon name="arrow" size={18}/></RouteLink></section>}
    </main>
    </ImageViewer>
  </div>;
}
