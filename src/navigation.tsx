import { useCallback, useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { rememberView } from './view-preference';

export type Route = { path: string; search: string };
const currentRoute = (): Route => ({ path: window.location.pathname.replace(/\/$/, '') || '/', search: window.location.search });
export function useRoute() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => { rememberView(route.path); }, [route.path]);
  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const go = useCallback((href: string) => {
    const target = new URL(href, window.location.href);
    if (target.pathname + target.search !== window.location.pathname + window.location.search) {
      window.history.pushState(null, '', target.pathname + target.search + target.hash);
      setRoute(currentRoute());
    }
  }, []);
  return { route, go };
}
export type Navigate = (href: string) => void;
export function RouteLink({ to, go, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; go: Navigate }) {
  function follow(event: MouseEvent<HTMLAnchorElement>) {
    props.onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === '_blank') return;
    event.preventDefault(); go(to);
  }
  return <a {...props} href={to} onClick={follow}>{children}</a>;
}
