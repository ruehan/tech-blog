import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compilePost, loadPosts, parsePost } from '../scripts/content.mjs';

const source = (body: string, metadata = '') => `---\ntitle: "테스트 글"\ndescription: "짧은 설명"\ndate: 2028-02-29\ntags: [React, React]\n${metadata}\n---\n${body}`;
const allNodes = (nodes: any[]): any[] => nodes.flatMap(node => [node, ...allNodes(node.children ?? [])]);

test('Markdown compiles rich blocks, stable headings, searchable code and unique IDs', () => {
  const post = compilePost(source('도입부 **강조**.\n\n## 첫 단락 {#original}\n\n### 하위 제목\n\n- 항목 `example`\n\n## 반복\n\n> 메모\n\n## 반복\n\n```typescript\nconst answer = 42;\n```\n\n![설명](/images/sample.png "캡션")\n\n| 이름 | 값 |\n| --- | --- |\n| A | B |'), 'sample.md');
  assert.equal(post.slug, 'sample');
  assert.equal(post.draft, true);
  assert.deepEqual(post.tags, ['React']);
  assert.deepEqual(post.sections.map(s => s.id), ['original', '반복', '반복-2']);
  assert.ok(post.searchText.includes('const answer = 42;'));
  const nodes = allNodes(post.body);
  assert.ok(nodes.some(n => n.type === 'code' && n.text === 'const answer = 42;'));
  assert.ok(nodes.some(n => n.attributes?.className?.includes('hljs-keyword')));
  assert.ok(nodes.some(n => n.tag === 'figcaption' && n.children[0].value === '캡션'));
  assert.ok(nodes.some(n => n.tag === 'table'));
  assert.ok(post.minutes >= 1);
});

test('invalid metadata and body structure fail with an actionable filename', () => {
  for (const [input, expected] of [
    [source('본문').replace('2028-02-29', '2027-02-29'), /sample.md: date/],
    [source('본문', 'draft: "false"'), /sample.md: draft/],
    [source('본문', 'slug: ../secret'), /sample.md: slug/],
    [source('본문', 'minutes: 0'), /sample.md: minutes/],
    [source('본문', 'drfat: true'), /sample.md: 알 수 없는 필드/],
    [source('# 제목'), /sample.md: 본문 제목/],
    [source(''), /sample.md: 본문이 비어/],
    [source('![](/missing.png)'), /sample.md: 이미지의 대체 텍스트/],
  ] as const) assert.throws(() => compilePost(input, 'sample.md'), expected);
  assert.throws(() => parsePost('본문', 'missing.md'), /missing.md: 글 맨 위/);
});

test('raw HTML and unsafe URLs cannot produce executable nodes', () => {
  const post = compilePost(source('<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[bad](javascript:alert%281%29)\n\n[good](https://example.com)\n\n```unknown\n<img onerror="alert(3)">\n```'), 'safe.md');
  const nodes = allNodes(post.body);
  assert.ok(!nodes.some(n => ['script', 'iframe', 'object'].includes(n.tag)));
  assert.ok(!nodes.some(n => Object.keys(n.attributes ?? {}).some(key => key.startsWith('on'))));
  assert.ok(!nodes.some(n => String(n.attributes?.href ?? '').startsWith('javascript:')));
  assert.ok(nodes.some(n => n.attributes?.href === 'https://example.com'));
  assert.ok(nodes.some(n => n.type === 'code' && n.text.includes('<img')));
  assert.throws(() => compilePost(source('![bad](data:image/svg+xml,test)'), 'bad.md'), /이미지 주소/);
});

test('production excludes drafts from all content and detects duplicate slugs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'room-content-'));
  try {
    await writeFile(join(directory, 'published.md'), source('공개 내용', 'draft: false'));
    await writeFile(join(directory, 'draft.md'), source('비공개 초안 문자열'));
    const published = await loadPosts(directory);
    assert.deepEqual(published.map(p => p.slug), ['published']);
    assert.ok(!JSON.stringify(published).includes('비공개 초안 문자열'));
    assert.equal((await loadPosts(directory, { includeDrafts: true })).length, 2);
    await writeFile(join(directory, 'duplicate.md'), source('본문', 'slug: published'));
    await assert.rejects(loadPosts(directory), /중복된 slug/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('isolated fixtures validate published image dimensions and draft filtering', async () => {
  const posts = await loadPosts('tests/fixtures/content/posts', { includeDrafts: true, publicDirectory: 'tests/fixtures/public' });
  assert.deepEqual(posts.map(p => p.slug), ['building-a-room-on-the-web', 'making-hover-transitions-smooth', 'from-the-room-to-the-cockpit']);
  const image = allNodes(posts[0].body).find(node => node.tag === 'img');
  assert.equal(image.attributes.width, 1440);
  assert.equal(image.attributes.height, 900);
  assert.deepEqual((await loadPosts('tests/fixtures/content/posts')).map(p => p.slug), ['building-a-room-on-the-web']);
});


test('deployment content starts empty, including drafts', async () => {
  assert.deepEqual(await loadPosts('content/posts', { includeDrafts: true, publicDirectory: 'public' }), []);
});
