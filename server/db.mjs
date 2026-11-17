// Database access is a single `query(text, params) → rows` function so that the same SQL
// runs on Neon in production and on PGlite (in-process Postgres) in development and tests.
import { readdir, readFile } from 'node:fs/promises';

const migrationsDirectory = new URL('../db/migrations/', import.meta.url);

/** @returns {(text: string, params?: unknown[]) => Promise<any[]>} */
export async function neonQuery(databaseUrl) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(databaseUrl);
  return (text, params = []) => sql.query(text, params);
}

/** In-process Postgres. `dataDir` persists between dev server restarts; omit it for an in-memory database. */
export async function pgliteQuery(dataDir) {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite(dataDir);
  await db.waitReady;
  const query = async (text, params = []) => (await db.query(text, params)).rows;
  query.exec = text => db.exec(text);
  query.close = () => db.close();
  return query;
}

/** Applies db/migrations/*.sql in name order, once each. */
export async function migrate(query, exec = text => query(text)) {
  await query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const applied = new Set((await query('SELECT name FROM schema_migrations')).map(row => row.name));
  const files = (await readdir(migrationsDirectory)).filter(file => file.endsWith('.sql')).sort();
  const ran = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(new URL(file, migrationsDirectory), 'utf8');
    // Multi-statement files need the simple query protocol (PGlite exec / Neon transaction of statements).
    await exec(sql);
    await query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    ran.push(file);
  }
  return ran;
}

/** Splits a migration into statements for drivers that only accept one statement per call. */
export function splitStatements(sql) {
  return sql.replace(/--[^\n]*/g, '').split(/;\s*(?:\n|$)/).map(statement => statement.trim()).filter(Boolean);
}
