import type { StoryItem } from './types';

export type MediaEvent = 'ended' | 'error' | 'waiting' | 'playing';

/**
 * What the story engine needs from a video player. The library ships one for
 * `<video>` elements (and anything shaped like one, such as Video.js 10 media
 * components) and one for Video.js 8 players.
 */
export interface MediaAdapter {
  /** Load a video item. Called when a video story becomes current. */
  load(item: StoryItem): void;
  /** Stop and hide the video, for image stories. */
  unload(): void;
  play(): Promise<unknown> | undefined | void;
  pause(): void;
  readonly currentTime: number;
  /** `NaN` or `Infinity` while unknown. */
  readonly duration: number;
  muted: boolean;
  /** Warm up the next video. Optional. */
  preload?(item: StoryItem): void;
  subscribe(listener: (event: MediaEvent, error?: unknown) => void): () => void;
  destroy(): void;
}

/** The subset of `HTMLMediaElement` used by {@link MediaElementAdapter}. */
export interface MediaElementLike extends EventTarget {
  src: string;
  currentTime: number;
  readonly duration: number;
  muted: boolean;
  readonly error?: unknown;
  play(): Promise<unknown> | undefined | void;
  pause(): void;
  load?(): void;
  setAttribute?(name: string, value: string): void;
  removeAttribute?(name: string): void;
}

const FORWARDED: MediaEvent[] = ['ended', 'error', 'waiting', 'playing'];

/**
 * Drives one or two media elements. With two (the story view's own videos),
 * the spare one loads the next video so switching is instant.
 */
export class MediaElementAdapter implements MediaAdapter {
  #active: MediaElementLike;
  #spare: MediaElementLike | undefined;
  #listeners = new Set<(event: MediaEvent, error?: unknown) => void>();
  #muted: boolean;
  #abort = new AbortController();

  constructor(primary: MediaElementLike, spare?: MediaElementLike) {
    this.#active = primary;
    this.#spare = spare;
    this.#muted = primary.muted;
    for (const el of spare ? [primary, spare] : [primary]) {
      for (const type of FORWARDED) {
        el.addEventListener(
          type,
          () => {
            if (el !== this.#active) return;
            const error = type === 'error' ? (el.error ?? new Error('Media error')) : undefined;
            for (const listener of this.#listeners) listener(type, error);
          },
          { signal: this.#abort.signal },
        );
      }
    }
    if (spare) this.#mark(spare, false);
    this.#mark(primary, true);
  }

  /** The element currently showing. */
  get element(): MediaElementLike {
    return this.#active;
  }

  get currentTime(): number {
    return this.#active.currentTime;
  }

  get duration(): number {
    return this.#active.duration;
  }

  get muted(): boolean {
    return this.#muted;
  }

  set muted(value: boolean) {
    this.#muted = value;
    this.#active.muted = value;
    if (this.#spare) this.#spare.muted = true;
  }

  load(item: StoryItem): void {
    const spare = this.#spare;
    if (spare && spare.src && sameUrl(spare.src, item.src)) {
      const previous = this.#active;
      previous.pause();
      this.#active = spare;
      this.#spare = previous;
      this.#mark(previous, false);
    } else {
      setPoster(this.#active, item.poster);
      this.#active.src = item.src;
      this.#active.load?.();
    }
    this.#active.muted = this.#muted;
    if (this.#active.currentTime > 0) this.#active.currentTime = 0;
    this.#mark(this.#active, true);
    if (item.alt) this.#active.setAttribute?.('aria-label', item.alt);
    else this.#active.removeAttribute?.('aria-label');
  }

  unload(): void {
    this.#active.pause();
    this.#mark(this.#active, false);
  }

  preload(item: StoryItem): void {
    const spare = this.#spare;
    if (!spare || (spare.src && sameUrl(spare.src, item.src))) return;
    spare.muted = true;
    setPoster(spare, item.poster);
    spare.src = item.src;
    spare.load?.();
  }

  play(): Promise<unknown> | undefined | void {
    return this.#active.play();
  }

  pause(): void {
    this.#active.pause();
  }

  subscribe(listener: (event: MediaEvent, error?: unknown) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  destroy(): void {
    this.#abort.abort();
    this.#listeners.clear();
    this.#active.pause();
  }

  #mark(el: MediaElementLike, active: boolean): void {
    if (active) el.setAttribute?.('data-active', '');
    else el.removeAttribute?.('data-active');
  }
}

function setPoster(el: MediaElementLike, poster: string | undefined): void {
  if (poster) el.setAttribute?.('poster', poster);
  else el.removeAttribute?.('poster');
}

function sameUrl(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    const base = globalThis.location?.href;
    return new URL(a, base).href === new URL(b, base).href;
  } catch {
    return false;
  }
}
