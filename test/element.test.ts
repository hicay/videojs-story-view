import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { defineStoryView } from '../src/element/define';
import { readChildItems, StoryViewElement } from '../src/element/story-view-element';

beforeAll(() => defineStoryView());

afterEach(() => {
  document.body.innerHTML = '';
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('readChildItems', () => {
  it('reads img, video and JSON children', () => {
    const parent = document.createElement('div');
    parent.innerHTML = `
      <img src="a.jpg" alt="A" data-duration="3" data-title="Ada" data-link="https://example.com" data-link-label="Go">
      <video poster="b.jpg" aria-label="B" data-subtitle="1h"><source src="b.webm" type="video/webm"></video>
      <script type="application/json">[{"src": "c.mp4", "title": "C"}]</script>
      <p>ignored</p>`;
    expect(readChildItems(parent)).toEqual([
      {
        type: 'image',
        src: 'a.jpg',
        alt: 'A',
        duration: 3,
        title: 'Ada',
        link: { href: 'https://example.com', label: 'Go' },
      },
      { type: 'video', src: 'b.webm', mimeType: 'video/webm', poster: 'b.jpg', alt: 'B', subtitle: '1h' },
      { src: 'c.mp4', title: 'C' },
    ]);
  });
});

describe('<story-view>', () => {
  it('is registered once', () => {
    defineStoryView();
    expect(customElements.get('story-view')).toBe(StoryViewElement);
    expect(document.createElement('story-view')).toBeInstanceOf(StoryViewElement);
  });

  it('renders stories from children', async () => {
    document.body.innerHTML = `<story-view><img src="a.jpg"><img src="b.jpg"></story-view>`;
    await tick();
    const el = document.querySelector('story-view') as StoryViewElement;
    expect(el.shadowRoot?.querySelectorAll('.segment')).toHaveLength(2);
    expect(el.index).toBe(0);
  });

  it('takes items as a property and dispatches events', async () => {
    const el = document.createElement('story-view');
    const changes: number[] = [];
    el.addEventListener('storychange', (event) => changes.push(event.detail.index));
    el.items = [{ src: 'a.jpg' }, { src: 'b.jpg' }, { src: 'c.jpg' }];
    document.body.append(el);
    await tick();
    el.next();
    el.goTo(2);
    expect(changes).toEqual([0, 1, 2]);
    el.items = [{ src: 'x.jpg' }];
    expect(el.shadowRoot?.querySelectorAll('.segment')).toHaveLength(1);
  });

  it('reads options from attributes', async () => {
    document.body.innerHTML = `<story-view start-index="1" autoplay="false" muted="false" loop close-button>
      <img src="a.jpg"><img src="b.jpg"></story-view>`;
    await tick();
    const el = document.querySelector('story-view') as StoryViewElement;
    expect(el.index).toBe(1);
    expect(el.paused).toBe(true);
    expect(el.muted).toBe(false);
    expect(el.loop).toBe(true);
    expect(el.shadowRoot?.querySelector<HTMLElement>('.close')?.hidden).toBe(false);
  });

  it('applies muted and loop changes without rebuilding', async () => {
    document.body.innerHTML = `<story-view><img src="a.jpg"><img src="b.jpg"></story-view>`;
    await tick();
    const el = document.querySelector('story-view') as StoryViewElement;
    const segment = el.shadowRoot?.querySelector('.segment');
    el.next();
    el.muted = false;
    el.loop = true;
    expect(el.muted).toBe(false);
    expect(el.index).toBe(1);
    expect(el.shadowRoot?.querySelector('.segment')).toBe(segment);
  });

  it('rebuilds on other attribute changes and keeps its place', async () => {
    document.body.innerHTML = `<story-view><img src="a.jpg"><img src="b.jpg"></story-view>`;
    await tick();
    const el = document.querySelector('story-view') as StoryViewElement;
    el.next();
    el.setAttribute('close-button', '');
    await tick();
    expect(el.index).toBe(1);
    expect(el.shadowRoot?.querySelector<HTMLElement>('.close')?.hidden).toBe(false);
  });

  it('updates when children change', async () => {
    document.body.innerHTML = `<story-view><img src="a.jpg"></story-view>`;
    await tick();
    const el = document.querySelector('story-view') as StoryViewElement;
    el.append(Object.assign(document.createElement('img'), { src: 'b.jpg' }));
    await tick();
    await tick();
    expect(el.shadowRoot?.querySelectorAll('.segment')).toHaveLength(2);
  });

  it('plays through an external media element', async () => {
    document.body.innerHTML = `<video id="player"></video>
      <story-view media="player"><video src="a.mp4"></video><video src="b.mp4"></video></story-view>`;
    const video = document.getElementById('player') as HTMLVideoElement;
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined);
    await tick();
    const el = document.querySelector('story-view') as StoryViewElement;
    expect(el.hasAttribute('data-external')).toBe(true);
    expect(el.shadowRoot?.querySelector('video')).toBeNull();
    expect(video.getAttribute('src')).toBe('a.mp4');
    expect(play).toHaveBeenCalled();
    el.next();
    expect(video.getAttribute('src')).toBe('b.mp4');
  });

  it('cleans up when removed', async () => {
    document.body.innerHTML = `<story-view><img src="a.jpg"></story-view>`;
    await tick();
    const el = document.querySelector('story-view') as StoryViewElement;
    el.remove();
    expect(el.shadowRoot?.childElementCount).toBe(0);
    document.body.append(el);
    await tick();
    expect(el.shadowRoot?.querySelectorAll('.segment')).toHaveLength(1);
  });
});
