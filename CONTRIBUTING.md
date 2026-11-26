# Contributing

Thanks for helping out. Bug reports, fixes and small features are all welcome.
For anything large, open an issue first so we can agree on the approach.

## Setup

You need Node.js 22.12 or newer.

```sh
npm install
npm run dev      # demo site at http://localhost:5173/videojs-story-view/
```

The demo imports the library straight from `src/`, so changes show up
without a build.

## Layout

- `src/core/engine.ts`: timing, navigation and pause reasons. No DOM.
- `src/core/view.ts`: the UI in a shadow root, gestures, keyboard, visibility.
- `src/core/media.ts`: playing videos in `<video>` elements.
- `src/element/`: the `<story-view>` custom element.
- `src/videojs/`: the Video.js 8 plugin.
- `src/styles/story-view.css`: styles inside the shadow root.
- `demo/`: the demo site, deployed to GitHub Pages.
- `test/`: unit tests (Vitest and happy-dom). `e2e/`: Playwright tests of the demo.

## Checks

```sh
npm run check      # lint, typecheck, unit tests, build and size budget
npm run test:e2e   # demo in Chromium and WebKit; run `npx playwright install` once
```

The end-to-end tests replace remote media with the files in `e2e/fixtures`,
so they run offline.

`npm run screenshots` regenerates `demo.png`, `demo-dark.png` and
`demo.webp` for the README. It needs Google Chrome, ffmpeg and img2webp.

## Pull requests

- Keep changes focused, and add or update tests when behavior changes.
- Update the README and CHANGELOG when users will notice the change.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for
  commit messages, such as `fix: keep progress when the tab is hidden`.

## Releasing

Maintainers bump the version and push the tag:

```sh
npm version minor
git push --follow-tags
```

The Release workflow runs the checks, publishes to npm with provenance and
creates the GitHub release.
