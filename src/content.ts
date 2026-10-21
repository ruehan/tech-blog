import posts from 'virtual:blog-posts';
export { posts };
export type { Post } from './content-types';

export const project = {
  slug: 'hangyu-room', title: 'hangyu / room', subtitle: '관심사가 놓인 방, 글이 쌓이는 블로그.',
  description: '방의 오브젝트를 통해 개발 기록과 프로젝트, 음악과 심레이싱을 탐색하는 개인 공간.',
  tags: ['React', 'TypeScript', 'React Three Fiber'],
};
export const allTags = [...new Set(posts.flatMap(post => post.tags))];
export const formatDate = (date: string) => date.replaceAll('-', '.');

const normalizeSearch = (text: string) => text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
export function filterPosts(tag: string, query: string) {
  const terms = normalizeSearch(query).split(' ').filter(Boolean);
  return posts.filter(post => {
    if (tag && !post.tags.includes(tag)) return false;
    const text = normalizeSearch([
      post.title, post.description, ...post.tags,
      post.searchText,
    ].join(' '));
    return terms.every(term => text.includes(term));
  });
}
