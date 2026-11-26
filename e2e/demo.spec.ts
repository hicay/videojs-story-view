import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page, type Route, test } from '@playwright/test';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
// Playwright's Chromium has no H.264, and its WebKit has no VP9.
const clips = { webm: fixture('clip.webm'), mp4: fixture('clip.mp4') };
const photo = fixture('photo.jpg');

/** Answer range requests too; WebKit will not play media without them. */
function serve(route: Route, body: Buffer, contentType: string) {
  const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range ?? '');
  if (!range) return route.fulfill({ body, contentType, headers: { 'accept-ranges': 'bytes' } });
  const start = Number(range[1]);
  const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
  return route.fulfill({
    status: 206,
    body: body.subarray(start, end + 1),
    contentType,
    headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${body.length}` },
  });
}

test.beforeEach(async ({ page, browserName }) => {
  // Serve every remote photo and video from local fixtures, so the tests run offline.
  const [clip, type] =
    browserName === 'webkit' ? [clips.mp4, 'video/mp4'] : [clips.webm, 'video/webm'];
  await page.route(/picsum\.photos/, (route) => serve(route, photo, 'image/jpeg'));
  await page.route(/\.(mp4|m4v)$/, (route) => serve(route, clip, type));
  await page.goto('./');
  await page.locator('#hero').scrollIntoViewIfNeeded();
});

const state = (el: Locator) =>
  el.evaluate(async (node: HTMLElementTagNameMap['story-view']) => {
    await customElements.whenDefined('story-view');
    return {
    index: node.index,
    paused: node.paused,
    reasons: [...node.pauseReasons],
    progress: node.progress,
    };
  });

async function tapAt(page: Page, el: Locator, fraction: number, touch = false) {
  const box = await el.boundingBox();
  if (!box) throw new Error('not visible');
  const x = box.x + box.width * fraction;
  const y = box.y + box.height * 0.6;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test('renders the hero stories and plays them', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const hero = page.locator('#hero');
  await expect(hero.locator('.segment')).toHaveCount(5);
  await expect(hero.locator('.title')).toHaveText('Video.js');
  await expect.poll(async () => (await state(hero)).progress).toBeGreaterThan(0.1);
  expect((await state(hero)).paused).toBe(false);
  expect(errors).toEqual([]);
});

test('auto-advances when a story ends', async ({ page }) => {
  const hero = page.locator('#hero');
  // The fixture clip is 3 seconds long.
  await expect.poll(async () => (await state(hero)).index, { timeout: 10_000 }).toBe(1);
  await expect(hero.locator('.title')).toHaveText('Wolfgang Lutz');
});

test('tapping the right and left thirds navigates', async ({ page, hasTouch }) => {
  const hero = page.locator('#hero');
  await expect(hero.locator('.title')).toHaveText('Video.js');
  await tapAt(page, hero, 0.85, hasTouch);
  await expect.poll(async () => (await state(hero)).index).toBe(1);
  await tapAt(page, hero, 0.85, hasTouch);
  await expect.poll(async () => (await state(hero)).index).toBe(2);
  await tapAt(page, hero, 0.15, hasTouch);
  await expect.poll(async () => (await state(hero)).index).toBe(1);
  await tapAt(page, hero, 0.5, hasTouch);
  await expect.poll(async () => (await state(hero)).reasons).toEqual(['user']);
});

test('press and hold pauses until released', async ({ page }) => {
  const hero = page.locator('#hero');
  await expect(hero.locator('.title')).toHaveText('Video.js');
  const box = await hero.boundingBox();
  if (!box) throw new Error('not visible');
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(async () => (await state(hero)).reasons).toEqual(['hold']);
  await page.mouse.up();
  await expect.poll(async () => (await state(hero)).paused).toBe(false);
  expect((await state(hero)).index).toBe(0);
});

test('keyboard navigation', async ({ page, isMobile }) => {
  test.skip(isMobile, 'no keyboard on phones');
  const hero = page.locator('#hero');
  await expect(hero.locator('.title')).toHaveText('Video.js');
  await hero.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await state(hero)).index).toBe(1);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(hero)).reasons).toEqual(['user']);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await state(hero)).index).toBe(0);
});

test('the Video.js 8 plugin drives the player', async ({ page }) => {
  const player = page.locator('#vjs8');
  await player.scrollIntoViewIfNeeded();
  await expect(player).toHaveClass(/vjs-story-view/);
  const overlay = player.locator('.vjs-story-view-overlay');
  await expect(overlay.locator('.segment')).toHaveCount(4);
  await expect(overlay.locator('.title')).toHaveText('Sintel');
  await expect(player.locator('video')).toHaveJSProperty('paused', false);
  await expect(overlay.locator('.title')).toHaveText('Oceans', { timeout: 10_000 });
});

test('the story view drives a Video.js 10 media element', async ({ page, hasTouch }) => {
  const stories = page.locator('#v10');
  await stories.scrollIntoViewIfNeeded();
  await expect(stories.locator('.title')).toHaveText('Sintel');
  const media = page.locator('#v10-media');
  await expect(media).toHaveAttribute('src', /sintel/);
  await expect(media).toHaveJSProperty('paused', false);
  await tapAt(page, stories, 0.85, hasTouch);
  await expect(media).toHaveAttribute('src', /oceans/);
});

test('pauses stories scrolled out of view', async ({ page }) => {
  const stories = page.locator('#declarative');
  expect((await state(stories)).reasons).toContain('offscreen');
  await stories.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await state(stories)).paused).toBe(false);
});
