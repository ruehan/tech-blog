export const defaultSiteUrl = 'https://hangyu.blog';

export function resolveSiteUrl(value = defaultSiteUrl) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SITE_URL은 경로·쿼리 없는 http(s) 도메인이어야 합니다. 예: https://hangyu.blog');
  }
  return url.origin;
}
