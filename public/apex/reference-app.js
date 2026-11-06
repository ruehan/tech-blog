const records=window.blogRecords||[];
const $=s=>document.querySelector(s);
const reader=$('#reader'),search=$('#search-dialog');
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setTheme(dark){document.documentElement.dataset.theme=dark?'dark':'light';$('#theme').setAttribute('aria-label',dark?'라이트 모드로 변경':'다크 모드로 변경');$('#theme use').setAttribute('href',dark?'#icon-sun':'#icon-moon');try{localStorage.setItem('apex-theme',dark?'dark':'light');}catch{}}
setTheme(document.documentElement.dataset.theme==='dark');
$('#theme').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme!=='dark'));
function showSearch(){reader.close();$('#photo-dialog').close();$('#project-preview')?.close();search.showModal();$('#search-input').value='';renderSearch();$('#search-input').focus();}
function renderSearch(){const q=$('#search-input').value.trim().toLocaleLowerCase();const list=records.filter(a=>[a.title,a.description,a.category,...a.tags].join(' ').toLocaleLowerCase().includes(q));$('#search-summary').textContent=`전체 기록 · ${list.length}개의 결과`;$('#search-results').innerHTML=list.length?list.map(a=>`<a class="search-result" href="${a.url}"><small>${escapeHTML(a.category)}</small><b>${escapeHTML(a.title)}</b></a>`).join(''):'<p class="empty">일치하는 기록이 없습니다. 다른 제목이나 태그로 검색해 보세요.</p>';}
$('#search-input').addEventListener('input',renderSearch);$('#search-open').addEventListener('click',showSearch);
search.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();search.close();}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();showSearch();}});
document.querySelectorAll('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}));
function showCredits(){search.close();$('#reader-content').innerHTML='<h1 id="reader-title">사진 출처</h1><p>시안에는 아래 공식 사이트의 사진을 참고 이미지로 사용했습니다. 직접 촬영한 관람 사진이 아닙니다.</p><ul>'+records.filter(a=>a.image).map(a=>`<li><a href="${a.source}" target="_blank" rel="noopener noreferrer">${escapeHTML(a.credit)}</a></li>`).join('')+'</ul><p>사진의 권리는 각 원저작권자에게 있습니다.</p>';reader.showModal();reader.scrollTop=0;}
$('#credits-open').addEventListener('click',showCredits);$('#archive-credits')?.addEventListener('click',showCredits);
function updateQuery(changes){const u=new URL(location.href);for(const [k,v]of Object.entries(changes)){if(v&&v!=='all')u.searchParams.set(k,v);else u.searchParams.delete(k);}history.replaceState(null,'',u);}
const raceButtons=[...document.querySelectorAll('[data-filter]')];
const raceState={series:'all',viewing:'all',view:'stories'};
const matchesRace=c=>(raceState.series==='all'||c.dataset.series===raceState.series)&&(raceState.viewing==='all'||c.dataset.viewing===raceState.viewing);
function filterRaces(persist=true){
 if(!raceButtons.length)return;
 raceButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===raceState.series)));
 document.querySelectorAll('[data-race-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.raceView===raceState.view)));
 $('#viewing-filter').value=raceState.viewing;
 const cards=[...document.querySelectorAll('#race-grid [data-series]')],photos=[...document.querySelectorAll('#photo-wall [data-series]')];
 [...cards,...photos].forEach(c=>{c.hidden=!matchesRace(c);});
 const photosActive=raceState.view==='photos',storyCount=cards.filter(c=>!c.hidden).length;
 const count=(photosActive?photos:cards).filter(c=>!c.hidden).length;
 $('#race-grid').hidden=photosActive;$('#photo-wall').hidden=!photosActive;
 $('#race-count').textContent=photosActive?`${count}장의 사진`:`${count}개의 글`;
 $('#race-empty').hidden=count>0;
 $('#race-empty-text').textContent=photosActive?'이 조건에 등록된 사진이 없습니다.':'이 조건에 맞는 기록이 없습니다.';
 $('#show-race-stories').hidden=!photosActive||!storyCount;
 if(persist)updateQuery({series:raceState.series,viewing:raceState.viewing,view:photosActive?'photos':''});
}
if(raceButtons.length){
 const p=new URLSearchParams(location.search);
 raceState.series=raceButtons.some(b=>b.dataset.filter===p.get('series'))?p.get('series'):'all';
 raceState.viewing=['trackside','broadcast'].includes(p.get('viewing'))?p.get('viewing'):'all';
 raceState.view=p.get('view')==='photos'?'photos':'stories';
 raceButtons.forEach(b=>b.addEventListener('click',()=>{raceState.series=b.dataset.filter;filterRaces();}));
 $('#viewing-filter').addEventListener('change',e=>{raceState.viewing=e.target.value;filterRaces();});
 document.querySelectorAll('[data-race-view]').forEach(b=>b.addEventListener('click',()=>{raceState.view=b.dataset.raceView;filterRaces();}));
 $('#reset-race-filters').addEventListener('click',()=>{raceState.series='all';raceState.viewing='all';filterRaces();});
 $('#show-race-stories').addEventListener('click',()=>{raceState.view='stories';filterRaces();});
 filterRaces(false);
}
const photoDialog=$('#photo-dialog');let photoItems=[],photoIndex=0,zoomed=false;
function setZoom(value){zoomed=value;$('.lightbox-frame').classList.toggle('zoomed',value);$('#photo-zoom').textContent=value?'축소':'확대';$('#photo-zoom').setAttribute('aria-pressed',String(value));$('#photo-image-button').setAttribute('aria-label',value?'사진 축소':'사진 확대');$('.lightbox-frame').scrollTo(0,0);}
function renderPhoto(){
 const a=photoItems[photoIndex];setZoom(false);
 $('#photo-image').src='/'+a.image;$('#photo-image').alt=a.credit+' 참고 사진';$('#photo-title').textContent=a.title;
 $('#photo-caption').textContent=a.credit+' · 참고 이미지';$('#photo-source').href=a.source;$('#photo-story').href=a.url;
 $('#photo-position').textContent=`${photoIndex+1} / ${photoItems.length}`;
 $('#photo-prev').hidden=$('#photo-next').hidden=photoItems.length<2;
}
document.querySelectorAll('[data-photo]').forEach(b=>b.addEventListener('click',()=>{
 const a=records.find(a=>a.id===b.dataset.photo);if(!a?.image)return;
 const ids=b.dataset.gallery==='archive'?[...document.querySelectorAll('#photo-wall .photo-tile')].filter(matchesRace).map(c=>c.querySelector('[data-photo]').dataset.photo):[];
 photoItems=ids.includes(a.id)?ids.map(id=>records.find(r=>r.id===id)):[a];photoIndex=photoItems.findIndex(r=>r.id===a.id);
 renderPhoto();photoDialog.showModal();
}));
function stepPhoto(delta){photoIndex=(photoIndex+delta+photoItems.length)%photoItems.length;renderPhoto();}
$('#photo-prev').addEventListener('click',()=>stepPhoto(-1));$('#photo-next').addEventListener('click',()=>stepPhoto(1));
$('#photo-zoom').addEventListener('click',()=>setZoom(!zoomed));$('#photo-image-button').addEventListener('click',()=>setZoom(!zoomed));
photoDialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();stepPhoto(e.key==='ArrowLeft'?-1:1);}});
photoDialog.addEventListener('close',()=>setZoom(false));
const topicButtons=[...document.querySelectorAll('[data-topic]')];let topic='all';
function filterWriting(persist=true){const query=($('#archive-query')?.value||'').trim().toLocaleLowerCase();let count=0;document.querySelectorAll('#writing-archive .archive-entry').forEach(a=>{a.hidden=(topic!=='all'&&a.dataset.category!==topic)||!a.dataset.search.includes(query);if(!a.hidden)count++;});topicButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.topic===topic)));$('#writing-count').textContent=`${count}개의 글`;$('#archive-empty').hidden=count!==0;if(persist)updateQuery({topic,q:query});}
if(topicButtons.length){const params=new URLSearchParams(location.search);const candidate=params.get('topic');topic=topicButtons.some(b=>b.dataset.topic===candidate)?candidate:'all';$('#archive-query').value=params.get('q')||'';topicButtons.forEach(b=>b.addEventListener('click',()=>{topic=b.dataset.topic;filterWriting();}));$('#archive-query').addEventListener('input',()=>filterWriting());filterWriting(false);}
$('#copy-link')?.addEventListener('click',async()=>{try{const u=new URL(location.href);u.hash='';await navigator.clipboard.writeText(u.href);$('#copy-status').textContent='주소를 복사했습니다.';}catch{$('#copy-status').textContent='주소창의 주소를 복사해 주세요.';}});
window.addEventListener('pageshow',()=>{try{setTheme(localStorage.getItem('apex-theme')==='dark');}catch{}});

/* Reading controls and per-tab return paths. All links work without JavaScript. */
(()=>{
 const toc=document.querySelector('#article-toc');
 if(toc){
  document.documentElement.classList.add('reading-document');
  const mobile=matchMedia('(max-width:720px)'),links=[...toc.querySelectorAll('nav a')];
  const headings=links.map(a=>document.getElementById(a.hash.slice(1)));
  const current=document.querySelector('#toc-current');let scheduled=false;
  const syncSize=()=>{toc.open=!mobile.matches;};syncSize();mobile.addEventListener('change',syncSize);
  function update(){
   scheduled=false;
   const line=mobile.matches?Math.max(95,toc.querySelector('summary').getBoundingClientRect().bottom+24):100;
   let active=0;headings.forEach((h,i)=>{if(h.getBoundingClientRect().top<=line)active=i;});
   links.forEach((a,i)=>{if(i===active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
   current.textContent=links[active].textContent;
  }
  const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}};
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
  window.addEventListener('pageshow',schedule);
  links.forEach((a,i)=>a.addEventListener('click',e=>{
   if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
   e.preventDefault();if(mobile.matches)toc.open=false;
   history.replaceState(history.state,'',a.hash);
   headings[i].focus({preventScroll:true});headings[i].scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
   schedule();
  }));
  document.fonts.ready.then(schedule);update();
 }
 document.querySelectorAll('.code-copy').forEach(button=>{
  let reset;
  button.addEventListener('click',async()=>{
   const block=button.closest('.code-block'),status=block.querySelector('.code-status');
   clearTimeout(reset);status.textContent='';
   try{
    await navigator.clipboard.writeText(document.getElementById(button.dataset.code).textContent);
    button.textContent='복사됨';status.textContent='코드를 복사했습니다.';
    reset=setTimeout(()=>{button.textContent='복사';status.textContent='';},2500);
   }catch{status.textContent='복사하지 못했습니다. 코드를 직접 선택해 주세요.';}
  });
 });
 const read=key=>{try{return JSON.parse(sessionStorage.getItem('apex:'+key));}catch{return null;}};
 const save=(key,value)=>{try{sessionStorage.setItem('apex:'+key,JSON.stringify(value));}catch{}};
 const remove=key=>{try{sessionStorage.removeItem('apex:'+key);}catch{}};
 const lists=['/writing/','/races/','/projects/'],isList=lists.includes(location.pathname);
 const valid=context=>{
  if(!context||Date.now()-context.time>2*60*60*1000||!Number.isFinite(context.y))return false;
  try{const u=new URL(context.url,location.origin);return u.origin===location.origin&&lists.includes(u.pathname);}catch{return false;}
 };
 const snapshot=focus=>({url:location.pathname+location.search,y:scrollY,focus:focus||null,time:Date.now()});
 const context=read('return:'+location.pathname);
 const defaultList=document.querySelector('.list-return')?.getAttribute('href');
 const returnContext=valid(context)&&new URL(context.url,location.origin).pathname===defaultList?context:null;
 if(returnContext)document.querySelectorAll('.list-return').forEach(a=>{a.href=returnContext.url;});
 document.addEventListener('click',e=>{
  const a=e.target.closest('a[href]');if(!a||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank'||a.hasAttribute('download'))return;
  const u=new URL(a.href,location.href);if(u.origin!==location.origin)return;
  if(a.classList.contains('list-return')&&returnContext){save('pending-return',returnContext);return;}
  if(!/^\/(writing|races|projects)\/[^/]+\/$/.test(u.pathname))return;
  if(isList){
   const saved=snapshot(u.pathname);save('return:'+u.pathname,saved);save('list:'+saved.url,saved);
  }else if(returnContext&&u.pathname.startsWith(defaultList)){save('return:'+u.pathname,returnContext);}
 });
 if(isList){
  window.addEventListener('pagehide',()=>{
   const key='list:'+location.pathname+location.search,previous=read(key);
   save(key,snapshot(previous?.focus));
  });
  window.addEventListener('pageshow',async e=>{
   const key=location.pathname+location.search,pending=read('pending-return');
   const back=e.persisted||performance.getEntriesByType('navigation')[0]?.type==='back_forward';
   const restore=valid(pending)&&pending.url===key?pending:back?read('list:'+key):null;
   if(pending)remove('pending-return');
   if(!valid(restore)||location.hash)return;
   await document.fonts.ready;
   requestAnimationFrame(()=>{
    if(restore.focus){const a=[...document.querySelectorAll('main a[href]')].find(a=>new URL(a.href).pathname===restore.focus&&a.getClientRects().length);a?.focus({preventScroll:true});}
    window.scrollTo({top:restore.y,behavior:'instant'});
   });
  });
 }
})();

// Project real XYZ vertices back into the tilted SVG road plane. Height is
// compensated for the parent's camera transform, so roofs stay above wheels
// as either the car heading or the user's viewpoint changes.
function createCarRenderer(car){
 const root=car.querySelector('.car-mesh'),shadow=car.querySelector('.car-shadow');
 const faces=[...root.children].map(el=>{
  const v=JSON.parse(el.dataset.v),a=v[1].map((x,i)=>x-v[0][i]),b=v[2].map((x,i)=>x-v[0][i]);
  const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=Math.hypot(...n)||1;
  return{el,v,n:n.map(x=>x/len),rgb:el.dataset.color.match(/\w\w/g).map(x=>parseInt(x,16))};
 });
 let order='';
 return(angle,camera)=>{
  const h=angle*Math.PI/180,c=Math.cos(h),s=Math.sin(h),rx=camera.x*Math.PI/180,rz=camera.z*Math.PI/180;
  const cz=Math.cos(rz),sz=Math.sin(rz),sx=Math.sin(rx),cx=Math.cos(rx),lift=Math.tan(rx);
  shadow.setAttribute('transform',`rotate(${angle})`);
  for(const f of faces){
   const v=f.v.map(([x,y,z])=>[x*c-y*s,x*s+y*c,z]);
   f.depth=v.reduce((sum,[x,y,z])=>sum+(x*sz+y*cz)*sx+z*cx,0)/v.length;
   f.el.setAttribute('points',v.map(([x,y,z])=>`${(x-z*sz*lift).toFixed(2)},${(y-z*cz*lift).toFixed(2)}`).join(' '));
   const nx=f.n[0]*c-f.n[1]*s,ny=f.n[0]*s+f.n[1]*c,nz=f.n[2];
   const light=.55+.48*Math.max(0,-nx*.35-ny*.45+nz*.82);
   const rgb=f.rgb.map(x=>Math.min(255,Math.round(x*light)));
   f.el.setAttribute('fill',`rgb(${rgb.join(',')})`);
  }
  const sorted=faces.map((f,i)=>({f,i})).sort((a,b)=>a.f.depth-b.f.depth),key=sorted.map(x=>x.i).join(',');
  if(key!==order){root.append(...sorted.map(x=>x.f.el));order=key;}
 };
}

// One shared race clock, in seconds. Identical cruise speeds preserve order
// across the lap seam; short reaction delays can only increase the grid gap.
function raceStartState(elapsed,index=0){
 const lightsOut=4.5,delay=index*.18,t=Math.max(0,elapsed-lightsOut-delay);
 const speed=170*(1-Math.exp(-t/1.2));
 return {
  lights:elapsed<.6||elapsed>=lightsOut?0:Math.min(5,1+Math.floor((elapsed-.6)/.75)),
  phase:elapsed<lightsOut?'grid':elapsed<lightsOut+.9?'launch':'racing',
  distance:-50-index*140+170*(t-1.2*(1-Math.exp(-t/1.2))),
  speed,
 };
}

// Fit the whole miniature to its own layout row, including height and rotation.
// The road's safety envelope includes curbs, car roofs, trails and soft shadows.
function createSceneFitter(scene,world,path){
 const points=[],length=path.getTotalLength();
 const land=world.querySelector('#circuit-land');
 if(land)for(let d=0;d<land.getTotalLength();d+=20){
  const p=land.getPointAtLength(d);
  for(const y of [0,25])points.push([p.x,p.y+y,0]);
 }
 for(let d=0;d<length;d+=24){
  const p=path.getPointAtLength(d);
  for(const x of [-55,55])for(const y of [-55,55])for(const z of [0,32])points.push([p.x+x,p.y+y,z]);
 }
 for(const group of world.querySelectorAll('.circuit-prop,.start-gantry')){
  const position=group.getAttribute('transform').match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/),angle=(group.classList.contains('start-gantry')?180:Number(group.dataset.angle))*Math.PI/180;
  const c=Math.cos(angle),s=Math.sin(angle),ox=Number(position[1]),oy=Number(position[2]);
  for(const polygon of group.querySelectorAll('[data-v]'))for(const [x,y,z] of JSON.parse(polygon.dataset.v))points.push([ox+x*c-y*s,oy+x*s+y*c,z]);
 }
 let lastKey='';
 return camera=>{
  const w=scene.clientWidth,h=scene.clientHeight,key=[w,h,camera.x.toFixed(2),camera.z.toFixed(2)].join(':');
  if(key===lastKey||!w||!h)return;lastKey=key;
  const rx=camera.x*Math.PI/180,rz=camera.z*Math.PI/180,cx=Math.cos(rx),sx=Math.sin(rx),cz=Math.cos(rz),sz=Math.sin(rz);
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const [px,py,z] of points){
   const x=px-600,y=py-350,u=x*cz-y*sz,v=(x*sz+y*cz)*cx-z*sx;
   left=Math.min(left,u);right=Math.max(right,u);top=Math.min(top,v);bottom=Math.max(bottom,v);
  }
  const padding=w<600?10:18,scale=Math.max(.05,Math.min((w-padding*2)/(right-left),(h-padding*2)/(bottom-top),1));
  world.style.width=(1200*scale)+'px';
  world.style.left=`calc(50% - ${(left+right)/2*scale}px)`;
  world.style.top=`calc(50% - ${(top+bottom)/2*scale}px)`;
 };
}

(()=>{
 const portal=document.querySelector('#portal');if(!portal)return;
 const scene=document.querySelector('#portal-scene'),world=document.querySelector('#portal-world'),path=document.querySelector('#circuit-path');
 const lights=document.querySelector('#start-lights'),lamps=[...lights.querySelectorAll('.start-lamp')];
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const length=path.getTotalLength(),cars=[...document.querySelectorAll('.circuit-car')],trails=[...document.querySelectorAll('.circuit-trail')];
 const renderCars=cars.map(createCarRenderer);
 const renderGantry=createCarRenderer(lights);
 const fitScene=createSceneFitter(scene,world,path);
 const scenery=[...document.querySelectorAll('.circuit-prop')].map(el=>({angle:Number(el.dataset.angle),render:createCarRenderer(el)}));
 let sceneryCamera='';
 let paused=reduced.matches,frame=0,last=0,elapsed=0,signalKey='' ;
 const camera={x:42,z:-14};
 function drawCars(){
  cars.forEach((car,i)=>{
   const state=raceStartState(elapsed,i),d=((state.distance%length)+length)%length,p=path.getPointAtLength(d),q=path.getPointAtLength((d+2)%length);
   const angle=Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI;
   car.setAttribute('transform',`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
   renderCars[i](angle,camera);
   const tail=state.speed*.2;trails[i].style.strokeDasharray=`${tail} ${length-tail}`;trails[i].style.strokeDashoffset=String(-(d-tail));
  });
 }
 function drawCamera(){
  fitScene(camera);
  world.style.setProperty('--camera-x',camera.x+'deg');world.style.setProperty('--camera-z',camera.z+'deg');
  renderGantry(180,camera);
  const viewKey=camera.x.toFixed(2)+':'+camera.z.toFixed(2);
  if(viewKey!==sceneryCamera){scenery.forEach(prop=>prop.render(prop.angle,camera));sceneryCamera=viewKey;}
  const rx=camera.x*Math.PI/180,rz=camera.z*Math.PI/180,lift=Math.tan(rx);
  lamps.forEach(lamp=>{
   const x=12-60*Math.sin(rz)*lift,y=-Number(lamp.dataset.lampY)-60*Math.cos(rz)*lift;
   // A small glass lens on the front of the housing, elevated with the beam.
   lamp.setAttribute('transform',`translate(${x} ${y}) rotate(${-camera.z}) scale(.62 ${1/Math.cos(rx)})`);
  });
 }
 function tick(now){
  frame=0;if(paused||document.hidden||document.querySelector('dialog[open]'))return;
  const dt=last?Math.min((now-last)/1000,.04):.016;last=now;
  elapsed+=dt;drawSignal();
  drawCars();frame=requestAnimationFrame(tick);
 }
 function run(){if(!frame&&!paused&&!document.hidden&&!document.querySelector('dialog[open]')){last=0;frame=requestAnimationFrame(tick);}}
 function drawSignal(){
  const state=raceStartState(elapsed),key=state.phase+state.lights;
  if(key===signalKey)return;signalKey=key;portal.dataset.raceState=state.phase;
  lamps.forEach((lamp,i)=>lamp.classList.toggle('is-lit',i<state.lights));
  lights.setAttribute('aria-label',state.phase==='grid'?`출발 신호 ${state.lights}/5`:'출발');
 }
 function drawGrid(){
  cars.forEach((_,i)=>{const d=(length+raceStartState(0,i).distance)%length,p=path.getPointAtLength(d),q=path.getPointAtLength((d+2)%length);
   document.querySelector(`#grid-slot-${i}`).setAttribute('transform',`translate(${p.x} ${p.y}) rotate(${Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI})`);
  });
 }
 const bottom=portal.querySelector('.portal-bottom');
 let hoveredDoor=null;
 function syncPreview(){
  const active=portal.querySelector('.portal-door:focus')||hoveredDoor;
  bottom.dataset.preview=active?.dataset.destination||'writing';
  if(active)portal.dataset.tone=active.dataset.tone;else delete portal.dataset.tone;
 }
 portal.querySelectorAll('.portal-door').forEach(a=>{
  a.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'){hoveredDoor=a;syncPreview();}});
  a.addEventListener('pointerleave',()=>{if(hoveredDoor===a)hoveredDoor=null;syncPreview();});
  a.addEventListener('focus',syncPreview);
  a.addEventListener('blur',()=>queueMicrotask(syncPreview));
 });
 function syncReduced(){document.body.classList.toggle('portal-reduced',reduced.matches);paused=reduced.matches;if(paused){cancelAnimationFrame(frame);frame=0;}else run();}
 reduced.addEventListener('change',syncReduced);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else run();});

 window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});
 window.addEventListener('pageshow',run);
 // Modal dialogs should remain still and usable while the background is inactive.
 const modalObserver=new MutationObserver(()=>{if(document.querySelector('dialog[open]')){cancelAnimationFrame(frame);frame=0;}else run();});
 document.querySelectorAll('dialog').forEach(d=>modalObserver.observe(d,{attributes:true,attributeFilter:['open']}));
 const sceneResize=new ResizeObserver(()=>fitScene(camera));sceneResize.observe(scene);
 drawGrid();drawSignal();drawCars();drawCamera();syncReduced();run();
})();
