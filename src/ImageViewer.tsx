import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icons';

type SelectedImage = { src: string; alt: string; caption: string; trigger: HTMLButtonElement };
const ImageViewerContext = createContext<((image: SelectedImage) => void) | undefined>(undefined);

/** Images stay plain in the 3D book; the journal opts into the viewer. */
export function ZoomableImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const open = useContext(ImageViewerContext);
  if (!open) return <img {...props}/>;
  return <button className="article-image-button" type="button" aria-label={`이미지 확대: ${props.alt || '본문 이미지'}`} onClick={event => {
    const image = event.currentTarget.querySelector('img')!;
    open({ src: image.currentSrc || image.src, alt: props.alt ?? '', caption: event.currentTarget.closest('figure')?.querySelector('figcaption')?.textContent ?? props.title ?? '', trigger: event.currentTarget });
  }}><img {...props}/></button>;
}

export function ImageViewer({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  const [selected, setSelected] = useState<SelectedImage | null>(null);
  const [original, setOriginal] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Release modal focus before the destination page focuses its heading.
    dialog.current?.close();
    setSelected(null);
  }, [routeKey]);
  useEffect(() => {
    if (!selected) return;
    const element = dialog.current!;
    const journal = element.closest<HTMLElement>('.journal')!;
    const overflow = journal.style.overflow;
    const scrollTop = journal.scrollTop;
    const openedUrl = window.location.href;
    journal.style.overflow = 'hidden';
    element.showModal();
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      element.close();
      journal.style.overflow = overflow;
      // Navigation owns the next page's focus and scroll position.
      if (selected.trigger.isConnected && window.location.href === openedUrl) {
        selected.trigger.focus({ preventScroll: true });
        journal.scrollTop = scrollTop;
      }
    };
  }, [selected]);
  return <ImageViewerContext.Provider value={image => { setOriginal(false); setFailed(false); setSelected(image); }}>
    {children}
    {selected && <dialog className="image-viewer" ref={dialog} aria-label="이미지 크게 보기" onCancel={event => { event.preventDefault(); setSelected(null); }} onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}>
      <div className="image-viewer-toolbar">
        <button type="button" aria-pressed={original} disabled={failed} onClick={() => { setOriginal(value => !value); stage.current?.scrollTo(0, 0); }}>{original ? '화면에 맞추기' : '원본 크기로 보기'}</button>
        <button ref={closeButton} className="icon-button" type="button" aria-label="이미지 닫기" onClick={() => setSelected(null)}><Icon name="close"/></button>
      </div>
      <div ref={stage} className={`image-viewer-stage${original ? ' is-original' : ''}`} tabIndex={0} role="region" aria-label="확대 이미지" onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}>
        {failed ? <p role="alert">이미지를 불러오지 못했어요.</p> : <img src={selected.src} alt={selected.alt} onError={() => setFailed(true)}/>}
      </div>
      {selected.caption && <p className="image-viewer-caption">{selected.caption}</p>}
    </dialog>}
  </ImageViewerContext.Provider>;
}
