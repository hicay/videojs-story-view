import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { itemType, StoryEngine } from '../src/core/engine';
import type { StoryItem } from '../src/core/types';
import { advance, FakeMedia, images, instantImages, useFakeClock } from './helpers';

function engine(items: StoryItem[], options: Partial<ConstructorParameters<typeof StoryEngine>[0]> = {}, media?: FakeMedia) {
  return new StoryEngine({ items, ...options }, { media, loadImage: instantImages });
}

beforeEach(useFakeClock);
afterEach(() => {
  vi.useRealTimers();
});

describe('itemType', () => {
  it('guesses from the extension, mime type or explicit type', () => {
    expect(itemType({ src: 'a.mp4' })).toBe('video');
    expect(itemType({ src: 'a.m3u8?token=1' })).toBe('video');
    expect(itemType({ src: 'a.jpg' })).toBe('image');
    expect(itemType({ src: 'https://cdn/x', mimeType: 'video/mp4' })).toBe('video');
    expect(itemType({ src: 'https://cdn/x', mimeType: 'image/png' })).toBe('image');
    expect(itemType({ src: 'a.mp4', type: 'image' })).toBe('image');
  });
});

describe('StoryEngine timing', () => {
  it('advances images after imageDuration and fires events in order', async () => {
    const e = engine(images(2), { imageDuration: 2 });
    const log: string[] = [];
    e.on('storychange', ({ index, previousIndex }) => log.push(`change ${previousIndex}->${index}`));
    e.on('storyend', ({ index }) => log.push(`end ${index}`));
    e.on('complete', () => log.push('complete'));
    e.start();

    await advance(1000);
    expect(e.index).toBe(0);
    expect(e.progress).toBeGreaterThan(0.4);
    expect(e.progress).toBeLessThan(0.6);

    await advance(1100);
    expect(e.index).toBe(1);
    await advance(2100);
    expect(log).toEqual(['change -1->0', 'end 0', 'change 0->1', 'end 1', 'complete']);
    expect(e.ended).toBe(true);
    expect(e.paused).toBe(true);
    expect(e.progress).toBe(1);
  });

  it('uses an item duration over imageDuration', async () => {
    const e = engine([{ src: 'a.jpg', duration: 1 }, { src: 'b.jpg' }], { imageDuration: 10 });
    e.start();
    await advance(1100);
    expect(e.index).toBe(1);
  });

  it('waits for the image to load before counting', async () => {
    const pending = new Map<string, () => void>();
    const e = new StoryEngine(
      { items: images(2), imageDuration: 1 },
      { loadImage: (src) => new Promise<void>((resolve) => pending.set(src, resolve)) },
    );
    e.start();
    await advance(3000);
    expect(e.index).toBe(0);
    expect(e.progress).toBe(0);
    pending.get('https://example.com/0.jpg')?.();
    await advance(1100);
    expect(e.index).toBe(1);
  });

  it('loops back to the first story', async () => {
    const e = engine(images(2), { imageDuration: 1, loop: true });
    const complete = vi.fn();
    e.on('complete', complete);
    e.start();
    await advance(2200);
    expect(complete).toHaveBeenCalledWith({ loop: true });
    expect(e.index).toBe(0);
    expect(e.ended).toBe(false);
  });

  it('does not count time while paused', async () => {
    const e = engine(images(2), { imageDuration: 2 });
    e.start();
    await advance(1000);
    e.pause();
    await advance(5000);
    expect(e.index).toBe(0);
    e.play();
    await advance(1100);
    expect(e.index).toBe(1);
  });

  it('starts paused with autoplay: false', async () => {
    const e = engine(images(2), { autoplay: false, imageDuration: 1 });
    e.start();
    await advance(3000);
    expect(e.index).toBe(0);
    expect(e.paused).toBe(true);
    expect(e.pauseReasons).toEqual(['user']);
  });
});

describe('StoryEngine navigation', () => {
  it('next, prev and goTo', () => {
    const e = engine(images(3));
    e.start(1);
    expect(e.index).toBe(1);
    e.next();
    expect(e.index).toBe(2);
    e.prev();
    e.prev();
    expect(e.index).toBe(0);
    e.prev();
    expect(e.index).toBe(0);
    e.goTo(99);
    expect(e.index).toBe(2);
    e.goTo(-5);
    expect(e.index).toBe(0);
  });

  it('prev on the first story restarts it', async () => {
    const e = engine(images(2), { imageDuration: 2 });
    const change = vi.fn();
    e.on('storychange', change);
    e.start();
    await advance(1000);
    e.prev();
    expect(e.index).toBe(0);
    expect(e.progress).toBe(0);
    expect(change).toHaveBeenCalledTimes(2);
  });

  it('next on the last story completes; play() then starts over', () => {
    const e = engine(images(2));
    const complete = vi.fn();
    e.on('complete', complete);
    e.start(1);
    e.next();
    e.next();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(e.ended).toBe(true);
    e.play();
    expect(e.index).toBe(0);
    expect(e.ended).toBe(false);
    expect(e.paused).toBe(false);
  });

  it('setItems replaces the stories', () => {
    const e = engine(images(2));
    e.start(1);
    e.setItems(images(5), 3);
    expect(e.items).toHaveLength(5);
    expect(e.index).toBe(3);
  });

  it('ignores calls with no items', () => {
    const e = engine([]);
    e.start();
    e.next();
    e.prev();
    e.goTo(2);
    expect(e.index).toBe(-1);
  });
});

describe('StoryEngine pause reasons', () => {
  it('stacks reasons and resumes only when all are lifted', () => {
    const e = engine(images(2));
    const events: string[] = [];
    e.on('pause', ({ reason }) => events.push(`pause:${reason}`));
    e.on('resume', ({ reason }) => events.push(`resume:${reason}`));
    e.start();
    e.pause('hidden');
    e.pause('user');
    e.resume('hidden');
    expect(e.paused).toBe(true);
    e.play();
    expect(e.paused).toBe(false);
    expect(events).toEqual(['pause:hidden', 'resume:user']);
  });

  it('reports starting paused as a pause, so events pair up', () => {
    const e = engine(images(2));
    const events: string[] = [];
    e.on('pause', ({ reason }) => events.push(`pause:${reason}`));
    e.on('resume', ({ reason }) => events.push(`resume:${reason}`));
    e.pause('offscreen');
    e.start();
    e.resume('offscreen');
    expect(e.paused).toBe(false);
    expect(events).toEqual(['pause:offscreen', 'resume:offscreen']);
  });

  it('togglePlay flips between playing and paused', () => {
    const e = engine(images(2));
    e.start();
    e.togglePlay();
    expect(e.paused).toBe(true);
    e.togglePlay();
    expect(e.paused).toBe(false);
  });
});

describe('StoryEngine with video', () => {
  const clips: StoryItem[] = [
    { src: 'a.mp4', poster: 'a.jpg' },
    { src: 'b.jpg' },
    { src: 'c.mp4', duration: 3 },
  ];

  it('loads and plays videos, and follows their time', async () => {
    const media = new FakeMedia();
    const e = engine(clips, {}, media);
    e.start();
    expect(media.loaded[0]?.src).toBe('a.mp4');
    expect(media.playing).toBe(true);
    media.currentTime = 5;
    await advance(20);
    expect(e.progress).toBeCloseTo(0.5);
    media.emit('ended');
    expect(e.index).toBe(1);
    expect(media.playing).toBe(false);
  });

  it('caps a video at its duration', async () => {
    const media = new FakeMedia();
    const e = engine(clips, {}, media);
    e.start(2);
    media.currentTime = 1.5;
    await advance(20);
    expect(e.progress).toBeCloseTo(0.5);
    media.currentTime = 3.01;
    await advance(20);
    expect(e.ended).toBe(true);
  });

  it('preloads the next video', () => {
    const media = new FakeMedia();
    const e = engine(clips, {}, media);
    e.start(1);
    expect(media.preload).toHaveBeenCalledWith(clips[2]);
  });

  it('pauses the video while paused', () => {
    const media = new FakeMedia();
    const e = engine(clips, {}, media);
    e.start();
    e.pause('hold');
    expect(media.playing).toBe(false);
    e.resume('hold');
    expect(media.playing).toBe(true);
  });

  it('mutes and retries when autoplay with sound is blocked', async () => {
    const media = new FakeMedia();
    let calls = 0;
    media.playResult = () =>
      ++calls === 1 ? Promise.reject(new DOMException('blocked', 'NotAllowedError')) : Promise.resolve();
    const e = engine(clips, { muted: false }, media);
    const mute = vi.fn();
    e.on('mutechange', mute);
    e.start();
    await advance(0);
    expect(mute).toHaveBeenCalledWith({ muted: true });
    expect(calls).toBe(2);
    expect(e.paused).toBe(false);
  });

  it('pauses with reason "autoplay" when even muted autoplay is blocked', async () => {
    const media = new FakeMedia();
    media.playResult = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    const e = engine(clips, {}, media);
    e.start();
    await advance(0);
    expect(e.pauseReasons).toEqual(['autoplay']);
    e.play();
    expect(e.pauseReasons).toEqual([]);
  });

  it('falls back to a timed story when the video fails', async () => {
    const media = new FakeMedia();
    const e = engine(clips, { imageDuration: 1 }, media);
    const error = vi.fn();
    e.on('error', error);
    e.start();
    media.emit('error', new Error('404'));
    expect(error).toHaveBeenCalledOnce();
    await advance(1100);
    expect(e.index).toBe(1);
  });

  it('sets mute on the media', () => {
    const media = new FakeMedia();
    const e = engine(clips, { muted: false }, media);
    expect(media.muted).toBe(false);
    e.muted = true;
    expect(media.muted).toBe(true);
  });

  it('stops everything on destroy', async () => {
    const media = new FakeMedia();
    const e = engine(clips, {}, media);
    const change = vi.fn();
    e.on('storychange', change);
    e.start();
    e.destroy();
    media.emit('ended');
    await advance(10_000);
    expect(change).toHaveBeenCalledTimes(1);
    expect(media.playing).toBe(false);
  });
});
