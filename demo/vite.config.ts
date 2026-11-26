import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const src = (path: string) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

// The demo imports the library by its package name, straight from source.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: process.env.DEMO_BASE ?? '/videojs-story-view/',
  resolve: {
    alias: [
      { find: /^videojs-story-view\/define$/, replacement: src('define.ts') },
      { find: /^videojs-story-view\/videojs$/, replacement: src('videojs.ts') },
      { find: /^videojs-story-view\/style\.css$/, replacement: src('videojs-story-view.css') },
      { find: /^videojs-story-view$/, replacement: src('index.ts') },
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
