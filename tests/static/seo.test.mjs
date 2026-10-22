import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, join, extname, relative } from 'node:path';
import { parseDocument, DomUtils } from 'htmlparser2';
import { chromium } from '@playwright/test';
import { loadPosts } from '../../scripts/content.mjs';

const posts = await loadPosts('content/posts', { publicDirectory: 'public' });
const imageCount = nodes => nodes.reduce((count, node) => count + (node.tag === 'img' ? 1 : 0) + imageCount(node.children ?? []), 0);

const output = resolve('dist');
const removedSlugs = ['building-a-room-on-the-web', 'making-hover-transitions-smooth', 'from-the-room-to-the-cockpit'];
const htmlFor = path => readFile(join(output, `${path.slice(1)}/index.html`), 'utf8');
const find = (document, tag, attribute, value) => DomUtils.findAll(node => node.name === tag && node.attribs?.[attribute] === value, document.children);

test('deployment publishes articles and metadata without removed sample content', async () => {
  for (const [path, text] of [['/journal', posts[0].title], ['/journal/projects', '아직 등록된 프로젝트가 없어요.'], ['/about', 'hangyu입니다.']]) {
    const document = parseDocument(await htmlFor(path));
    assert.ok(DomUtils.textContent(document).includes(text));
    assert.equal(find(document, 'link', 'rel', 'canonical')[0].attribs.href, `https://hangyu.blog${path}`);
    assert.equal(find(document, 'meta', 'property', 'og:image')[0].attribs.content, 'https://hangyu.blog/images/site/room.png');
    assert.equal(find(document, 'script', 'type', 'application/ld+json').length, 0);
  }
  for (const slug of removedSlugs) for (const base of ['journal/posts', 'posts']) {
    await assert.rejects(stat(join(output, base, slug, 'index.html')), { code: 'ENOENT' });
  }
  for (const base of ['journal/projects', 'projects']) await assert.rejects(stat(join(output, base, 'hangyu-room/index.html')), { code: 'ENOENT' });
  await assert.rejects(stat(join(output, 'images/posts/room-blog/journal.png')), { code: 'ENOENT' });
  const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');
  assert.equal((sitemap.match(/<loc>/g) ?? []).length, 4 + posts.length);
  assert.ok(!sitemap.includes('/projects/hangyu-room'));
  assert.ok(sitemap.includes('<loc>https://hangyu.blog/about</loc>'));
  for (const post of posts) {
    const canonical = `https://hangyu.blog/journal/posts/${post.slug}`;
    assert.ok(sitemap.includes(`<loc>${canonical}</loc>`));
    assert.ok(!sitemap.includes(`<loc>https://hangyu.blog/posts/${post.slug}</loc>`));
    for (const base of ['/journal/posts', '/posts']) {
      const document = parseDocument(await htmlFor(`${base}/${post.slug}`));
      assert.ok(DomUtils.textContent(document).includes(post.title));
      assert.equal(find(document, 'link', 'rel', 'canonical')[0].attribs.href, canonical);
      assert.equal(find(document, 'meta', 'property', 'og:image')[0].attribs.content, `https://hangyu.blog${post.image}`);
      const data = JSON.parse(DomUtils.textContent(find(document, 'script', 'type', 'application/ld+json')[0]));
      assert.equal(data['@type'], 'BlogPosting');
      assert.equal(data.headline, post.title);
      assert.equal(data.datePublished, post.publishedAt ?? `${post.date}T00:00:00+09:00`);
    }
  }
  const javascript = (await Promise.all((await readdir(join(output, 'assets'))).filter(name => name.endsWith('.js')).map(name => readFile(join(output, 'assets', name), 'utf8')))).join('\n');
  for (const content of [...removedSlugs, '호버가 자꾸 다시 시작되던 이유', '관심사가 놓인 방, 글이 쌓이는 블로그.', '요즘 하는 일을 담은 메모와 여백에 놓이는 책상 소품.']) assert.ok(!javascript.includes(content), `Removed content leaked: ${content}`);
  const missing = parseDocument(await readFile(join(output, '404.html'), 'utf8'));
  assert.equal(find(missing, 'meta', 'name', 'robots')[0].attribs.content, 'noindex, follow');
});

test('published articles work with and without JavaScript, including book mode and removed addresses', async () => {
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let file = resolve(output, `.${path}`);
      if (relative(output, file).startsWith('..')) throw new Error('Invalid path');
      try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); }
      catch { file = join(output, '404.html'); response.statusCode = 404; }
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
      response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
      response.end(await readFile(file));
    } catch { response.statusCode = 500; response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
    const plain = await browser.newPage({ javaScriptEnabled: false });
    await plain.goto(base + '/journal');
    assert.equal(await plain.locator('.journal-entry').count(), posts.length);
    assert.deepEqual(await plain.locator('.journal-entry h2').allTextContents(), posts.map(post => post.title));
    await plain.locator('.journal-entry').first().click();
    assert.equal(await plain.getByRole('heading', { level: 1 }).innerText(), posts[0].title);
    assert.equal(await plain.locator('article img').count(), imageCount(posts[0].body));
    await plain.getByRole('link', { name: '프로젝트', exact: true }).click();
    assert.match(await plain.locator('main').innerText(), /아직 등록된 프로젝트가 없어요/);
    await plain.getByRole('link', { name: '소개', exact: true }).click();
    assert.equal(new URL(plain.url()).pathname, '/about');
    assert.ok((await plain.locator('main').innerText()).includes('직무와 경력'));
    assert.equal(await plain.getByRole('link', { name: 'ruehan98@gmail.com', exact: true }).getAttribute('href'), 'mailto:ruehan98@gmail.com');
    assert.equal(await plain.locator('.about-project').count(), 4);
    const page = await browser.newPage();
    const errors = [], scenes = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\.glb|WorldScene/.test(request.url())) scenes.push(request.url()); });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/journal');
      await page.locator('.journal-static').waitFor({ state: 'detached' });
      assert.equal(await page.locator('.journal-entry').count(), posts.length);
      assert.equal(await page.locator('.now-note').count(), 0);
      assert.equal(await page.locator('.desk-item').count(), 3);
      assert.ok(await page.locator('.journal').evaluate(element => element.scrollWidth <= element.clientWidth));
      await page.screenshot({ path: `.local/published-journal-${width}.png` });
      await page.getByRole('searchbox').fill('no-matching-post-12345');
      await page.getByRole('searchbox').press('Enter');
      await page.getByRole('heading', { name: '아직 찾는 기록이 없어요.' }).waitFor();
      await page.getByRole('link', { name: '프로젝트', exact: true }).click();
      await page.getByRole('heading', { name: '아직 등록된 프로젝트가 없어요.' }).waitFor();
    }
    for (const path of ['/journal/posts/building-a-room-on-the-web', '/journal/projects/hangyu-room']) {
      const missing = await plain.goto(base + path);
      assert.equal(missing.status(), 404);
      await page.goto(base + path);
      await page.locator('.journal-static').waitFor({ state: 'detached' });
      await page.getByRole('heading', { name: '페이지를 찾을 수 없습니다.' }).waitFor();
      assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex, follow');
    }
    await page.goto(base + '/posts');
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.locator('.post-card').count(), posts.length);
    await page.locator('.post-card').first().click();
    await page.getByRole('heading', { level: 1, name: posts[0].title }).waitFor();
    assert.equal(await page.locator('article img').count(), imageCount(posts[0].body));
    await page.goto(base + '/projects');
    await page.getByRole('dialog').waitFor();
    await page.getByRole('heading', { name: '아직 등록된 프로젝트가 없어요.' }).waitFor();
    assert.equal(await page.locator('.project-card').count(), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(scenes, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
