import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePost, loadPosts } from '../scripts/content.mjs';
import { resolveSiteUrl } from '../site.config.mjs';

const source = (order: number, draft = false, title = '만드는 과정') => `---\ntitle: "글"\ndescription: "소개"\ndate: 2026-10-22\ndraft: ${draft}\nseries:\n  slug: making-room\n  title: ${title}\n  order: ${order}\n---\n## 본문\n\n기록.`;

test('series metadata rejects invalid order and conflicting definitions without exposing drafts', async () => {
  assert.throws(() => parsePost(source(0), 'invalid.md'), /series/);
  assert.throws(() => parsePost(source(1).replace('making-room', '../bad'), 'invalid.md'), /series/);
  assert.throws(() => parsePost(source(1).replace('draft: false', 'image: javascript:alert(1)'), 'invalid.md'), /image/);
  const directory = await mkdtemp(join(tmpdir(), 'room-series-'));
  try {
    await writeFile(join(directory, 'one.md'), source(1));
    await writeFile(join(directory, 'two.md'), source(2, true));
    assert.equal((await loadPosts(directory)).length, 1);
    assert.equal((await loadPosts(directory, { includeDrafts: true })).length, 2);
    await writeFile(join(directory, 'two.md'), source(1, true));
    await assert.rejects(loadPosts(directory), /시리즈 순서가 중복/);
    await writeFile(join(directory, 'two.md'), source(2, true, '다른 제목'));
    await assert.rejects(loadPosts(directory), /같은 title/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('canonical origin defaults to the approved domain and rejects paths or credentials', () => {
  assert.equal(resolveSiteUrl(), 'https://hangyu.blog');
  assert.equal(resolveSiteUrl('https://preview.example.com/'), 'https://preview.example.com');
  for (const value of ['https://example.com/blog', 'https://user:pass@example.com', 'javascript:alert(1)', 'https://example.com/?q=x']) assert.throws(() => resolveSiteUrl(value));
});
