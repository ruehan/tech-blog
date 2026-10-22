import now from '../content/now.json';
import { Icon } from './Icons';
import { RouteLink, type Navigate } from './navigation';
import './now-note.css';

export function NowNote({ go }: { go?: Navigate }) {
  return <section className="now-note" aria-labelledby="now-note-heading">
    <h2 id="now-note-heading">요즘 하고 있는 것</h2>
    <ul>{now.items.map(item => {
      const content = <><span className="now-note-label">{item.label}</span><span className="now-note-title">{item.title}<Icon name="arrow" size={14}/></span><span className="now-note-description">{item.description}</span></>;
      return <li key={item.href}>{go ? <RouteLink to={item.href} go={go}>{content}</RouteLink> : <a href={item.href}>{content}</a>}</li>;
    })}</ul>
    <p className="now-note-updated"><time dateTime={now.updated}>{now.updated.replaceAll('-', '.')}</time> 수정</p>
  </section>;
}
