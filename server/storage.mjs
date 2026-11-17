// Object storage. Public variants and private originals live in separate buckets.
// Browsers upload directly with presigned PUT URLs, so file bytes never pass through a function.
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';

const uploadTtlSeconds = 15 * 60;
const downloadTtlSeconds = 5 * 60;

/** A key beginning with "/" is a static site asset (seeded samples), not a stored object. */
export const isStaticKey = key => key.startsWith('/');

/** Cloudflare R2 through its S3-compatible API. */
export async function r2Storage({ accountId, accessKeyId, secretAccessKey, publicBucket, privateBucket, publicUrl }) {
  const { AwsClient } = await import('aws4fetch');
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const objectUrl = (bucket, key) => `${endpoint}/${bucket === 'private' ? privateBucket : publicBucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const presign = async (bucket, key, method, ttl) => {
    const url = new URL(objectUrl(bucket, key));
    url.searchParams.set('X-Amz-Expires', String(ttl));
    return (await client.sign(new Request(url, { method }), { aws: { signQuery: true } })).url;
  };
  const base = publicUrl.replace(/\/$/, '');
  return {
    kind: 'r2',
    publicUrl: key => isStaticKey(key) ? key : `${base}/${key}`,
    presignPut: async (bucket, key, contentType) => ({ url: await presign(bucket, key, 'PUT', uploadTtlSeconds), headers: { 'Content-Type': contentType } }),
    presignGet: (bucket, key) => presign(bucket, key, 'GET', downloadTtlSeconds),
    async exists(bucket, key) {
      const response = await client.fetch(objectUrl(bucket, key), { method: 'HEAD' });
      return response.ok;
    },
    async remove(bucket, key) {
      if (isStaticKey(key)) return;
      const response = await client.fetch(objectUrl(bucket, key), { method: 'DELETE' });
      if (!response.ok && response.status !== 404) throw new Error(`R2 삭제 실패 (${response.status}): ${key}`);
    },
  };
}

/**
 * Development storage on disk, served by the API itself under /api/dev-storage/.
 * Only the Vite dev server creates it; production always uses R2.
 */
export function diskStorage({ directory, secret = 'local-dev-storage' }) {
  const root = resolve(directory);
  const sign = (bucket, key, method, expires) => createHmac('sha256', secret).update(`${method}\n${bucket}\n${key}\n${expires}`).digest('base64url');
  const pathOf = (bucket, key) => {
    const path = resolve(root, bucket, key);
    const inside = relative(root, path);
    if (inside.startsWith('..') || isAbsolute(inside) || !['public', 'private'].includes(bucket)) throw new Error('invalid key');
    return path;
  };
  const signedUrl = (bucket, key, method, ttl) => {
    const expires = Math.floor(Date.now() / 1000) + ttl;
    return `/api/dev-storage/${bucket}/${key}?expires=${expires}&signature=${sign(bucket, key, method, expires)}`;
  };
  return {
    kind: 'local',
    publicUrl: key => isStaticKey(key) ? key : `/api/dev-storage/public/${key}`,
    presignPut: async (bucket, key, contentType) => ({ url: signedUrl(bucket, key, 'PUT', uploadTtlSeconds), headers: { 'Content-Type': contentType } }),
    presignGet: async (bucket, key) => signedUrl(bucket, key, 'GET', downloadTtlSeconds),
    async exists(bucket, key) { try { await stat(pathOf(bucket, key)); return true; } catch { return false; } },
    async remove(bucket, key) { if (!isStaticKey(key)) await rm(pathOf(bucket, key), { force: true }); },
    /** Handles /api/dev-storage/<bucket>/<key>. Public objects are readable; everything else needs a signature. */
    async handle(request, bucket, key) {
      const url = new URL(request.url);
      const expires = Number(url.searchParams.get('expires'));
      const signature = url.searchParams.get('signature') ?? '';
      const signed = () => {
        const expected = Buffer.from(sign(bucket, key, request.method, expires));
        const given = Buffer.from(signature);
        return expires > Date.now() / 1000 && expected.length === given.length && timingSafeEqual(expected, given);
      };
      let path;
      try { path = pathOf(bucket, key); } catch { return new Response('Not found', { status: 404 }); }
      if (request.method === 'PUT') {
        if (!signed()) return new Response('Forbidden', { status: 403 });
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, Buffer.from(await request.arrayBuffer()));
        await writeFile(`${path}.type`, request.headers.get('content-type') ?? 'application/octet-stream');
        return new Response(null, { status: 200 });
      }
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      if (bucket !== 'public' && !signed()) return new Response('Forbidden', { status: 403 });
      try {
        const [body, type] = await Promise.all([readFile(path), readFile(`${path}.type`, 'utf8').catch(() => 'application/octet-stream')]);
        return new Response(body, { headers: { 'Content-Type': type, 'Cache-Control': 'no-cache' } });
      } catch { return new Response('Not found', { status: 404 }); }
    },
  };
}

export const storageDirectory = (projectRoot) => join(projectRoot, '.local/gallery-storage');
