import { Emitter } from './emitter';
import type { MediaAdapter, MediaEvent } from './media';
import type {
  PauseReason,
  StoryEventListener,
  StoryEventType,
  StoryItem,
  StoryItemType,
} from './types';

export interface EngineOptions {
  items: StoryItem[];
  startIndex?: number;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  imageDuration?: number;
  preload?: boolean;
}

export interface Clock {
  now(): number;
  request(callback: () => void): unknown;
  cancel(handle: unknown): void;
}

export interface EngineDeps {
  media?: MediaAdapter | undefined;
  clock?: Clock;
  /** Resolves when an image is ready to show. Also used to preload. */
  loadImage?: (src: string) => Promise<unknown>;
}

const VIDEO_EXT = /\.(mp4|m4v|webm|ogv|ogg|mov|m3u8|mpd)(?:[?#]|$)/i;

/** Guess whether an item is a video or an image. */
export function itemType(item: StoryItem): StoryItemType {
  if (item.type) return item.type;
  if (item.mimeType) return item.mimeType.startsWith('image/') ? 'image' : 'video';
  return VIDEO_EXT.test(item.src) ? 'video' : 'image';
}

const defaultClock: Clock = {
  now: () => globalThis.performance?.now() ?? Date.now(),
  request: (callback) =>
    typeof globalThis.requestAnimationFrame === 'function'
      ? globalThis.requestAnimationFrame(callback)
      : globalThis.setTimeout(callback, 16),
  cancel: (handle) => {
    if (typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(handle as number);
    }
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

const imageCache = new Map<string, Promise<unknown>>();

function defaultLoadImage(src: string): Promise<unknown> {
  let pending = imageCache.get(src);
  if (!pending) {
    pending = new Promise((resolve) => {
      if (typeof Image === 'undefined') return resolve(undefined);
      const img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = () => resolve(undefined);
      img.src = src;
    });
    imageCache.set(src, pending);
    if (imageCache.size > 50) imageCache.delete(imageCache.keys().next().value as string);
  }
  return pending;
}

/** Longest gap between two frames that still counts as playback time. */
const MAX_FRAME_GAP = 250;

/**
 * The story state machine: which story is showing, how far along it is,
 * whether it is playing, and when to move on. It has no DOM of its own.
 */
export class StoryEngine {
  #items: StoryItem[];
  #index = -1;
  #reasons = new Set<PauseReason>();
  #complete = false;
  #elapsed = 0;
  #last = 0;
  #frame: unknown = null;
  #progress = 0;
  #waiting = false;
  #mediaFailed = false;
  #muted: boolean;
  #loop: boolean;
  #imageDuration: number;
  #preload: boolean;
  #token = 0;
  #destroyed = false;
  /** A `pause` event went out without a matching `resume` yet. */
  #pauseAnnounced = false;
  #media: MediaAdapter | undefined;
  #clock: Clock;
  #loadImage: (src: string) => Promise<unknown>;
  #emitter = new Emitter();
  #unsubscribeMedia: (() => void) | undefined;

  constructor(options: EngineOptions, deps: EngineDeps = {}) {
    this.#items = [...options.items];
    this.#muted = options.muted ?? true;
    this.#loop = options.loop ?? false;
    this.#imageDuration = options.imageDuration ?? 5;
    this.#preload = options.preload ?? true;
    this.#media = deps.media;
    this.#clock = deps.clock ?? defaultClock;
    this.#loadImage = deps.loadImage ?? defaultLoadImage;
    if (this.#media) {
      this.#media.muted = this.#muted;
      this.#unsubscribeMedia = this.#media.subscribe((event, error) =>
        this.#onMedia(event, error),
      );
    }
    if (options.autoplay === false) this.#reasons.add('user');
  }

  /** Show the first story. Separate from the constructor so listeners can attach first. */
  start(startIndex = 0): void {
    if (!this.#items.length) return;
    this.#show(clampIndex(startIndex, this.#items.length));
    const [reason] = this.#reasons;
    if (reason && !this.#destroyed) {
      // Starting paused (autoplay off, tab hidden...) counts as a pause.
      this.#pauseAnnounced = true;
      this.#emitter.emit('pause', { reason });
    }
  }

  get items(): readonly StoryItem[] {
    return this.#items;
  }

  get index(): number {
    return this.#index;
  }

  get item(): StoryItem | undefined {
    return this.#items[this.#index];
  }

  /** True while not playing, for any reason, including after the last story. */
  get paused(): boolean {
    return !this.#isPlaying();
  }

  /** Reasons playback is currently paused. */
  get pauseReasons(): readonly PauseReason[] {
    return [...this.#reasons];
  }

  /** True after the last story ended (without `loop`). */
  get ended(): boolean {
    return this.#complete;
  }

  /** Progress of the current story, from 0 to 1. */
  get progress(): number {
    return this.#progress;
  }

  get loop(): boolean {
    return this.#loop;
  }

  set loop(value: boolean) {
    this.#loop = value;
  }

  get muted(): boolean {
    return this.#muted;
  }

  set muted(value: boolean) {
    if (value === this.#muted) return;
    this.#muted = value;
    if (this.#media) this.#media.muted = value;
    this.#emitter.emit('mutechange', { muted: value });
  }

  on<K extends StoryEventType>(type: K, listener: StoryEventListener<K>): () => void {
    return this.#emitter.on(type, listener);
  }

  off<K extends StoryEventType>(type: K, listener: StoryEventListener<K>): void {
    this.#emitter.off(type, listener);
  }

  /** Go to the next story. On the last one, finishes (or loops). */
  next(): void {
    if (!this.#items.length || this.#complete) return;
    if (this.#index < this.#items.length - 1) this.#show(this.#index + 1);
    else this.#finishAll();
  }

  /** Go to the previous story. On the first one, starts it over. */
  prev(): void {
    if (!this.#items.length) return;
    this.#show(Math.max(0, this.#index - 1));
  }

  /** Show the story at `index`. Out-of-range values are clamped. */
  goTo(index: number): void {
    if (!this.#items.length) return;
    this.#show(clampIndex(index, this.#items.length));
  }

  /** Resume playback. After the last story ended, starts again from the first. */
  play(): void {
    if (this.#complete) {
      this.#reasons.delete('user');
      this.#reasons.delete('autoplay');
      this.#show(0);
      return;
    }
    this.#lift('user');
    this.#lift('autoplay');
  }

  /** Pause for `reason`. Pauses stack: see {@link PauseReason}. */
  pause(reason: PauseReason = 'user'): void {
    if (this.#reasons.has(reason)) return;
    const wasPlaying = this.#isPlaying();
    this.#reasons.add(reason);
    if (wasPlaying) {
      this.#stop();
      this.#pauseAnnounced = true;
      this.#emitter.emit('pause', { reason });
    }
  }

  /** Remove one pause reason. `play()` lifts `user` and `autoplay`. */
  resume(reason: PauseReason = 'user'): void {
    this.#lift(reason);
  }

  togglePlay(): void {
    if (this.paused) this.play();
    else this.pause('user');
  }

  /** Replace the stories and show `startIndex`. */
  setItems(items: StoryItem[], startIndex = 0): void {
    this.#items = [...items];
    this.#index = -1;
    this.#complete = false;
    this.#stop();
    if (this.#items.length) this.#show(clampIndex(startIndex, this.#items.length));
    else this.#media?.unload();
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#stop();
    this.#token++;
    this.#unsubscribeMedia?.();
    this.#emitter.clear();
  }

  // ---------------------------------------------------------------------------

  #isPlaying(): boolean {
    return !this.#destroyed && this.#reasons.size === 0 && !this.#complete && this.#index >= 0;
  }

  #isVideo(): boolean {
    const item = this.item;
    return !!item && !!this.#media && itemType(item) === 'video' && !this.#mediaFailed;
  }

  #lift(reason: PauseReason): void {
    if (!this.#reasons.delete(reason)) return;
    if (this.#isPlaying()) {
      this.#run();
      if (this.#pauseAnnounced) {
        this.#pauseAnnounced = false;
        this.#emitter.emit('resume', { reason });
      }
    }
  }

  #show(index: number): void {
    if (this.#destroyed) return;
    const previousIndex = this.#index;
    const item = this.#items[index];
    if (!item) return;
    this.#stop();
    const token = ++this.#token;
    this.#index = index;
    this.#complete = false;
    this.#elapsed = 0;
    this.#progress = 0;
    this.#mediaFailed = false;
    this.#waiting = false;

    if (itemType(item) === 'video' && this.#media) {
      this.#media.load(item);
    } else {
      this.#media?.unload();
      this.#waiting = true;
      this.#loadImage(itemType(item) === 'video' ? (item.poster ?? '') : item.src).then(() => {
        if (token !== this.#token) return;
        this.#waiting = false;
        if (this.#isPlaying()) this.#run();
      });
    }

    this.#emitter.emit('storychange', { index, previousIndex, item });
    this.#emitter.emit('progress', { index, progress: 0 });
    if (this.#isPlaying() && token === this.#token) this.#run();
    this.#preloadNext();
  }

  #preloadNext(): void {
    if (!this.#preload) return;
    const next = this.#items[this.#index + 1] ?? (this.#loop ? this.#items[0] : undefined);
    if (!next || next === this.item) return;
    if (itemType(next) === 'image') void this.#loadImage(next.src);
    else {
      if (next.poster) void this.#loadImage(next.poster);
      this.#media?.preload?.(next);
    }
  }

  #run(): void {
    if (this.#frame !== null) return;
    this.#last = this.#clock.now();
    if (this.#isVideo()) this.#playMedia();
    this.#frame = this.#clock.request(this.#tick);
  }

  #stop(): void {
    if (this.#frame !== null) {
      this.#clock.cancel(this.#frame);
      this.#frame = null;
    }
    if (this.#isVideo()) this.#media?.pause();
  }

  #playMedia(): void {
    const media = this.#media;
    if (!media) return;
    const token = this.#token;
    let result: Promise<unknown> | undefined | void;
    try {
      result = media.play();
    } catch (error) {
      this.#onPlayRejected(error, token);
      return;
    }
    if (result && typeof result.then === 'function') {
      result.then(undefined, (error: unknown) => this.#onPlayRejected(error, token));
    }
  }

  #onPlayRejected(error: unknown, token: number): void {
    if (token !== this.#token || !this.#isPlaying()) return;
    const name = (error as { name?: string } | null)?.name;
    if (name === 'AbortError') return;
    if (name === 'NotAllowedError') {
      if (!this.#muted) {
        // Autoplay with sound was blocked. Muted autoplay usually is not.
        this.muted = true;
        this.#playMedia();
      } else {
        this.pause('autoplay');
      }
      return;
    }
    this.#fail(error);
  }

  #fail(error: unknown): void {
    const item = this.item;
    if (!item || this.#mediaFailed) return;
    this.#mediaFailed = true;
    this.#elapsed = 0;
    this.#emitter.emit('error', { index: this.#index, item, error });
  }

  #onMedia(event: MediaEvent, error?: unknown): void {
    if (this.#destroyed || !this.item || itemType(this.item) !== 'video') return;
    switch (event) {
      case 'ended':
        if (!this.#mediaFailed) this.#finishItem();
        break;
      case 'error':
        this.#fail(error);
        break;
      case 'waiting':
        this.#emitter.emit('buffering', { buffering: true });
        break;
      case 'playing':
        this.#emitter.emit('buffering', { buffering: false });
        break;
    }
  }

  #tick = (): void => {
    this.#frame = null;
    if (!this.#isPlaying()) return;
    const now = this.#clock.now();
    const delta = Math.min(Math.max(now - this.#last, 0), MAX_FRAME_GAP) / 1000;
    this.#last = now;
    const item = this.item as StoryItem;
    let progress: number;

    if (this.#isVideo()) {
      const media = this.#media as MediaAdapter;
      const time = media.currentTime;
      const length = media.duration;
      const cap = item.duration && item.duration > 0 ? item.duration : Number.POSITIVE_INFINITY;
      const total = Math.min(cap, Number.isFinite(length) && length > 0 ? length : cap);
      progress = Number.isFinite(total) && total > 0 ? Math.min(time / total, 1) : 0;
      if (time >= cap) {
        this.#setProgress(1);
        this.#finishItem();
        return;
      }
    } else {
      if (!this.#waiting) this.#elapsed += delta;
      const total = item.duration && item.duration > 0 ? item.duration : this.#imageDuration;
      progress = total > 0 ? Math.min(this.#elapsed / total, 1) : 1;
      if (progress >= 1) {
        this.#setProgress(1);
        this.#finishItem();
        return;
      }
    }

    this.#setProgress(progress);
    this.#frame = this.#clock.request(this.#tick);
  };

  #setProgress(progress: number): void {
    if (progress === this.#progress) return;
    this.#progress = progress;
    this.#emitter.emit('progress', { index: this.#index, progress });
  }

  #finishItem(): void {
    const item = this.item;
    if (!item) return;
    this.#stop();
    this.#emitter.emit('storyend', { index: this.#index, item });
    this.next();
  }

  #finishAll(): void {
    this.#emitter.emit('complete', { loop: this.#loop });
    if (this.#loop) {
      this.#show(0);
      return;
    }
    this.#stop();
    this.#complete = true;
    this.#setProgress(1);
  }
}

function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), length - 1);
}
