import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../Icons';
import { RouteLink, type Navigate } from '../navigation';
import { photoSrcSet, type GalleryPhoto } from './api';
import { packTiles, tileSize } from './mosaic.ts';

export function PhotoImage({ photo, sizes, eager = false }: { photo: GalleryPhoto; sizes: string; eager?: boolean }) {
  return <img src={photo.src.md} srcSet={photoSrcSet(photo)} sizes={sizes} width={photo.width} height={photo.height}
    alt={photo.alt || photo.title || ''} loading={eager ? 'eager' : 'lazy'} decoding="async" style={photo.color ? { backgroundColor: photo.color } : undefined}/>;
}

function useColumns() {
  const read = () => matchMedia('(max-width: 720px)').matches ? 2 : matchMedia('(max-width: 1000px)').matches ? 3 : 4;
  const [columns, setColumns] = useState(read);
  useEffect(() => {
    const queries = ['(max-width: 720px)', '(max-width: 1000px)'].map(query => matchMedia(query));
    const update = () => setColumns(read());
    queries.forEach(query => query.addEventListener('change', update));
    return () => queries.forEach(query => query.removeEventListener('change', update));
  }, []);
  return columns;
}

/** Uniform square-cell grid with tiles of 1×1, 2×1, 1×2 and 2×2 cells. */
export function Mosaic<T>({ items, ratio, render, label, keyOf }: {
  items: T[]; ratio: (item: T) => number; render: (item: T, index: number) => ReactNode; label: string; keyOf: (item: T) => string;
}) {
  const columns = useColumns();
  const places = packTiles(items.map((item, index) => tileSize(ratio(item), index)), columns);
  return <div className="mosaic-frame"><div className="mosaic" role="list" aria-label={label} style={{ '--mosaic-columns': columns } as React.CSSProperties}>
    {items.map((item, index) => {
      const place = places[index];
      return <div role="listitem" key={keyOf(item)} className={`mosaic-tile${place.width === 2 && place.height === 2 ? ' mosaic-big' : ''}`}
        style={{ gridColumn: `${place.column + 1} / span ${place.width}`, gridRow: `${place.row + 1} / span ${place.height}` }}>{render(item, index)}</div>;
    })}
  </div></div>;
}

/** Lightbox with the original APEX markup (dialog.lightbox) driven by React state. */
export function PhotoLightbox({ photos, index, onIndex, onClose }: { photos: GalleryPhoto[]; index: number; onIndex: (index: number) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const photo = photos[index];
  useEffect(() => {
    const element = dialog.current!;
    const site = element.closest<HTMLElement>('.apex-site');
    const overflow = site?.style.overflow ?? '';
    const trigger = document.activeElement as HTMLElement | null;
    if (site) site.style.overflow = 'hidden';
    element.showModal();
    return () => { element.close(); if (site) site.style.overflow = overflow; trigger?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    setZoomed(false);
    frame.current?.scrollTo(0, 0);
    // Warm the neighbours so stepping through feels instant.
    for (const offset of [1, -1]) {
      const neighbour = photos[(index + offset + photos.length) % photos.length];
      if (neighbour && neighbour !== photos[index]) new Image().src = neighbour.src.lg;
    }
  }, [index, photos]);
  if (!photo) return null;
  const many = photos.length > 1;
  // The lg variant is at most 2560px on its long edge; zooming only helps when that exceeds the screen.
  const scale = Math.min(1, 2560 / Math.max(photo.width, photo.height));
  const canZoom = photo.width * scale > window.innerWidth || photo.height * scale > window.innerHeight;
  const step = (delta: number) => onIndex((index + delta + photos.length) % photos.length);
  const toggleZoom = () => {
    setZoomed(value => !value);
    // Open the zoomed view around the middle of the photo.
    requestAnimationFrame(() => { const element = frame.current; if (element) element.scrollTo((element.scrollWidth - element.clientWidth) / 2, (element.scrollHeight - element.clientHeight) / 2); });
  };
  const caption = [photo.caption, photo.takenAt && new Date(photo.takenAt).toLocaleDateString('ko-KR'), photo.credit && `사진: ${photo.credit}`].filter(Boolean).join(' · ');
  return <dialog ref={dialog} id="photo-dialog" className="gallery-lightbox" aria-label="사진 확대 보기" onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => { if (many && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); } }}>
    <div ref={frame} className={`gallery-lightbox-frame${zoomed ? ' is-zoomed' : ''}`}
      onClick={event => { if (event.target === event.currentTarget && !zoomed) onClose(); }}
      onPointerDown={event => { if (!zoomed && event.pointerType !== 'mouse') swipe.current = { x: event.clientX, y: event.clientY }; }}
      onPointerUp={event => {
        const start = swipe.current; swipe.current = null;
        if (!start || !many) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
      }}>
      <img key={photo.id} src={photo.src.lg} alt={photo.alt || photo.title || ''} width={photo.width} height={photo.height}
        className={canZoom ? 'can-zoom' : undefined} onClick={canZoom ? toggleZoom : undefined} title={canZoom ? (zoomed ? '클릭하면 화면에 맞춥니다' : '클릭하면 원본 크기로 봅니다') : undefined}/>
    </div>
    <div className="gallery-lightbox-top"><p id="photo-title">{photo.title || photo.album?.title || '사진'}</p><div>
      <span id="photo-position" role="status">{index + 1} / {photos.length}</span>
      {canZoom && <button type="button" aria-pressed={zoomed} onClick={toggleZoom}>{zoomed ? '화면에 맞추기' : '원본 크기'}</button>}
      <button type="button" className="icon-button" aria-label="사진 닫기" onClick={onClose}><Icon name="close"/></button>
    </div></div>
    {many && <><button id="photo-prev" type="button" className="gallery-lightbox-nav is-prev" aria-label="이전 사진" onClick={() => step(-1)}><span aria-hidden="true">‹</span></button>
      <button id="photo-next" type="button" className="gallery-lightbox-nav is-next" aria-label="다음 사진" onClick={() => step(1)}><span aria-hidden="true">›</span></button></>}
    {(caption || photo.sourceUrl) && <div className="gallery-lightbox-bottom">{caption && <p id="photo-caption">{caption}</p>}{photo.sourceUrl && <a id="photo-source" href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">사진 출처</a>}</div>}
  </dialog>;
}

/** Photos in the mosaic grid; clicking one opens the shared lightbox. */
export function PhotoWall({ photos, label, empty }: { photos: GalleryPhoto[]; label: string; empty?: ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return <>{empty}</>;
  return <>
    <Mosaic items={photos} ratio={photo => photo.width / photo.height} label={label} keyOf={photo => photo.id}
      render={(photo, index) => <button type="button" className="mosaic-photo photo-open" aria-label={`${photo.title || photo.alt || '사진'} 크게 보기`} onClick={() => setOpen(index)}>
        <PhotoImage photo={photo} sizes="(max-width: 720px) 100vw, 50vw"/>
      </button>}/>
    {open !== null && <PhotoLightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)}/>}
  </>;
}

/** Album (or section) tile: the cover fills the cell and the title sits on it. */
export function AlbumTile({ title, meta, href, go, cover, fallback }: { title: string; meta: string; href: string; go: Navigate; cover: GalleryPhoto | null; fallback: string }) {
  return <RouteLink className={`album-tile${cover ? '' : ' is-empty'}`} to={href} go={go}>
    {cover ? <PhotoImage photo={cover} sizes="(max-width: 720px) 100vw, 50vw"/> : <span className="album-tile-mark" aria-hidden="true">{fallback}</span>}
    <span className="album-tile-text"><b>{title}</b><small>{meta}</small></span>
  </RouteLink>;
}

export function GalleryStatus({ error, loading }: { error?: Error; loading: boolean }) {
  if (error) return <div className="race-empty gallery-status" role="alert"><p>{error.message}</p></div>;
  if (loading) return <div className="gallery-status gallery-loading" role="status"><span className="sr-only">사진을 불러오는 중</span><i/><i/><i/></div>;
  return null;
}
