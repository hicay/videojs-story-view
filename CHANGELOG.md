# Changelog

## 1.0.0

A rewrite. The package is now a small story player that works on its own,
with Video.js 8 as an option instead of a requirement.

### Added

- `<story-view>` custom element: video and image stories, segmented progress
  bars, a header with avatar, title and subtitle, and a link button.
- Tap the left or right third to go back or forward, the middle to pause;
  press and hold to pause; swipe sideways; optional swipe down to close.
- Keyboard shortcuts: arrow keys, space, `M` and Escape.
- Pauses while the tab is hidden or the view is off screen; pauses from
  different causes stack.
- Loads the next story early; the element switches between two video
  elements so the next video starts without a gap.
- Starts muted with `playsinline`; if the browser blocks autoplay with sound,
  it mutes and tries again.
- Right-to-left support, screen reader labels and announcements, translatable
  labels, and `prefers-reduced-motion`.
- Theming with CSS custom properties and `::part()`.
- Stories from the `items` property, from child `<img>` and `<video>`
  elements, or from a JSON `<script>`.
- `media` attribute to play videos in another element, such as a Video.js 10
  media element or a plain `<video>`.
- Video.js 8 plugin: `registerStoryView(videojs)`, then
  `player.storyView({ items })`. Plays videos through the player.
- Typed events: `storychange`, `storyend`, `complete`, `pause`, `resume`,
  `mutechange`, `progress`, `buffering`, `error`, `close`.
- `createStoryView()` and `StoryEngine` for custom setups.
- TypeScript types, ES modules, and a single minified file for CDNs.
- Tests, a demo site, CI, and releases published from GitHub Actions with npm
  provenance.

### Changed

- `video.js` is an optional peer dependency (`^8`). Video.js 7 and older are
  no longer supported.
- The plugin is no longer registered as a side effect of importing the
  package; call `registerStoryView(videojs)`. The CDN script still registers
  it when `window.videojs` exists.
- Requires a browser from 2022 or later. Internet Explorer is not supported.

### Removed

- The committed `dist/` builds. Use the files from npm or a CDN.

## 0.0.1

First release: a progress bar over a Video.js 7 player.
