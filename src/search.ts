import type { Post } from './content-types';

export const normalizeSearch = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
export const searchTerms = (query: string) => [...new Set(normalizeSearch(query).split(' ').filter(Boolean))];

// Keep original offsets while matching full-width text, ligatures and Korean graphemes.
function normalizedOffsets(text: string) {
  let value = '';
  const starts: number[] = [], ends: number[] = [];
  for (const { segment, index } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    for (const char of segment.normalize('NFKC').toLowerCase()) {
      const next = /\s/u.test(char) ? ' ' : char;
      if (next === ' ' && value.endsWith(' ')) { ends[ends.length - 1] = index + segment.length; continue; }
      value += next;
      for (let offset = 0; offset < next.length; offset++) { starts.push(index); ends.push(index + segment.length); }
    }
  }
  return { value, starts, ends };
}

export function searchRanges(text: string, query: string): [number, number][] {
  const normalized = normalizedOffsets(text);
  const ranges: [number, number][] = [];
  for (const term of searchTerms(query)) {
    let index = normalized.value.indexOf(term);
    while (index >= 0) {
      ranges.push([normalized.starts[index], normalized.ends[index + term.length - 1]]);
      index = normalized.value.indexOf(term, index + term.length);
    }
  }
  const merged: [number, number][] = [];
  for (const range of ranges.sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

export function searchPreview(post: Post, query: string) {
  const terms = searchTerms(query);
  let best: Post['searchBlocks'][number] | undefined;
  let score = 0;
  for (const block of post.searchBlocks) {
    const normalized = normalizeSearch(block.text);
    const matches = terms.filter(term => normalized.includes(term)).length;
    if (matches > score) { best = block; score = matches; }
  }
  if (!best) return { text: post.description, anchor: '' };
  const first = searchRanges(best.text, query)[0];
  const start = Math.max(0, (first?.[0] ?? 0) - 40);
  const end = Math.min(best.text.length, Math.max(start + 150, first?.[1] ?? 0));
  return { text: `${start ? '…' : ''}${best.text.slice(start, end)}${end < best.text.length ? '…' : ''}`, anchor: best.id };
}
