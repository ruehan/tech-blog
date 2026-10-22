import { useState } from 'react';
import { ResearchCaseDialog, type ResearchCaseSelection } from './ResearchCaseDialog';
import { profile } from './profile';
import { posts } from './content';
import { Icon } from './Icons';
import { RouteLink, type Navigate } from './navigation';
import './about.css';

export function About({ go }: { go: Navigate }) {
  const [selectedCase, setSelectedCase] = useState<ResearchCaseSelection | null>(null);
  return <article className="about-page" aria-labelledby="about-heading">
    <header className="about-intro">
      <div>
        <p className="about-label">소개</p>
        <h1 id="about-heading" tabIndex={-1}>안녕하세요,<br/>{profile.name}입니다.</h1>
        <div className="about-role"><span>{profile.role}</span></div>
        {profile.introduction.map(paragraph => <p className="about-description" key={paragraph}>{paragraph}</p>)}
        <nav className="about-contact" aria-label="연락처">
          <a href={`mailto:${profile.email}`}><Icon name="mail" size={17}/>{profile.email}</a>
          <a href={profile.github}><Icon name="link" size={17}/>GitHub <span className="sr-only">ruehan</span></a>
          <a href={profile.portfolio}><Icon name="folder" size={17}/>포트폴리오</a>
        </nav>
      </div>
      <figure className="about-room"><img src="/images/site/room.png" alt="직접 만든 책장과 책상, 베이스, 심레이싱 장비가 있는 3D 방" width="1440" height="900"/><figcaption>Blender에서 직접 만들고 웹으로 옮긴 방.<RouteLink to="/" go={go}>방 둘러보기 <Icon name="arrow" size={15}/></RouteLink></figcaption></figure>
    </header>

    <section className="about-section" aria-labelledby="experience-heading">
      <h2 id="experience-heading">직무와 경력</h2>
      <div className="about-experience">{profile.experience.map((entry, index) => <div className="about-experience-row" key={index}>
        <p className="about-period">{entry.period}</p>
        <div><h3>{entry.organization}</h3><p className="about-job">{entry.role}</p><p>{entry.details}</p>
          <div className="about-work">{entry.work.map(group => <section className="about-work-group" key={group.title}>
            <h4>{group.title}</h4><ul>{group.items.map(item => <li key={item}>{item}</li>)}</ul>
            {group.reference && <a className="about-reference" href={group.reference.href} aria-haspopup="dialog" onClick={event => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              setSelectedCase({ ...group.reference!, trigger: event.currentTarget });
            }}>{group.reference.label}<Icon name="arrow" size={15}/></a>}
          </section>)}</div>
        </div>
      </div>)}</div>
    </section>

    <section className="about-section" aria-labelledby="making-heading">
      <h2 id="making-heading">프로젝트</h2>
      <div className="about-projects">{profile.projects.map(project => {
        const post = posts.find(item => item.slug === project.postSlug);
        return <section className="about-project" key={project.name}>
          <p className="about-project-context">{project.context}</p><h3>{project.name}</h3><p>{project.description}</p>
          <ul className="about-tools" aria-label={`${project.name}에 사용한 도구`}>{project.tools.map(tool => <li key={tool}>{tool}</li>)}</ul>
          {project.reference && <a className="about-post-link" href={project.reference.href}>{project.reference.label}<Icon name="arrow" size={16}/></a>}
          {post && <RouteLink className="about-post-link" to={`/journal/posts/${post.slug}`} go={go}>{project.name} 제작기 읽기 <Icon name="arrow" size={16}/></RouteLink>}
        </section>;
      })}</div>
    </section>

    <section className="about-section" aria-labelledby="skills-heading">
      <h2 id="skills-heading">주요 기술</h2>
      <dl className="about-skills">{profile.skills.map(group => <div key={group.name}><dt>{group.name}</dt><dd>{group.tools.join(' · ')}</dd></div>)}</dl>
    </section>

    <section className="about-section" aria-labelledby="interests-heading">
      <h2 id="interests-heading">관심사</h2>
      <div className="about-interests">{profile.interests.map(interest => <section key={interest.name}><h3>{interest.name}</h3><p>{interest.description}</p></section>)}</div>
    </section>
    {selectedCase && <ResearchCaseDialog selected={selectedCase} onClose={() => setSelectedCase(null)}/>}
    <footer className="about-footer"><RouteLink to="/journal" go={go}>글 기록 보기 <Icon name="arrow" size={17}/></RouteLink></footer>
  </article>;
}
