// Prints the size of the built files and fails if the <script> build grows
// past its budget. Run after `npm run build`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const DIST = 'dist';
const BUDGET = { 'videojs-story-view.iife.js': 10 * 1024 };

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const kb = (bytes) => `${(bytes / 1024).toFixed(2)} kB`;
let failed = false;
const rows = files(DIST)
  .filter((path) => /\.(js|css)$/.test(path))
  .sort()
  .map((path) => {
    const source = readFileSync(path);
    const gzip = gzipSync(source, { level: 9 }).length;
    const name = relative(DIST, path);
    const budget = BUDGET[name];
    if (budget && gzip > budget) failed = true;
    return {
      file: name,
      raw: kb(source.length),
      gzip: kb(gzip),
      brotli: kb(brotliCompressSync(source).length),
      budget: budget ? `${kb(budget)} gzip${gzip > budget ? ' EXCEEDED' : ''}` : '',
    };
  });

console.table(rows);
if (failed) {
  console.error('Size budget exceeded.');
  process.exit(1);
}
