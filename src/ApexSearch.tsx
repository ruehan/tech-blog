import { useEffect, useRef, useState } from 'react';
import { posts } from './content';
import { apexProjects } from './apex-data';
import races from '../design/apex/race-records.json';
import { Icon } from './Icons';
import { RouteLink, type Navigate } from './navigation';

export function ApexSearch({ go, onClose }: { go: Navigate; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const records = [...posts.map(post => ({ title: post.title, description: post.description, category: post.tags[0], tags: post.tags, url: `/writing/${post.slug}` })), ...apexProjects.map(project => ({ title: project.title, description: project.description, category: '프로젝트', tags: project.tags, url: `/projects/${project.slug}` })), ...races];
  const results = records.filter(record => [record.title, record.description, record.category, ...record.tags].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal(); input.current?.focus();
    return () => { element.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog id="search-dialog" ref={dialog} aria-labelledby="search-title" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } }} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}><div className="search-top"><label id="search-title" htmlFor="search-input">기록 검색</label><button className="icon-button close-dialog" aria-label="검색 닫기" onClick={onClose}><Icon name="close"/></button></div><input ref={input} id="search-input" type="search" placeholder="제목, 태그, 관심 있는 주제를 검색하세요" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)}/><div className="search-summary" aria-live="polite">전체 기록 · {results.length}개의 결과</div><div id="search-results">{results.length ? results.map(record => <RouteLink key={record.url} to={record.url} go={href => { onClose(); go(href); }} className="search-result"><small>{record.category}</small><b>{record.title}</b></RouteLink>) : <p className="empty">일치하는 기록이 없습니다. 다른 제목이나 태그로 검색해 보세요.</p>}</div></dialog>;
}
