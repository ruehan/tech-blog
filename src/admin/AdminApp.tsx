import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { albumBase, api, ApiError, clearGalleryCache, type AlbumCategory, type GalleryAlbum, type GalleryPhoto, type PhotoCategory } from '../gallery/api';
import { originalTypes, processImage, type Variant } from './image-process';

type Tab = PhotoCategory;
const tabs: [Tab, string][] = [['general', '일반'], ['race', '레이스'], ['space', '우주']];

function useQueryState() {
  const read = () => new URLSearchParams(location.search);
  const [params, setParams] = useState(read);
  useEffect(() => { const sync = () => setParams(read()); addEventListener('popstate', sync); return () => removeEventListener('popstate', sync); }, []);
  const update = useCallback((next: Record<string, string | null>) => {
    const query = read();
    for (const [key, value] of Object.entries(next)) if (value) query.set(key, value); else query.delete(key);
    history.pushState(null, '', `/admin${query.size ? `?${query}` : ''}`);
    setParams(query);
  }, []);
  return [params, update] as const;
}

export function AdminApp() {
  const [me, setMe] = useState<{ login: string; dev?: boolean } | null | undefined>();
  const [configured, setConfigured] = useState(true);
  useEffect(() => {
    document.title = '사진 관리 — hangyu / apex';
    api<{ login: string; dev?: boolean }>('auth/me').then(setMe).catch(async error => {
      setMe(null);
      if (error instanceof ApiError && error.status === 401) {
        const body = await fetch('/api/auth/me').then(response => response.json()).catch(() => ({}));
        setConfigured(body.configured !== false);
      }
    });
  }, []);
  if (me === undefined) return <main className="admin admin-center"><p role="status">확인 중…</p></main>;
  if (!me) return <main className="admin admin-center"><h1>사진 관리</h1>
    {configured ? <a className="admin-button primary" href="/api/auth/login?next=/admin">GitHub로 로그인</a>
      : <p>관리자 로그인이 아직 설정되지 않았습니다. GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, ADMIN_GITHUB_LOGINS, SESSION_SECRET 환경 변수를 확인해 주세요.</p>}
    <a href="/">사이트로 돌아가기</a></main>;
  return <Dashboard login={me.login} dev={!!me.dev}/>;
}

function Dashboard({ login, dev }: { login: string; dev: boolean }) {
  const [params, update] = useQueryState();
  const tab = (tabs.find(([value]) => value === params.get('tab'))?.[0] ?? 'general') as Tab;
  return <div className="admin">
    <header className="admin-header"><a className="admin-brand" href="/photos">hangyu<span>/</span>apex <small>사진 관리</small></a>
      <nav aria-label="사진첩">{tabs.map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => update({ tab: value, album: null })}>{label}</button>)}</nav>
      <div className="admin-user">{dev ? <span title="로컬 개발 서버에서는 로그인 없이 관리자 권한을 사용합니다.">로컬 개발 모드</span> : <span>@{login}</span>}
        {!dev && <button type="button" onClick={async () => { await api('auth/logout', { method: 'POST' }); location.reload(); }}>로그아웃</button>}</div>
    </header>
    {tab === 'space' ? <main className="admin-main"><section className="admin-panel"><h2>우주 사진</h2><p className="admin-hint">앨범 없이 /photos/space 에 펼쳐집니다.</p><PhotoManager category="space" albumId={null}/></section></main>
      : <AlbumsTab key={tab} category={tab} selected={params.get('album')} select={album => update({ album })}/>}
  </div>;
}

// ---------- albums ----------
function AlbumsTab({ category, selected, select }: { category: AlbumCategory; selected: string | null; select: (id: string | null) => void }) {
  const [albums, setAlbums] = useState<GalleryAlbum[]>();
  const [error, setError] = useState('');
  const load = useCallback(() => api<{ albums: GalleryAlbum[] }>(`admin/albums?category=${category}`).then(data => setAlbums(data.albums)).catch(error => setError(error.message)), [category]);
  useEffect(() => { load(); }, [load]);
  async function move(index: number, delta: number) {
    if (!albums) return;
    const next = [...albums];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setAlbums(next);
    await api('admin/albums/reorder', { method: 'POST', json: { ids: next.map(album => album.id) } }).catch(error => setError(error.message));
    clearGalleryCache();
  }
  return <main className="admin-main admin-split">
    <aside className="admin-panel admin-list">
      <div className="admin-list-head"><h2>{category === 'race' ? '레이스 앨범' : '앨범'}</h2><button type="button" className="admin-button primary" onClick={() => select('new')}>새 앨범</button></div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {!albums ? <p role="status">불러오는 중…</p> : !albums.length ? <p className="admin-hint">아직 없습니다.</p> : <ol>{albums.map((album, index) => <li key={album.id} className={selected === album.id ? 'is-selected' : ''}>
        <button type="button" className="admin-list-item" onClick={() => select(album.id)}>
          {album.cover ? <img src={album.cover.src.thumb} alt=""/> : <span className="admin-thumb-empty"/>}
          <span><b>{album.title}</b><small>{[`${album.photoCount}장`, album.visibility === 'draft' && '비공개'].filter(Boolean).join(' · ')}</small></span>
        </button>
        <span className="admin-order"><button type="button" aria-label="위로" disabled={!index} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label="아래로" disabled={index === albums.length - 1} onClick={() => move(index, 1)}>↓</button></span>
      </li>)}</ol>}
    </aside>
    <section className="admin-panel admin-detail">
      {selected === 'new' ? <AlbumForm key="new" category={category} onSaved={album => { load(); select(album.id); }}/>
        : selected ? <AlbumEditor key={selected} id={selected} onChanged={load} onDeleted={() => { load(); select(null); }}/>
          : <p className="admin-hint">왼쪽에서 앨범을 선택하거나 새로 만드세요.</p>}
    </section>
  </main>;
}

function AlbumEditor({ id, onChanged, onDeleted }: { id: string; onChanged: () => void; onDeleted: () => void }) {
  const [data, setData] = useState<{ album: GalleryAlbum; photos: GalleryPhoto[] }>();
  const [error, setError] = useState('');
  const load = useCallback(() => api<{ album: GalleryAlbum; photos: GalleryPhoto[] }>(`admin/albums/${id}`).then(setData).catch(error => setError(error.message)), [id]);
  useEffect(() => { load(); }, [load]);
  if (error) return <p className="admin-error" role="alert">{error}</p>;
  if (!data) return <p role="status">불러오는 중…</p>;
  const { album } = data;
  async function remove() {
    if (!confirm(`“${album.title}”과(와) 사진 ${album.photoCount}장을 모두 삭제할까요? 저장소의 원본도 삭제되며 되돌릴 수 없습니다.`)) return;
    try { await api(`admin/albums/${album.id}`, { method: 'DELETE' }); clearGalleryCache(); onDeleted(); }
    catch (error) { setError((error as Error).message); }
  }
  const publicPath = `${albumBase[album.category]}/${album.slug}`;
  return <>
    <AlbumForm category={album.category} album={album} onSaved={() => { load(); onChanged(); }}
      extra={<>{album.visibility === 'public' && <a href={publicPath} target="_blank" rel="noreferrer">공개 페이지 ↗</a>}<button type="button" className="admin-button danger" onClick={remove}>삭제</button></>}/>
    <h3 className="admin-subhead">사진 {data.photos.length}장</h3>
    <PhotoManager category={album.category} albumId={album.id} coverPhotoId={album.coverPhotoId ?? null} onChange={() => { load(); onChanged(); }}
      onCover={async photoId => { await api(`admin/albums/${album.id}`, { method: 'PATCH', json: { coverPhotoId: photoId } }); clearGalleryCache(); load(); onChanged(); }}/>
  </>;
}

const splitTags = (value: string) => value.split(',').map(tag => tag.trim()).filter(Boolean);

function AlbumForm({ category, album, onSaved, extra }: { category: AlbumCategory; album?: GalleryAlbum; onSaved: (album: GalleryAlbum) => void; extra?: React.ReactNode }) {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '');
    const body: Record<string, unknown> = {
      category, slug: value('slug'), title: value('title'), description: value('description'),
      tags: splitTags(value('tags')), dateStart: value('dateStart') || null, dateEnd: value('dateEnd') || null,
      visibility: form.get('public') === 'on' ? 'public' : 'draft',
    };
    setError(''); setStatus('저장 중…');
    try {
      const saved = album ? await api<{ album: GalleryAlbum }>(`admin/albums/${album.id}`, { method: 'PATCH', json: body }) : await api<{ album: GalleryAlbum }>('admin/albums', { method: 'POST', json: body });
      clearGalleryCache(); setStatus('저장했습니다.'); onSaved(saved.album);
    } catch (error) { setStatus(''); setError((error as Error).message); }
  }
  return <form className="admin-form" onSubmit={submit}>
    <div className="admin-form-head"><h2>{album ? album.title : category === 'race' ? '새 레이스 앨범' : '새 앨범'}</h2><div className="admin-actions">{extra}<button className="admin-button primary">저장</button></div></div>
    {error && <p className="admin-error" role="alert">{error}</p>}{status && <p className="admin-status" role="status">{status}</p>}
    <div className="admin-grid">
      <label>제목<input name="title" required maxLength={120} defaultValue={album?.title}/></label>
      <label>주소(slug)<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} defaultValue={album?.slug} placeholder="2026-inje-n-festival"/><small>{albumBase[category]}/<i>slug</i></small></label>
      <label className="wide">설명<input name="description" maxLength={400} defaultValue={album?.description}/></label>
      <label>태그 (쉼표로 구분)<input name="tags" defaultValue={album?.tags.join(', ')}/></label>
      <label>{category === 'race' ? '경기일' : '시작일'}<input type="date" name="dateStart" defaultValue={album?.dateStart ?? ''}/></label>
      <label>종료일 (여러 날이면)<input type="date" name="dateEnd" defaultValue={album?.dateEnd ?? ''}/></label>
      <div className="admin-checks wide">
        <label><input type="checkbox" name="public" defaultChecked={album ? album.visibility === 'public' : false}/> 공개</label>
      </div>
    </div>
  </form>;
}

// ---------- photos ----------
type QueueItem = { key: string; name: string; state: string; error?: boolean };

async function uploadFile(file: File, category: PhotoCategory, albumId: string | null, onState: (state: string) => void) {
  onState('변환 중');
  const image = await processImage(file);
  const original = originalTypes.includes(file.type) ? { type: file.type, size: file.size } : undefined;
  const variants = Object.fromEntries(Object.entries(image.variants).map(([variant, blob]) => [variant, { type: blob.type, size: blob.size }]));
  const ticket = await api<{ id: string; types: Record<string, string>; uploads: Record<string, { url: string; headers: Record<string, string> }> }>('admin/uploads', { method: 'POST', json: { category, albumId, variants, original } });
  const files: [string, Blob][] = [...(Object.entries(image.variants) as [Variant, Blob][]), ...(original ? [['original', file] as [string, Blob]] : [])];
  let done = 0;
  onState(`업로드 중 0/${files.length}`);
  await Promise.all(files.map(async ([variant, blob]) => {
    const target = ticket.uploads[variant];
    const response = await fetch(target.url, { method: 'PUT', headers: target.headers, body: blob });
    if (!response.ok) throw new Error(`${variant} 업로드 실패 (${response.status}). 저장소 CORS 설정을 확인해 주세요.`);
    onState(`업로드 중 ${++done}/${files.length}`);
  }));
  onState('등록 중');
  await api('admin/photos', { method: 'POST', json: {
    id: ticket.id, category, albumId, types: ticket.types, width: image.width, height: image.height, color: image.color, takenAt: image.takenAt,
    originalName: original ? file.name : undefined, originalBytes: original ? file.size : undefined, visibility: 'public',
  } });
}

function PhotoManager({ category, albumId, coverPhotoId, onChange, onCover }: { category: PhotoCategory; albumId: string | null; coverPhotoId?: string | null; onChange?: () => void; onCover?: (id: string) => Promise<void> }) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const path = albumId ? `admin/photos?album=${albumId}` : `admin/photos?category=${category}`;
  const load = useCallback(() => api<{ items: GalleryPhoto[] }>(path).then(data => setPhotos(data.items)).catch(error => setError(error.message)), [path]);
  useEffect(() => { load(); }, [load]);
  const changed = () => { clearGalleryCache(); load(); onChange?.(); };

  async function upload(files: File[]) {
    const images = files.filter(file => file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name));
    const items = images.map((file, index) => ({ key: `${Date.now()}-${index}`, name: file.name, state: '대기' }));
    setQueue(current => [...current, ...items]);
    const set = (key: string, state: string, error = false) => setQueue(current => current.map(item => item.key === key ? { ...item, state, error } : item));
    // Two at a time keeps memory use reasonable for large camera files.
    let next = 0;
    await Promise.all([0, 1].map(async () => {
      while (next < images.length) {
        const index = next++;
        try { await uploadFile(images[index], category, albumId, state => set(items[index].key, state)); set(items[index].key, '완료'); }
        catch (error) { set(items[index].key, (error as Error).message, true); }
      }
    }));
    changed();
    setQueue(current => current.filter(item => item.error));
  }

  async function move(index: number, delta: number) {
    if (!photos) return;
    const next = [...photos];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setPhotos(next);
    try { await api('admin/photos/reorder', { method: 'POST', json: { ids: next.map(photo => photo.id) } }); changed(); }
    catch (error) { setError((error as Error).message); }
  }

  return <div className="admin-photos">
    <div className={`admin-drop${dragging ? ' is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); upload([...event.dataTransfer.files]); }}>
      <p>사진을 끌어다 놓거나 <button type="button" className="admin-button" onClick={() => input.current?.click()}>파일 선택</button></p>
      <small>공개용 사본(2560·1280·480px)은 위치 정보 등 EXIF를 지우고 저장합니다. 원본은 비공개 저장소에 그대로 보관합니다.</small>
      <input ref={input} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={event => { upload([...(event.target.files ?? [])]); event.target.value = ''; }}/>
    </div>
    {!!queue.length && <ul className="admin-queue">{queue.map(item => <li key={item.key} className={item.error ? 'admin-error' : ''}><span>{item.name}</span><span>{item.state}</span>{item.error && <button type="button" onClick={() => setQueue(current => current.filter(entry => entry.key !== item.key))}>닫기</button>}</li>)}</ul>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    {!photos ? <p role="status">불러오는 중…</p> : <ol className="admin-photo-grid">{photos.map((photo, index) =>
      <PhotoCard key={photo.id} photo={photo} isCover={coverPhotoId === photo.id} first={!index} last={index === photos.length - 1}
        onMove={delta => move(index, delta)} onSaved={changed} onCover={onCover && (() => onCover(photo.id))} onError={setError}/>)}</ol>}
  </div>;
}

function PhotoCard({ photo, isCover, first, last, onMove, onSaved, onCover, onError }: { photo: GalleryPhoto; isCover: boolean; first: boolean; last: boolean; onMove: (delta: number) => void; onSaved: () => void; onCover?: () => void; onError: (message: string) => void }) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '');
    setSaving(true);
    try {
      await api(`admin/photos/${photo.id}`, { method: 'PATCH', json: {
        title: value('title'), caption: value('caption'), alt: value('alt'), tags: splitTags(value('tags')),
        credit: value('credit') || null, sourceUrl: value('sourceUrl') || null, visibility: form.get('public') === 'on' ? 'public' : 'draft',
        takenAt: value('takenAt') ? new Date(`${value('takenAt')}T12:00:00+09:00`).toISOString() : null,
      } });
      setDirty(false); onSaved();
    } catch (error) { onError((error as Error).message); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!confirm('이 사진을 삭제할까요? 공개용 사본과 원본이 모두 삭제됩니다.')) return;
    try { await api(`admin/photos/${photo.id}`, { method: 'DELETE' }); onSaved(); }
    catch (error) { onError((error as Error).message); }
  }
  const taken = photo.takenAt ? new Date(new Date(photo.takenAt).getTime() + 9 * 3600_000).toISOString().slice(0, 10) : '';
  return <li className={`admin-photo${photo.visibility === 'draft' ? ' is-draft' : ''}`}>
    <a href={photo.src.lg} target="_blank" rel="noreferrer" className="admin-photo-image"><img src={photo.src.thumb} alt={photo.alt} loading="lazy" style={photo.color ? { backgroundColor: photo.color } : undefined}/>{isCover && <span className="admin-badge">대표</span>}{photo.visibility === 'draft' && <span className="admin-badge muted">비공개</span>}</a>
    <form onSubmit={submit} onChange={() => setDirty(true)}>
      <input name="title" placeholder="제목" defaultValue={photo.title} maxLength={120}/>
      <textarea name="caption" placeholder="설명" rows={2} defaultValue={photo.caption} maxLength={1000}/>
      <input name="alt" placeholder="대체 텍스트 (화면 낭독용)" defaultValue={photo.alt} maxLength={300}/>
      <input name="tags" placeholder="태그, 쉼표로 구분" defaultValue={photo.tags.join(', ')}/>
      <div className="admin-row"><input name="credit" placeholder="출처 표기" defaultValue={photo.credit ?? ''}/><input name="sourceUrl" type="url" placeholder="출처 주소" defaultValue={photo.sourceUrl ?? ''}/></div>
      <div className="admin-row"><label>촬영일 <input name="takenAt" type="date" defaultValue={taken}/></label><label><input type="checkbox" name="public" defaultChecked={photo.visibility !== 'draft'}/> 공개</label></div>
      <div className="admin-photo-actions">
        <span className="admin-order"><button type="button" aria-label="앞으로" disabled={first} onClick={() => onMove(-1)}>←</button><button type="button" aria-label="뒤로" disabled={last} onClick={() => onMove(1)}>→</button></span>
        {onCover && !isCover && <button type="button" onClick={onCover}>대표로</button>}
        {photo.original && <a href={`/api/admin/photos/${photo.id}/original`} title={photo.original.name ?? ''}>원본</a>}
        <button type="button" className="danger" onClick={remove}>삭제</button>
        <button className="admin-button primary" disabled={!dirty || saving}>{saving ? '저장 중' : '저장'}</button>
      </div>
    </form>
  </li>;
}
