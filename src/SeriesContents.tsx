import { posts, type Post } from './content';
import { RouteLink, type Navigate } from './navigation';
import { Icon } from './Icons';

export function SeriesContents({ post, go, articleBase }: { post: Post; go: Navigate; articleBase: string }) {
  if (!post.series) return null;
  const entries = posts.filter(item => item.series?.slug === post.series!.slug).sort((a, b) => a.series!.order - b.series!.order);
  const index = entries.findIndex(item => item.slug === post.slug);
  return <details className="article-series">
    <summary><span>시리즈 · {post.series.title}</span><span>{index + 1} / {entries.length}</span></summary>
    <nav aria-label="시리즈 순서">
      <ol>{entries.map(item => <li key={item.slug}><RouteLink to={`${articleBase}/${item.slug}`} go={go} aria-current={item.slug === post.slug ? 'page' : undefined}><span>{String(item.series!.order).padStart(2, '0')}</span>{item.title}{item.draft && <span className="draft-label">초안</span>}</RouteLink></li>)}</ol>
      <div className="series-neighbours">
        {index > 0 && <RouteLink to={`${articleBase}/${entries[index - 1].slug}`} go={go}><Icon name="back" size={14}/> 이전 편</RouteLink>}
        {index < entries.length - 1 && <RouteLink to={`${articleBase}/${entries[index + 1].slug}`} go={go}>다음 편 <Icon name="arrow" size={14}/></RouteLink>}
      </div>
    </nav>
  </details>;
}
