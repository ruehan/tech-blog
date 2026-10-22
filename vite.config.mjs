import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { relative, isAbsolute } from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadPosts } from './scripts/content.mjs';
import { resolveSiteUrl } from './site.config.mjs';

const moduleId = 'virtual:blog-posts';
const resolvedId = `\0${moduleId}`;

export default defineConfig(({ command, mode }) => {
  // Fixtures are available only to the dedicated test dev server, never to a build.
  const fixtures = command === 'serve' && mode === 'test';
  const root = fixtures ? './tests/fixtures/' : './';
  const directory = fileURLToPath(new URL(`${root}content/posts`, import.meta.url));
  const publicDirectory = fileURLToPath(new URL(`${root}public`, import.meta.url));
  return {
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
