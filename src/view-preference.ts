const storageKey = 'blog-view-mode';

export function rememberView(path: string) {
  const mode = path === '/journal' || path.startsWith('/journal/') ? 'journal'
    : path === '/' || path === '/posts' || path.startsWith('/posts/') || path === '/projects' || path.startsWith('/projects/') ? 'room'
    : null;
  if (!mode) return;
  try { localStorage.setItem(storageKey, mode); }
  catch { /* Navigation still works when storage is blocked or full. */ }
}

// Run before React mounts so a returning journal reader never loads the 3D scene.
// Only a fresh visit to the site root uses the saved mode; deep links stay intact.
export function restoreViewPreference() {
  if (window.location.pathname !== '/') return;
  try {
    if (localStorage.getItem(storageKey) !== 'journal') return;
    window.history.replaceState(window.history.state, '', `/journal${window.location.search}${window.location.hash}`);
  } catch { /* Keep the requested URL when browser storage is unavailable. */ }
}
