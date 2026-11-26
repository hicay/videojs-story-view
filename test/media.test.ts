import { describe, expect, it, vi } from 'vitest';
import { MediaElementAdapter } from '../src/core/media';

function video() {
  const el = document.createElement('video');
  vi.spyOn(el, 'play').mockResolvedValue(undefined);
  vi.spyOn(el, 'pause').mockImplementation(() => {});
  vi.spyOn(el, 'load').mockImplementation(() => {});
  return el;
}

describe('MediaElementAdapter', () => {
  it('swaps to the preloaded element', () => {
    const a = video();
    const b = video();
    const adapter = new MediaElementAdapter(a, b);
    adapter.load({ src: 'https://example.com/1.mp4' });
    adapter.preload({ src: 'https://example.com/2.mp4', poster: 'https://example.com/2.jpg' });
    expect(b.getAttribute('src')).toBe('https://example.com/2.mp4');
    expect(b.getAttribute('poster')).toBe('https://example.com/2.jpg');
    adapter.load({ src: 'https://example.com/2.mp4' });
    expect(adapter.element).toBe(b);
    expect(b.hasAttribute('data-active')).toBe(true);
    expect(a.hasAttribute('data-active')).toBe(false);
  });

  it('forwards events from the active element only', () => {
    const a = video();
    const b = video();
    const adapter = new MediaElementAdapter(a, b);
    const listener = vi.fn();
    adapter.subscribe(listener);
    b.dispatchEvent(new Event('ended'));
    expect(listener).not.toHaveBeenCalled();
    a.dispatchEvent(new Event('ended'));
    expect(listener).toHaveBeenCalledWith('ended', undefined);
  });

  it('keeps the spare muted and the active one as asked', () => {
    const a = video();
    const b = video();
    const adapter = new MediaElementAdapter(a, b);
    adapter.muted = false;
    expect(a.muted).toBe(false);
    expect(b.muted).toBe(true);
  });

  it('stops forwarding after destroy', () => {
    const a = video();
    const adapter = new MediaElementAdapter(a);
    const listener = vi.fn();
    adapter.subscribe(listener);
    adapter.destroy();
    a.dispatchEvent(new Event('ended'));
    expect(listener).not.toHaveBeenCalled();
  });
});
