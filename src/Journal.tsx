import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PostArticle, ProjectArticle, useReadingPosition } from './Blog';
import { allTags, filterPosts, formatDate, posts, project } from './content';
import { Icon } from './Icons';
import { RouteLink, type Navigate, type Route } from './navigation';
import { asset } from './worlds';
import { DeskObjects } from './DeskObjects';
import './journal.css';

const number = (value: number) => String(value).padStart(2, '0');

export function Journal({ route, go }: { route: Route; go: Navigate }) {
  const scroll = useRef<HTMLDivElement>(null);
  const isIndex = route.path === '/journal';
  const isProjects = route.path === '/journal/projects';
  const isProject = route.path === `/journal/projects/${project.slug}`;
  const post = posts.find(item => route.path === `/journal/posts/${item.slug}`);
  const query = new URLSearchParams(route.search);
  const tag = query.get('tag') ?? '';
  const search = query.get('q') ?? '';
  const [draftSearch, setDraftSearch] = useState(search);
  const [deskArrangement] = useState(() => Math.floor(Math.random() * 3));
  const searchInput = useRef<HTMLInputElement>(null);
  const restoreSearchFocus = useRef(false);
  useEffect(() => setDraftSearch(search), [search]);
  useEffect(() => {
    if (!restoreSearchFocus.current) return;
    restoreSearchFocus.current = false;
    searchInput.current?.focus({ preventScroll: true });
  }, [route.path, route.search]);
  useReadingPosition(scroll, route.path + route.search);
  const visiblePosts = filterPosts(tag, search);
  const postIndex = visiblePosts.findIndex(item => item.slug === post?.slug);
  const previousPost = postIndex > 0 ? visiblePosts[postIndex - 1] : undefined;
  const nextPost = postIndex >= 0 ? visiblePosts[postIndex + 1] : undefined;
  function filterHref(nextTag: string, nextSearch = search) {
    const params = new URLSearchParams();
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

  return <div className="journal" ref={scroll}>
    <a className="journal-skip" href="#journal-main">본문으로 건너뛰기</a>
    <header className="journal-header">
      <RouteLink className="brand" to="/journal" go={go}>hangyu<span className="brand-light"> / room</span></RouteLink>
    </header>
    <nav className="journal-rail" aria-label="블로그 메뉴">
      <RouteLink className="rail-button" to="/journal" go={go} aria-label="글 기록" aria-current={isIndex || post ? 'page' : undefined} title="글 기록"><Icon name="notes"/><span className="journal-tooltip">글 기록</span></RouteLink>
      <RouteLink className="rail-button" to="/journal/projects" go={go} aria-label="프로젝트" aria-current={isProjects || isProject ? 'page' : undefined} title="프로젝트"><Icon name="folder"/><span className="journal-tooltip">프로젝트</span></RouteLink>
      <span className="journal-rail-divider"/>
      <RouteLink className="rail-button" to="/" go={go} aria-label="3D 방으로" title="3D 방으로"><Icon name="room"/><span className="journal-tooltip">3D 방으로</span></RouteLink>
    </nav>

    <main className={`journal-main${isIndex ? ' journal-with-desk' : ''}`} id="journal-main" tabIndex={-1}>
      {isIndex ? <div className="journal-index-layout">
          <section className="journal-entries" aria-labelledby="entries-heading">
            <div className="journal-section-heading"><h1 id="entries-heading" tabIndex={-1}>글 <span>{posts.length}</span></h1></div>
            <form className="journal-search" role="search" onSubmit={submitSearch}><label className="sr-only" htmlFor="journal-search">글 검색</label><input ref={searchInput} id="journal-search" type="search" placeholder="제목·본문 검색" value={draftSearch} onChange={event => setDraftSearch(event.target.value)}/>{(draftSearch || search) && <button type="button" aria-label="검색어 지우기" onClick={clearSearch}><Icon name="close" size={16}/></button>}<button type="submit" aria-label="검색"><Icon name="search" size={18}/></button></form>
            <nav className="journal-tags" aria-label="태그 필터"><RouteLink to={filterHref('')} go={go} aria-current={!tag ? 'true' : undefined}>전체</RouteLink>{allTags.map(value => <RouteLink key={value} to={filterHref(value)} go={go} aria-current={tag === value ? 'true' : undefined}>{value}</RouteLink>)}</nav>
            {(search || tag) && <div className="journal-results" role="status"><span>{search && `“${search}” · `}{visiblePosts.length}개의 기록</span><RouteLink to="/journal" go={go}>필터 지우기 <Icon name="close" size={13}/></RouteLink></div>}
            <div className="journal-post-list">{visiblePosts.map(item => <RouteLink key={item.slug} className="journal-entry" to={`/journal/posts/${item.slug}${route.search}`} go={go}>
              <div className={`journal-spine journal-spine-${posts.indexOf(item) % 3}`} aria-hidden="true"><Icon name={['book', 'focus', 'steering'][posts.indexOf(item) % 3]} size={22}/><span>{number(posts.indexOf(item) + 1)}</span></div>
              <div className="journal-entry-body"><div className="journal-entry-meta"><span>{item.tags.join(' / ')}</span><span>초안</span></div><h2>{item.title}</h2><p>{item.description}</p><div className="journal-entry-bottom"><time dateTime={item.date}>{formatDate(item.date)}</time><span>{item.minutes}분 읽기</span><Icon name="arrow" size={18}/></div></div>
            </RouteLink>)}</div>
            {!visiblePosts.length && <div className="journal-empty"><Icon name="search" size={28}/><h3>아직 찾는 기록이 없어요.</h3><p>다른 단어나 태그로 찾아보세요.</p><RouteLink to="/journal" go={go}>전체 기록 보기 <Icon name="arrow" size={16}/></RouteLink></div>}
          </section>
          <DeskObjects arrangement={deskArrangement}/>
      </div> : isProjects ? <>
        <div className="journal-section-heading journal-project-heading"><h1 tabIndex={-1}>프로젝트</h1></div>
        <RouteLink className="journal-project-card" to={`/journal/projects/${project.slug}`} go={go}><div className="journal-project-image"><img src={asset('interactive/room-glb-verified.png')} alt="책장과 컴퓨터, 심레이싱 장비가 놓인 hangyu의 방"/></div><div className="journal-project-info"><span className="status-badge">진행 중 · 개인 프로젝트</span><h2>{project.title}</h2><p>{project.description}</p><div className="article-tags">{project.tags.map(value => <span key={value}>{value}</span>)}</div><span className="journal-note-link">만드는 과정 보기 <Icon name="arrow" size={18}/></span></div></RouteLink>
      </> : post ? <div className="journal-reading">
        <div className="journal-reading-margin"><RouteLink to={`/journal${route.search}`} go={go}><Icon name="back" size={16}/> 기록 목록</RouteLink></div>
        <PostArticle key={post.slug} post={post} go={go} listPath="/journal" articleBase="/journal/posts" footer={
          <nav className="journal-pagination" aria-label="글 이동">
            <div className="journal-neighbours">
              {previousPost && <RouteLink className="journal-previous" to={`/journal/posts/${previousPost.slug}${route.search}`} go={go}><span><Icon name="back" size={15}/> 이전 글</span><strong>{previousPost.title}</strong></RouteLink>}
              {nextPost && <RouteLink className="journal-next" to={`/journal/posts/${nextPost.slug}${route.search}`} go={go}><span>다음 글 <Icon name="arrow" size={15}/></span><strong>{nextPost.title}</strong></RouteLink>}
            </div>
            <RouteLink className="journal-list-link" to={`/journal${route.search}`} go={go}><Icon name="notes" size={16}/> 글 목록</RouteLink>
          </nav>
        }/>
      </div> : isProject ? <div className="journal-project-reading"><ProjectArticle go={go} listPath="/journal/projects" articleBase="/journal/posts"/></div> : <section className="journal-empty journal-missing"><h1 tabIndex={-1}>페이지를 찾을 수 없습니다.</h1><RouteLink to="/journal" go={go}>기록 목록으로 <Icon name="arrow" size={18}/></RouteLink></section>}
    </main>
  </div>;
}
