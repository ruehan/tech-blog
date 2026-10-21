import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import type { Post } from './content-types';
import { Icon } from './Icons';

export function JournalToc({ post, scrollRef }: { post: Post; scrollRef: RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState(post.sections[0]?.id ?? '');
  const [expanded, setExpanded] = useState(false);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1200px)').matches);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !post.sections.length) return;
    const media = window.matchMedia('(min-width: 1200px)');
    const headings = post.sections.map(section => document.getElementById(section.id)).filter((heading): heading is HTMLElement => !!heading);
    let frame = 0;
    const update = () => {
      frame = 0;
      const edge = root.getBoundingClientRect().top + (media.matches ? 48 : 88);
      let current = headings[0]?.id ?? '';
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= edge) current = heading.id;
      }
      if (root.scrollTop > 0 && root.scrollTop + root.clientHeight >= root.scrollHeight - 2) current = headings.at(-1)?.id ?? current;
      setActive(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const resize = () => { setWide(media.matches); schedule(); };
    const followHash = () => {
      let id = window.location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch { return; }
      const heading = headings.find(item => item.id === id);
      if (!heading) return;
      // Browsers don't consistently restore fragment positions inside fixed scrollers.
      flushSync(() => setExpanded(false));
      heading.scrollIntoView({ block: 'start' });
      schedule();
    };
    const observer = new ResizeObserver(schedule);
    const article = root.querySelector('.article');
    if (article) observer.observe(article);
    root.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resize);
    window.addEventListener('hashchange', followHash);
    media.addEventListener('change', resize);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', resize);
      window.removeEventListener('hashchange', followHash);
      media.removeEventListener('change', resize);
    };
  }, [post, scrollRef]);

  // Keep a long outline's active item visible without scrolling the article itself.
  useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!list || !link || (!wide && !expanded)) return;
    const bounds = list.getBoundingClientRect();
    const item = link.getBoundingClientRect();
    if (item.top < bounds.top) list.scrollTop += item.top - bounds.top;
    else if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom;
  }, [active, wide, expanded]);

  if (!post.sections.length) return null;
  return <nav className="journal-toc" aria-label="목차">
    <span className="journal-toc-label">목차</span>
    <button className="journal-toc-toggle" type="button" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>
      <Icon name="notes" size={16}/><span>목차</span><span className="journal-toc-current">{post.sections.find(section => section.id === active)?.title}</span><span aria-hidden="true">{expanded ? '−' : '+'}</span>
    </button>
    <div className="journal-toc-links" id={listId} ref={listRef} hidden={!wide && !expanded}>
      {post.sections.map(section => <a href={`#${section.id}`} key={section.id} aria-current={active === section.id ? 'location' : undefined} onClick={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        // Collapse before the native anchor scroll measures the heading's position.
        // Keeping native navigation also preserves fragment history and new-tab links.
        if (expanded) flushSync(() => setExpanded(false));
        const heading = document.getElementById(section.id);
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      }}>{section.title}</a>)}
    </div>
  </nav>;
}
