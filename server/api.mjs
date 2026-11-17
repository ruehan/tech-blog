// Gallery HTTP API. A plain (Request) → Response function, mounted by Vercel (api/index.js)
// and by the Vite dev server. See docs/gallery.md for the route list.
import * as repo from './repo.mjs';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

// Browsers always revalidate (a fresh upload shows on the next visit); only Vercel's CDN keeps a short copy.
const publicCache = 'public';
const cdnCache = 'public, s-maxage=60, stale-while-revalidate=600';
function json(data, { status = 200, cache = 'no-store' } = {}) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache === publicCache ? 'public, max-age=0, must-revalidate' : cache };
  if (cache === publicCache) headers['CDN-Cache-Control'] = cdnCache;
  return new Response(JSON.stringify(data), { status, headers });
}

// ---------- validation ----------
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function text(value, name, { max = 200, required = false, nullable = false } = {}) {
  if (value === undefined) return required ? fail(400, `${name}이(가) 필요합니다.`) : undefined;
  if (value === null || value === '') {
    if (required) fail(400, `${name}이(가) 필요합니다.`);
    return nullable ? null : '';
  }
  if (typeof value !== 'string') fail(400, `${name}은(는) 문자열이어야 합니다.`);
  const trimmed = value.trim();
  if (required && !trimmed) fail(400, `${name}이(가) 필요합니다.`);
  if (trimmed.length > max) fail(400, `${name}은(는) ${max}자 이하로 입력해 주세요.`);
  return trimmed || (nullable ? null : '');
}
function oneOf(value, name, options, { required = false } = {}) {
  if (value === undefined && !required) return undefined;
  if (!options.includes(value)) fail(400, `${name}은(는) ${options.join(', ')} 중 하나여야 합니다.`);
  return value;
}
function tags(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 20 || value.some(tag => typeof tag !== 'string' || !tag.trim() || tag.trim().length > 40)) fail(400, '태그는 40자 이하 문자열 20개까지 입력할 수 있습니다.');
  return [...new Set(value.map(tag => tag.trim()))];
}
function date(value, name) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (typeof value !== 'string' || !datePattern.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(400, `${name}은(는) YYYY-MM-DD 형식이어야 합니다.`);
  return value;
}
function timestamp(value, name) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail(400, `${name} 형식이 올바르지 않습니다.`);
  return new Date(value).toISOString();
}
function link(value, name) {
  const result = text(value, name, { max: 1000, nullable: true });
  if (result && !/^https?:\/\//i.test(result)) fail(400, `${name}은(는) http(s) 주소여야 합니다.`);
  try { if (result) new URL(result); } catch { fail(400, `${name}이(가) 올바른 주소가 아닙니다.`); }
  return result;
}
function integer(value, name, { min = 0, max = 1e9 } = {}) {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < min || value > max) fail(400, `${name}은(는) ${min}~${max} 사이 정수여야 합니다.`);
  return value;
}
function ids(value) {
  if (!Array.isArray(value) || !value.length || value.length > 1000 || value.some(id => typeof id !== 'string' || !uuidPattern.test(id)) || new Set(value).size !== value.length) fail(400, 'ids에는 중복 없는 사진/앨범 id 목록이 필요합니다.');
  return value;
}
const defined = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

function albumInput(body, { creating }) {
  const input = defined({
    slug: body.slug === undefined ? undefined : (typeof body.slug === 'string' && slugPattern.test(body.slug) && body.slug.length <= 80 ? body.slug : fail(400, '주소(slug)는 영문 소문자·숫자·하이픈으로 80자 이하여야 합니다.')),
    title: text(body.title, '제목', { max: 120, required: creating }),
    description: text(body.description, '설명', { max: 400 }),
    tags: tags(body.tags),
    dateStart: date(body.dateStart, '시작일'),
    dateEnd: date(body.dateEnd, '종료일'),
    visibility: oneOf(body.visibility, '공개 상태', ['public', 'draft']),
    sort: integer(body.sort, '순서'),
    coverPhotoId: body.coverPhotoId === undefined ? undefined : body.coverPhotoId === null ? null : (uuidPattern.test(body.coverPhotoId) ? body.coverPhotoId : fail(400, '대표 사진 id가 올바르지 않습니다.')),
  });
  if (creating && !input.slug) fail(400, '주소(slug)가 필요합니다.');
  if (input.dateStart && input.dateEnd && input.dateEnd < input.dateStart) fail(400, '종료일은 시작일보다 빠를 수 없습니다.');
  return input;
}

function photoInput(body) {
  return defined({
    title: text(body.title, '사진 제목', { max: 120 }),
    caption: text(body.caption, '설명', { max: 1000 }),
    alt: text(body.alt, '대체 텍스트', { max: 300 }),
    tags: tags(body.tags),
    credit: text(body.credit, '출처 표기', { max: 200, nullable: true }),
    sourceUrl: link(body.sourceUrl, '출처 주소'),
    takenAt: timestamp(body.takenAt, '촬영일'),
    visibility: oneOf(body.visibility, '공개 상태', ['public', 'draft']),
  });
}

// ---------- uploads ----------
const variantSpecs = { lg: 2560, md: 1280, thumb: 480 };
const variantTypes = { 'image/webp': 'webp', 'image/jpeg': 'jpg' };
const originalTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/heic': 'heic', 'image/heif': 'heif', 'image/tiff': 'tiff', 'image/gif': 'gif' };
const maxOriginalBytes = 80 * 1024 * 1024;
const maxVariantBytes = 15 * 1024 * 1024;
export const photoKeys = (id, types) => ({
  ...Object.fromEntries(Object.keys(variantSpecs).map(variant => [variant, `photos/${id}/${variant}.${variantTypes[types[variant]]}`])),
  ...(types.original ? { original: `originals/${id}/original.${originalTypes[types.original]}` } : {}),
});

// ---------- views ----------
function photoView(photo, storage, admin) {
  return {
    id: photo.id, category: photo.category, albumId: photo.albumId, album: photo.album,
    title: photo.title, caption: photo.caption, alt: photo.alt, tags: photo.tags,
    credit: photo.credit, sourceUrl: photo.sourceUrl, takenAt: photo.takenAt,
    width: photo.width, height: photo.height, color: photo.color,
    src: { thumb: storage.publicUrl(photo.keys.thumb), md: storage.publicUrl(photo.keys.md), lg: storage.publicUrl(photo.keys.lg) },
    ...(admin ? { visibility: photo.visibility, sort: photo.sort, uploadedAt: photo.uploadedAt, original: photo.original } : {}),
  };
}
function albumView(album, storage, admin) {
  return {
    id: album.id, slug: album.slug, category: album.category, title: album.title, description: album.description,
    tags: album.tags, dateStart: album.dateStart, dateEnd: album.dateEnd,
    photoCount: album.photoCount, cover: album.cover ? photoView(album.cover, storage, admin) : null, updatedAt: album.updatedAt,
    ...(admin ? { visibility: album.visibility, sort: album.sort, coverPhotoId: album.coverPhotoId, createdAt: album.createdAt } : {}),
  };
}

async function readJson(request) {
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) fail(415, 'JSON 요청만 받습니다.');
  const raw = await request.text();
  if (raw.length > 200_000) fail(413, '요청이 너무 큽니다.');
  try { const body = JSON.parse(raw); if (body && typeof body === 'object' && !Array.isArray(body)) return body; } catch { /* handled below */ }
  fail(400, 'JSON 본문이 올바르지 않습니다.');
}

/**
 * @param {{ query: Function, storage: object, auth?: object, devAdmin?: boolean, log?: (error: unknown) => void }} options
 * devAdmin is set only by the local Vite server and treats every request as the admin.
 */
export function createApi({ query, storage, auth, devAdmin = false, log = console.error }) {
  const publicList = (searchParams) => {
    const limit = Math.min(Number(searchParams.get('limit')) || 60, 200);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
    return { limit: Number.isInteger(limit) ? limit : 60, offset: Number.isInteger(offset) ? offset : 0 };
  };

  async function requireAdmin(request) {
    if (devAdmin) return { login: 'local-dev' };
    const admin = auth?.admin(request);
    if (!admin) fail(401, '로그인이 필요합니다.');
    return admin;
  }

  async function albumWithPhotos(album, admin) {
    const photos = await repo.listPhotos(query, { albumId: album.id, publicOnly: !admin, limit: 1000 });
    return { album: albumView(album, storage, admin), photos: photos.items.map(photo => photoView(photo, storage, admin)) };
  }

  async function ensureAlbumFor(category, albumId) {
    if (category === 'space') {
      if (albumId) fail(400, '우주 사진은 앨범 없이 올립니다.');
      return null;
    }
    if (!albumId) fail(400, '앨범을 선택해 주세요.');
    const album = await repo.getAlbum(query, { id: albumId, publicOnly: false });
    if (!album || album.category !== category) fail(400, '앨범을 찾을 수 없거나 사진첩 종류가 다릅니다.');
    return album;
  }

  async function removeObjects(photos) {
    const failures = [];
    for (const photo of photos) {
      for (const [variant, key] of Object.entries(photo.keys)) {
        if (!key) continue;
        try { await storage.remove(variant === 'original' ? 'private' : 'public', key); }
        catch (error) { failures.push(key); log(error); }
      }
    }
    return failures;
  }

  async function route(request, segments) {
    const { method } = request;
    const url = new URL(request.url);
    const [head, second, third, fourth] = segments;

    // ----- public -----
    if (method === 'GET' && head === 'summary' && !second) {
      // /photos lists two sections; race albums have their own page at /races.
      const [general, space, generalAlbums] = await Promise.all([
        repo.listPhotos(query, { category: 'general', limit: 1 }), repo.listPhotos(query, { category: 'space', limit: 1 }),
        repo.listAlbums(query, { category: 'general' }),
      ]);
      const generalCover = generalAlbums.find(album => album.cover)?.cover ?? general.items[0];
      return json({
        general: { photos: general.total, albums: generalAlbums.length, cover: generalCover ? photoView(generalCover, storage, false) : null },
        space: { photos: space.total, cover: space.items[0] ? photoView(space.items[0], storage, false) : null },
      }, { cache: publicCache });
    }
    if (method === 'GET' && head === 'albums') {
      if (!second) {
        const category = oneOf(url.searchParams.get('category') ?? undefined, 'category', repo.albumCategories);
        const albums = await repo.listAlbums(query, { category });
        return json({ albums: albums.map(album => albumView(album, storage, false)) }, { cache: publicCache });
      }
      if (!third) {
        const album = await repo.getAlbum(query, { slug: second });
        if (!album) fail(404, '앨범을 찾을 수 없습니다.');
        return json(await albumWithPhotos(album, false), { cache: publicCache });
      }
    }
    if (method === 'GET' && head === 'photos' && !second) {
      const category = oneOf(url.searchParams.get('category') ?? undefined, 'category', repo.photoCategories);
      const tag = url.searchParams.get('tag') || undefined;
      const { limit, offset } = publicList(url.searchParams);
      const list = await repo.listPhotos(query, { category, tag, limit, offset });
      const tagList = category && offset === 0 ? await repo.photoTags(query, { category }) : undefined;
      return json({ total: list.total, items: list.items.map(photo => photoView(photo, storage, false)), ...(tagList ? { tags: tagList } : {}) }, { cache: publicCache });
    }

    // ----- auth -----
    if (head === 'auth') {
      if (method === 'GET' && second === 'me') {
        const admin = devAdmin ? { login: 'local-dev' } : auth?.admin(request);
        return admin ? json({ login: admin.login, dev: devAdmin }) : json({ error: '로그인이 필요합니다.', configured: !!auth?.configured }, { status: 401 });
      }
      if (devAdmin && method === 'GET' && (second === 'login' || second === 'callback')) return new Response(null, { status: 302, headers: { Location: '/admin' } });
      if (!auth?.configured) fail(503, '관리자 로그인이 아직 설정되지 않았습니다. (GITHUB_CLIENT_ID 등)');
      if (method === 'GET' && second === 'login') return auth.login(request);
      if (method === 'GET' && second === 'callback') return auth.callback(request);
      if (method === 'POST' && second === 'logout') return auth.logout(request);
    }

    // ----- admin -----
    if (head === 'admin') {
      await requireAdmin(request);
      if (second === 'albums') {
        if (method === 'GET' && !third) {
          const category = oneOf(url.searchParams.get('category') ?? undefined, 'category', repo.albumCategories);
          return json({ albums: (await repo.listAlbums(query, { category, publicOnly: false })).map(album => albumView(album, storage, true)) });
        }
        if (method === 'POST' && !third) {
          const body = await readJson(request);
          const category = oneOf(body.category, '사진첩 종류', repo.albumCategories, { required: true });
          const input = albumInput(body, { creating: true });
          if (input.coverPhotoId) fail(400, '대표 사진은 사진을 올린 뒤 지정해 주세요.');
          if (await repo.getAlbum(query, { slug: input.slug, publicOnly: false })) fail(409, '이미 사용 중인 주소(slug)입니다.');
          return json({ album: albumView(await repo.createAlbum(query, { ...input, category }), storage, true) }, { status: 201 });
        }
        if (method === 'POST' && third === 'reorder') {
          await repo.reorder(query, 'albums', ids((await readJson(request)).ids));
          return json({ ok: true });
        }
        if (third && !fourth) {
          if (!uuidPattern.test(third)) fail(404, '앨범을 찾을 수 없습니다.');
          const album = await repo.getAlbum(query, { id: third, publicOnly: false });
          if (!album) fail(404, '앨범을 찾을 수 없습니다.');
          if (method === 'GET') return json(await albumWithPhotos(album, true));
          if (method === 'PATCH') {
            const input = albumInput(await readJson(request), { creating: false });
            if (input.slug && input.slug !== album.slug && await repo.getAlbum(query, { slug: input.slug, publicOnly: false })) fail(409, '이미 사용 중인 주소(slug)입니다.');
            if (input.coverPhotoId) {
              const cover = await repo.getPhoto(query, input.coverPhotoId);
              if (cover?.albumId !== album.id) fail(400, '대표 사진은 이 앨범의 사진이어야 합니다.');
            }
            return json({ album: albumView(await repo.updateAlbum(query, album.id, input), storage, true) });
          }
          if (method === 'DELETE') {
            const photos = await repo.deleteAlbum(query, album.id);
            const failed = await removeObjects(photos ?? []);
            return json({ ok: true, deletedPhotos: photos?.length ?? 0, storageFailures: failed });
          }
        }
      }
      if (second === 'photos') {
        if (method === 'GET' && !third) {
          const category = oneOf(url.searchParams.get('category') ?? undefined, 'category', repo.photoCategories);
          const albumId = url.searchParams.get('album') || undefined;
          const list = await repo.listPhotos(query, { category, albumId, publicOnly: false, limit: 1000 });
          return json({ total: list.total, items: list.items.map(photo => photoView(photo, storage, true)) });
        }
        if (method === 'POST' && !third) {
          const body = await readJson(request);
          if (typeof body.id !== 'string' || !uuidPattern.test(body.id)) fail(400, '업로드 id가 올바르지 않습니다.');
          if (await repo.getPhoto(query, body.id)) fail(409, '이미 등록된 사진입니다.');
          const category = oneOf(body.category, '사진첩 종류', repo.photoCategories, { required: true });
          const album = await ensureAlbumFor(category, body.albumId ?? null);
          const types = body.types ?? {};
          for (const variant of Object.keys(variantSpecs)) oneOf(types[variant], `${variant} 형식`, Object.keys(variantTypes), { required: true });
          if (types.original !== undefined) oneOf(types.original, '원본 형식', Object.keys(originalTypes));
          const keys = photoKeys(body.id, types);
          for (const [variant, key] of Object.entries(keys)) {
            if (!await storage.exists(variant === 'original' ? 'private' : 'public', key)) fail(400, `업로드된 파일을 찾을 수 없습니다: ${variant}`);
          }
          const photo = await repo.createPhoto(query, {
            id: body.id, category, albumId: album?.id ?? null, keys,
            width: integer(body.width, '가로 크기', { min: 1, max: 100_000 }) ?? fail(400, '가로 크기가 필요합니다.'),
            height: integer(body.height, '세로 크기', { min: 1, max: 100_000 }) ?? fail(400, '세로 크기가 필요합니다.'),
            color: typeof body.color === 'string' && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : null,
            original: types.original ? { name: text(body.originalName, '원본 파일 이름', { max: 255, nullable: true }), type: types.original, bytes: integer(body.originalBytes, '원본 크기', { min: 0, max: maxOriginalBytes }) ?? null } : null,
            ...photoInput(body),
          });
          return json({ photo: photoView(photo, storage, true) }, { status: 201 });
        }
        if (method === 'POST' && third === 'reorder') {
          await repo.reorder(query, 'photos', ids((await readJson(request)).ids));
          return json({ ok: true });
        }
        if (third && uuidPattern.test(third)) {
          const photo = await repo.getPhoto(query, third);
          if (!photo) fail(404, '사진을 찾을 수 없습니다.');
          if (method === 'GET' && fourth === 'original') {
            if (!photo.keys.original) fail(404, '보관된 원본이 없습니다.');
            return new Response(null, { status: 302, headers: { Location: await storage.presignGet('private', photo.keys.original), 'Cache-Control': 'no-store' } });
          }
          if (fourth) fail(404, '찾을 수 없는 경로입니다.');
          if (method === 'PATCH') {
            const body = await readJson(request);
            const input = photoInput(body);
            if (body.albumId !== undefined && body.albumId !== photo.albumId) input.albumId = (await ensureAlbumFor(photo.category, body.albumId)).id;
            return json({ photo: photoView(await repo.updatePhoto(query, photo.id, input), storage, true) });
          }
          if (method === 'DELETE') {
            await query('UPDATE albums SET cover_photo_id = NULL WHERE cover_photo_id = $1', [photo.id]);
            const removed = await repo.deletePhoto(query, photo.id);
            return json({ ok: true, storageFailures: await removeObjects(removed ? [removed] : []) });
          }
        }
      }
      if (method === 'POST' && second === 'uploads' && !third) {
        const body = await readJson(request);
        const category = oneOf(body.category, '사진첩 종류', repo.photoCategories, { required: true });
        await ensureAlbumFor(category, body.albumId ?? null);
        const types = {};
        for (const variant of Object.keys(variantSpecs)) {
          const file = body.variants?.[variant];
          types[variant] = oneOf(file?.type, `${variant} 형식`, Object.keys(variantTypes), { required: true });
          integer(file.size, `${variant} 크기`, { min: 1, max: maxVariantBytes });
        }
        if (body.original) {
          types.original = oneOf(body.original.type, '원본 형식', Object.keys(originalTypes), { required: true });
          integer(body.original.size, '원본 크기', { min: 1, max: maxOriginalBytes });
        }
        const id = repo.newId();
        const keys = photoKeys(id, types);
        const uploads = {};
        for (const [variant, key] of Object.entries(keys)) uploads[variant] = await storage.presignPut(variant === 'original' ? 'private' : 'public', key, types[variant]);
        return json({ id, types, uploads });
      }
    }

    if (head === 'dev-storage' && storage.kind === 'local' && second) return storage.handle(request, second, segments.slice(2).join('/'));
    fail(404, '찾을 수 없는 경로입니다.');
  }

  return async function handle(request) {
    try {
      const url = new URL(request.url);
      // Vercel rewrites /api/<path> to /api?route=<path>; the dev server passes the path directly.
      const path = url.searchParams.get('route') ?? url.pathname.replace(/^\/api\/?/, '');
      const segments = path.split('/').filter(Boolean).map(decodeURIComponent);
      const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
      // Cookie-authenticated writes must come from this site's own pages.
      if (mutating && segments[0] !== 'dev-storage' && request.headers.get('origin') !== url.origin) fail(403, '허용되지 않은 요청 출처입니다.');
      return await route(request, segments);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
      log(error);
      return json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
  };
}
