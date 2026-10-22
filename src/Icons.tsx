export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    reading: <><path d="m3 18 5-12 5 12M5 14h6m4-8h6m-6 6h6m-6 6h4"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    notes: <><rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18M3 7h4m-4 5h4m-4 5h4m6-10h4m-4 5h4"/></>,
    room: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-8h6v8"/></>,
    desktop: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4M7 8h5"/></>,
    circuit: <><path d="M7 3v18M7 4c5-4 7 4 14 0v9c-7 4-9-4-14 0"/><path d="M12 4v8m5-6v8M7 8c5-4 7 4 14 0"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></>,
    moon: <path d="M20.8 13.3A9 9 0 0 1 10.7 3.2 9 9 0 1 0 20.8 13.3Z"/>,
    reset: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/></>,
    pause: <><path d="M8 5v14M16 5v14"/></>,
    play: <path d="m8 4 12 8-12 8Z"/>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    back: <path d="M19 12H5m6-6-6 6 6 6"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>,
    markers: <><path d="M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7Z"/><circle cx="12" cy="12" r="3"/></>,
    focus: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="4"/></>,
    link: <><path d="m10 13 4-4m-5-3 2-2a4 4 0 0 1 6 6l-2 2m-6 0-2 2a4 4 0 0 0 6 6l2-2"/></>,
    steering: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="m10 11-6-2m10 2 6-2m-8 5v7"/></>,
    drag: <><path d="M7 12V7a2 2 0 0 1 4 0v5-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v10a5 5 0 0 1-5 5h-2a5 5 0 0 1-4-2L3 13a2 2 0 0 1 3-2l1 1Z"/></>,
    book: <><path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15"/></>,
    folder: <path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"/>,
    music: <><path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.room}</svg>;
}
