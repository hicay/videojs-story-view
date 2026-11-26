import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoryItem } from '../src/core/types';
import { createStoryView, type StoryView, type StoryViewInit } from '../src/core/view';
import { advance, FakeMedia, images, instantImages, useFakeClock } from './helpers';

let host: HTMLElement;
let view: StoryView | undefined;

async function mount(options: Partial<StoryViewInit> = {}): Promise<StoryView> {
  view = createStoryView(host, { items: images(3), media: new FakeMedia(), ...options }, { loadImage: instantImages });
  await Promise.resolve();
  return view;
}

const $ = <T extends Element = HTMLElement>(selector: string) =>
  host.shadowRoot?.querySelector(selector) as T;

function key(k: string, target: EventTarget = host) {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, composed: true });
  target.dispatchEvent(event);
  return event;
}

function pointer(type: string, x: number, y = 100, target: Element = $('.zones')) {
  target.dispatchEvent(
    new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', bubbles: true, composed: true }),
  );
}

beforeEach(() => {
  useFakeClock();
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(() => {
  view?.destroy();
  view = undefined;
  host.remove();
  vi.useRealTimers();
});

describe('rendering', () => {
  it('renders one progress segment per story and fills earlier ones', async () => {
    const v = await mount();
    expect(host.shadowRoot?.querySelectorAll('.segment')).toHaveLength(3);
    v.goTo(2);
    const fills = [...(host.shadowRoot?.querySelectorAll<HTMLElement>('.fill') ?? [])];
    expect(fills.map((f) => f.style.getPropertyValue('--p'))).toEqual(['1', '1', '0']);
  });

  it('updates the current segment as time passes', async () => {
    await mount({ imageDuration: 2 });
    await advance(1000);
    const value = Number($('.fill').style.getPropertyValue('--p'));
    expect(value).toBeGreaterThan(0.4);
    expect(value).toBeLessThan(0.6);
  });

  it('shows header, image and call to action from the item', async () => {
    const items: StoryItem[] = [
      {
        src: 'https://example.com/a.jpg',
        alt: 'A beach',
        title: 'Ada',
        subtitle: '2h',
        avatar: 'https://example.com/ada.png',
        link: { href: 'https://example.com/shop', label: 'Shop now' },
      },
      { src: 'https://example.com/b.jpg' },
    ];
    const v = await mount({ items });
    expect($('.title').textContent).toBe('Ada');
    expect($('.subtitle').textContent).toBe('2h');
    expect($<HTMLImageElement>('.avatar').src).toBe('https://example.com/ada.png');
    expect($<HTMLImageElement>('.image').alt).toBe('A beach');
    const cta = $<HTMLAnchorElement>('.cta');
    expect(cta.hidden).toBe(false);
    expect(cta.textContent).toBe('Shop now');
    expect(cta.target).toBe('_blank');
    v.next();
    expect($('.header').hidden).toBe(true);
    expect(cta.hidden).toBe(true);
  });

  it('refuses javascript: links', async () => {
    await mount({ items: [{ src: 'a.jpg', link: { href: 'javascript:alert(1)' } }] });
    expect($('.cta').hidden).toBe(true);
  });

  it('treats titles as text, not HTML', async () => {
    await mount({ items: [{ src: 'a.jpg', title: '<img src=x onerror=alert(1)>' }] });
    expect($('.title').textContent).toBe('<img src=x onerror=alert(1)>');
    expect($('.title').children).toHaveLength(0);
  });

  it('hides the mute button for images', async () => {
    const v = await mount({ items: [{ src: 'a.jpg' }, { src: 'b.mp4' }] });
    expect($('.mute').hidden).toBe(true);
    v.next();
    expect($('.mute').hidden).toBe(false);
  });

  it('uses its own video elements when no media is given', async () => {
    await mount({ media: undefined, items: [{ src: 'a.mp4' }] });
    const videos = host.shadowRoot?.querySelectorAll('video');
    expect(videos).toHaveLength(2);
    expect(videos?.[0]?.playsInline).toBe(true);
    expect(videos?.[0]?.muted).toBe(true);
  });
});

describe('accessibility', () => {
  it('labels the region and controls', async () => {
    const v = await mount({ labels: { region: 'Highlights' } });
    expect(host.getAttribute('role')).toBe('region');
    expect(host.getAttribute('aria-label')).toBe('Highlights');
    expect(host.tabIndex).toBe(0);
    expect($('.zone.prev').getAttribute('aria-label')).toBe('Previous story');
    expect($('.pause').getAttribute('aria-label')).toBe('Pause');
    v.pause();
    expect($('.pause').getAttribute('aria-label')).toBe('Play');
  });

  it('keeps attributes the page set', async () => {
    host.setAttribute('aria-label', 'Mine');
    await mount();
    expect(host.getAttribute('aria-label')).toBe('Mine');
  });

  it('announces the story when focused', async () => {
    const v = await mount();
    host.focus();
    v.next();
    expect($('[aria-live]').textContent).toBe('Story 2 of 3: Story 1');
  });

  it('removes what it added on destroy', async () => {
    const v = await mount();
    v.destroy();
    expect(host.hasAttribute('role')).toBe(false);
    expect(host.hasAttribute('tabindex')).toBe(false);
    expect(host.shadowRoot?.childElementCount).toBe(0);
  });
});

describe('pointer', () => {
  it('goes back, forward and pauses with the three tap zones', async () => {
    const v = await mount();
    $('.zone.next').click();
    expect(v.index).toBe(1);
    $('.zone.prev').click();
    expect(v.index).toBe(0);
    $('.zone.toggle').click();
    expect(v.paused).toBe(true);
    $('.zone.toggle').click();
    expect(v.paused).toBe(false);
  });

  it('pauses while pressed and held, without navigating on release', async () => {
    const v = await mount();
    pointer('pointerdown', 300);
    await advance(250);
    expect(v.pauseReasons).toEqual(['hold']);
    expect(host.hasAttribute('data-holding')).toBe(true);
    pointer('pointerup', 300);
    $('.zone.next').click();
    expect(v.paused).toBe(false);
    expect(v.index).toBe(0);
  });

  it('a quick tap is not a hold', async () => {
    const v = await mount();
    pointer('pointerdown', 300);
    await advance(50);
    pointer('pointerup', 300);
    $('.zone.next').click();
    expect(v.index).toBe(1);
  });

  it('swipes left and right', async () => {
    const v = await mount();
    pointer('pointerdown', 300);
    pointer('pointerup', 100);
    expect(v.index).toBe(1);
    pointer('pointerdown', 100);
    pointer('pointerup', 300);
    expect(v.index).toBe(0);
  });

  it('mirrors swipes in right-to-left layouts', async () => {
    const v = await mount({ dir: 'rtl' });
    pointer('pointerdown', 100);
    pointer('pointerup', 300);
    expect(v.index).toBe(1);
  });

  it('emits close on swipe down only when enabled', async () => {
    const close = vi.fn();
    (await mount()).on('close', close);
    pointer('pointerdown', 100, 100);
    pointer('pointerup', 100, 300);
    expect(close).not.toHaveBeenCalled();
    view?.destroy();
    (await mount({ swipeToClose: true })).on('close', close);
    pointer('pointerdown', 100, 100);
    pointer('pointerup', 100, 300);
    expect(close).toHaveBeenCalledWith({ trigger: 'swipe' });
  });
});

describe('keyboard', () => {
  it('arrows navigate, space pauses, m mutes, Escape closes', async () => {
    const v = await mount({ items: [{ src: 'a.mp4' }, { src: 'b.jpg' }, { src: 'c.jpg' }] });
    const close = vi.fn();
    v.on('close', close);
    expect(key('ArrowRight').defaultPrevented).toBe(true);
    expect(v.index).toBe(1);
    key('ArrowLeft');
    expect(v.index).toBe(0);
    key(' ');
    expect(v.paused).toBe(true);
    key(' ');
    expect(v.paused).toBe(false);
    key('m');
    expect(v.muted).toBe(false);
    key('Escape');
    expect(close).toHaveBeenCalledWith({ trigger: 'keyboard' });
    expect(key('x').defaultPrevented).toBe(false);
  });

  it('mirrors arrows in right-to-left layouts', async () => {
    const v = await mount({ dir: 'rtl' });
    key('ArrowLeft');
    expect(v.index).toBe(1);
  });

  it('leaves space to a focused button', async () => {
    const v = await mount();
    key(' ', $('.mute'));
    expect(v.paused).toBe(false);
  });

  it('can be turned off', async () => {
    const v = await mount({ keyboard: false });
    key('ArrowRight');
    expect(v.index).toBe(0);
  });
});

describe('page visibility', () => {
  function setHidden(hidden: boolean) {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  afterEach(() => setHidden(false));

  it('pauses while the tab is hidden', async () => {
    const v = await mount({ imageDuration: 1 });
    setHidden(true);
    expect(v.pauseReasons).toEqual(['hidden']);
    await advance(5000);
    expect(v.index).toBe(0);
    setHidden(false);
    expect(v.paused).toBe(false);
  });

  it('does not resume a story the viewer paused', async () => {
    const v = await mount();
    v.pause();
    setHidden(true);
    setHidden(false);
    expect(v.paused).toBe(true);
  });

  it('can be turned off', async () => {
    const v = await mount({ pauseWhenHidden: false });
    setHidden(true);
    expect(v.paused).toBe(false);
  });
});

describe('viewport', () => {
  it('pauses when less than half is visible', async () => {
    let callback: IntersectionObserverCallback | undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const v = await mount();
    const entry = (ratio: number) =>
      ({
        isIntersecting: ratio > 0,
        intersectionRatio: ratio,
        intersectionRect: { height: ratio * 100 },
        rootBounds: { height: 1000 },
      }) as unknown as IntersectionObserverEntry;
    callback?.([entry(0.2)], {} as IntersectionObserver);
    await Promise.resolve();
    expect(v.index).toBe(0);
    expect(v.pauseReasons).toEqual(['offscreen']);
    callback?.([entry(0.8)], {} as IntersectionObserver);
    expect(v.paused).toBe(false);
    vi.unstubAllGlobals();
  });
});
