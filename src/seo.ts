import type { MarkdownNode, Post } from './content-types';
import { projects } from './project-data';

export const siteUrl: string = import.meta.env.SITE_URL;
export const siteName = 'hangyu / room';
export const siteDescription = '개발하고, 만들고, 배우는 과정을 기록하는 hangyu의 개인 공간.';
const defaultImage = '/images/site/room.png';

function firstImage(nodes: MarkdownNode[]): string | undefined {
  for (const node of nodes) {
    if (node.type !== 'element') continue;
    if (node.tag === 'img' && typeof node.attributes.src === 'string') return node.attributes.src;
    const child = firstImage(node.children);
    if (child) return child;
  }
}

export function pageMetadata(path: string, posts: Post[]) {
  const clean = path.replace(/\/$/, '') || '/';
  const canonicalPath = clean === '/posts' ? '/journal' : clean.startsWith('/posts/') || clean === '/projects' || clean.startsWith('/projects/') ? `/journal${clean}` : clean;
  const post = posts.find(item => canonicalPath === `/journal/posts/${item.slug}`);
  const project = projects.find(item => canonicalPath === `/journal/projects/${item.slug}`);
  const known = post || project || ['/', '/journal', '/journal/projects'].includes(canonicalPath);
  const title = post?.title ?? (canonicalPath === '/journal' ? '글 기록' : canonicalPath.startsWith('/journal/projects') && known ? '프로젝트' : canonicalPath === '/' ? '작은 취향의 공간' : '페이지를 찾을 수 없습니다');
  const description = post?.description ?? siteDescription;
  const image = new URL(post?.image ?? (post && firstImage(post.body)) ?? defaultImage, siteUrl).href;
  const canonical = new URL(canonicalPath, siteUrl).href;
  const noindex = !known || !!post?.draft;
  const structuredData = post && !noindex ? {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title,
    description, image: [image], datePublished: `${post.date}T00:00:00+09:00`, inLanguage: 'ko-KR',
    author: { '@type': 'Person', name: 'hangyu' }, mainEntityOfPage: canonical, url: canonical,
    ...(post.series ? { isPartOf: { '@type': 'CreativeWorkSeries', name: post.series.title }, position: post.series.order } : {}),
  } : null;
  return { title: `${title} — ${siteName}`, description, canonical, image, imageAlt: post?.title ?? 'hangyu의 작업실', type: post ? 'article' : 'website', date: post?.date, noindex, structuredData };
}

export function metadataTags(metadata: ReturnType<typeof pageMetadata>) {
  return [
    ['name', 'description', metadata.description], ['name', 'robots', metadata.noindex ? 'noindex, follow' : 'index, follow'],
    ['property', 'og:title', metadata.title], ['property', 'og:description', metadata.description],
    ['property', 'og:type', metadata.type], ['property', 'og:url', metadata.canonical],
    ['property', 'og:image', metadata.image], ['property', 'og:image:alt', metadata.imageAlt],
    ['property', 'og:site_name', siteName], ['property', 'og:locale', 'ko_KR'],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', metadata.title],
    ['name', 'twitter:description', metadata.description], ['name', 'twitter:image', metadata.image],
    ['name', 'twitter:image:alt', metadata.imageAlt],
    ...(metadata.date ? [['property', 'article:published_time', `${metadata.date}T00:00:00+09:00`]] : []),
  ];
}
