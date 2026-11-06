import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { apexHome } from './apex-home.mjs';
import { apexRace, raceRoutes } from './apex-races.mjs';

const output = resolve('dist');
const serverOutput = resolve('.local/prerender');
await build({ build: { ssr: 'src/static-entry.tsx', outDir: serverOutput, emptyOutDir: true, rolldownOptions: { output: { entryFileNames: 'entry.mjs' } } }, logLevel: 'warn' });
const { staticRoutes, renderPage, pageMetadata, metadataTags, posts, apexProjects, siteUrl } = await import(pathToFileURL(join(serverOutput, 'entry.mjs')).href);
const template = await readFile(join(output, 'index.html'), 'utf8');
const manifest = JSON.parse(await readFile(join(output, '.vite/manifest.json'), 'utf8'));
function stylesFor(path) {
  const entry = /^\/(room|posts)(\/|$)/.test(path) ? 'src/legacy-main.tsx' : 'src/apex-main.tsx';
  const files = new Set();
  const visited = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) return;
    for (const child of chunk.imports ?? []) visit(child);
    for (const css of chunk.css ?? []) files.add(css);
  }
  visit(entry);
  return [...files].map(file => `<link rel="stylesheet" href="/${file}">`).join('\n');
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function documentFor(path) {
  const metadata = pageMetadata(path, posts);
  const head = `<title>${escape(metadata.title)}</title>\n` + metadataTags(metadata).map(([kind, name, value]) => `<meta ${kind}="${escape(name)}" content="${escape(value)}" data-page-meta>`).join('\n')
    + `\n<link rel="canonical" href="${escape(metadata.canonical)}" data-page-meta>`
    + (metadata.structuredData ? `\n<script type="application/ld+json" data-page-meta>${JSON.stringify(metadata.structuredData).replace(/</g, '\\u003c')}</script>` : '');
  return template.replace(/<title>[\s\S]*?<\/title>/, '').replace(/<meta\s+name="description"[^>]*>/, '')
    .replace('</head>', () => `${stylesFor(path)}\n${head}\n</head>`).replace('<div id="root"></div>', () => `<div id="root">${renderPage(path)}</div>`);
}

for (const path of staticRoutes) {
  const file = join(output, path === '/' ? 'index.html' : `${path.slice(1)}/index.html`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, path === '/' ? await apexHome(siteUrl, posts, apexProjects) : raceRoutes.includes(path) ? await apexRace(path, { origin: siteUrl, posts, projects: apexProjects }) : documentFor(path));
}
await writeFile(join(output, '404.html'), documentFor('/not-found'));
// Only canonical public pages are listed; alternate reading modes and drafts stay out.
const canonicalRoutes = staticRoutes.filter(path => path === '/' || path === '/about' || path === '/races' || path.startsWith('/writing') || path.startsWith('/projects'));
await writeFile(join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${canonicalRoutes.map(path => `<url><loc>${escape(siteUrl + path)}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile(join(output, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
console.log(`Prerendered ${staticRoutes.length} public pages, 404, sitemap and robots for ${siteUrl}.`);
