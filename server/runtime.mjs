// Builds the API from environment variables. Production (Vercel) requires every service;
// the dev server falls back to PGlite + disk storage + local admin when a service is not configured.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createApi } from './api.mjs';
import { createAuth } from './auth.mjs';
import { migrate, neonQuery, pgliteQuery, splitStatements } from './db.mjs';
import { seedRaceSamples } from './repo.mjs';
import { diskStorage, r2Storage, storageDirectory } from './storage.mjs';

const r2Variables = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_BUCKET', 'R2_PRIVATE_BUCKET', 'R2_PUBLIC_URL'];
const authVariables = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'ADMIN_GITHUB_LOGINS', 'SESSION_SECRET'];

export const missing = (env, names) => names.filter(name => !env[name]);

const r2From = env => r2Storage({
  accountId: env.R2_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  publicBucket: env.R2_PUBLIC_BUCKET, privateBucket: env.R2_PRIVATE_BUCKET, publicUrl: env.R2_PUBLIC_URL,
});
const authFrom = env => createAuth({
  clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET,
  admins: env.ADMIN_GITHUB_LOGINS.split(','), secret: env.SESSION_SECRET,
});

/** Vercel: every variable must be present. Missing configuration answers 503 rather than half-working. */
export async function productionApi(env = process.env) {
  const absent = missing(env, ['DATABASE_URL', ...r2Variables, ...authVariables]);
  if (absent.length) {
    console.error(`Gallery API is not configured. Missing: ${absent.join(', ')}`);
    return async () => new Response(JSON.stringify({ error: '사진첩 서버가 아직 설정되지 않았습니다.' }), { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  return createApi({ query: await neonQuery(env.DATABASE_URL), storage: await r2From(env), auth: authFrom(env) });
}

export async function seedSamples(query) {
  const samples = JSON.parse(await readFile(new URL('../db/seed/race-albums.json', import.meta.url), 'utf8'));
  return seedRaceSamples(query, samples);
}

/**
 * Dev server and browser tests.
 * - DATABASE_URL set → that database (Neon); otherwise PGlite in .local/pgdata (or memory with `memory: true`).
 * - R2 variables set → R2; otherwise files in .local/gallery-storage served by /api/dev-storage.
 * - GitHub variables set → real login; otherwise every local request is the admin.
 */
export async function developmentApi(env, { projectRoot, memory = false }) {
  const useNeon = !!env.DATABASE_URL && !memory;
  const query = useNeon ? await neonQuery(env.DATABASE_URL) : await pgliteQuery(memory ? undefined : join(projectRoot, '.local/pgdata'));
  if (!useNeon) {
    await migrate(query, query.exec);
    await seedSamples(query);
  }
  const useR2 = !memory && !missing(env, r2Variables).length;
  const useAuth = !memory && !missing(env, authVariables).length;
  const storage = useR2 ? await r2From(env) : diskStorage({ directory: memory ? join(projectRoot, '.local/gallery-storage-test') : storageDirectory(projectRoot) });
  const description = `gallery api: db=${useNeon ? 'neon' : memory ? 'pglite(memory)' : 'pglite(.local/pgdata)'}, storage=${useR2 ? 'r2' : 'local'}, admin=${useAuth ? 'github' : 'local (no login)'}`;
  return { handle: createApi({ query, storage, auth: useAuth ? authFrom(env) : undefined, devAdmin: !useAuth }), description };
}

/** Production migrations through Neon's HTTP driver, one statement per call inside a transaction. */
export async function migrateNeon(databaseUrl) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(databaseUrl);
  const query = (text, params = []) => sql.query(text, params);
  return migrate(query, text => sql.transaction(splitStatements(text).map(statement => sql.query(statement))));
}
