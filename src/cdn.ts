// Entry for the <script> build: registers <story-view>, and the Video.js 8
// plugin when a global `videojs` is already on the page.
import { defineStoryView } from './element/define';
import { registerStoryView, type VideojsLike } from './videojs/plugin';

defineStoryView();

const videojs = (globalThis as { videojs?: VideojsLike }).videojs;
if (videojs && typeof videojs.registerPlugin === 'function') registerStoryView(videojs);

export * from './index';
export { attachStoryView, createVideojsAdapter, getStoryView, registerStoryView } from './videojs';
