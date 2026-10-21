import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { allTags, formatDate, posts, project, type ContentBlock, type Post } from './content';
import { Icon } from './Icons';
import { RouteLink, type Navigate, type Route } from './navigation';
import { asset } from './worlds';
import './blog.css';

const scrollPositions = new Map<string, number>();
function useReadingPosition(ref: RefObject<HTMLElement | null>, key: string) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.scrollTop = scrollPositions.get(key) ?? 0;
    const heading = element.querySelector<HTMLElement>('h1');
    if (heading?.getClientRects().length) heading.focus({ preventScroll: true });
    const hash = window.location.hash.slice(1);
    if (hash) document.getElementById(hash)?.scrollIntoView();
    // Capture before a shorter replacement article can clamp the old scroll offset.
    const save = () => { scrollPositions.set(key, element.scrollTop); };
    element.addEventListener('scroll', save, { passive: true });
    return () => { element.removeEventListener('scroll', save); };
  }, [key, ref]);
}
export function Library({ route, go, onClose }: { route: Route; go: Navigate; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    return () => { element.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useReadingPosition(scroll, route.path + route.search);
  return <dialog ref={dialog} className="library" aria-labelledby="library-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}>
    <div className="library-bar"><span className="library-label"><Icon name="desktop" size={16}/> 프로젝트</span><button className="icon-button" aria-label="목록 닫기" onClick={onClose}><Icon name="close"/></button></div>
    <div className="library-scroll" ref={scroll}>
      <div className="library-intro"><span className="content-kicker">ON MY DESKTOP</span>
        <h1 id="library-title" tabIndex={-1}>만들며 배우는 것들.</h1>
        <p>아이디어가 화면이 되기까지의 기록.</p>
      </div>
      <RouteLink className="project-card" to={`/projects/${project.slug}`} go={go}>
        <div className="project-cover"><img src={asset('interactive/room-glb-verified.png')} alt="책장과 컴퓨터, 심레이싱 장비가 놓인 3D 방"/></div>
        <div className="project-card-body"><span className="status-badge">진행 중</span><h2>{project.title}</h2><p>{project.description}</p><span className="project-more">작업 기록 보기 <Icon name="arrow" size={18}/></span></div>
      </RouteLink>
      <div className="library-footnote">hangyu / room <span>조금씩 쌓아가는 개인 기록</span></div>
    </div>
  </dialog>;
}

function Block({ block }: { block: ContentBlock }) {
  if (block.type === 'paragraph') return <p>{block.text}</p>;
  if (block.type === 'list') return <ul>{block.items.map(item => <li key={item}>{item}</li>)}</ul>;
  if (block.type === 'code') return <figure className="code-block"><figcaption>{block.language}</figcaption><pre><code>{block.text}</code></pre></figure>;
  return <aside className="article-note"><Icon name="info" size={19}/><p>{block.text}</p></aside>;
}

export function Book({ route, go, onClose }: { route: Route; go: Navigate; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const listScroll = useRef<HTMLDivElement>(null);
  const pageScroll = useRef<HTMLDivElement>(null);
  const tag = new URLSearchParams(route.search).get('tag');
  const visiblePosts = tag ? posts.filter(post => post.tags.includes(tag)) : posts;
  const isList = route.path === '/posts';
  const post = isList ? visiblePosts[0] : posts.find(item => route.path === `/posts/${item.slug}`);
  const pageKey = post?.slug ?? route.path + route.search;
  const previousPage = useRef(pageKey);
  const previousIndex = posts.findIndex(item => item.slug === previousPage.current);
  const index = posts.findIndex(item => item.slug === post?.slug);
  const neighbours = post && visiblePosts.includes(post) ? visiblePosts : posts;
  const neighbourIndex = neighbours.findIndex(item => item.slug === post?.slug);
  const turn = previousPage.current !== pageKey;
  const direction = index < previousIndex ? 'backward' : 'forward';
  useLayoutEffect(() => { previousPage.current = pageKey; }, [pageKey]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    const heading = [...element.querySelectorAll<HTMLElement>('h1, .book-intro h2')].find(item => item.getClientRects().length && item.tagName === 'H1') ?? element.querySelector<HTMLElement>('.book-intro h2');
    heading?.focus({ preventScroll: true });
    return () => { element.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useReadingPosition(listScroll, `book-list:${tag ?? ''}`);
  useReadingPosition(pageScroll, `book-page:${pageKey}`);
  useLayoutEffect(() => {
    if (!isList) pageScroll.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }, [isList, route.path]);
  return <dialog ref={dialog} className={`library book ${isList ? 'book-browsing' : 'book-reading'}`} aria-label="글 기록" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="library-bar book-bar">
      <span className="library-label"><Icon name="book" size={16}/> 글</span>
      <span className="book-signature">hangyu / room</span>
      <button className="icon-button" aria-label="목록 닫기" onClick={onClose}><Icon name="close"/></button>
    </header>
    <div className="book-spread">
      <aside className="book-index" aria-label="글 목록">
        <div className="book-index-scroll" ref={listScroll}>
          <div className="book-intro"><span className="content-kicker">FROM MY BOOKSHELF</span><h2 tabIndex={-1}>생각을 쌓아두는 곳.</h2><p>만들고, 막히고, 다시 풀어낸 기록.</p></div>
          <div className="tag-filters" aria-label="태그 필터"><RouteLink to="/posts" go={go} aria-current={!tag ? 'true' : undefined}>전체 <span>{posts.length}</span></RouteLink>{allTags.map(value => <RouteLink key={value} to={`/posts?tag=${encodeURIComponent(value)}`} go={go} aria-current={tag === value ? 'true' : undefined}>{value}</RouteLink>)}</div>
          <div className="library-count">{visiblePosts.length}개의 글 <span>작업 기록 · 초안</span></div>
          <nav className="book-posts" aria-label="글 선택">{visiblePosts.map(item => <RouteLink key={item.slug} className="post-card" to={`/posts/${item.slug}${route.search}`} go={go} aria-current={item.slug === post?.slug ? 'page' : undefined}>
            <span className="post-number">{String(posts.indexOf(item) + 1).padStart(2, '0')}</span><div><div className="post-meta"><span>{item.tags.join(' / ')}</span></div><h3>{item.title}</h3><time dateTime={item.date}>{formatDate(item.date)} · {item.minutes}분 읽기</time></div><Icon name="arrow" size={16}/>
          </RouteLink>)}</nav>
          {!visiblePosts.length && <div className="content-empty"><h2>아직 이 태그의 글이 없어요.</h2><RouteLink to="/posts" go={go}>전체 글 보기 <Icon name="arrow" size={16}/></RouteLink></div>}
        </div>
        <footer className="book-index-footer"><span>조금씩 쌓아가는 개인 기록</span><Icon name="book" size={18}/></footer>
      </aside>
      <section className="book-paper" aria-label="선택한 글">
        <div className="book-page-bar"><RouteLink className="article-back" to={`/posts${route.search}`} go={go}><Icon name="back" size={15}/> 글 목록</RouteLink><span>{post ? `${String(index + 1).padStart(2, '0')} / ${String(posts.length).padStart(2, '0')}` : '기록'}</span></div>
        <div className="book-page-scroll" ref={pageScroll}>
          <div key={pageKey} className={`book-leaf ${turn ? 'is-turning' : ''}`} data-direction={direction}>
            {post ? <PostArticle post={post} go={go}/> : isList ? <div className="book-blank"><Icon name="book" size={40}/><h1 tabIndex={-1}>다음 이야기를 기다리며.</h1><p>왼쪽 목록에서 다른 태그를 골라보세요.</p></div> : <section className="content-empty not-found"><span className="content-kicker">404 / NOT FOUND</span><h1 tabIndex={-1}>이 페이지는 아직 없어요.</h1><p>책장에서 다른 글을 찾아보세요.</p><RouteLink className="content-primary" to="/posts" go={go}>글 목록으로 <Icon name="arrow" size={18}/></RouteLink></section>}
          </div>
        </div>
        {post && <footer className="book-pagination"><span>{String(index + 1).padStart(2, '0')}</span><nav aria-label="글 넘기기">{neighbourIndex > 0 && <RouteLink to={`/posts/${neighbours[neighbourIndex - 1].slug}${route.search}`} go={go}><Icon name="back" size={15}/> 이전 글</RouteLink>}{neighbourIndex < neighbours.length - 1 && <RouteLink to={`/posts/${neighbours[neighbourIndex + 1].slug}${route.search}`} go={go}>다음 글 <Icon name="arrow" size={15}/></RouteLink>}</nav></footer>}
      </section>
    </div>
  </dialog>;
}

function PostArticle({ post, go }: { post: Post; go: Navigate }) {
  const [share, setShare] = useState('');
  const [copyFallback, setCopyFallback] = useState('');
  async function copyLink() {
    const url = new URL(`/posts/${post.slug}`, window.location.origin).href;
    try { await navigator.clipboard.writeText(url); setShare('링크를 복사했어요.'); }
    catch { setCopyFallback(url); setShare('아래 주소를 복사해주세요.'); }
  }
  return <article className="article" >
        <header className="article-heading"><div className="article-tags">{post.tags.map(tag => <RouteLink key={tag} to={`/posts?tag=${encodeURIComponent(tag)}`} go={go}>{tag}</RouteLink>)}</div>
          <h1 tabIndex={-1}>{post.title}</h1><p className="article-deck">{post.description}</p>
          <div className="article-byline"><span className="author-mark">h.</span><span>hangyu <span className="byline-separator">/</span> <time dateTime={post.date}>{formatDate(post.date)}</time></span><span>{post.minutes}분 읽기</span><span className="draft-label">초안</span></div>
        </header>
        <nav className="book-toc" aria-label="목차"><span className="content-kicker">이 글의 순서</span>{post.sections.map(section => <a href={`#${section.id}`} key={section.id}>{section.title}</a>)}</nav>
        <div className="article-body">{post.sections.map(section => <section key={section.id} id={section.id}><h2>{section.title}</h2>{section.blocks.map((block, index) => <Block key={index} block={block}/>)}</section>)}</div>
        <div className="article-end"><span>읽어주셔서 감사합니다.</span><button className="share-button" onClick={copyLink}><Icon name="link" size={17}/> 링크 복사</button><span role="status">{share}</span>{copyFallback && <input className="copy-fallback" aria-label="글 주소" readOnly value={copyFallback} onFocus={event => event.target.select()}/>}</div>
        <section className="related-posts"><span className="content-kicker">함께 읽기</span>{posts.filter(item => item.slug !== post.slug).map(item => <RouteLink key={item.slug} to={`/posts/${item.slug}`} go={go}>{item.title}<Icon name="arrow" size={18}/></RouteLink>)}</section>
      </article>;
}

export function ReadingPage({ route, go, onReturn }: { route: Route; go: Navigate; onReturn: () => void }) {
  const scroll = useRef<HTMLDivElement>(null);
  const isProject = route.path === `/projects/${project.slug}`;
  useReadingPosition(scroll, route.path);
  return <div className="reading-page" ref={scroll}>
    <header className="reading-header"><RouteLink className="brand" to="/" go={go} aria-label="Hangyu's room, 메인 방으로">hangyu<span className="brand-light"> / room</span></RouteLink>
      <button className="reading-return" onClick={onReturn}><Icon name="back" size={17}/> 공간으로 돌아가기</button></header>
    <main className="reading-layout reading-wide">
      {isProject ? <article className="project-detail">
        <RouteLink className="article-back" to="/projects" go={go}><Icon name="back" size={16}/> 프로젝트 목록</RouteLink>
        <header className="article-heading"><span className="status-badge">진행 중 · 개인 프로젝트</span><h1 tabIndex={-1}>{project.title}</h1><p className="article-deck">{project.subtitle}</p><div className="article-tags">{project.tags.map(tag => <span key={tag}>{tag}</span>)}</div></header>
        <div className="project-cover"><img src={asset('interactive/room-glb-verified.png')} alt="웹으로 옮긴 개인 작업실의 3D 모델"/></div>
        <div className="article-body"><section><h2>어떤 공간인가요?</h2><p>{project.description} 책에서 글을 읽고, 컴퓨터에서 만든 것을 살펴볼 수 있습니다.</p></section>
          <section><h2>지금까지 만든 경험</h2><ul><li>책·베이스의 호버 반응과 방의 조명 전환</li><li>모니터를 거쳐 들어가는 컴퓨터 월드</li><li>심레이싱 장비에서 출발선의 운전석으로 이동</li><li>책처럼 펼치는 글 목록과 본문, 페이지 전환</li></ul></section>
          <section><h2>다음 작업</h2><p>실제 글과 프로젝트 콘텐츠를 늘리고, 모바일에서의 탐색 경험을 다듬습니다. 현재 차량 주행과 물리 시뮬레이션은 포함하지 않습니다.</p></section></div>
        <RouteLink className="content-primary" to="/" go={go}>방 둘러보기 <Icon name="arrow" size={18}/></RouteLink>
        <section className="related-posts"><span className="content-kicker">이 프로젝트의 작업 기록</span>{posts.map(post => <RouteLink key={post.slug} to={`/posts/${post.slug}`} go={go}>{post.title}<Icon name="arrow" size={18}/></RouteLink>)}</section>
      </article> : <section className="content-empty not-found"><span className="content-kicker">404 / NOT FOUND</span><h1 tabIndex={-1}>이 페이지는 아직 없어요.</h1><p>주소를 확인하거나 책장에서 다른 글을 찾아보세요.</p><RouteLink className="content-primary" to="/posts" go={go}>글 목록으로 <Icon name="arrow" size={18}/></RouteLink></section>}
    </main><footer className="reading-footer">hangyu / room <span>만들고 배우는 과정을 기록합니다.</span></footer>
  </div>;
}

export function ContentMetadata({ route }: { route: Route }) {
  useEffect(() => {
    const post = posts.find(post => route.path === `/posts/${post.slug}`);
    const title = post?.title ?? (route.path === '/posts' ? '글 기록' : route.path.startsWith('/projects') ? '프로젝트' : route.path === '/' ? '작은 취향의 공간' : '페이지를 찾을 수 없습니다');
    const description = post?.description ?? '개발하고, 만들고, 배우는 과정을 기록하는 hangyu의 개인 공간.';
    document.title = `${title} — hangyu / room`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [route.path]);
  return null;
}
