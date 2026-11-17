import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packTiles, tileSize } from '../src/gallery/mosaic.ts';

const cells = (places: ReturnType<typeof packTiles>) => {
  const grid = new Map<string, number>();
  places.forEach((place, index) => {
    for (let y = 0; y < place.height; y++) for (let x = 0; x < place.width; x++) {
      const key = `${place.row + y}:${place.column + x}`;
      assert.ok(!grid.has(key), `tile ${index} overlaps at ${key}`);
      grid.set(key, index);
    }
  });
  return grid;
};

test('tile sizes vary with shape and position', () => {
  assert.equal(tileSize(1.5, 0), 'big');
  assert.equal(tileSize(0.6, 1), 'tall');
  assert.equal(tileSize(1.6, 1), 'wide');
  assert.equal(tileSize(1.6, 2), 'one');
  assert.equal(tileSize(1, 3), 'one');
});

test('packing never overlaps and leaves no holes before the last row', () => {
  for (const columns of [2, 3, 4]) {
    for (let seed = 1; seed < 40; seed++) {
      const ratios = Array.from({ length: 5 + seed % 17 }, (_, index) => [0.6, 1, 1.5, 1.8, 0.75][(seed * 7 + index * 3) % 5]);
      const places = packTiles(ratios.map((ratio, index) => tileSize(ratio, index)), columns);
      const grid = cells(places);
      assert.ok(places.every(place => place.column + place.width <= columns));
      const lastRow = Math.max(...places.map(place => place.row + place.height - 1));
      // Every row above the final occupied rows is full.
      const firstIncomplete = Array.from({ length: lastRow + 1 }, (_, row) => row).find(row => Array.from({ length: columns }, (_, column) => grid.has(`${row}:${column}`)).includes(false));
      if (firstIncomplete !== undefined) assert.ok(firstIncomplete >= lastRow - 1, `hole in row ${firstIncomplete} of ${lastRow} (columns ${columns}, seed ${seed})`);
    }
  }
});
