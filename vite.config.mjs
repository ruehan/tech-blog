import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { relative, isAbsolute } from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadPosts } from './scripts/content.mjs';
import { resolveSiteUrl } from './site.config.mjs';
import { apexHome } from './scripts/apex-home.mjs';
import { Readable } from 'node:stream';

const moduleId = 'virtual:blog-posts';
const resolvedId = `\0${moduleId}`;

export default defineConfig(({ command, mode }) => {
  // Fixtures are available only to the dedicated test dev server, never to a build.
  const fixtures = command === 'serve' && mode === 'test';
  const root = fixtures ? './tests/fixtures/' : './';
  const directory = fileURLToPath(new URL(`${root}content/posts`, import.meta.url));
  const publicDirectory = fileURLToPath(new URL(`${root}public`, import.meta.url));
  return {
  build: { manifest: true },
  resolve: { alias: fixtures ? ['projects', 'now'].map(name => ({
    find: `../content/${name}.json`,
    replacement: fileURLToPath(new URL(`./tests/fixtures/content/${name}.json`, import.meta.url)),
  })) : [] },
  define: { 'import.meta.env.SITE_URL': JSON.stringify(resolveSiteUrl(process.env.SITE_URL || loadEnv(mode, process.cwd(), '').SITE_URL)) },
  plugins: [{
    name: 'blog-markdown',
    resolveId(id) { if (id === moduleId) return resolvedId; },
    async load(id) {
      if (id !== resolvedId) return;
      if (command === 'build') this.addWatchFile(directory);
      return `export default ${JSON.stringify(await loadPosts(directory, { includeDrafts: command === 'serve' && mode !== 'production', publicDirectory }))};`;
    },
    configureServer(server) {
      // Gallery API: same handler as the Vercel Function, backed by PGlite/disk unless real services are configured.
      let gallery;
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith('/api/')) return next();
        try {
          gallery ??= import('./server/runtime.mjs').then(async ({ developmentApi }) => {
            const api = await developmentApi({ ...process.env, ...loadEnv(mode, process.cwd(), '') }, { projectRoot: process.cwd(), memory: fixtures });
            server.config.logger.info(api.description);
            return api.handle;
          });
          const handle = await gallery;
          const origin = `http://${request.headers.host}`;
          const body = ['GET', 'HEAD'].includes(request.method) ? undefined : Readable.toWeb(request);
          const result = await handle(new Request(origin + request.url, { method: request.method, headers: request.headers, body, duplex: 'half' }));
          response.statusCode = result.status;
          result.headers.forEach((value, key) => { if (key !== 'set-cookie') response.setHeader(key, value); });
          const cookies = result.headers.getSetCookie();
          if (cookies.length) response.setHeader('Set-Cookie', cookies);
          response.end(Buffer.from(await result.arrayBuffer()));
        } catch (error) { next(error); }
      });
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split('?')[0].replace(/\/$/, '') || '/';
        if (path !== '/') return next();
        try {
          const origin = resolveSiteUrl(process.env.SITE_URL || loadEnv(mode, process.cwd(), '').SITE_URL);
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          const pagePosts = await loadPosts(directory, { includeDrafts: mode !== 'production', publicDirectory });
          const { apexProjects: pageProjects } = await server.ssrLoadModule('/src/apex-data.ts');
          response.end(await apexHome(origin, pagePosts, pageProjects));
        } catch (error) { next(error); }
      });
      if (fixtures) server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split('?')[0];
        if (!['/images/posts/room-blog/room.png', '/images/posts/room-blog/journal.png'].includes(path)) return next();
        try {
          const bytes = await readFile(new URL(`./tests/fixtures/public${path}`, import.meta.url));
          response.setHeader('Content-Type', 'image/png'); response.end(bytes);
        } catch (error) { next(error); }
      });
      server.watcher.add(directory);
      const reload = file => {
        const path = relative(directory, file);
        if (path.startsWith('..') || isAbsolute(path) || !path.endsWith('.md')) return;
        const module = server.moduleGraph.getModuleById(resolvedId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      };
      for (const event of ['add', 'change', 'unlink']) server.watcher.on(event, reload);
      server.httpServer?.once('close', () => {
        for (const event of ['add', 'change', 'unlink']) server.watcher.off(event, reload);
      });
    },
  }],
};
});
