import type { MediaAdapter, MediaEvent } from '../core/media';
import type { StoryItem, StoryViewOptions } from '../core/types';
import { createStoryView, type StoryView } from '../core/view';

/**
 * The parts of a Video.js 8 player the plugin uses. Typed structurally so the
 * library does not depend on Video.js types at build time.
 */
export interface VideojsPlayerLike {
  el(): Element;
  ready(callback: () => void): unknown;
  src(source?: { src: string; type?: string }): unknown;
  poster(src?: string): unknown;
  play(): Promise<unknown> | undefined;
  pause(): unknown;
  currentTime(seconds?: number): number | undefined;
  duration(): number | undefined;
  muted(muted?: boolean): boolean | undefined;
  controls(enabled?: boolean): boolean | undefined;
  playsinline?(value?: boolean): unknown;
  error?(): { message?: string } | null | undefined;
  addClass(className: string): unknown;
  removeClass(className: string): unknown;
  on(type: string | string[], listener: (...args: unknown[]) => void): unknown;
  off(type?: string | string[], listener?: (...args: unknown[]) => void): unknown;
  one(type: string | string[], listener: (...args: unknown[]) => void): unknown;
}

/** The parts of the `videojs` function the plugin uses. */
export interface VideojsLike {
  registerPlugin(name: string, plugin: (this: VideojsPlayerLike, ...args: never[]) => unknown): unknown;
  getPlugin?(name: string): unknown;
}

const VIDEO_TYPES: Record<string, string> = {
  m3u8: 'application/x-mpegURL',
  mpd: 'application/dash+xml',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mov: 'video/mp4',
  m4v: 'video/mp4',
  mp4: 'video/mp4',
};

function guessType(src: string): string | undefined {
  const match = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(src);
  return match?.[1] ? VIDEO_TYPES[match[1].toLowerCase()] : undefined;
}

const FORWARDED: MediaEvent[] = ['ended', 'error', 'waiting', 'playing'];

/** A {@link MediaAdapter} that plays stories through a Video.js 8 player. */
export function createVideojsAdapter(player: VideojsPlayerLike): MediaAdapter {
  const listeners = new Set<(event: MediaEvent, error?: unknown) => void>();
  const handlers = FORWARDED.map((type) => {
    const handler = () => {
      const error = type === 'error' ? (player.error?.() ?? new Error('Media error')) : undefined;
      for (const listener of listeners) listener(type, error);
    };
    player.on(type, handler);
    return [type, handler] as const;
  });
  let muted = !!player.muted();

  return {
    load(item: StoryItem) {
      const type = item.mimeType ?? guessType(item.src);
      player.poster(item.poster ?? '');
      player.src(type ? { src: item.src, type } : { src: item.src });
      player.muted(muted);
    },
    unload() {
      player.pause();
    },
    play: () => player.play(),
    pause() {
      player.pause();
    },
    get currentTime() {
      return player.currentTime() ?? 0;
    },
    get duration() {
      return player.duration() ?? Number.NaN;
    },
    get muted() {
      return muted;
    },
    set muted(value: boolean) {
      muted = value;
      player.muted(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      for (const [type, handler] of handlers) player.off(type, handler);
      listeners.clear();
    },
  };
}

const instances = new WeakMap<VideojsPlayerLike, StoryView>();

/** The story view attached to `player`, if any. */
export function getStoryView(player: VideojsPlayerLike): StoryView | undefined {
  return instances.get(player);
}

/**
 * Attach a story view to a Video.js 8 player. Calling it again replaces the
 * previous one. `player.storyView(options)` does the same once the plugin is
 * registered.
 */
export function attachStoryView(player: VideojsPlayerLike, options: StoryViewOptions): StoryView {
  instances.get(player)?.destroy();

  const hadControls = !!player.controls();
  player.controls(false);
  player.playsinline?.(true);
  player.addClass('vjs-story-view');

  // The overlay gets its own shadow root, so player styles and ours never mix.
  const host = document.createElement('div');
  host.className = 'vjs-story-view-overlay';
  host.style.cssText = 'position:absolute;inset:0;z-index:2;background:transparent;';
  player.el().appendChild(host);

  const view = createStoryView(host, { ...options, media: createVideojsAdapter(player) });
  const destroy = view.destroy;
  const onDispose = () => view.destroy();
  view.destroy = () => {
    destroy();
    if (instances.get(player) === view) instances.delete(player);
    player.off('dispose', onDispose);
    host.remove();
    player.removeClass('vjs-story-view');
    player.controls(hadControls);
  };
  player.one('dispose', onDispose);
  instances.set(player, view);
  return view;
}

/**
 * Register the `storyView` plugin with Video.js 8:
 *
 * ```js
 * import videojs from 'video.js';
 * import { registerStoryView } from 'videojs-story-view/videojs';
 *
 * registerStoryView(videojs);
 * const stories = videojs('my-player').storyView({ items });
 * ```
 */
export function registerStoryView(videojs: VideojsLike, name = 'storyView'): void {
  if (videojs.getPlugin?.(name)) return;
  videojs.registerPlugin(name, function storyView(this: VideojsPlayerLike, options: StoryViewOptions) {
    return attachStoryView(this, options);
  });
}

