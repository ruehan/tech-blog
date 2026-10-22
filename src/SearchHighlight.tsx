import { searchRanges } from './search';

export function SearchHighlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return text;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of searchRanges(text, query)) {
    parts.push(text.slice(cursor, start), <mark key={start}>{text.slice(start, end)}</mark>);
    cursor = end;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}
