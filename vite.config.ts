import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// `vite build` makes the ES modules for bundlers; `vite build --mode iife`
// makes the single minified file for <script> tags and CDNs.
export default defineConfig(({ mode }) => {
  const iife = mode === 'iife';
  return {
    build: {
      emptyOutDir: !iife,
      target: 'es2022',
      // ES modules stay readable (your bundler minifies them), but the CSS
      // inlined into them is minified either way.
      minify: iife,
      cssMinify: true,
      sourcemap: true,
      rolldownOptions: { output: { chunkFileNames: 'chunks/[name].js' } },
      lib: iife
        ? {
            entry: 'src/cdn.ts',
            name: 'VideojsStoryView',
            formats: ['iife'],
            fileName: () => 'videojs-story-view.iife.js',
          }
        : {
            entry: {
              index: 'src/index.ts',
              define: 'src/define.ts',
              videojs: 'src/videojs.ts',
            },
            formats: ['es'],
          },
    },
    plugins: [
      {
        name: 'copy-css',
        apply: 'build',
        generateBundle() {
          if (iife) return;
          this.emitFile({
            type: 'asset',
            fileName: 'videojs-story-view.css',
            source: readFileSync('src/videojs-story-view.css', 'utf8'),
          });
        },
      },
    ],
  };
});
