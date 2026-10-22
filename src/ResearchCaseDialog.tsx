import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';
import './research-case-dialog.css';

export type ResearchCaseSelection = { label: string; href: string; trigger: HTMLAnchorElement };

export function ResearchCaseDialog({ selected, onClose }: { selected: ResearchCaseSelection; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(true);
  const [delayed, setDelayed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = dialog.current!;
    const journal = element.closest<HTMLElement>('.journal');
    const overflow = journal?.style.overflow ?? '';
    const scrollTop = journal?.scrollTop ?? 0;
    const openedUrl = window.location.href;
    if (journal) journal.style.overflow = 'hidden';
    element.showModal();
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      element.close();
      if (journal) journal.style.overflow = overflow;
      if (selected.trigger.isConnected && window.location.href === openedUrl) {
        selected.trigger.focus({ preventScroll: true });
        if (journal) journal.scrollTop = scrollTop;
      }
    };
  }, [selected]);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setDelayed(true), 12000);
    return () => window.clearTimeout(timer);
  }, [loading, attempt]);

  function retry() {
    setLoading(true); setDelayed(false); setAttempt(value => value + 1);
  }

  return <dialog className="research-case-dialog" ref={dialog} aria-labelledby="research-case-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <header className="research-case-toolbar">
      <h2 id="research-case-title">{selected.label}</h2>
      <a href={selected.href} target="_blank" rel="noopener noreferrer">원본 새 탭<Icon name="arrow" size={14}/></a>
      <button ref={closeButton} className="icon-button" type="button" aria-label="연구 사례 닫기" onClick={onClose}><Icon name="close"/></button>
    </header>
    {loading && <div className="research-case-loading" role="status">
      <span>{delayed ? '불러오기가 지연되고 있어요. 다시 시도하거나 원본을 새 탭에서 열어주세요.' : '연구 사례를 불러오는 중이에요.'}</span>
      {delayed && <button type="button" onClick={retry}>다시 불러오기</button>}
    </div>}
    <iframe key={attempt} className="research-case-frame" src={selected.href} title={selected.label}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={() => { setLoading(false); setDelayed(false); }}
      onError={() => { setLoading(true); setDelayed(true); }}/>
  </dialog>;
}
