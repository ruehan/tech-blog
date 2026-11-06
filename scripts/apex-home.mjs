import { readFile } from 'node:fs/promises';
import { resolveSiteUrl } from '../site.config.mjs';

export function brandTemplate(html) {
  return html.replaceAll('APEX / LOG', 'HANGYU / APEX').replaceAll('APEX LOG', 'HANGYU APEX')
    .replaceAll('apex / log', 'hangyu / apex')
    .replaceAll('apex<span class="slash">/</span>log', 'hangyu<span class="slash">/</span>apex')
    .replaceAll('<span>apex</span><i>/</i><span>log</span>', '<span>hangyu</span><i>/</i><span>apex</span>')
    .replace('</head>', '<link rel="stylesheet" href="/apex/brand.css"></head>');
}

export async function referenceRecords(posts = [], projects = []) {
  const races = JSON.parse(await readFile(new URL('../design/apex/race-records.json', import.meta.url), 'utf8'));
  return [...races, ...posts.map(post => ({ id: post.slug, kind: 'dev', category: post.tags[0] || '개발 노트', title: post.title, description: post.description, tags: post.tags, url: `/writing/${post.slug}` })), ...projects.map(project => ({ id: project.slug, kind: 'project', category: '프로젝트', title: project.title, description: project.description, tags: project.tags, url: `/projects/${project.slug}` }))];
}

export function adaptReference(html, origin, records) {
  return brandTemplate(html.replaceAll('https://apex-log-rh-1105.candid-eft-1421.chatgpt.site', origin)
    .replaceAll('/assets/', '/apex/assets/')
    .replace('href="/style.css"', 'href="/apex/style.css"').replace('href="/pages.css"', 'href="/apex/pages.css"')
    .replace('<script src="/data.js" defer></script>', `<script>window.blogRecords=${JSON.stringify(records).replaceAll('<', '\\u003c')}</script>`)
    .replace('src="/app.js"', 'src="/apex/reference-app.js"').replace('src="/page-loading.js"', 'src="/apex/page-loading.js"')
    .replace('디자인 시안 · 글과 프로젝트 내용은 샘플입니다.', '개발과 레이스 사이, hangyu의 기록.'));
}

export async function apexHome(origin = resolveSiteUrl(process.env.SITE_URL), posts = [], projects = []) {
  let html = await readFile(new URL('../design/apex/home.html', import.meta.url), 'utf8');
  html = html.replace('<nav class="portal-contact" aria-label="연락처">', '<nav class="portal-contact" aria-label="연락처"><a href="/room">3D 방 <span aria-hidden="true">↗</span></a>')
    .replace('</head>', `<meta name="robots" content="index, follow"><meta property="og:title" content="HANGYU / APEX — 개발과 서킷 사이"><meta property="og:description" content="개발하고, 만들고, 배우는 과정을 기록하는 hangyu의 개인 공간."><meta property="og:type" content="website"><meta property="og:url" content="${origin}/"><meta property="og:image" content="${origin}/images/site/room.png"><meta name="twitter:card" content="summary_large_image"></head>`);
  return adaptReference(html, origin, await referenceRecords(posts, projects));
}
