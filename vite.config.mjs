import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { relative, isAbsolute } from 'node:path';
import { loadPosts } from './scripts/content.mjs';

const directory = fileURLToPath(new URL('./content/posts', import.meta.url));
const publicDirectory = fileURLToPath(new URL('./public', import.meta.url));
const moduleId = 'virtual:blog-posts';
const resolvedId = `\0${moduleId}`;

export default defineConfig(({ command, mode }) => ({
  plugins: [{
    name: 'blog-markdown',
    resolveId(id) { if (id === moduleId) return resolvedId; },
    async load(id) {
      if (id !== resolvedId) return;
      if (command === 'build') this.addWatchFile(directory);
      return `export default ${JSON.stringify(await loadPosts(directory, { includeDrafts: command === 'serve' && mode !== 'production', publicDirectory }))};`;
    },
    configureServer(server) {
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
}));
