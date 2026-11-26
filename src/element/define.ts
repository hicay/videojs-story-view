import { StoryViewElement } from './story-view-element';

/**
 * Register `<story-view>` (or another tag name). Safe to call more than once
 * and during server rendering.
 */
export function defineStoryView(tagName = 'story-view'): void {
  if (typeof customElements === 'undefined' || customElements.get(tagName)) return;
  customElements.define(tagName, tagName === 'story-view' ? StoryViewElement : class extends StoryViewElement {});
}

declare global {
  interface HTMLElementTagNameMap {
    'story-view': StoryViewElement;
  }
}
