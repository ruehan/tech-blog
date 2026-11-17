// Admin sign-in with GitHub OAuth. Only logins listed in ADMIN_GITHUB_LOGINS become admins.
// The session is a stateless HMAC-signed cookie, so no session table is needed.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const sessionCookie = 'apex_admin';
const stateCookie = 'apex_oauth_state';
const sessionSeconds = 7 * 24 * 60 * 60;

const base64url = value => Buffer.from(value).toString('base64url');

export function parseCookies(header) {
  const cookies = {};
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

function cookie(name, value, { maxAge, secure }) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function createAuth({ clientId, clientSecret, admins, secret, fetch = globalThis.fetch, now = () => Date.now() }) {
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET은 32자 이상이어야 합니다.');
  const allowed = new Set(admins.map(login => login.trim().toLowerCase()).filter(Boolean));
  const sign = payload => createHmac('sha256', secret).update(payload).digest('base64url');

  function issue(login) {
    const payload = base64url(JSON.stringify({ login, exp: Math.floor(now() / 1000) + sessionSeconds }));
    return `${payload}.${sign(payload)}`;
  }

  function verify(token) {
    const [payload, signature] = (token ?? '').split('.');
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload)), given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (typeof session.login !== 'string' || session.exp * 1000 < now() || !allowed.has(session.login.toLowerCase())) return null;
      return { login: session.login };
    } catch { return null; }
  }

  return {
    configured: !!(clientId && clientSecret),
    /** Returns the admin for this request or null. */
    admin(request) { return verify(parseCookies(request.headers.get('cookie'))[sessionCookie]); },

    login(request) {
      const url = new URL(request.url);
      const next = safeNext(url.searchParams.get('next'));
      const state = randomBytes(16).toString('base64url');
      const authorize = new URL('https://github.com/login/oauth/authorize');
      authorize.search = new URLSearchParams({ client_id: clientId, redirect_uri: `${url.origin}/api/auth/callback`, state, allow_signup: 'false' }).toString();
      return new Response(null, { status: 302, headers: { Location: authorize.href, 'Set-Cookie': cookie(stateCookie, `${state}:${next}`, { maxAge: 600, secure: url.protocol === 'https:' }), 'Cache-Control': 'no-store' } });
    },

    async callback(request) {
      const url = new URL(request.url);
      const secure = url.protocol === 'https:';
      const [state, next = '/admin'] = (parseCookies(request.headers.get('cookie'))[stateCookie] ?? '').split(':');
      const fail = message => new Response(message, { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Set-Cookie': cookie(stateCookie, '', { maxAge: 0, secure }), 'Cache-Control': 'no-store' } });
      if (!state || state !== url.searchParams.get('state') || !url.searchParams.get('code')) return fail('로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.');
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code: url.searchParams.get('code'), redirect_uri: `${url.origin}/api/auth/callback` }),
      });
      const { access_token: accessToken } = await tokenResponse.json().catch(() => ({}));
      if (!accessToken) return fail('GitHub 인증에 실패했습니다.');
      const userResponse = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'hangyu-apex-gallery' } });
      const user = await userResponse.json().catch(() => ({}));
      if (typeof user.login !== 'string' || !allowed.has(user.login.toLowerCase())) return fail('관리자 계정이 아닙니다.');
      const headers = new Headers({ Location: next, 'Cache-Control': 'no-store' });
      headers.append('Set-Cookie', cookie(stateCookie, '', { maxAge: 0, secure }));
      headers.append('Set-Cookie', cookie(sessionCookie, issue(user.login), { maxAge: sessionSeconds, secure }));
      return new Response(null, { status: 302, headers });
    },

    logout(request) {
      const secure = new URL(request.url).protocol === 'https:';
      return new Response(null, { status: 204, headers: { 'Set-Cookie': cookie(sessionCookie, '', { maxAge: 0, secure }), 'Cache-Control': 'no-store' } });
    },
    issue,
  };
}

/** Only same-site paths are allowed after login, never another origin. */
export function safeNext(value) {
  return typeof value === 'string' && /^\/(?![/\\])[\w\-./?=&%]*$/.test(value) ? value : '/admin';
}
