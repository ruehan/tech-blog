declare module 'virtual:blog-posts' {
  const posts: import('./content-types').Post[];
  export default posts;
}
