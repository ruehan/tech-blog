import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrangeDesk, overlaps } from '../src/desk-layout.ts';

const sizes = [{ width: 236, height: 358 }, { width: 230, height: 289 }, { width: 198, height: 236 }, { width: 230, height: 329 }];
test('free desk placements stay within the margins without collisions across seeds and sizes', () => {
  for (const width of [1232, 1392, 1872, 2512]) {
    const contentWidth = Math.min(760, width - 712);
    const content = { x: (width - contentWidth) / 2, y: 0, width: contentWidth, height: 700 };
    const unique = new Set();
    for (let seed = 0; seed < 100; seed++) {
      const layout = arrangeDesk(width, 726, content, sizes, seed)!;
      assert.ok(layout);
      unique.add(layout.items[0].x);
      assert.ok(layout.items.some(item => item.x < content.x));
      assert.ok(layout.items.some(item => item.x > content.x + content.width));
      for (const [index, item] of layout.items.entries()) {
        assert.ok(item.x >= 84 && item.x + item.width <= width);
        assert.ok(item.y >= 0 && item.y + item.height <= layout.height);
        assert.ok(!overlaps(item, { ...content, height: layout.height }, 23));
        for (const other of layout.items.slice(index + 1)) assert.ok(!overlaps(item, other, 17));
      }
      assert.deepEqual(layout, arrangeDesk(width, 726, content, sizes, seed));
    }
    assert.equal(unique.size, 100);
  }
});
test('oversized objects expand vertical space; margins too narrow return a fallback', () => {
  const content = { x: 356, y: 0, width: 680, height: 400 };
  const large = sizes.map(item => ({ ...item, height: 800 }));
  const layout = arrangeDesk(1392, 500, content, large, 15)!;
  assert.ok(layout.height > 1600);
  assert.equal(arrangeDesk(600, 700, { ...content, x: 100, width: 400 }, sizes, 2), null);
});
