/** A single story: a video or an image shown for a while. */
export interface StoryItem {
  /** Your own identifier. Not used by the library, handy in event handlers. */
  id?: string;
  /** `'video'` or `'image'`. Guessed from the file extension when left out. */
  type?: StoryItemType;
  /** URL of the video or image. */
  src: string;
  /** MIME type of the video, such as `video/mp4` or `application/x-mpegURL`. */
  mimeType?: string;
  /**
   * Seconds to show the item. Images default to `imageDuration`. For videos
   * this caps playback: a 60 second clip with `duration: 8` advances after 8s.
   */
  duration?: number;
  /** Poster image for a video, shown while it loads. */
  poster?: string;
  /** Text alternative. Used as the image `alt` or the video's accessible label. */
  alt?: string;
  /** Header title, usually the author's name. */
  title?: string;
  /** Header subtitle, such as "2h" or a location. */
  subtitle?: string;
  /** Header avatar image URL. */
  avatar?: string;
  /** Call-to-action link shown at the bottom. */
  link?: StoryLink;
}

export type StoryItemType = 'video' | 'image';

export interface StoryLink {
  href: string;
  /** Button text. Defaults to the `link` label, "Open link". */
  label?: string;
  /** Defaults to `_blank`. */
  target?: string;
}

/**
 * Why playback is paused. A story view can be paused for several reasons at
 * once; it resumes only when all of them are gone.
 */
export type PauseReason =
  /** `pause()` was called, or the pause button / space bar was used. */
  | 'user'
  /** The viewer is pressing and holding. */
  | 'hold'
  /** The browser tab is hidden. */
  | 'hidden'
  /** Less than half of the story view is on screen. */
  | 'offscreen'
  /** The browser blocked autoplay, even muted. */
  | 'autoplay';

export interface StoryLabels {
  /** Accessible name of the story view. */
  region: string;
  previous: string;
  next: string;
  pause: string;
  play: string;
  mute: string;
  unmute: string;
  close: string;
  link: string;
  /** `{index}` and `{total}` are replaced. */
  position: string;
}

export interface StoryViewOptions {
  /** The stories, in order. */
  items: StoryItem[];
  /** Index of the first story to show. Default `0`. */
  startIndex?: number;
  /** Start playing right away. Default `true`. */
  autoplay?: boolean;
  /** Go back to the first story after the last one. Default `false`. */
  loop?: boolean;
  /** Start muted. Default `true`, which lets browsers autoplay. */
  muted?: boolean;
  /** Seconds an image is shown when it has no `duration`. Default `5`. */
  imageDuration?: number;
  /** Milliseconds of pressing before it counts as hold-to-pause. Default `200`. */
  holdDelay?: number;
  /** Emit `close` when the viewer swipes down. Default `false`. */
  swipeToClose?: boolean;
  /** Show a close button that emits `close`. Default `false`. */
  closeButton?: boolean;
  /** Arrow keys, space, `m` and Escape while focused. Default `true`. */
  keyboard?: boolean;
  /** Pause while the browser tab is hidden. Default `true`. */
  pauseWhenHidden?: boolean;
  /** Pause while less than half of the view is on screen. Default `true`. */
  pauseWhenOffscreen?: boolean;
  /** Load the next story in the background. Default `true`. */
  preload?: boolean;
  /** Text direction. `'auto'` follows the page. Default `'auto'`. */
  dir?: 'ltr' | 'rtl' | 'auto';
  /** Text for buttons and screen readers. */
  labels?: Partial<StoryLabels>;
}

export interface StoryChangeDetail {
  index: number;
  previousIndex: number;
  item: StoryItem;
}

export interface StoryEventMap {
  /** A different story is now showing. */
  storychange: StoryChangeDetail;
  /** A story played to its end. */
  storyend: { index: number; item: StoryItem };
  /** The last story ended. With `loop`, playback then starts over. */
  complete: { loop: boolean };
  /** Playback stopped. */
  pause: { reason: PauseReason };
  /** Playback continued. `reason` is the pause reason that was lifted last. */
  resume: { reason: PauseReason };
  /** Progress of the current story, from 0 to 1. Fires every frame while playing. */
  progress: { index: number; progress: number };
  /** The current video started or stopped waiting for data. */
  buffering: { buffering: boolean };
  /** The mute state changed. */
  mutechange: { muted: boolean };
  /** A video failed to load. The story falls back to its poster for `imageDuration`. */
  error: { index: number; item: StoryItem; error: unknown };
  /** The viewer asked to close: Escape, swipe down or the close button. */
  close: { trigger: 'keyboard' | 'swipe' | 'button' };
}

export type StoryEventType = keyof StoryEventMap;
export type StoryEventListener<K extends StoryEventType> = (detail: StoryEventMap[K]) => void;

export const DEFAULT_LABELS: StoryLabels = {
  region: 'Stories',
  previous: 'Previous story',
  next: 'Next story',
  pause: 'Pause',
  play: 'Play',
  mute: 'Mute',
  unmute: 'Unmute',
  close: 'Close',
  link: 'Open link',
  position: 'Story {index} of {total}',
};
