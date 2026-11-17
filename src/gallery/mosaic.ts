// Layout for the gallery mosaic: uniform square cells, tiles of 1×1, 2×1, 1×2 or 2×2.

export type TileSize = 'one' | 'wide' | 'tall' | 'big';
/**
 * Cell size in a uniform grid: a 2×2 feature every few items, wide/tall by the photo's shape,
 * and some landscapes kept to one cell so the rhythm varies.
 */
export function tileSize(ratio: number, index: number): TileSize {
  if (index % 7 === 0) return 'big';
  if (ratio <= 0.85) return 'tall';
  if (ratio >= 1.3) return index % 3 === 2 ? 'one' : 'wide';
  return 'one';
}

const sizeSpans: Record<TileSize, [number, number]> = { one: [1, 1], wide: [2, 1], tall: [1, 2], big: [2, 2] };

/**
 * Places tiles row by row at the first free cell. A tile that would not fit there shrinks
 * (wide → one, tall → one) so the grid never leaves holes in the middle.
 */
export function packTiles(sizes: TileSize[], columns: number) {
  const taken: boolean[][] = [];
  const isTaken = (row: number, column: number) => column >= columns || !!taken[row]?.[column];
  const take = (row: number, column: number) => { (taken[row] ??= [])[column] = true; };
  let cursor = 0;
  return sizes.map(size => {
    while (isTaken(Math.floor(cursor / columns), cursor % columns)) cursor++;
    const row = Math.floor(cursor / columns), column = cursor % columns;
    let [width, height] = sizeSpans[size];
    if (width === 2 && isTaken(row, column + 1)) width = 1;
    if (height === 2 && (isTaken(row + 1, column) || (width === 2 && isTaken(row + 1, column + 1)))) height = 1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) take(row + y, column + x);
    return { row, column, width, height };
  });
}
