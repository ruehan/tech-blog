export type PostSortOrder = 'newest' | 'oldest' | 'title';

export function parsePostSort(value: string | null): PostSortOrder {
  return value === 'oldest' || value === 'title' ? value : 'newest';
}

export function sortPosts<T extends { date: string; publishedAt?: string; title: string }>(posts: readonly T[], order: PostSortOrder = 'newest'): T[] {
  const newest = [...posts].sort((a, b) => b.date.localeCompare(a.date)
    || Date.parse(b.publishedAt ?? `${b.date}T00:00:00Z`) - Date.parse(a.publishedAt ?? `${a.date}T00:00:00Z`));
  if (order === 'oldest') return newest.reverse();
  if (order === 'title') return newest.sort((a, b) => a.title.localeCompare(b.title, 'ko', { numeric: true }));
  return newest;
}

export function postSortSearch(search: string, order: PostSortOrder) {
  const query = new URLSearchParams(search);
  if (order === 'newest') query.delete('sort');
  else query.set('sort', order);
  return query.size ? `?${query}` : '';
}
