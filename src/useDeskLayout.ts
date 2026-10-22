import { useLayoutEffect, useRef, useState } from 'react';
import { arrangeDesk } from './desk-layout';

export function useDeskLayout(seed: number) {
  const ref = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState<ReturnType<typeof arrangeDesk>>(null);
  useLayoutEffect(() => {
    const desk = ref.current!;
    const host = desk.parentElement!;
    const entries = host.querySelector<HTMLElement>('.journal-entries')!;
    const children = [...desk.children] as HTMLElement[];
    const media = matchMedia('(min-width: 1280px)');
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      if (!media.matches) {
        host.style.removeProperty('--desk-height');
        setLayout(null);
        return;
      }
      const bounds = host.getBoundingClientRect();
      const article = entries.getBoundingClientRect();
      const next = arrangeDesk(bounds.width, Math.max(innerHeight - 174, article.height), { x: article.left - bounds.left, y: 0, width: article.width, height: article.height }, children.map(child => ({ width: child.offsetWidth, height: child.offsetHeight })), seed);
      host.style.setProperty('--desk-height', `${next?.height ?? 0}px`);
      setLayout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(schedule);
    [host, entries, ...children].forEach(element => observer.observe(element));
    window.addEventListener('resize', schedule);
    media.addEventListener('change', schedule);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); media.removeEventListener('change', schedule); host.style.removeProperty('--desk-height'); };
  }, [seed]);
  return { ref, layout };
}
