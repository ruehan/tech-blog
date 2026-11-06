import { readFile } from 'node:fs/promises';
import { resolveSiteUrl } from '../site.config.mjs';
import { adaptReference, referenceRecords } from './apex-home.mjs';

export const raceRoutes = ['/races', '/races/n1', '/races/wec', '/races/tcr', '/races/f1'];

export async function apexRace(path, { origin = resolveSiteUrl(process.env.SITE_URL), posts = [], projects = [] } = {}) {
  if (!raceRoutes.includes(path)) return null;
  const name = path.split('/')[2] || 'index';
  const html = (await readFile(new URL(`../design/apex/races/${name}.html`, import.meta.url), 'utf8'))
    .replace('</head>', `<meta name="robots" content="${name === 'index' ? 'index' : 'noindex'}, follow"></head>`);
  return adaptReference(html, origin, await referenceRecords(posts, projects));
}
