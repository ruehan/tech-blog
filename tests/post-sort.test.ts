import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePostSort, postSortSearch, sortPosts } from '../src/post-sort.ts';
import { loadPosts, parsePost } from '../scripts/content.mjs';

const samples = [
  { title: '나중 글', date: '2026-10-22', publishedAt: '2026-10-22T08:00:00Z' },
  { title: '가장 먼저 쓴 글', date: '2026-10-21' },
  { title: '다른 글', date: '2026-10-22', publishedAt: '2026-10-22T07:00:00Z' },
];
test('date and publication time determine chronological order without mutating input', () => {
  const original = [...samples];
  assert.deepEqual(sortPosts(samples), [samples[0], samples[2], samples[1]]);
  assert.deepEqual(sortPosts(samples, 'oldest'), [samples[1], samples[2], samples[0]]);
  assert.deepEqual(sortPosts(samples, 'title'), [samples[1], samples[0], samples[2]]);
  assert.deepEqual(samples, original);
});
test('sort URLs keep search and tags and omit the default', () => {
  const params = new URLSearchParams(postSortSearch('?tag=React&q=카메라', 'oldest'));
  assert.equal(params.get('q'), '카메라');
  assert.equal(params.get('tag'), 'React');
  assert.equal(params.get('sort'), 'oldest');
  assert.equal(postSortSearch('?sort=title', 'newest'), '');
  assert.equal(parsePostSort('unknown'), 'newest');
  assert.equal(parsePostSort(null), 'newest');
});
test('build ordering matches the reader and rejects invalid publication timestamps', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'post-sort-'));
  const source = (post: typeof samples[number]) => `---\ntitle: ${post.title}\ndescription: 설명\ndate: ${post.date}\ndraft: false\n${post.publishedAt ? `publishedAt: ${post.publishedAt}\n` : ''}---\n본문`;
  try {
    for (const [index, post] of samples.entries()) await writeFile(join(directory, `${index}.md`), source(post));
    const posts = await loadPosts(directory);
    assert.deepEqual(posts.map(post => post.title), sortPosts(samples).map(post => post.title));
    for (const invalid of ['2026-02-30T08:00:00Z', '2026-10-22T25:00:00Z', '2026-10-22', 'yesterday']) {
      assert.throws(() => parsePost(source({ ...samples[0], publishedAt: invalid }), 'invalid.md'), /publishedAt/);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
