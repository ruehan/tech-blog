// Gallery persistence. Every function takes the driver-neutral `query` from db.mjs.
import { randomUUID } from 'node:crypto';

export const albumCategories = ['general', 'race'];
export const photoCategories = ['general', 'race', 'space'];

const iso = value => value == null ? null : new Date(value).toISOString();
const day = value => value == null ? null : typeof value === 'string' ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10);

export const newId = () => randomUUID();

const photoColumns = `p.id, p.category, p.album_id, p.title, p.caption, p.alt, p.tags, p.credit, p.source_url,
  p.taken_at, p.uploaded_at, p.width, p.height, p.color, p.key_lg, p.key_md, p.key_thumb, p.key_original,
  p.original_name, p.original_type, p.original_bytes, p.visibility, p.sort`;

export function toPhoto(row) {
  if (!row) return null;
  return {
    id: row.id, category: row.category, albumId: row.album_id ?? null,
    title: row.title ?? '', caption: row.caption ?? '', alt: row.alt ?? '', tags: row.tags ?? [],
    credit: row.credit ?? null, sourceUrl: row.source_url ?? null,
    takenAt: iso(row.taken_at), uploadedAt: iso(row.uploaded_at),
    width: row.width, height: row.height, color: row.color ?? null,
    keys: { lg: row.key_lg, md: row.key_md, thumb: row.key_thumb, original: row.key_original ?? null },
    original: row.key_original ? { name: row.original_name ?? null, type: row.original_type ?? null, bytes: row.original_bytes ?? null } : null,
    visibility: row.visibility, sort: row.sort,
    album: row.album_slug ? { slug: row.album_slug, title: row.album_title } : null,
  };
}

function toAlbum(row) {
  if (!row) return null;
  return {
    id: row.id, slug: row.slug, category: row.category, title: row.title, description: row.description,
    tags: row.tags ?? [], coverPhotoId: row.cover_photo_id ?? null,
    dateStart: day(row.date_start), dateEnd: day(row.date_end),
    visibility: row.visibility, sort: row.sort, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
    photoCount: row.photo_count ?? 0,
    cover: row.cover ? toPhoto(row.cover) : null,
  };
}

const albumSelect = (publicOnly) => `
  SELECT a.id, a.slug, a.category, a.title, a.description, a.tags, a.cover_photo_id,
    a.date_start::text AS date_start, a.date_end::text AS date_end, a.visibility, a.sort, a.created_at, a.updated_at,
    (SELECT count(*)::int FROM photos p WHERE p.album_id = a.id ${publicOnly ? "AND p.visibility = 'public'" : ''}) AS photo_count,
    (SELECT to_jsonb(c) FROM (SELECT ${photoColumns} FROM photos p WHERE p.album_id = a.id ${publicOnly ? "AND p.visibility = 'public'" : ''}
      ORDER BY (p.id IS NOT DISTINCT FROM a.cover_photo_id) DESC, p.sort, p.uploaded_at DESC LIMIT 1) c) AS cover
  FROM albums a`;

const albumOrder = 'ORDER BY a.sort, a.date_start DESC NULLS LAST, a.created_at DESC';

export async function listAlbums(query, { category, publicOnly = true } = {}) {
  const where = [], params = [];
  if (category) { params.push(category); where.push(`a.category = $${params.length}`); }
  if (publicOnly) where.push("a.visibility = 'public'");
  const rows = await query(`${albumSelect(publicOnly)} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ${albumOrder}`, params);
  return rows.map(toAlbum);
}

export async function getAlbum(query, { slug, id, publicOnly = true }) {
  const params = [slug ?? id];
  const rows = await query(`${albumSelect(publicOnly)} WHERE a.${slug ? 'slug' : 'id'} = $1 ${publicOnly ? "AND a.visibility = 'public'" : ''}`, params);
  return toAlbum(rows[0]);
}

const albumFields = { slug: 'slug', title: 'title', description: 'description', tags: 'tags', coverPhotoId: 'cover_photo_id', dateStart: 'date_start', dateEnd: 'date_end', visibility: 'visibility', sort: 'sort' };

export async function createAlbum(query, album) {
  const id = album.id ?? newId();
  const columns = ['id', 'category'], params = [id, album.category];
  for (const [field, column] of Object.entries(albumFields)) if (album[field] !== undefined) { columns.push(column); params.push(album[field]); }
  await query(`INSERT INTO albums (${columns}) VALUES (${columns.map((_, index) => `$${index + 1}`)})`, params);
  return getAlbum(query, { id, publicOnly: false });
}

export async function updateAlbum(query, id, patch) {
  const sets = [], params = [id];
  for (const [field, column] of Object.entries(albumFields)) if (patch[field] !== undefined) { params.push(patch[field]); sets.push(`${column} = $${params.length}`); }
  sets.push('updated_at = now()');
  const updated = await query(`UPDATE albums SET ${sets.join(', ')} WHERE id = $1 RETURNING id`, params);
  if (!updated.length) return null;
  return getAlbum(query, { id, publicOnly: false });
}

/** Removes the album and its photo rows; returns the removed photos so storage can be cleaned up. */
export async function deleteAlbum(query, id) {
  await query('UPDATE albums SET cover_photo_id = NULL WHERE id = $1', [id]);
  const photos = (await query(`DELETE FROM photos p WHERE p.album_id = $1 RETURNING ${photoColumns}`, [id])).map(toPhoto);
  const removed = await query('DELETE FROM albums WHERE id = $1 RETURNING id', [id]);
  return removed.length ? photos : null;
}

export async function listPhotos(query, { category, albumId, tag, publicOnly = true, limit = 60, offset = 0 } = {}) {
  const where = [], params = [];
  if (category) { params.push(category); where.push(`p.category = $${params.length}`); }
  if (albumId) { params.push(albumId); where.push(`p.album_id = $${params.length}`); }
  if (tag) { params.push(tag); where.push(`$${params.length} = ANY(p.tags)`); }
  if (publicOnly) where.push("p.visibility = 'public' AND (p.album_id IS NULL OR al.visibility = 'public')");
  const from = 'FROM photos p LEFT JOIN albums al ON al.id = p.album_id';
  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await query(`SELECT count(*)::int AS total ${from} ${condition}`, params);
  const order = albumId ? 'p.sort, p.uploaded_at DESC' : 'al.sort NULLS FIRST, p.album_id, p.sort, coalesce(p.taken_at, p.uploaded_at) DESC';
  const rows = await query(`SELECT ${photoColumns}, al.slug AS album_slug, al.title AS album_title
    ${from} ${condition} ORDER BY ${order}, p.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]);
  return { total, items: rows.map(toPhoto) };
}

export async function photoTags(query, { category, publicOnly = true }) {
  const rows = await query(`SELECT DISTINCT unnest(p.tags) AS tag FROM photos p LEFT JOIN albums al ON al.id = p.album_id
    WHERE p.category = $1 ${publicOnly ? "AND p.visibility = 'public' AND (p.album_id IS NULL OR al.visibility = 'public')" : ''} ORDER BY tag`, [category]);
  return rows.map(row => row.tag);
}

export async function getPhoto(query, id) {
  return toPhoto((await query(`SELECT ${photoColumns} FROM photos p WHERE p.id = $1`, [id]))[0]);
}

const photoFields = { title: 'title', caption: 'caption', alt: 'alt', tags: 'tags', credit: 'credit', sourceUrl: 'source_url', takenAt: 'taken_at', visibility: 'visibility', sort: 'sort', albumId: 'album_id' };

export async function createPhoto(query, photo) {
  const values = {
    id: photo.id, category: photo.category, album_id: photo.albumId ?? null,
    width: photo.width, height: photo.height, color: photo.color ?? null,
    key_lg: photo.keys.lg, key_md: photo.keys.md, key_thumb: photo.keys.thumb, key_original: photo.keys.original ?? null,
    original_name: photo.original?.name ?? null, original_type: photo.original?.type ?? null, original_bytes: photo.original?.bytes ?? null,
  };
  for (const [field, column] of Object.entries(photoFields)) if (photo[field] !== undefined && column !== 'album_id') values[column] = photo[field];
  // New photos go to the end of their album or category.
  if (photo.sort === undefined) {
    const [{ next }] = await query(`SELECT coalesce(max(sort), 0) + 1 AS next FROM photos WHERE ${values.album_id ? 'album_id = $1' : "category = $1 AND album_id IS NULL"}`, [values.album_id ?? values.category]);
    values.sort = next;
  }
  const columns = Object.keys(values);
  await query(`INSERT INTO photos (${columns}) VALUES (${columns.map((_, index) => `$${index + 1}`)})`, Object.values(values));
  return getPhoto(query, photo.id);
}

export async function updatePhoto(query, id, patch) {
  const sets = [], params = [id];
  for (const [field, column] of Object.entries(photoFields)) if (patch[field] !== undefined) { params.push(patch[field]); sets.push(`${column} = $${params.length}`); }
  if (!sets.length) return getPhoto(query, id);
  const rows = await query(`UPDATE photos SET ${sets.join(', ')} WHERE id = $1 RETURNING id`, params);
  return rows.length ? getPhoto(query, id) : null;
}

export async function deletePhoto(query, id) {
  return toPhoto((await query(`DELETE FROM photos p WHERE p.id = $1 RETURNING ${photoColumns}`, [id]))[0]);
}

/** Sets sort = position (1-based) for the given ids, in one statement. */
export async function reorder(query, table, ids) {
  if (!['photos', 'albums'].includes(table)) throw new Error('unknown table');
  await query(`UPDATE ${table} t SET sort = v.ord FROM unnest($1::text[]) WITH ORDINALITY AS v(id, ord) WHERE t.id = v.id`, [ids]);
}

/** Seeds the four original race samples (reference photos) when the database has no race albums yet. */
export async function seedRaceSamples(query, samples) {
  const [{ count }] = await query("SELECT count(*)::int AS count FROM albums WHERE category = 'race'");
  if (count) return 0;
  for (const [index, sample] of samples.entries()) {
    const album = await createAlbum(query, {
      category: 'race', slug: sample.slug, title: sample.title, description: sample.description,
      tags: sample.tags, visibility: 'public', sort: index + 1,
    });
    for (const [photoIndex, photo] of sample.photos.entries()) {
      await createPhoto(query, {
        id: newId(), category: 'race', albumId: album.id, width: photo.width, height: photo.height,
        keys: { lg: photo.image, md: photo.image, thumb: photo.image }, alt: photo.alt, title: sample.title,
        credit: photo.credit, sourceUrl: photo.sourceUrl, visibility: 'public', sort: photoIndex + 1,
      });
    }
  }
  return samples.length;
}
