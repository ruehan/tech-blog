import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { posts } from './content';
import { metadataTags, pageMetadata, siteName, siteUrl } from './seo';
import type { Route } from './navigation';

const scrollPositions = new Map<string, number>();
export function useReadingPosition(ref: RefObject<HTMLElement | null>, key: string) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.scrollTop = scrollPositions.get(key) ?? 0;
    const heading = element.querySelector<HTMLElement>('h1');
    if (heading?.getClientRects().length) heading.focus({ preventScroll: true });
    let hash = window.location.hash.slice(1);
    try { hash = decodeURIComponent(hash); } catch { /* Keep malformed fragments harmless. */ }
    if (hash) {
      const target = document.getElementById(hash);
      target?.scrollIntoView();
      if (target && new URLSearchParams(window.location.search).get('q')) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    }
    // Capture before a shorter replacement article can clamp the old scroll offset.
    const save = () => { scrollPositions.set(key, element.scrollTop); };
    element.addEventListener('scroll', save, { passive: true });
    return () => { element.removeEventListener('scroll', save); };
  }, [key, ref]);
}
type MetadataOverride = { title: string; description?: string; image?: string; noindex?: boolean };
// Runtime pages (gallery albums) learn their title after fetching; they register it here.
const overrides = new Map<string, MetadataOverride>();
const currentPath = () => window.location.pathname.replace(/\/$/, '') || '/';

function applyMetadata(path: string) {
  const metadata = pageMetadata(path, posts);
  const override = overrides.get(path);
  if (override) Object.assign(metadata, {
    title: `${override.title} — ${siteName}`, imageAlt: override.title,
    ...(override.description ? { description: override.description } : {}),
    ...(override.image ? { image: new URL(override.image, siteUrl).href } : {}),
    ...(override.noindex ? { noindex: true } : {}),
  });
  document.title = metadata.title;
  document.head.querySelectorAll('[data-page-meta],meta[name="description"]').forEach(element => element.remove());
  for (const [kind, name, content] of metadataTags(metadata)) {
    const element = document.createElement('meta');
    element.setAttribute(kind, name); element.content = content; element.dataset.pageMeta = '';
    document.head.append(element);
  }
  const canonical = document.createElement('link');
  canonical.rel = 'canonical'; canonical.href = metadata.canonical; canonical.dataset.pageMeta = '';
  document.head.append(canonical);
  if (metadata.structuredData) {
    const data = document.createElement('script');
    data.type = 'application/ld+json'; data.dataset.pageMeta = '';
    data.textContent = JSON.stringify(metadata.structuredData);
    document.head.append(data);
  }
}

export function overridePageMetadata(path: string, override: MetadataOverride) {
  overrides.set(path, override);
  if (currentPath() === path) applyMetadata(path);
}

export function ContentMetadata({ route }: { route: Route }) {
  useEffect(() => { applyMetadata(route.path); }, [route.path]);
  return null;
}
