// Renders the README pictures from the real component:
//   demo.png, demo-dark.png  three story views, light and dark
//   demo.webp                a short recording of one story view
//
// Needs Google Chrome (Playwright's own Chromium cannot play H.264), ffmpeg
// and img2webp (from libwebp). Run with: npm run screenshots
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const server = await createServer({ configFile: 'demo/vite.config.ts', server: { port: 5188 } });
await server.listen();
const url = 'http://localhost:5188/videojs-story-view/hero.html';
const browser = await chromium.launch({ channel: 'chrome' });

const ready = (page) =>
  page.waitForFunction(() =>
    [...document.querySelectorAll('story-view')].every((el) => {
      const img = el.shadowRoot?.querySelector('img[data-active]');
      const video = el.shadowRoot?.querySelector('video[data-active]');
      return (img && img.complete && img.naturalWidth > 0) || (video && video.readyState >= 3);
    }),
  );

try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 720 }, colorScheme: scheme });
    await page.goto(url);
    await ready(page);
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('story-view')) el.play();
    });
    await page.waitForTimeout(3200);
    const file = scheme === 'light' ? 'demo.png' : 'demo-dark.png';
    await page.screenshot({ path: file });
    console.log(`wrote ${file}`);
    await page.close();
  }

  const dir = mkdtempSync(join(tmpdir(), 'story-view-'));
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    recordVideo: { dir, size: { width: 360, height: 640 } },
  });
  const page = await context.newPage();
  await page.goto(`${url}#single`);
  await page.waitForTimeout(13_500);
  await context.close();
  const [recording] = readdirSync(dir);
  // Skip the first second (page load), take 12 frames a second, then pack
  // them into an animated WebP.
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-ss', '1', '-t', '12', '-i', join(dir, recording),
    '-vf', 'fps=12,scale=300:-1:flags=lanczos', join(dir, 'frame-%04d.png'),
  ]);
  const frames = readdirSync(dir).filter((name) => name.startsWith('frame-')).sort();
  execFileSync('img2webp', [
    '-loop', '0', '-lossy', '-q', '65', '-d', '83',
    ...frames.map((name) => join(dir, name)), '-o', 'demo.webp',
  ]);
  rmSync(dir, { recursive: true, force: true });
  console.log('wrote demo.webp');
} finally {
  await browser.close();
  await server.close();
}
