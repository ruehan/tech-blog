import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../server/api.mjs';
import { createAuth } from '../server/auth.mjs';
import { migrate, pgliteQuery } from '../server/db.mjs';
import { seedSamples } from '../server/runtime.mjs';
import { diskStorage } from '../server/storage.mjs';

const origin = 'http://gallery.test';
const directory = await mkdtemp(join(tmpdir(), 'gallery-'));
const query = await pgliteQuery();
await migrate(query, query.exec);
await seedSamples(query);
const storage = diskStorage({ directory });
const auth = createAuth({ clientId: 'id', clientSecret: 'secret', admins: ['hangyu'], secret: 'x'.repeat(32) });
const handle = createApi({ query, storage, auth, log: () => {} });
const adminCookie = `apex_admin=${auth.issue('hangyu')}`;

async function call(path: string, { method = 'GET', body, admin = false, from = origin }: { method?: string; body?: unknown; admin?: boolean; from?: string | null } = {}) {
  const headers: Record<string, string> = {};
  if (admin) headers.cookie = adminCookie;
  if (from) headers.origin = from;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await handle(new Request(`${origin}/api/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  return { status: response.status, headers: response.headers, data: response.status === 302 ? null : await response.json() };
}

test.after(async () => { await query.close(); await rm(directory, { recursive: true, force: true }); });

test('seeded race albums are plain public albums with their sample photo', async () => {
  const { status, data, headers } = await call('albums?category=race');
  assert.equal(status, 200);
  assert.equal(headers.get('cache-control'), 'public, max-age=0, must-revalidate');
  assert.match(headers.get('cdn-cache-control')!, /s-maxage=60/);
  assert.deepEqual(data.albums.map((album: { slug: string }) => album.slug), ['n1', 'wec', 'tcr', 'f1']);
  const tcr = (await call('albums/tcr')).data;
  assert.equal(tcr.album.category, 'race');
  assert.equal(tcr.photos[0].src.lg, '/apex/assets/tcr.jpg');
  assert.equal(tcr.photos[0].credit, 'Hyundai Motor Company · TCR');
  assert.equal(tcr.album.visibility, undefined, 'admin fields stay out of public responses');
  assert.equal((await call('albums/nope')).status, 404);
});

test('admin routes require a valid session and same-origin writes', async () => {
  assert.equal((await call('admin/albums')).status, 401);
  assert.equal((await handle(new Request(`${origin}/api/admin/albums`, { headers: { cookie: 'apex_admin=forged.token' } }))).status, 401);
  assert.equal((await call('admin/albums', { method: 'POST', admin: true, from: 'https://evil.example', body: {} })).status, 403);
  assert.equal((await call('admin/albums', { method: 'POST', admin: true, from: null, body: {} })).status, 403);
  const outsider = createAuth({ clientId: 'id', clientSecret: 'secret', admins: ['someone-else'], secret: 'x'.repeat(32) });
  const response = await handle(new Request(`${origin}/api/admin/albums`, { headers: { cookie: `apex_admin=${outsider.issue('someone-else')}` } }));
  assert.equal(response.status, 401, 'a session for a login outside the allowlist is rejected');
  assert.equal((await call('auth/me', { admin: true })).data.login, 'hangyu');
});

test('drafts stay hidden until published; validation rejects bad input', async () => {
  assert.equal((await call('admin/albums', { method: 'POST', admin: true, body: { category: 'general', slug: 'Bad Slug', title: 'x' } })).status, 400);
  assert.equal((await call('admin/albums', { method: 'POST', admin: true, body: { category: 'space', slug: 'sky', title: 'x' } })).status, 400, 'space has no albums');
  assert.equal((await call('admin/albums', { method: 'POST', admin: true, body: { category: 'race', slug: 'bad-dates', title: 'x', dateStart: '2026-05-02', dateEnd: '2026-05-01' } })).status, 400);
  const created = await call('admin/albums', { method: 'POST', admin: true, body: { category: 'general', slug: 'jeju-2026', title: '제주', tags: ['여행'] } });
  assert.equal(created.status, 201);
  assert.equal(created.data.album.visibility, 'draft');
  assert.equal((await call('albums/jeju-2026')).status, 404);
  assert.equal((await call('admin/albums', { method: 'POST', admin: true, body: { category: 'general', slug: 'jeju-2026', title: '중복' } })).status, 409);
  await call(`admin/albums/${created.data.album.id}`, { method: 'PATCH', admin: true, body: { visibility: 'public' } });
  assert.equal((await call('albums/jeju-2026')).status, 200);
  assert.deepEqual((await call('summary')).data.general, { photos: 0, albums: 1, cover: null });
  assert.equal('race' in (await call('summary')).data, false, '/photos lists general and space only');
});

test('upload flow: presign, put, register; originals stay private; delete cleans storage', async () => {
  const album = (await call('admin/albums', { method: 'POST', admin: true, body: { category: 'general', slug: 'walk', title: '산책', visibility: 'public' } })).data.album;
  const variants = { lg: { type: 'image/webp', size: 10 }, md: { type: 'image/webp', size: 10 }, thumb: { type: 'image/webp', size: 10 } };
  assert.equal((await call('admin/uploads', { method: 'POST', admin: true, body: { category: 'space', albumId: album.id, variants } })).status, 400, 'space photos have no album');
  assert.equal((await call('admin/uploads', { method: 'POST', admin: true, body: { category: 'race', albumId: album.id, variants } })).status, 400, 'album category must match');
  const ticket = (await call('admin/uploads', { method: 'POST', admin: true, body: { category: 'general', albumId: album.id, variants, original: { type: 'image/jpeg', size: 10 } } })).data;
  const register = () => call('admin/photos', { method: 'POST', admin: true, body: { id: ticket.id, category: 'general', albumId: album.id, types: ticket.types, width: 400, height: 300, title: '노을', takenAt: '2026-11-01T09:00:00Z' } });
  assert.equal((await register()).status, 400, 'files must be uploaded first');
  for (const [variant, target] of Object.entries(ticket.uploads) as [string, { url: string; headers: Record<string, string> }][]) {
    const put = await handle(new Request(origin + target.url, { method: 'PUT', headers: target.headers, body: variant }));
    assert.equal(put.status, 200);
  }
  const tampered = ticket.uploads.lg.url.replace(/signature=[^&]+/, 'signature=nope');
  assert.equal((await handle(new Request(origin + tampered, { method: 'PUT', body: 'x' }))).status, 403);
  const created = await register();
  assert.equal(created.status, 201);
  const photo = created.data.photo;
  assert.equal(photo.src.lg, `/api/dev-storage/public/photos/${ticket.id}/lg.webp`);
  assert.equal((await handle(new Request(origin + photo.src.lg))).status, 200);
  const originalPath = `/api/dev-storage/private/originals/${ticket.id}/original.jpg`;
  assert.equal((await handle(new Request(origin + originalPath))).status, 403, 'originals are never public');
  const download = await call(`admin/photos/${photo.id}/original`, { admin: true });
  assert.equal(download.status, 302);
  assert.equal((await handle(new Request(origin + download.headers.get('location')))).status, 200);

  const page = (await call('albums/walk')).data;
  assert.equal(page.photos.length, 1);
  assert.equal(page.album.cover.id, photo.id);
  assert.equal(page.photos[0].original, undefined, 'original metadata is admin-only');

  await call(`admin/photos/${photo.id}`, { method: 'PATCH', admin: true, body: { visibility: 'draft' } });
  assert.equal((await call('albums/walk')).data.photos.length, 0);
  assert.equal((await call(`admin/albums/${album.id}`, { method: 'DELETE', admin: true })).data.deletedPhotos, 1);
  assert.equal((await handle(new Request(origin + photo.src.lg))).status, 404);
});

test('space photos are flat, paginated and filterable by tag', async () => {
  const variants = { lg: { type: 'image/jpeg', size: 1 }, md: { type: 'image/jpeg', size: 1 }, thumb: { type: 'image/jpeg', size: 1 } };
  for (const tags of [['달'], ['은하수'], ['달']]) {
    const ticket = (await call('admin/uploads', { method: 'POST', admin: true, body: { category: 'space', variants } })).data;
    for (const target of Object.values(ticket.uploads) as { url: string }[]) await handle(new Request(origin + target.url, { method: 'PUT', body: 'x' }));
    assert.equal((await call('admin/photos', { method: 'POST', admin: true, body: { id: ticket.id, category: 'space', types: ticket.types, width: 10, height: 10, tags } })).status, 201);
  }
  const first = (await call('photos?category=space&limit=2')).data;
  assert.equal(first.total, 3);
  assert.equal(first.items.length, 2);
  assert.deepEqual(first.tags, ['달', '은하수']);
  assert.equal((await call('photos?category=space&limit=2&offset=2')).data.items.length, 1);
  assert.equal((await call(`photos?category=space&tag=${encodeURIComponent('달')}`)).data.total, 2);
  assert.equal((await call('summary')).data.space.photos, 3);
});

test('reorder and cover selection', async () => {
  const races = (await call('admin/albums?category=race', { admin: true })).data.albums;
  await call('admin/albums/reorder', { method: 'POST', admin: true, body: { ids: [...races].reverse().map((album: { id: string }) => album.id) } });
  assert.deepEqual((await call('albums?category=race')).data.albums.map((album: { slug: string }) => album.slug), ['f1', 'tcr', 'wec', 'n1']);
  const wec = races.find((album: { slug: string }) => album.slug === 'wec');
  const tcrPhoto = (await call('albums/tcr')).data.photos[0];
  assert.equal((await call(`admin/albums/${wec.id}`, { method: 'PATCH', admin: true, body: { coverPhotoId: tcrPhoto.id } })).status, 400, 'cover must belong to the album');
});
