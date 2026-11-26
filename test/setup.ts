// happy-dom's IntersectionObserver never reports. Report "fully visible" on
// observe, like a browser does for an element on screen.
class VisibleIntersectionObserver {
  #callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.#callback = callback;
  }
  observe(target: Element) {
    const entry = {
      target,
      isIntersecting: true,
      intersectionRatio: 1,
      intersectionRect: { height: 100 },
      rootBounds: { height: 1000 },
    } as unknown as IntersectionObserverEntry;
    this.#callback([entry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

globalThis.IntersectionObserver = VisibleIntersectionObserver as unknown as typeof IntersectionObserver;
