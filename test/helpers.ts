import { vi } from 'vitest';
import type { MediaAdapter, MediaEvent } from '../src/core/media';
import type { StoryItem } from '../src/core/types';

export class FakeMedia implements MediaAdapter {
  currentTime = 0;
  duration = 10;
  muted = true;
  playing = false;
  loaded: StoryItem[] = [];
  playResult: () => Promise<unknown> = () => Promise.resolve();
  preload = vi.fn();
  destroyed = false;
  #listeners = new Set<(event: MediaEvent, error?: unknown) => void>();

  load(item: StoryItem): void {
    this.loaded.push(item);
    this.currentTime = 0;
  }

  unload(): void {
    this.playing = false;
  }

  play(): Promise<unknown> {
    this.playing = true;
    return this.playResult();
  }

  pause(): void {
    this.playing = false;
  }

  subscribe(listener: (event: MediaEvent, error?: unknown) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emit(event: MediaEvent, error?: unknown): void {
    for (const listener of this.#listeners) listener(event, error);
  }

  destroy(): void {
    this.destroyed = true;
  }
}

export const images = (count: number): StoryItem[] =>
  Array.from({ length: count }, (_, i) => ({ src: `https://example.com/${i}.jpg`, title: `Story ${i}` }));

export const instantImages = () => Promise.resolve();

export function useFakeClock(): void {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'Date',
    ],
  });
}

/** Advance fake time in animation-frame sized steps, flushing promises. */
export async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}
