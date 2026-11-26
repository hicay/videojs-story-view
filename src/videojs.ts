export {
  attachStoryView,
  createVideojsAdapter,
  getStoryView,
  registerStoryView,
} from './videojs/plugin';
export type { VideojsLike, VideojsPlayerLike } from './videojs/plugin';

import type { StoryViewOptions } from './core/types';
import type { StoryView } from './core/view';

// Types `player.storyView()` on Video.js 8 players.
import type {} from 'video.js/dist/types/player';

declare module 'video.js/dist/types/player' {
  export default interface Player {
    storyView(options: StoryViewOptions): StoryView;
  }
}
