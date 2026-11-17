import { useEffect, useState } from 'react';

export type PhotoCategory = 'general' | 'race' | 'space';
export type AlbumCategory = 'general' | 'race';
export type Visibility = 'public' | 'draft';

export interface GalleryPhoto {
  id: string;
  category: PhotoCategory;
  albumId: string | null;
  album: { slug: string; title: string } | null;
  title: string;
  caption: string;
  alt: string;
  tags: string[];
  credit: string | null;
  sourceUrl: string | null;
  takenAt: string | null;
  width: number;
  height: number;
  color: string | null;
  src: { thumb: string; md: string; lg: string };
  // Admin responses only.
  visibility?: Visibility;
  sort?: number;
  uploadedAt?: string;
  original?: { name: string | null; type: string | null; bytes: number | null } | null;
}

export interface GalleryAlbum {
  id: string;
  slug: string;
  category: AlbumCategory;
  title: string;
  description: string;
  tags: string[];
  dateStart: string | null;
  dateEnd: string | null;
  photoCount: number;
  cover: GalleryPhoto | null;
  updatedAt: string;
  // Admin responses only.
  visibility?: Visibility;
  sort?: number;
  coverPhotoId?: string | null;
}

export interface GallerySummary {
  general: { photos: number; albums: number; cover: GalleryPhoto | null };
  space: { photos: number; cover: GalleryPhoto | null };
}
export interface PhotoPage { total: number; items: GalleryPhoto[]; tags?: string[] }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const response = await fetch(`/api/${path}`, {
    ...rest, credentials: 'same-origin',
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.error ?? `요청에 실패했습니다 (${response.status}).`);
  return data as T;
}

// Public reads are cached for the session so back/forward navigation renders instantly.
const cache = new Map<string, unknown>();
export function clearGalleryCache() { cache.clear(); }

export function useGallery<T>(path: string | null) {
  const [state, setState] = useState<{ path: string | null; data?: T; error?: ApiError }>(() => ({ path, data: path ? cache.get(path) as T | undefined : undefined }));
  useEffect(() => {
    if (!path) return;
    if (cache.has(path)) { setState({ path, data: cache.get(path) as T }); return; }
    let live = true;
    setState({ path });
    api<T>(path).then(data => { cache.set(path, data); if (live) setState({ path, data }); })
      .catch(error => { if (live) setState({ path, error: error instanceof ApiError ? error : new ApiError(0, '사진첩 서버에 연결하지 못했습니다.') }); });
    return () => { live = false; };
  }, [path]);
  const current = state.path === path ? state : { path, data: path ? cache.get(path) as T | undefined : undefined };
  return { data: current.data, error: current.error, loading: !!path && !current.data && !current.error };
}

export const albumBase: Record<AlbumCategory, string> = { general: '/photos/general', race: '/races' };

export function photoSrcSet(photo: GalleryPhoto) {
  const unique = new Map([[photo.src.thumb, 480], [photo.src.md, 1280], [photo.src.lg, 2560]]);
  return unique.size > 1 ? [...unique].map(([src, width]) => `${src} ${Math.min(width, Math.max(photo.width, photo.height))}w`).join(', ') : undefined;
}

export function formatDay(value: string | null) {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return `${year}. ${month}. ${day}.`;
}
export function dateRange(start: string | null, end: string | null) {
  if (!start) return '';
  return end && end !== start ? `${formatDay(start)} – ${formatDay(end)}` : formatDay(start);
}
