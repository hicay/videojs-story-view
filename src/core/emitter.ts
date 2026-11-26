import type { StoryEventListener, StoryEventMap, StoryEventType } from './types';

/** A tiny typed event emitter. */
export class Emitter {
  #listeners = new Map<StoryEventType, Set<(detail: never) => void>>();

  on<K extends StoryEventType>(type: K, listener: StoryEventListener<K>): () => void {
    let set = this.#listeners.get(type);
    if (!set) {
      set = new Set();
      this.#listeners.set(type, set);
    }
    set.add(listener as (detail: never) => void);
    return () => this.off(type, listener);
  }

  off<K extends StoryEventType>(type: K, listener: StoryEventListener<K>): void {
    this.#listeners.get(type)?.delete(listener as (detail: never) => void);
  }

  emit<K extends StoryEventType>(type: K, detail: StoryEventMap[K]): void {
    const set = this.#listeners.get(type);
    if (!set) return;
    for (const listener of [...set]) (listener as StoryEventListener<K>)(detail);
  }

  clear(): void {
    this.#listeners.clear();
  }
}
