import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, join, extname, relative } from 'node:path';
import { parseDocument, DomUtils } from 'htmlparser2';
import { chromium, expect } from '@playwright/test';
import { loadPosts } from '../../scripts/content.mjs';

const posts = await loadPosts('content/posts', { publicDirectory: 'public' });
const output = resolve('dist');
const htmlFor = path => readFile(join(output, `${path.slice(1)}/index.html`), 'utf8');
const find = (document, tag, attribute, value) => DomUtils.findAll(node => node.name === tag && node.attribs?.[attribute] === value, document.children);

test('old and new article URLs publish full content and canonical metadata without demo records', async () => {
  const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');
  for (const post of posts) {
    const canonical = `https://hangyu.blog/writing/${post.slug}`;
    assert.ok(sitemap.includes(`<loc>${canonical}</loc>`));
    for (const base of ['/writing', '/journal/posts', '/posts', '/room/journal/posts']) {
      const document = parseDocument(await htmlFor(`${base}/${post.slug}`));
      assert.ok(DomUtils.textContent(document).includes(post.title));
      assert.equal(find(document, 'link', 'rel', 'canonical')[0].attribs.href, canonical);
      assert.equal(find(document, 'meta', 'property', 'og:image')[0].attribs.content, `https://hangyu.blog${post.image}`);
      const data = JSON.parse(DomUtils.textContent(find(document, 'script', 'type', 'application/ld+json')[0]));
      assert.equal(data.headline, post.title);
      assert.equal(data.datePublished, post.publishedAt ?? `${post.date}T00:00:00+09:00`);
      assert.equal(data['@type'], 'BlogPosting');
    }
  }
  assert.ok(!sitemap.includes('/journal'));
  assert.ok(!sitemap.includes('<loc>https://hangyu.blog/room'));
  for (const path of ['/writing/rendering', '/writing/tokens', '/projects/lap-compare']) {
    await assert.rejects(stat(join(output, path, 'index.html')), { code: 'ENOENT' });
  }
  const home = await htmlFor('/');
  assert.ok(home.includes('id="circuit-path"'));
  assert.ok(home.includes('href="/room"'));
  assert.ok(!home.includes('chatgpt.site'));
  const missing = parseDocument(await readFile(join(output, '404.html'), 'utf8'));
  assert.equal(find(missing, 'meta', 'name', 'robots')[0].attribs.content, 'noindex, follow');
});

test('production preserves reading, discovery, mobile layout, no-JS content and original book mode', { timeout: 180000 }, async () => {
  const server = createServer(async (request, response) => {
    try {
      let file = resolve(output, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
      if (relative(output, file).startsWith('..')) throw new Error('Invalid path');
      try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); }
      catch { file = join(output, '404.html'); response.statusCode = 404; }
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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
    await plain.goto(base + '/writing');
    assert.equal(await plain.locator('.archive-entry').count(), posts.length);
    assert.ok(await plain.locator('body').evaluate(el => getComputedStyle(el).fontFamily.includes('Pretendard')));
    await plain.locator('.archive-entry').first().click();
    assert.equal(await plain.locator('h1').innerText(), posts[0].title);
    assert.ok(await plain.locator('article img').count() > 0);
    await plain.goto(base + '/projects');
    assert.equal(await plain.locator('.case-preview').count(), 4);
    await plain.goto(base + '/about');
    assert.ok((await plain.locator('main').innerText()).includes('직무와 경력'));
    assert.equal(await plain.locator('.profile-layout').count(), 1);
    assert.equal(await plain.locator('.profile-experience').count(), 2);

    const page = await browser.newPage();
    const errors = [], scenes = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\.glb|WorldScene/.test(request.url())) scenes.push(request.url()); });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/');
      await expect(page.locator('html')).not.toHaveClass(/page-entering/);
      await expect(page.locator('#portal')).toBeVisible();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `.local/apex-home-${width}.png` });
      await page.goto(base + '/writing');
      await expect(page.locator('.archive-entry')).toHaveCount(posts.length);
      await page.getByRole('searchbox').fill('no-matching-post-12345');
      await page.getByRole('searchbox').press('Enter');
      await expect(page.getByRole('heading', { name: '찾는 기록이 없습니다.' })).toBeVisible();
      await page.getByRole('link', { name: '전체 기록 보기' }).click();
      await expect(page.locator('.archive-entry')).toHaveCount(posts.length);
      await page.screenshot({ path: `.local/apex-writing-${width}.png` });
      await page.locator('.archive-entry').first().click();
      await expect(page.locator('h1')).toHaveText(posts[0].title);
      await page.getByRole('button', { name: '읽기 설정', exact: true }).click();
      const settings = page.getByRole('region', { name: '읽기 설정', exact: true });
      await settings.getByRole('radio', { name: '크게', exact: true }).check();
      await settings.getByRole('button', { name: '읽기 설정 닫기' }).click();
      await page.getByRole('button', { name: /^이미지 확대:/ }).first().click();
      await expect(page.getByRole('dialog', { name: '이미지 크게 보기' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      assert.ok(await page.locator('.apex-site').evaluate(el => el.scrollWidth <= el.clientWidth));
      await page.screenshot({ path: `.local/apex-article-${width}.png` });
      await page.getByRole('button', { name: '다크 모드로 변경' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await page.screenshot({ path: `.local/apex-dark-${width}.png` });
      await page.getByRole('button', { name: '라이트 모드로 변경' }).click();
    }
    await page.goto(base + '/projects/bytepet');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('BytePet');
    assert.equal(await page.locator('.related a').count(), 3);
    await page.goto(base + '/races');
    await expect(page.locator('.race-lead')).toBeVisible();
    await expect(page.locator('#race-grid .race-card')).toHaveCount(4);
    assert.deepEqual(scenes, []);
    await page.goto(base + '/posts');
    await expect(page.getByRole('dialog', { name: '글 기록' })).toBeVisible();
    assert.equal(await page.locator('.post-card').count(), posts.length);
    await page.goto(base + '/writing/no-such-post');
    await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다.' })).toBeVisible();
    assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex, follow');
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
