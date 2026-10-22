import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, join, extname, relative } from 'node:path';
import { parseDocument, DomUtils } from 'htmlparser2';
import { chromium } from '@playwright/test';

const output = resolve('dist');
const articlePath = '/journal/posts/building-a-room-on-the-web';
const htmlFor = path => readFile(join(output, `${path.slice(1)}/index.html`), 'utf8');
const find = (document, tag, attribute, value) => DomUtils.findAll(node => node.name === tag && node.attribs?.[attribute] === value, document.children);

test('built public HTML contains the article, canonical metadata and schema before JavaScript runs', async () => {
  const html = await htmlFor(articlePath);
  const document = parseDocument(html);
  assert.match(DomUtils.textContent(document), /이 블로그는 작은 방에서 시작했다/);
  assert.equal(find(document, 'meta', 'property', 'og:title')[0].attribs.content, '내 방을 웹으로 옮기는 일 — hangyu / room');
  assert.equal(find(document, 'meta', 'property', 'og:image')[0].attribs.content, 'https://hangyu.blog/images/posts/room-blog/room.png');
  assert.equal(find(document, 'link', 'rel', 'canonical')[0].attribs.href, `https://hangyu.blog${articlePath}`);
  assert.equal(find(document, 'meta', 'name', 'description').length, 1);
  const schema = JSON.parse(DomUtils.textContent(find(document, 'script', 'type', 'application/ld+json')[0]));
  assert.equal(schema['@type'], 'BlogPosting');
  assert.equal(schema.mainEntityOfPage, `https://hangyu.blog${articlePath}`);
  assert.equal(schema.isPartOf.name, '이 블로그를 만드는 과정');
  const alternate = parseDocument(await htmlFor('/posts/building-a-room-on-the-web'));
  assert.equal(find(alternate, 'link', 'rel', 'canonical')[0].attribs.href, `https://hangyu.blog${articlePath}`);
  assert.ok(!html.includes('making-hover-transitions-smooth'));
  assert.ok(!html.includes('from-the-room-to-the-cockpit'));
  await assert.rejects(stat(join(output, 'journal/posts/making-hover-transitions-smooth/index.html')), { code: 'ENOENT' });
  const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');
  assert.ok(sitemap.includes(`https://hangyu.blog${articlePath}`));
  assert.ok(!sitemap.includes('https://hangyu.blog/posts/'));
  assert.ok(!sitemap.includes('making-hover'));
  assert.match(await readFile(join(output, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/hangyu.blog\/sitemap.xml/);
  const missing = parseDocument(await readFile(join(output, '404.html'), 'utf8'));
  assert.equal(find(missing, 'meta', 'name', 'robots')[0].attribs.content, 'noindex, follow');
});

test('static deep links remain readable without JavaScript, then enhance into the working journal', async () => {
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
    await plain.goto(base + articlePath);
    assert.match(await plain.locator('.markdown-body').innerText(), /이 블로그는 작은 방에서 시작했다/);
    await plain.locator('.article-series summary').click();
    assert.equal(await plain.locator('.article-series ol a').count(), 1);
    await plain.screenshot({ path: '.local/static-article.png' });
    await plain.getByRole('link', { name: '기록 목록', exact: true }).click();
    assert.equal(await plain.locator('.journal-entry').count(), 1);
    const page = await browser.newPage();
    const errors = [], scenes = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\.glb|WorldScene/.test(request.url())) scenes.push(request.url()); });
    await page.goto(`${base}${articlePath}#scene-and-content`);
    await page.locator('.journal-static').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '읽기 설정', exact: true }).click();
    await page.getByRole('radio', { name: '크게', exact: true }).check();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.article-body').evaluate(node => getComputedStyle(node).fontSize), '19px');
    await page.getByRole('link', { name: '기록 목록', exact: true }).click();
    await page.getByRole('searchbox').fill('lerpVectors');
    await page.getByRole('searchbox').press('Enter');
    await page.locator('.journal-entry').click();
    await page.locator('[data-search-match=true]').waitFor();
    assert.match(await page.locator('[data-search-match=true]').innerText(), /lerpVectors/);
    assert.equal(await page.locator('meta[name=description]').count(), 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(scenes, []);
    const missing = await plain.goto(base + '/journal/posts/making-hover-transitions-smooth');
    assert.equal(missing.status(), 404);
    assert.match(await plain.getByRole('heading', { level: 1 }).innerText(), /찾을 수 없습니다/);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
