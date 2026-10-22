export type DeskRect = { x: number; y: number; width: number; height: number };
export type DeskSize = Pick<DeskRect, 'width' | 'height'>;

export function overlaps(a: DeskRect, b: DeskRect, gap = 0) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

// Continuous coordinates within the available margins, with collision rejection.
// A seed keeps a visit stable when the clock ticks or the index is revisited.
export function arrangeDesk(width: number, minHeight: number, content: DeskRect, sizes: DeskSize[], seed: number) {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const bands = [{ x: 84, width: content.x - 24 - 84 }, { x: content.x + content.width + 24, width: width - (content.x + content.width + 24) - 4 }];
  if (sizes.some(size => !bands.some(band => band.width >= size.width))) return null;
  for (let height = Math.max(minHeight, ...sizes.map(size => size.height)); ; height += 120) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const placed: DeskRect[] = [];
      const firstSide = random() < .5 ? 0 : 1;
      for (const [index, size] of sizes.entries()) {
        let found = false;
        for (let trial = 0; trial < 100; trial++) {
          // Prefer alternating sides, but allow either side when space is tight.
          const band = bands[trial < 70 ? (firstSide + index) % 2 : Math.floor(random() * 2)];
          if (band.width < size.width) continue;
          const rect = { ...size, x: band.x + random() * (band.width - size.width), y: random() * (height - size.height) };
          if (placed.some(other => overlaps(rect, other, 18))) continue;
          placed.push(rect); found = true; break;
        }
        if (!found) break;
      }
      if (placed.length === sizes.length) return { height, items: placed };
    }
  }
}
