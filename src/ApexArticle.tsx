import { useEffect, useRef, useState, type RefObject } from 'react';
import { formatDate, posts, type Post, type Project } from './content';
import { MarkdownBody } from './MarkdownBody';
import { SeriesContents } from './SeriesContents';
import { ZoomableImage } from './ImageViewer';
import { RouteLink, type Navigate } from './navigation';
import { searchPreview } from './search';

export function ApexToc({ sections, scroll }: { sections: Post['sections']; scroll: RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState(sections[0]?.id || '');
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const media = matchMedia('(max-width:720px)');
    const sync = () => { if (details.current) details.current.open = !media.matches; };
    sync(); media.addEventListener('change', sync);
    const root = scroll.current;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = (root?.getBoundingClientRect().top || 0) + 100;
      let current = sections[0]?.id || '';
      for (const section of sections) if ((document.getElementById(section.id)?.getBoundingClientRect().top ?? Infinity) <= top) current = section.id;
      setActive(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    root?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
    return () => { cancelAnimationFrame(frame); root?.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); media.removeEventListener('change', sync); };
  }, [sections, scroll]);
  return <aside className="article-toc"><details ref={details} id="article-toc" open><summary><span>이 글에서</span><span id="toc-current" aria-hidden="true">{sections.find(section => section.id === active)?.title}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5"/></svg></summary><nav aria-label="목차">{sections.map(section => <a key={section.id} href={`#${section.id}`} aria-current={active === section.id ? 'location' : undefined} onClick={() => {
    if (matchMedia('(max-width:720px)').matches && details.current) details.current.open = false;
    const heading = document.getElementById(section.id);
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }}>{section.title}</a>)}</nav></details></aside>;
}

function ShareLink() {
  const [status, setStatus] = useState('');
  const [fallback, setFallback] = useState('');
  return <><button className="text-link" onClick={async () => {
    const url = new URL(location.href); url.hash = ''; url.search = '';
    try { await navigator.clipboard.writeText(url.href); setStatus('주소를 복사했습니다.'); }
    catch { setFallback(url.href); setStatus('아래 주소를 복사해 주세요.'); }
  }}>글 주소 복사</button><span role="status">{status}</span>{fallback && <input aria-label="글 주소" readOnly value={fallback} onFocus={event => event.target.select()}/>}</>;
}

// Markup follows the exported detail template: heading, optional media, left outline, prose, related cards.
export function ApexArticle({ post, go, scroll, search, query }: { post: Post; go: Navigate; scroll: RefObject<HTMLDivElement | null>; search: string; query: string }) {
  const next = posts.filter(item => item.slug !== post.slug).slice(0, 2);
  return <div className="wrap detail-page dev-detail">
    <header className="article-heading"><RouteLink className="back-link list-return" to={`/writing${search}`} go={go}>개발 목록으로</RouteLink><div className="article-meta"><span>{post.tags[0] || '개발 노트'}</span><time dateTime={post.date}>{formatDate(post.date)}</time><span>{post.minutes}분 읽기{post.draft ? ' · 초안' : ''}</span></div><h1 tabIndex={-1}>{post.title}</h1><p className="article-deck">{post.description}</p><div className="article-tags">{post.tags.map(tag => <RouteLink key={tag} to={`/writing?${new URLSearchParams({ tag })}`} go={go}>{tag}</RouteLink>)}</div></header>
    <div className="reading-layout"><ApexToc sections={post.sections} scroll={scroll}/><article className="prose">
      <SeriesContents post={post} go={go} articleBase="/writing"/>
      <MarkdownBody body={post.body} searchTarget={query ? searchPreview(post, query).anchor : ''} variant="apex"/>
      <div className="article-end"><RouteLink className="text-link list-return" to={`/writing${search}`} go={go}>개발 목록으로</RouteLink><ShareLink/></div>
    </article></div>
    {!!next.length && <section className="related"><h2>이어서 읽기</h2><div>{next.map(item => <RouteLink key={item.slug} to={`/writing/${item.slug}`} go={go}><span>{item.tags[0]}</span><h3>{item.title}</h3></RouteLink>)}</div></section>}
  </div>;
}

export function ApexProject({ project, go, scroll }: { project: Project; go: Navigate; scroll: RefObject<HTMLDivElement | null> }) {
  const sections = project.sections.map((section, index) => ({ id: `project-section-${index + 1}`, title: section.title }));
  const records = project.series ? posts.filter(post => post.series?.slug === project.series) : [];
  return <div className="wrap detail-page project-detail">
    <header className="article-heading"><RouteLink className="back-link list-return" to="/projects" go={go}>프로젝트 목록으로</RouteLink><div className="article-meta"><span>프로젝트</span><span>{project.status}</span></div><h1 tabIndex={-1}>{project.title}</h1><p className="article-deck">{project.description}</p><div className="article-tags">{project.tags.map(tag => <span key={tag}>{tag}</span>)}</div></header>
    {project.cover && <figure className="article-photo"><ZoomableImage src={project.cover.src} alt={project.cover.alt}/></figure>}
    <div className="reading-layout"><ApexToc sections={sections} scroll={scroll}/><article className="prose">
      {project.sections.map((section, index) => <section key={section.title}><h2 id={sections[index].id} tabIndex={-1}>{section.title}</h2>{section.text && <p>{section.text}</p>}{section.items && <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>}</section>)}
      {!!project.previews.length && <section className="apex-project-previews"><h2>화면 미리보기</h2>{project.previews.map(preview => <figure key={preview.label}><ZoomableImage src={preview.image} alt={preview.alt}/><figcaption><h3>{preview.label}</h3><p>{preview.description}</p><RouteLink className="text-link" to={preview.href === '/' ? '/room' : preview.href} go={go}>{preview.action}</RouteLink></figcaption></figure>)}</section>}
      {!!project.updates.length && <section className="apex-project-updates"><h2>최근 작업</h2>{project.updates.map((update, index) => <p key={index}><time dateTime={update.date}>{formatDate(update.date)}</time> · {update.text}</p>)}</section>}
      {project.action && <p><RouteLink className="text-link" to={project.action.href === '/' ? '/room' : project.action.href} go={go}>{project.action.label}</RouteLink></p>}
      <div className="article-end"><RouteLink className="text-link" to="/projects" go={go}>프로젝트 목록으로</RouteLink><ShareLink/></div>
    </article></div>
    {!!records.length && <section className="related"><h2>만드는 과정</h2><div>{records.map(post => <RouteLink to={`/writing/${post.slug}`} go={go} key={post.slug}><span>{post.tags[0]}</span><h3>{post.title}</h3></RouteLink>)}</div></section>}
  </div>;
}
