import { useState } from 'react';
import { formatDate, posts, type Project } from './content';
import { Icon } from './Icons';
import { RouteLink, type Navigate } from './navigation';
import './project-showcase.css';

export function ProjectShowcase({ project, go }: { project: Project; go?: Navigate }) {
  const [selected, setSelected] = useState(0);
  const { previews, updates } = project;
  const preview = previews[selected];
  const screenId = `showcase-screen-${project.slug}`;
  const titleId = `showcase-title-${project.slug}`;
  const records = project.series ? posts.filter(post => post.series?.slug === project.series) : [];
  const link = (href: string, content: React.ReactNode, className?: string) => go ? <RouteLink to={href} go={go} className={className}>{content}</RouteLink> : <a href={href} className={className}>{content}</a>;
  return <article className="project-showcase" aria-labelledby={titleId}>
    <header className="showcase-heading"><span className="status-badge">{project.status}</span><h2 id={titleId}>{project.title}</h2><p>{project.subtitle}</p></header>
    {preview && <div className="showcase-preview">
      {go && previews.length > 1 && <div className="showcase-switch" role="group" aria-label="프로젝트 미리보기">{previews.map((item, index) => <button key={item.label} type="button" aria-pressed={selected === index} aria-controls={screenId} onClick={() => setSelected(index)}><Icon name={index === 0 ? 'room' : 'notes'} size={16}/>{item.label}</button>)}</div>}
      <figure id={screenId}><div className="showcase-screen">{previews.map((item, index) => <img key={item.image} src={item.image} alt={item.alt} hidden={selected !== index} width="1440" height="900"/>)}</div><figcaption><p>{preview.description}</p>{link(preview.href, <>{preview.action}<Icon name="arrow" size={16}/></>)}</figcaption></figure>
    </div>}
    <div className="showcase-summary"><p>{project.description}</p>{link(`/journal/projects/${project.slug}`, <>프로젝트 자세히 보기<Icon name="arrow" size={16}/></>, 'showcase-detail-link')}</div>
    <div className="showcase-details">
      {!!updates.length && <section aria-labelledby={`showcase-updates-${project.slug}`}><h3 id={`showcase-updates-${project.slug}`}>최근 작업</h3><ol className="showcase-updates">{updates.map((update, index) => <li key={index}><time dateTime={update.date}>{formatDate(update.date)}</time><p>{update.text}</p></li>)}</ol></section>}
      {!!records.length && <section aria-labelledby={`showcase-records-${project.slug}`}><h3 id={`showcase-records-${project.slug}`}>만드는 과정</h3><div className="showcase-records">{records.map(post => <div key={post.slug}>{link(`/journal/posts/${post.slug}`, <><span>{post.title}{post.draft && <small>초안</small>}</span><Icon name="arrow" size={16}/></>)}<p>{post.description}</p></div>)}</div></section>}
    </div>
  </article>;
}
