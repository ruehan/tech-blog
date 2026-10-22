import { renderToStaticMarkup } from 'react-dom/server';
import { PostArticle, ProjectArticle } from './Blog';
import { posts, project, formatDate } from './content';
import { pageMetadata, metadataTags, siteUrl } from './seo';

export { posts, pageMetadata, metadataTags, siteUrl };
export const staticRoutes = ['/', '/journal', '/posts', '/projects', '/journal/projects', '/projects/hangyu-room', '/journal/projects/hangyu-room', ...posts.flatMap(post => [`/journal/posts/${post.slug}`, `/posts/${post.slug}`])];

export function renderPage(path: string) {
  const post = posts.find(item => path === `/journal/posts/${item.slug}` || path === `/posts/${item.slug}`);
  const isProject = path.endsWith('/projects/hangyu-room');
  const isProjects = path.endsWith('/projects');
  const notFound = !staticRoutes.includes(path);
  return renderToStaticMarkup(<div className="journal journal-static" style={{ '--reading-width': '780px', '--reading-size-offset': '0px' } as React.CSSProperties}>
    <header className="journal-header"><a className="brand" href="/journal">hangyu<span className="brand-light"> / room</span></a><nav aria-label="블로그 메뉴"><a href="/journal">글 기록</a><a href="/journal/projects">프로젝트</a></nav></header>
    <main className={`journal-main${post || isProject ? ' journal-with-reading' : ''}${post?.sections.length ? ' journal-with-toc' : ''}`} id="journal-main">
      {post ? <div className="journal-reading"><div className="journal-reading-margin"><a href="/journal">기록 목록</a></div><PostArticle post={post} go={() => {}} listPath="/journal" articleBase="/journal/posts" toc={post.sections.length ? <nav className="journal-toc" aria-label="목차"><span className="journal-toc-label">목차</span><div className="journal-toc-links">{post.sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</div></nav> : undefined}/></div>
        : isProject ? <div className="journal-project-reading"><ProjectArticle go={() => {}} listPath="/journal/projects" articleBase="/journal/posts"/></div>
        : notFound ? <section className="journal-empty"><h1>페이지를 찾을 수 없습니다.</h1><a href="/journal">기록 목록으로</a></section>
        : isProjects ? <section><h1>프로젝트</h1><a className="journal-project-card" href="/journal/projects/hangyu-room"><div className="journal-project-info"><h2>{project.title}</h2><p>{project.description}</p></div></a></section>
        : <section className="journal-entries"><div className="journal-section-heading"><h1>글 <span>{posts.length}</span></h1></div>{posts.map(item => <a className="journal-entry" href={`/journal/posts/${item.slug}`} key={item.slug}><div className="journal-entry-body"><div className="journal-entry-meta">{item.tags.join(' / ')}</div><h2>{item.title}</h2><p>{item.description}</p><div className="journal-entry-bottom"><time dateTime={item.date}>{formatDate(item.date)}</time><span>{item.minutes}분 읽기</span></div></div></a>)}</section>}
    </main>
  </div>);
}
