import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attachStoryView,
  getStoryView,
  registerStoryView,
  type VideojsLike,
  type VideojsPlayerLike,
} from '../src/videojs/plugin';

type Handler = (...args: unknown[]) => void;

function fakePlayer() {
  const el = document.createElement('div');
  document.body.append(el);
  const handlers = new Map<string, Set<Handler>>();
  const state = { src: undefined as unknown, poster: '', muted: false, controls: true, time: 0, classes: new Set<string>() };
  const player = {
    el: () => el,
    ready: (cb: () => void) => cb(),
    src: vi.fn((source?: unknown) => {
      if (source) state.src = source;
      return undefined;
    }),
    poster: vi.fn((src?: string) => {
      if (src !== undefined) state.poster = src;
      return state.poster;
    }),
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    currentTime: () => state.time,
    duration: () => 10,
    muted: (value?: boolean) => {
      if (value !== undefined) state.muted = value;
      return state.muted;
    },
    controls: (value?: boolean) => {
      if (value !== undefined) state.controls = value;
      return state.controls;
    },
    playsinline: vi.fn(),
    addClass: (c: string) => state.classes.add(c),
    removeClass: (c: string) => state.classes.delete(c),
    on: (type: string | string[], fn: Handler) => {
      for (const t of [type].flat()) {
        if (!handlers.has(t)) handlers.set(t, new Set());
        handlers.get(t)?.add(fn);
      }
    },
    off: (type?: string | string[], fn?: Handler) => {
      for (const t of [type ?? []].flat()) if (fn) handlers.get(t)?.delete(fn);
    },
    one: (type: string | string[], fn: Handler) => {
      const once: Handler = (...args) => {
        player.off(type, once);
        fn(...args);
      };
      player.on(type, once);
    },
    trigger: (type: string) => {
      for (const fn of [...(handlers.get(type) ?? [])]) fn();
    },
  };
  return { player: player as typeof player & VideojsPlayerLike, state, handlers };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Video.js 8 plugin', () => {
  it('registers once under storyView', async () => {
    const plugins = new Map<string, unknown>();
    const videojs: VideojsLike = {
      registerPlugin: vi.fn((name, fn) => plugins.set(name, fn)),
      getPlugin: (name) => plugins.get(name),
    };
    registerStoryView(videojs);
    registerStoryView(videojs);
    expect(videojs.registerPlugin).toHaveBeenCalledTimes(1);
    expect(plugins.has('storyView')).toBe(true);
  });

  it('plays stories through the player', async () => {
    const { player, state } = fakePlayer();
    const view = attachStoryView(player, {
      items: [{ src: 'https://example.com/a.m3u8', poster: 'p.jpg' }, { src: 'b.jpg' }],
    });
    await Promise.resolve();
    expect(state.src).toEqual({ src: 'https://example.com/a.m3u8', type: 'application/x-mpegURL' });
    expect(state.poster).toBe('p.jpg');
    expect(state.controls).toBe(false);
    expect(state.muted).toBe(true);
    expect(player.playsinline).toHaveBeenCalledWith(true);
    expect(player.play).toHaveBeenCalled();
    expect(state.classes.has('vjs-story-view')).toBe(true);
    expect(player.el().querySelector('.vjs-story-view-overlay')).not.toBeNull();
    expect(getStoryView(player)).toBe(view);
  });

  it('advances when the player ends', async () => {
    const { player } = fakePlayer();
    const view = attachStoryView(player, { items: [{ src: 'a.mp4' }, { src: 'b.mp4' }] });
    await Promise.resolve();
    player.trigger('ended');
    expect(view.index).toBe(1);
  });

  it('replaces an earlier story view and cleans up on dispose', async () => {
    const { player, state, handlers } = fakePlayer();
    const first = attachStoryView(player, { items: [{ src: 'a.mp4' }] });
    const second = attachStoryView(player, { items: [{ src: 'b.mp4' }] });
    expect(first).not.toBe(second);
    expect(player.el().querySelectorAll('.vjs-story-view-overlay')).toHaveLength(1);
    player.trigger('dispose');
    expect(player.el().querySelector('.vjs-story-view-overlay')).toBeNull();
    expect(state.controls).toBe(true);
    expect(state.classes.has('vjs-story-view')).toBe(false);
    expect(getStoryView(player)).toBeUndefined();
    expect(handlers.get('ended')?.size ?? 0).toBe(0);
  });
});
