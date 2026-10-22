import posts from 'virtual:blog-posts';
import { normalizeSearch, searchTerms } from './search';
export { posts };
export type { Post } from './content-types';
export { projects, type Project } from './project-data';
export const allTags = [...new Set(posts.flatMap(post => post.tags))];
export const formatDate = (date: string) => date.replaceAll('-', '.');

export function filterPosts(tag: string, query: string) {
  const terms = searchTerms(query);
  return posts.filter(post => {
    if (tag && !post.tags.includes(tag)) return false;
    const text = normalizeSearch([
      post.title, post.description, ...post.tags,
      post.searchText,
    ].join(' '));
    return terms.every(term => text.includes(term));
  });
}
