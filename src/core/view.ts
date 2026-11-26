import css from '../styles/story-view.css?inline';
import { Emitter } from './emitter';
import { type EngineDeps, itemType, StoryEngine } from './engine';
import { type MediaAdapter, MediaElementAdapter, type MediaElementLike } from './media';
import {
  DEFAULT_LABELS,
  type PauseReason,
  type StoryEventListener,
  type StoryEventType,
  type StoryItem,
  type StoryLabels,
  type StoryViewOptions,
} from './types';

export interface StoryViewInit extends StoryViewOptions {
  /**
   * Play videos in this element instead of the story view's own. Pass a
   * `<video>`, anything with the same API (such as a Video.js 10 media
   * component), or a {@link MediaAdapter}.
   */
  media?: MediaElementLike | MediaAdapter | null | undefined;
}

/** A mounted story view. Returned by `createStoryView` and `player.storyView()`. */
export interface StoryView {
  /** The element the story view renders into. */
  readonly host: HTMLElement;
  readonly items: readonly StoryItem[];
  /** Index of the current story. */
  readonly index: number;
  /** The current story. */
  readonly item: StoryItem | undefined;
  /** True while not playing, for any reason. */
  readonly paused: boolean;
  /** Why playback is paused, if it is. */
  readonly pauseReasons: readonly PauseReason[];
  /** True after the last story ended (without `loop`). */
  readonly ended: boolean;
  /** Progress of the current story, from 0 to 1. */
  readonly progress: number;
  muted: boolean;
  loop: boolean;
  next(): void;
  prev(): void;
  goTo(index: number): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  toggleMute(): void;
  /** Replace the stories and show `startIndex` (default 0). */
  setItems(items: StoryItem[], startIndex?: number): void;
  on<K extends StoryEventType>(type: K, listener: StoryEventListener<K>): () => void;
  off<K extends StoryEventType>(type: K, listener: StoryEventListener<K>): void;
  /** Stop playback, remove listeners and clear the rendered UI. */
  destroy(): void;
}

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
const stroke = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"';
const ICONS = {
  pause: svg('<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>'),
  play: svg('<path d="M8 5.6v12.8a.6.6 0 0 0 .92.5l9.85-6.4a.6.6 0 0 0 0-1L8.92 5.1A.6.6 0 0 0 8 5.6z"/>'),
  sound: svg(`<path d="M3.5 9h4l5-4.5v15l-5-4.5h-4z"/><path ${stroke} d="M16 8.8a4.5 4.5 0 0 1 0 6.4M18.6 6.2a8.2 8.2 0 0 1 0 11.6"/>`),
  muted: svg(`<path d="M3.5 9h4l5-4.5v15l-5-4.5h-4z"/><path ${stroke} d="m16 9.5 5 5m0-5-5 5"/>`),
  close: svg(`<path ${stroke} stroke-width="2.2" d="M6 6l12 12M18 6 6 18"/>`),
};

const TEMPLATE = `<div class="root" part="root">
<div class="stage" part="stage"><img class="image" part="image" alt="" decoding="async"></div>
<div class="shade top" aria-hidden="true"></div><div class="shade bottom" aria-hidden="true"></div>
<div class="zones" part="zones">
<button type="button" class="zone prev" part="zone zone-prev" tabindex="-1"></button>
<button type="button" class="zone toggle" part="zone zone-toggle" tabindex="-1"></button>
<button type="button" class="zone next" part="zone zone-next" tabindex="-1"></button>
</div>
<div class="spinner" part="spinner" aria-hidden="true"></div>
<div class="top" part="top">
<div class="segments" part="progress" aria-hidden="true"></div>
<div class="bar">
<div class="header" part="header"><img class="avatar" part="avatar" alt=""><div class="titles"><span class="title" part="title"></span><span class="subtitle" part="subtitle"></span></div></div>
<div class="actions" part="actions">
<button type="button" class="icon pause" part="button pause-button"></button>
<button type="button" class="icon mute" part="button mute-button"></button>
<button type="button" class="icon close" part="button close-button" hidden></button>
</div></div></div>
<a class="cta" part="cta" rel="noopener noreferrer" hidden></a>
<div class="sr-only" aria-live="polite" aria-atomic="true"></div>
</div>`;

let sharedSheet: CSSStyleSheet | undefined;

function adoptStyles(root: ShadowRoot): void {
  try {
    if (!sharedSheet) {
      sharedSheet = new CSSStyleSheet();
      sharedSheet.replaceSync(css);
    }
    const sheet = sharedSheet;
    root.adoptedStyleSheets = [...root.adoptedStyleSheets.filter((s) => s !== sheet), sheet];
    return;
  } catch {
    // Constructable stylesheets are not available; use a <style> element.
  }
  const style = document.createElement('style');
  style.textContent = css;
  root.prepend(style);
}

function isAdapter(media: MediaElementLike | MediaAdapter): media is MediaAdapter {
  return (
    typeof (media as MediaAdapter).subscribe === 'function' &&
    typeof (media as MediaAdapter).unload === 'function'
  );
}

/** Only allow links that cannot run script. */
export function safeHref(href: string): string | undefined {
  try {
    const url = new URL(href, globalThis.location?.href ?? 'https://invalid.example/');
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? href : undefined;
  } catch {
    return undefined;
  }
}

function makeVideo(): HTMLVideoElement {
  const video = document.createElement('video');
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('muted', '');
  video.setAttribute('part', 'video');
  video.setAttribute('tabindex', '-1');
  video.disableRemotePlayback = true;
  return video;
}

const SWIPE_DISTANCE = 50;
const MOVE_TOLERANCE = 10;

/**
 * Render a story view into `host` (inside a shadow root) and start it.
 * This is what `<story-view>` and the Video.js plugin use under the hood.
 */
export function createStoryView(
  host: HTMLElement,
  init: StoryViewInit,
  deps: Omit<EngineDeps, 'media'> = {},
): StoryView {
  const labels: StoryLabels = { ...DEFAULT_LABELS, ...init.labels };
  const options = {
    keyboard: true,
    pauseWhenHidden: true,
    pauseWhenOffscreen: true,
    swipeToClose: false,
    closeButton: false,
    holdDelay: 200,
    dir: 'auto' as const,
    ...init,
  };

  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  shadow.replaceChildren();
  adoptStyles(shadow);
  const template = document.createElement('template');
  template.innerHTML = TEMPLATE;
  shadow.append(template.content);

  const $ = <T extends Element>(selector: string) => shadow.querySelector(selector) as T;
  const root = $<HTMLDivElement>('.root');
  const stage = $<HTMLDivElement>('.stage');
  const image = $<HTMLImageElement>('.image');
  const segments = $<HTMLDivElement>('.segments');
  const header = $<HTMLDivElement>('.header');
  const avatar = $<HTMLImageElement>('.avatar');
  const title = $<HTMLSpanElement>('.title');
  const subtitle = $<HTMLSpanElement>('.subtitle');
  const pauseButton = $<HTMLButtonElement>('.pause');
  const muteButton = $<HTMLButtonElement>('.mute');
  const closeButton = $<HTMLButtonElement>('.close');
  const zones = $<HTMLDivElement>('.zones');
  const prevZone = $<HTMLButtonElement>('.zone.prev');
  const toggleZone = $<HTMLButtonElement>('.zone.toggle');
  const nextZone = $<HTMLButtonElement>('.zone.next');
  const cta = $<HTMLAnchorElement>('.cta');
  const live = $<HTMLDivElement>('[aria-live]');

  if (options.dir !== 'auto') root.dir = options.dir;
  prevZone.setAttribute('aria-label', labels.previous);
  nextZone.setAttribute('aria-label', labels.next);
  closeButton.setAttribute('aria-label', labels.close);
  closeButton.innerHTML = ICONS.close;
  closeButton.hidden = !options.closeButton;

  // Host attributes we add, so destroy() can take them away again.
  const added: string[] = [];
  const setDefault = (name: string, value: string) => {
    if (host.hasAttribute(name)) return;
    host.setAttribute(name, value);
    added.push(name);
  };
  setDefault('role', 'region');
  setDefault('aria-label', labels.region);
  setDefault('tabindex', '0');
  const flag = (name: string, on: boolean) => {
    host.toggleAttribute(name, on);
    if (on && !added.includes(name)) added.push(name);
  };
  flag('data-swipe-to-close', options.swipeToClose);

  // Media: our own pair of <video> elements, or one the caller owns.
  let media: MediaAdapter;
  const ownsMedia = !init.media;
  if (init.media && isAdapter(init.media)) media = init.media;
  else if (init.media) media = new MediaElementAdapter(init.media);
  else {
    const a = makeVideo();
    const b = makeVideo();
    stage.prepend(a, b);
    media = new MediaElementAdapter(a, b);
  }
  flag('data-external', !ownsMedia);

  const engine = new StoryEngine(
    {
      items: init.items,
      autoplay: init.autoplay,
      loop: init.loop,
      muted: init.muted,
      imageDuration: init.imageDuration,
      preload: init.preload,
    },
    { ...deps, media },
  );
  const closeEmitter = new Emitter();
  const abort = new AbortController();
  const { signal } = abort;

  let fills: HTMLElement[] = [];
  const buildSegments = () => {
    segments.replaceChildren();
    fills = engine.items.map(() => {
      const segment = document.createElement('div');
      segment.className = 'segment';
      segment.setAttribute('part', 'segment');
      const fill = document.createElement('span');
      fill.className = 'fill';
      fill.setAttribute('part', 'segment-fill');
      segment.append(fill);
      segments.append(segment);
      return fill;
    });
  };

  const setFill = (i: number, progress: number) => {
    fills[i]?.style.setProperty('--p', String(progress));
  };

  const updatePlayState = () => {
    const paused = engine.paused;
    pauseButton.innerHTML = paused ? ICONS.play : ICONS.pause;
    pauseButton.setAttribute('aria-label', paused ? labels.play : labels.pause);
    toggleZone.setAttribute('aria-label', paused ? labels.play : labels.pause);
    host.toggleAttribute('data-paused', paused);
    if (paused && !added.includes('data-paused')) added.push('data-paused');
  };

  const updateMute = () => {
    const muted = engine.muted;
    muteButton.innerHTML = muted ? ICONS.muted : ICONS.sound;
    muteButton.setAttribute('aria-label', muted ? labels.unmute : labels.mute);
  };

  const showImage = (src: string | undefined, alt: string) => {
    if (src) {
      if (image.getAttribute('src') !== src) image.src = src;
      image.alt = alt;
      image.setAttribute('data-active', '');
    } else {
      image.removeAttribute('data-active');
    }
  };

  const render = (item: StoryItem, index: number) => {
    if (fills.length !== engine.items.length) buildSegments();
    fills.forEach((_, i) => {
      setFill(i, i < index ? 1 : 0);
    });

    const isVideo = itemType(item) === 'video';
    showImage(isVideo ? undefined : item.src, item.alt ?? '');
    muteButton.hidden = !isVideo;

    header.hidden = !(item.title || item.subtitle || item.avatar);
    title.textContent = item.title ?? '';
    subtitle.textContent = item.subtitle ?? '';
    avatar.hidden = !item.avatar;
    if (item.avatar) avatar.src = item.avatar;
    else avatar.removeAttribute('src');

    const href = item.link && safeHref(item.link.href);
    cta.hidden = !href;
    if (href && item.link) {
      cta.href = href;
      cta.target = item.link.target ?? '_blank';
      cta.textContent = item.link.label ?? labels.link;
    } else {
      cta.removeAttribute('href');
    }

    host.removeAttribute('data-buffering');
    // Announce only while the viewer is interacting; auto-advance stays quiet.
    const active = host.ownerDocument.activeElement;
    if (active === host || shadow.activeElement || (active && host.contains(active))) {
      const position = labels.position
        .replace('{index}', String(index + 1))
        .replace('{total}', String(engine.items.length));
      live.textContent = item.title ? `${position}: ${item.title}` : position;
    }
    updatePlayState();
  };

  engine.on('storychange', ({ item, index }) => render(item, index));
  engine.on('progress', ({ index, progress }) => setFill(index, progress));
  engine.on('pause', updatePlayState);
  engine.on('resume', updatePlayState);
  engine.on('complete', updatePlayState);
  engine.on('mutechange', updateMute);
  engine.on('buffering', ({ buffering }) => flag('data-buffering', buffering));
  engine.on('error', ({ item }) => {
    host.removeAttribute('data-buffering');
    media.unload();
    showImage(item.poster, item.alt ?? '');
  });

  // --- Pointer: tap zones, press and hold, swipes ---------------------------
  const isRtl = () =>
    options.dir === 'auto' ? getComputedStyle(host).direction === 'rtl' : options.dir === 'rtl';
  let press: {
    id: number;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout>;
    holding: boolean;
  } | null = null;
  let swallowClick = false;

  const endPress = (event: PointerEvent, cancelled: boolean) => {
    if (!press || event.pointerId !== press.id) return;
    clearTimeout(press.timer);
    const { holding, x, y } = press;
    press = null;
    if (holding) {
      swallowClick = true;
      host.removeAttribute('data-holding');
      engine.resume('hold');
      return;
    }
    if (cancelled) return;
    const dx = event.clientX - x;
    const dy = event.clientY - y;
    if (options.swipeToClose && dy > SWIPE_DISTANCE && dy > Math.abs(dx) * 1.5) {
      swallowClick = true;
      closeEmitter.emit('close', { trigger: 'swipe' });
    } else if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
      swallowClick = true;
      // Swiping towards the start edge reveals the next story.
      if (dx < 0 !== isRtl()) engine.next();
      else engine.prev();
    }
  };

  zones.addEventListener(
    'pointerdown',
    (event) => {
      swallowClick = false;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (press) clearTimeout(press.timer);
      const current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        holding: false,
        timer: setTimeout(() => {
          current.holding = true;
          flag('data-holding', true);
          engine.pause('hold');
        }, options.holdDelay),
      };
      press = current;
    },
    { signal },
  );
  zones.addEventListener(
    'pointermove',
    (event) => {
      if (!press || press.holding || event.pointerId !== press.id) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE) {
        clearTimeout(press.timer);
      }
    },
    { signal },
  );
  zones.addEventListener('pointerup', (event) => endPress(event, false), { signal });
  zones.addEventListener('pointercancel', (event) => endPress(event, true), { signal });
  zones.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });

  const onZone = (action: () => void) => (event: MouseEvent) => {
    event.preventDefault();
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    action();
  };
  prevZone.addEventListener('click', onZone(() => engine.prev()), { signal });
  nextZone.addEventListener('click', onZone(() => engine.next()), { signal });
  toggleZone.addEventListener('click', onZone(() => engine.togglePlay()), { signal });
  pauseButton.addEventListener('click', () => engine.togglePlay(), { signal });
  muteButton.addEventListener(
    'click',
    () => {
      engine.muted = !engine.muted;
    },
    { signal },
  );
  closeButton.addEventListener(
    'click',
    () => closeEmitter.emit('close', { trigger: 'button' }),
    { signal },
  );

  // --- Keyboard -------------------------------------------------------------
  if (options.keyboard) {
    host.addEventListener(
      'keydown',
      (event) => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        const onControl = event
          .composedPath()
          .some(
            (node) =>
              node instanceof HTMLElement &&
              ((node.tagName === 'BUTTON' && !node.classList.contains('zone')) ||
                node.tagName === 'A'),
          );
        switch (event.key) {
          case 'ArrowRight':
          case 'ArrowLeft': {
            const forward = (event.key === 'ArrowRight') !== isRtl();
            if (forward) engine.next();
            else engine.prev();
            break;
          }
          case ' ':
          case 'k':
            if (onControl) return;
            engine.togglePlay();
            break;
          case 'm':
            engine.muted = !engine.muted;
            break;
          case 'Escape':
            closeEmitter.emit('close', { trigger: 'keyboard' });
            break;
          default:
            return;
        }
        event.preventDefault();
      },
      { signal },
    );
  }

  let destroyed = false;
  const boot = () => {
    if (!destroyed && engine.index === -1) engine.start(init.startIndex ?? 0);
  };

  // --- Page visibility and viewport ------------------------------------------
  if (options.pauseWhenHidden && typeof document !== 'undefined') {
    const sync = () => (document.hidden ? engine.pause('hidden') : engine.resume('hidden'));
    document.addEventListener('visibilitychange', sync, { signal });
    if (document.hidden) engine.pause('hidden');
  }

  let observer: IntersectionObserver | undefined;
  if (options.pauseWhenOffscreen && typeof IntersectionObserver === 'function') {
    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        const viewport = entry.rootBounds?.height ?? Number.POSITIVE_INFINITY;
        const visible =
          entry.isIntersecting &&
          (entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= viewport / 2);
        if (visible) engine.resume('offscreen');
        else engine.pause('offscreen');
        // The first report decides whether we start playing or paused.
        queueMicrotask(boot);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    observer.observe(host);
  }

  buildSegments();
  updateMute();
  updatePlayState();
  // Without an IntersectionObserver, start on the next microtask so callers
  // can add listeners first. With one, start after its first report.
  if (!observer) queueMicrotask(boot);

  const view: StoryView = {
    host,
    get items() {
      return engine.items;
    },
    get index() {
      return engine.index;
    },
    get item() {
      return engine.item;
    },
    get paused() {
      return engine.paused;
    },
    get pauseReasons() {
      return engine.pauseReasons;
    },
    get ended() {
      return engine.ended;
    },
    get progress() {
      return engine.progress;
    },
    get muted() {
      return engine.muted;
    },
    set muted(value: boolean) {
      engine.muted = value;
    },
    get loop() {
      return engine.loop;
    },
    set loop(value: boolean) {
      engine.loop = value;
    },
    next: () => {
      boot();
      engine.next();
    },
    prev: () => {
      boot();
      engine.prev();
    },
    goTo: (index) => engine.goTo(index),
    play: () => {
      boot();
      engine.play();
    },
    pause: () => {
      boot();
      engine.pause('user');
    },
    togglePlay: () => {
      boot();
      engine.togglePlay();
    },
    toggleMute: () => {
      engine.muted = !engine.muted;
    },
    setItems: (items, startIndex = 0) => {
      engine.setItems(items, startIndex);
      buildSegments();
      const item = engine.item;
      if (item) render(item, engine.index);
    },
    on: (type, listener) =>
      type === 'close' ? closeEmitter.on(type, listener) : engine.on(type, listener),
    off: (type, listener) =>
      type === 'close' ? closeEmitter.off(type, listener) : engine.off(type, listener),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      if (press) clearTimeout(press.timer);
      abort.abort();
      observer?.disconnect();
      engine.destroy();
      closeEmitter.clear();
      media.unload();
      media.destroy();
      for (const name of added) host.removeAttribute(name);
      shadow.replaceChildren();
    },
  };
  return view;
}
