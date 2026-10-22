import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compilePost } from '../scripts/content.mjs';
import { normalizeSearch, searchPreview, searchRanges } from '../src/search.ts';

const source = (body: string) => `---\ntitle: "React 기록"\ndescription: "소개에서 찾는 단어"\ndate: 2026-10-22\n---\n${body}`;

test('search highlighting preserves original Unicode offsets and treats punctuation literally', () => {
  const text = '앞🙂 Ｒｅａｃｔ와 ﬃ, 각 camera.position.set';
  assert.deepEqual(searchRanges(text, 'react ffi 각 camera.position.set').map(([start, end]) => text.slice(start, end)), ['Ｒｅａｃｔ', 'ﬃ', '각', 'camera.position.set']);
  assert.equal(normalizeSearch(' React\n\t CAMERA '), 'react camera');
  assert.deepEqual(searchRanges('abc abcd', 'abc abcd'), [[0, 3], [4, 8]]);
  assert.deepEqual(searchRanges('x <script> [a.*]', '[a.*]'), [[11, 16]]);
  assert.deepEqual(searchRanges('React', '  '), []);
});

test('search excerpts choose the matching body block, include code and fall back for metadata-only matches', () => {
  const post = compilePost(source('## 카메라\n\n소개 문장.\n\n```ts\ncamera.position.set(1, 2, 3);\ncamera.quaternion.identity();\n```\n\n## 다른 제목\n\n마지막 문단.'), 'sample.md');
  const preview = searchPreview(post, 'CAMERA.POSITION.SET quaternion');
  assert.match(preview.text, /camera.position.set/);
  assert.match(preview.text, /quaternion/);
  assert.equal(preview.anchor, post.body.find(node => node.type === 'code').id);
  assert.equal(searchPreview(post, '카메라').anchor, '카메라');
  assert.deepEqual(searchPreview(post, 'React'), { text: post.description, anchor: '' });
  const ids = post.searchBlocks.map(block => block.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('search anchors cannot collide with authored headings and excerpts retain a late match', () => {
  const post = compilePost(source(`## 명시한 주소 {#search-block-3}\n\n${'긴 문장 '.repeat(80)}needle 끝.`), 'sample.md');
  assert.equal(new Set(post.searchBlocks.map(block => block.id)).size, post.searchBlocks.length);
  const preview = searchPreview(post, 'needle');
  assert.ok(preview.text.startsWith('…'));
  assert.ok(preview.text.includes('needle'));
  assert.ok(preview.text.length < 180);
});
