import type { MediaAdapter, MediaElementLike } from '../core/media';
import type {
  PauseReason,
  StoryEventMap,
  StoryEventType,
  StoryItem,
  StoryLabels,
  StoryViewOptions,
} from '../core/types';
import { createStoryView, type StoryView } from '../core/view';

/** Events dispatched by `<story-view>`, as `CustomEvent`s with the detail below. */
export type StoryViewElementEventMap = {
  [K in StoryEventType]: CustomEvent<StoryEventMap[K]>;
};

const EVENTS: StoryEventType[] = [
  'storychange',
  'storyend',
  'complete',
  'pause',
  'resume',
  'progress',
  'buffering',
  'mutechange',
  'error',
  'close',
];

/** Attributes that rebuild the view when they change. */
const REBUILD = [
  'autoplay',
  'image-duration',
  'start-index',
  'hold-delay',
  'swipe-to-close',
  'close-button',
  'keyboard',
  'pause-when-hidden',
  'pause-when-offscreen',
  'preload',
  'media',
];

// Lets the module be imported during server rendering, where HTMLElement does not exist.
const Base = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

/**
 * `<story-view>`: Instagram-style stories in a custom element.
 *
 * Give it stories through the `items` property, or as child `<img>` and
 * `<video>` elements, or a child `<script type="application/json">`.
 */
// The interface below adds typed addEventListener overloads to the class.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class StoryViewElement extends Base {
  static readonly observedAttributes = ['loop', 'muted', ...REBUILD];

  #view: StoryView | undefined;
  #items: StoryItem[] | undefined;
  #childItems: StoryItem[] = [];
  #labels: Partial<StoryLabels> | undefined;
  #media: MediaElementLike | MediaAdapter | null = null;
  #observer: MutationObserver | undefined;
  #queued = false;

  /** The stories. Setting this replaces any child elements as the source. */
  get items(): StoryItem[] {
    return this.#items ?? this.#childItems;
  }

  set items(items: StoryItem[]) {
    this.#items = Array.isArray(items) ? items : [];
    if (this.#view) this.#view.setItems(this.#items, 0);
    else this.#schedule();
  }

  /** Text for buttons and screen readers. */
  get labels(): Partial<StoryLabels> | undefined {
    return this.#labels;
  }

  set labels(labels: Partial<StoryLabels> | undefined) {
    this.#labels = labels;
    this.#schedule(true);
  }

  /**
   * Play videos in this element instead of the built-in ones. The `media`
   * attribute does the same with an element id.
   */
  get media(): MediaElementLike | MediaAdapter | null {
    return this.#media ?? this.#mediaFromAttribute();
  }

  set media(media: MediaElementLike | MediaAdapter | null) {
    this.#media = media;
    this.#schedule(true);
  }

  get index(): number {
    return this.#view?.index ?? this.#number('start-index', 0);
  }

  get item(): StoryItem | undefined {
    return this.#view?.item;
  }

  get paused(): boolean {
    return this.#view?.paused ?? true;
  }

  get pauseReasons(): readonly PauseReason[] {
    return this.#view?.pauseReasons ?? [];
  }

  get ended(): boolean {
    return this.#view?.ended ?? false;
  }

  get progress(): number {
    return this.#view?.progress ?? 0;
  }

  get muted(): boolean {
    return this.#view?.muted ?? this.#flag('muted', true);
  }

  set muted(value: boolean) {
    this.setAttribute('muted', String(!!value));
  }

  get loop(): boolean {
    return this.hasAttribute('loop') && this.getAttribute('loop') !== 'false';
  }

  set loop(value: boolean) {
    this.toggleAttribute('loop', !!value);
  }

  next(): void {
    this.#view?.next();
  }

  prev(): void {
    this.#view?.prev();
  }

  goTo(index: number): void {
    this.#view?.goTo(index);
  }

  play(): void {
    this.#view?.play();
  }

  pause(): void {
    this.#view?.pause();
  }

  togglePlay(): void {
    this.#view?.togglePlay();
  }

  toggleMute(): void {
    this.muted = !this.muted;
  }

  connectedCallback(): void {
    this.#childItems = readChildItems(this);
    this.#observer ??= new MutationObserver((records) => {
      // Our own attributes change all the time (data-paused and friends).
      if (this.#items || records.every((r) => r.type === 'attributes' && r.target === this)) return;
      const items = readChildItems(this);
      if (JSON.stringify(items) === JSON.stringify(this.#childItems)) return;
      this.#childItems = items;
      this.#schedule(true);
    });
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true });
    this.#schedule();
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#teardown();
  }

  attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    if (oldValue === value || !this.#view) return;
    if (name === 'muted') this.#view.muted = value !== 'false';
    else if (name === 'loop') this.#view.loop = value !== null && value !== 'false';
    else this.#schedule(true);
  }

  #schedule(rebuild = false): void {
    if (rebuild && this.#view) {
      const index = this.#view.index;
      this.#teardown();
      if (index >= 0) this.#pendingIndex = index;
    }
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      this.#queued = false;
      if (this.isConnected && !this.#view) this.#build();
    });
  }

  #pendingIndex: number | undefined;

  #build(): void {
    if (!this.#items) this.#childItems = readChildItems(this);
    const items = this.items;
    if (!items.length) return;
    const start = this.#pendingIndex ?? this.#number('start-index', 0);
    this.#pendingIndex = undefined;
    const options: StoryViewOptions & { media: MediaElementLike | MediaAdapter | null } = {
      items,
      startIndex: start,
      autoplay: this.#flag('autoplay', true),
      loop: this.loop,
      muted: this.#flag('muted', true),
      imageDuration: this.#number('image-duration', 5),
      holdDelay: this.#number('hold-delay', 200),
      swipeToClose: this.#flag('swipe-to-close', false),
      closeButton: this.#flag('close-button', false),
      keyboard: this.#flag('keyboard', true),
      pauseWhenHidden: this.#flag('pause-when-hidden', true),
      pauseWhenOffscreen: this.#flag('pause-when-offscreen', true),
      preload: this.#flag('preload', true),
      media: this.media,
    };
    if (this.#labels) options.labels = this.#labels;
    const view = createStoryView(this, options);
    this.#view = view;
    for (const type of EVENTS) {
      view.on(type, (detail) => {
        this.dispatchEvent(new CustomEvent(type, { detail }));
      });
    }
  }

  #teardown(): void {
    this.#view?.destroy();
    this.#view = undefined;
  }

  #flag(name: string, fallback: boolean): boolean {
    const value = this.getAttribute(name);
    if (value === null) return fallback;
    return value !== 'false';
  }

  #number(name: string, fallback: number): number {
    const value = Number.parseFloat(this.getAttribute(name) ?? '');
    return Number.isFinite(value) ? value : fallback;
  }

  #mediaFromAttribute(): MediaElementLike | null {
    const id = this.getAttribute('media');
    if (!id) return null;
    const root = this.getRootNode() as Document | ShadowRoot;
    return (root.getElementById?.(id) ?? document.getElementById(id)) as MediaElementLike | null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface StoryViewElement {
  addEventListener<K extends keyof StoryViewElementEventMap>(
    type: K,
    listener: (this: StoryViewElement, event: StoryViewElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof StoryViewElementEventMap>(
    type: K,
    listener: (this: StoryViewElement, event: StoryViewElementEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

function data(el: Element, name: string): string | undefined {
  return el.getAttribute(`data-${name}`) ?? undefined;
}

/** Read stories from child `<img>`, `<video>` and JSON `<script>` elements. */
export function readChildItems(parent: Element): StoryItem[] {
  const items: StoryItem[] = [];
  for (const child of Array.from(parent.children)) {
    const tag = child.localName;
    if (tag === 'script' && child.getAttribute('type') === 'application/json') {
      try {
        const parsed: unknown = JSON.parse(child.textContent ?? '');
        if (Array.isArray(parsed)) items.push(...(parsed as StoryItem[]));
      } catch {
        // Ignore invalid JSON; there is nothing sensible to show.
      }
      continue;
    }
    if (tag !== 'img' && tag !== 'video') continue;
    const source = tag === 'video' ? child.querySelector('source[src]') : null;
    const src = child.getAttribute('src') ?? source?.getAttribute('src');
    if (!src) continue;
    const item: StoryItem = { type: tag === 'img' ? 'image' : 'video', src };
    const mimeType = source?.getAttribute('type');
    if (mimeType) item.mimeType = mimeType;
    const duration = Number.parseFloat(data(child, 'duration') ?? '');
    if (Number.isFinite(duration)) item.duration = duration;
    const poster = child.getAttribute('poster');
    if (poster) item.poster = poster;
    const alt = tag === 'img' ? child.getAttribute('alt') : child.getAttribute('aria-label');
    if (alt) item.alt = alt;
    const id = child.id || data(child, 'id');
    if (id) item.id = id;
    for (const key of ['title', 'subtitle', 'avatar'] as const) {
      const value = data(child, key);
      if (value) item[key] = value;
    }
    const href = data(child, 'link');
    if (href) {
      item.link = { href };
      const label = data(child, 'link-label');
      if (label) item.link.label = label;
      const target = data(child, 'link-target');
      if (target) item.link.target = target;
    }
    items.push(item);
  }
  return items;
}
