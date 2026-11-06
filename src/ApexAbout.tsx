import { useState } from 'react';
import { profile } from './profile';
import { RouteLink, type Navigate } from './navigation';
import { ResearchCaseDialog, type ResearchCaseSelection } from './ResearchCaseDialog';

export function ApexAbout({ go }: { go: Navigate }) {
  const [selectedCase, setSelectedCase] = useState<ResearchCaseSelection | null>(null);
  return <div className="wrap about-page">
    <header className="page-heading"><h1 tabIndex={-1}>소개</h1></header>
    <div className="profile-layout">
      <div className="profile-intro"><h2>코드를 쓰는 시간,<br/>레이스를 보는 시간.</h2><p>{profile.role},<br/>{profile.name}입니다.</p><div className="profile-series"><a href="/races/?series=F1">F1</a><a href="/races/?series=WEC">WEC</a><a href="/races/?series=TCR">TCR</a><a href="/races/?series=N1">현대 N1</a></div><p className="profile-contact"><a className="text-link" href={profile.github}>GitHub</a> · <a className="text-link" href={`mailto:${profile.email}`}>이메일</a> · <a className="text-link" href={profile.portfolio}>포트폴리오</a></p></div>
      <div className="profile-story">
        <section><h2>여기에 남기는 것</h2><p>{profile.introduction[2]}</p><p>기술 이야기는 읽기 편하게, 레이스 이야기는 사진과 함께 남기려 합니다.</p></section>
        <section><h2>개발 이야기</h2><p>{profile.introduction[0]}</p><p>{profile.introduction[1]}</p><RouteLink className="text-link" to="/writing" go={go}>개발 기록 읽기</RouteLink></section>
        <section><h2>레이스를 보는 즐거움</h2><p>F1과 WEC, TCR과 현대 N1을 봅니다. 전략을 따라가는 재미도 있고, 같은 장면을 다시 보고 싶어지는 순간도 있습니다. 관람 후의 생각들을 따로 기록합니다.</p><a className="text-link" href="/races/">레이스 기록 보기</a></section>
      </div>
    </div>
    <div className="about-photo"><img src="/apex/assets/n-festival.jpg" alt="현대 N 페스티벌 레이스카" loading="lazy"/><p>Hyundai N 제공 참고 이미지</p></div>
    <section className="site-about"><h2>이 공간에 대해</h2><p>hangyu / apex는 개발 기록과 모터스포츠 취미를 함께 담는 개인 블로그입니다. 직접 만든 웹·데스크톱 앱과 연구 경험, 만드는 중에 막혔던 지점과 다시 고친 과정을 정리합니다.</p><RouteLink className="text-link" to="/projects" go={go}>만들고 있는 프로젝트</RouteLink></section>
    <section className="site-about profile-story"><h2>직무와 경력</h2>{profile.experience.map(entry => <section className="profile-experience" key={entry.organization}><h3>{entry.organization}</h3><p>{entry.period} · {entry.role}</p><p>{entry.details}</p>{entry.work.map(work => <div key={work.title}><h4>{work.title}</h4><ul>{work.items.map(item => <li key={item}>{item}</li>)}</ul>{work.reference && <a className="text-link" href={work.reference.href} aria-haspopup="dialog" onClick={event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); setSelectedCase({ ...work.reference!, trigger: event.currentTarget });
    }}>{work.reference.label}</a>}</div>)}</section>)}</section>
    <section className="site-about profile-story"><h2>주요 기술</h2>{profile.skills.map(group => <section key={group.name}><h3>{group.name}</h3><p>{group.tools.join(' · ')}</p></section>)}</section>
    <section className="site-about profile-story"><h2>좋아하는 것</h2>{profile.interests.map(interest => <section key={interest.name}><h3>{interest.name}</h3><p>{interest.description}</p></section>)}</section>
    {selectedCase && <ResearchCaseDialog selected={selectedCase} onClose={() => setSelectedCase(null)}/>}
  </div>;
}
