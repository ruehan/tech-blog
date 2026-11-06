// Hold the loading screen for one second, then reveal the next document gently.
(()=>{
 const loader=document.querySelector('#page-loader');if(!loader)return;
 const label=loader.querySelector('[data-loading-label]');
 const sections={writing:'개발',projects:'프로젝트',races:'레이스 기록',about:'소개'};
 const root=document.documentElement;
 let recovery=0,navigationTimer=0,navigationFrame=0,locked=[],departing=false;
 function reset(){
  clearTimeout(recovery);clearTimeout(navigationTimer);cancelAnimationFrame(navigationFrame);
  departing=false;
  root.classList.remove('page-entering');
  loader.classList.remove('is-loading');loader.setAttribute('aria-hidden','true');
  locked.forEach(el=>el.inert=false);locked=[];
  document.querySelector('main')?.removeAttribute('aria-busy');
 }
 if(root.classList.contains('page-entering')){
  loader.setAttribute('aria-hidden','false');
  const aboveFold=[...document.querySelectorAll('main img')].filter(img=>{
   const r=img.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;
  });
  const ready=Promise.allSettled([
   document.fonts?.ready||Promise.resolve(),
   ...aboveFold.map(img=>img.decode().catch(()=>{})),
  ]);
  let entryTimer;
  Promise.race([ready,new Promise(resolve=>entryTimer=setTimeout(resolve,1400))]).then(()=>{
   clearTimeout(entryTimer);clearTimeout(window.apexEntryFallback);
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
    root.classList.remove('page-entering');
    if(!departing)loader.setAttribute('aria-hidden','true');
   }));
  });
 }
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest?.('a[href]');
  if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self')||link.relList.contains('external'))return;
  const next=new URL(link.href,location.href);
  if(next.origin!==location.origin||!/^https?:$/.test(next.protocol))return;
  if(next.pathname===location.pathname&&next.search===location.search)return;
  event.preventDefault();
  if(departing)return;
  departing=true;
  const parts=next.pathname.split('/').filter(Boolean);
  label.textContent=parts.length>1?'기록을 불러오는 중':`${sections[parts[0]]||'홈'} 페이지로 이동 중`;
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  loader.setAttribute('aria-hidden','false');loader.classList.add('is-loading');
  document.querySelector('main')?.setAttribute('aria-busy','true');
  locked=[...document.querySelectorAll('body > header,body > main,body > footer')].filter(el=>!el.inert);
  locked.forEach(el=>el.inert=true);
  navigationFrame=requestAnimationFrame(()=>{
   navigationTimer=setTimeout(()=>{
    location.assign(next.href);
    // Recover if a request is stopped or never commits.
    recovery=setTimeout(reset,12000);
   },1000);
  });
 });
 window.addEventListener('pagehide',reset);
 window.addEventListener('pageshow',event=>{if(event.persisted)reset();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')reset();});
})();
