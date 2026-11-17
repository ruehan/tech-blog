import { useEffect, useState } from 'react';
import { ShareLink } from '../ApexArticle';
import { RouteLink, type Navigate, type Route } from '../navigation';
import { overridePageMetadata } from '../reading-runtime';
import { albumBase, api, dateRange, useGallery, type AlbumCategory, type GalleryAlbum, type GalleryPhoto, type GallerySummary, type PhotoPage } from './api';
import { AlbumTile, GalleryStatus, Mosaic, PhotoWall } from './Photos';
import './gallery.css';

export type GalleryRoute =
  | { kind: 'photos' } | { kind: 'space' }
  | { kind: 'albums'; category: AlbumCategory } | { kind: 'album'; category: AlbumCategory; slug: string };

/** Paths owned by the gallery. `_album` is the prerendered shell that Vercel serves for every album slug. */
export function galleryRoute(path: string): GalleryRoute | null {
  if (path === '/photos') return { kind: 'photos' };
  if (path === '/photos/space') return { kind: 'space' };
  if (path === '/photos/general') return { kind: 'albums', category: 'general' };
  if (path === '/races') return { kind: 'albums', category: 'race' };
  const general = path.match(/^\/photos\/general\/([^/]+)$/);
  if (general) return { kind: 'album', category: 'general', slug: decodeURIComponent(general[1]) };
  const race = path.match(/^\/races\/([^/]+)$/);
  if (race) return { kind: 'album', category: 'race', slug: decodeURIComponent(race[1]) };
  return null;
}

const copy: Record<AlbumCategory, { title: string; lead: string; back: string; backLabel: string; empty: string }> = {
  general: { title: '일반', lead: '걷다가, 머물다가 남겨 둔 장면들.', back: '/photos', backLabel: '사진', empty: '아직 공개한 앨범이 없어요.' },
  race: { title: '레이스 기록', lead: '경기를 보고 나서도 생각나는 장면들.', back: '', backLabel: '', empty: '아직 공개한 레이스 앨범이 없어요.' },
};

export function GalleryPage({ gallery, route, go }: { gallery: GalleryRoute; route: Route; go: Navigate }) {
  // The prerendered shell has no data yet; it renders the loading state for any slug.
  if (typeof window === 'undefined') return <div className="wrap gallery-page"><GalleryStatus loading/></div>;
  switch (gallery.kind) {
    case 'photos': return <PhotosHome go={go}/>;
    case 'space': return <SpacePhotos route={route} go={go}/>;
    case 'albums': return <AlbumList key={gallery.category} category={gallery.category} go={go}/>;
    case 'album': return <AlbumPage key={route.path} category={gallery.category} slug={gallery.slug} path={route.path} go={go}/>;
  }
}

const albumMeta = (album: GalleryAlbum) => [dateRange(album.dateStart, album.dateEnd), `사진 ${album.photoCount}장`].filter(Boolean).join(' · ');

// ---------- /photos ----------
function PhotosHome({ go }: { go: Navigate }) {
  const { data, error, loading } = useGallery<GallerySummary>('summary');
  return <div className="wrap gallery-page">
    <header className="page-heading"><h1 tabIndex={-1}>사진</h1><p>일상과 밤하늘. 오래 보고 싶은 장면을 모아 둡니다.</p></header>
    <GalleryStatus error={error} loading={loading}/>
    {data && <div className="gallery-sections">
      <AlbumTile href="/photos/general" go={go} title="일반" cover={data.general.cover} fallback="일반" meta={`앨범 ${data.general.albums}개 · 사진 ${data.general.photos}장`}/>
      <AlbumTile href="/photos/space" go={go} title="우주" cover={data.space.cover} fallback="우주" meta={data.space.photos ? `사진 ${data.space.photos}장` : '준비 중'}/>
    </div>}
  </div>;
}

// ---------- /photos/general, /races ----------
function AlbumList({ category, go }: { category: AlbumCategory; go: Navigate }) {
  const { data, error, loading } = useGallery<{ albums: GalleryAlbum[] }>(`albums?category=${category}`);
  const text = copy[category];
  return <div className="wrap gallery-page">
    <header className="page-heading">{text.back && <RouteLink className="back-link" to={text.back} go={go}>{text.backLabel}</RouteLink>}<h1 tabIndex={-1}>{text.title}</h1><p>{text.lead}</p></header>
    <GalleryStatus error={error} loading={loading}/>
    {data && (data.albums.length
      ? <Mosaic items={data.albums} label={`${text.title} 앨범`} keyOf={album => album.id} ratio={album => album.cover ? album.cover.width / album.cover.height : 1}
        render={album => <AlbumTile href={`${albumBase[category]}/${album.slug}`} go={go} title={album.title} cover={album.cover} fallback={album.title.slice(0, 2)} meta={albumMeta(album)}/>}/>
      : <div className="race-empty"><p>{text.empty}</p></div>)}
  </div>;
}

function AlbumPage({ category, slug, path, go }: { category: AlbumCategory; slug: string; path: string; go: Navigate }) {
  const { data, error, loading } = useGallery<{ album: GalleryAlbum; photos: GalleryPhoto[] }>(`albums/${encodeURIComponent(slug)}`);
  const list = albumBase[category];
  const listLabel = category === 'race' ? '레이스 기록' : '앨범 목록';
  // An album of the other category is not found under this path.
  const album = data?.album.category === category ? data.album : undefined;
  const missing = error?.status === 404 || (!!data && !album);
  useEffect(() => {
    if (missing) overridePageMetadata(path, { title: '페이지를 찾을 수 없습니다', noindex: true });
    else if (album) overridePageMetadata(path, { title: album.title, description: album.description || undefined, image: album.cover?.src.lg });
  }, [path, album, missing]);
  if (missing) return <div className="wrap missing-page"><h1 tabIndex={-1}>앨범을 찾을 수 없습니다.</h1><p>주소가 바뀌었거나 아직 공개하지 않은 앨범입니다.</p><RouteLink className="text-link" to={list} go={go}>{listLabel}으로</RouteLink></div>;
  if (!album || !data) return <div className="wrap gallery-page"><GalleryStatus error={error} loading={loading}/></div>;
  return <div className="wrap gallery-page gallery-album">
    <header className="page-heading"><RouteLink className="back-link" to={list} go={go}>{listLabel}</RouteLink>
      <h1 tabIndex={-1}>{album.title}</h1>{album.description && <p>{album.description}</p>}
      <div className="gallery-album-meta">{albumMeta({ ...album, photoCount: data.photos.length })}</div>
    </header>
    <PhotoWall photos={data.photos} label={`${album.title} 사진`} empty={<div className="race-empty"><p>아직 사진이 없어요.</p></div>}/>
    <div className="gallery-album-end"><RouteLink className="text-link" to={list} go={go}>{listLabel}으로</RouteLink><ShareLink/></div>
  </div>;
}

// ---------- /photos/space ----------
const spacePage = 48;
function SpacePhotos({ route, go }: { route: Route; go: Navigate }) {
  const tag = new URLSearchParams(route.search).get('tag') ?? '';
  const first = useGallery<PhotoPage>(`photos?category=space&limit=${spacePage}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`);
  const tags = useGallery<PhotoPage>('photos?category=space&limit=1').data?.tags ?? [];
  const [more, setMore] = useState<{ key: string; items: GalleryPhoto[] }>({ key: '', items: [] });
  const [moreError, setMoreError] = useState<Error>();
  const [fetching, setFetching] = useState(false);
  const extra = more.key === tag ? more.items : [];
  const photos = [...(first.data?.items ?? []), ...extra];
  async function loadMore() {
    setFetching(true); setMoreError(undefined);
    try {
      const page = await api<PhotoPage>(`photos?category=space&limit=${spacePage}&offset=${photos.length}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`);
      setMore({ key: tag, items: [...extra, ...page.items] });
    } catch (error) { setMoreError(error as Error); }
    finally { setFetching(false); }
  }
  return <div className="wrap gallery-page gallery-space">
    <header className="page-heading"><RouteLink className="back-link" to="/photos" go={go}>사진</RouteLink><h1 tabIndex={-1}>우주</h1><p>밤하늘을 올려다본 기록. 앨범 없이 한 장씩 펼쳐 둡니다.</p></header>
    {tags.length > 1 && <div className="filter-bar"><div className="filters" role="group" aria-label="태그 필터">{['', ...tags].map(value => <button key={value} type="button" aria-pressed={tag === value} onClick={() => go(`/photos/space${value ? `?${new URLSearchParams({ tag: value })}` : ''}`)}>{value || '전체'}</button>)}</div></div>}
    <GalleryStatus error={first.error} loading={first.loading}/>
    {first.data && <PhotoWall photos={photos} label="우주 사진" empty={<div className="race-empty gallery-soon"><p>아직 올린 사진이 없어요.</p><p>첫 번째 밤하늘 사진을 준비하고 있습니다.</p></div>}/>}
    {first.data && photos.length < first.data.total && <p className="gallery-more"><button type="button" className="text-link" disabled={fetching} onClick={loadMore}>{fetching ? '불러오는 중' : '사진 더 보기'}</button></p>}
    {moreError && <p role="alert" className="gallery-more">{moreError.message}</p>}
  </div>;
}
