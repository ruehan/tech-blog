import { useState } from 'react';
import { formatDate, posts, project } from './content';
import { Icon } from './Icons';
import { RouteLink, type Navigate } from './navigation';
import './project-showcase.css';

const previews = [
  { label: '3D 방', image: '/images/posts/room-blog/room.png', alt: '책장, 책상과 심레이싱 장비가 놓인 3D 방', description: '방 안의 물건을 따라 글과 프로젝트를 찾아가는 공간.', href: '/', action: '방 둘러보기' },
  { label: '2D 블로그', image: '/images/posts/room-blog/journal.png', alt: '글 목록과 책상 소품이 놓인 일반 블로그 화면', description: '검색하고, 읽고, 기록을 따라가는 가벼운 블로그.', href: '/journal', action: '글 읽으러 가기' },
];
const updates = [
  { date: '2026-10-22', text: '요즘 하는 일을 담은 메모와 여백에 놓이는 책상 소품.' },
  { date: '2026-10-22', text: '본문 검색, 시리즈 탐색, 글씨 크기와 읽기 폭 설정.' },
  { date: '2026-10-21', text: '3D 방의 화면 전환과 렌더링 최적화, 화질 선택.' },
];

export function ProjectShowcase({ go }: { go?: Navigate }) {
  const [selected, setSelected] = useState(0);
  const preview = previews[selected];
  const records = posts.filter(post => post.series?.slug === 'building-hangyu-room');
  const link = (href: string, content: React.ReactNode, className?: string) => go ? <RouteLink to={href} go={go} className={className}>{content}</RouteLink> : <a href={href} className={className}>{content}</a>;
  return <article className="project-showcase" aria-labelledby="showcase-title">
    <header className="showcase-heading"><span className="status-badge">진행 중 · 개인 프로젝트</span><h2 id="showcase-title">{project.title}</h2><p>{project.subtitle}</p></header>
    <div className="showcase-preview">
      {go && <div className="showcase-switch" role="group" aria-label="프로젝트 미리보기">{previews.map((item, index) => <button key={item.label} type="button" aria-pressed={selected === index} aria-controls="showcase-screen" onClick={() => setSelected(index)}><Icon name={index === 0 ? 'room' : 'notes'} size={16}/>{item.label}</button>)}</div>}
      <figure id="showcase-screen"><div className="showcase-screen">{previews.map((item, index) => <img key={item.image} src={item.image} alt={item.alt} hidden={selected !== index} width="1440" height="900"/>)}</div><figcaption><p>{preview.description}</p>{link(preview.href, <>{preview.action}<Icon name="arrow" size={16}/></>)}</figcaption></figure>
    </div>
    <div className="showcase-summary"><p>{project.description}</p>{link(`/journal/projects/${project.slug}`, <>프로젝트 자세히 보기<Icon name="arrow" size={16}/></>, 'showcase-detail-link')}</div>
    <div className="showcase-details">
      <section aria-labelledby="showcase-updates"><h3 id="showcase-updates">최근 작업</h3><ol className="showcase-updates">{updates.map((update, index) => <li key={index}><time dateTime={update.date}>{formatDate(update.date)}</time><p>{update.text}</p></li>)}</ol></section>
      <section aria-labelledby="showcase-records"><h3 id="showcase-records">만드는 과정</h3><div className="showcase-records">{records.map(post => <div key={post.slug}>{link(`/journal/posts/${post.slug}`, <><span>{post.title}{post.draft && <small>초안</small>}</span><Icon name="arrow" size={16}/></>)}<p>{post.description}</p></div>)}</div></section>
    </div>
  </article>;
}
