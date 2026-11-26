import 'video.js/dist/video-js.css';
import 'videojs-story-view/style.css';
import './style.css';

import '@videojs/html/video/player';
import '@videojs/html/ui/container';
import videojs from 'video.js';
import 'videojs-story-view/define';
import { registerStoryView } from 'videojs-story-view/videojs';
import { nature, travel, videos } from './stories';

// Custom element
const hero = document.getElementById('hero') as HTMLElementTagNameMap['story-view'];
hero.items = travel;

const log = document.getElementById('log') as HTMLElement;
const toggle = document.querySelector<HTMLButtonElement>('[data-action="toggle"]');
const mute = document.querySelector<HTMLButtonElement>('[data-action="mute"]');

hero.addEventListener('storychange', ({ detail }) => {
  log.textContent = `storychange: ${detail.index + 1} of ${hero.items.length}, ${detail.item.title ?? ''}`;
});
hero.addEventListener('pause', ({ detail }) => {
  log.textContent = `pause: ${detail.reason}`;
  if (toggle) toggle.textContent = 'Play';
});
hero.addEventListener('resume', () => {
  log.textContent = 'resume';
  if (toggle) toggle.textContent = 'Pause';
});
hero.addEventListener('mutechange', ({ detail }) => {
  if (mute) mute.textContent = detail.muted ? 'Sound on' : 'Sound off';
});
hero.addEventListener('complete', () => {
  log.textContent = 'complete: starting over';
});

document.querySelector('.toolbar')?.addEventListener('click', (event) => {
  const action = (event.target as HTMLElement).closest('button')?.dataset.action;
  if (action === 'prev') hero.prev();
  if (action === 'next') hero.next();
  if (action === 'toggle') hero.togglePlay();
  if (action === 'mute') hero.toggleMute();
});

// Video.js 8 plugin
registerStoryView(videojs);
const player = videojs('vjs8', { aspectRatio: '9:16', fluid: true });
player.storyView({ items: videos, loop: true });

// Video.js 10: <story-view media="v10-media"> inside the player container
const v10 = document.getElementById('v10') as HTMLElementTagNameMap['story-view'];
v10.items = videos.filter((item) => item.src.endsWith('.mp4') || item.src.endsWith('.m4v'));
v10.loop = true;

// Theming
for (const el of document.querySelectorAll<HTMLElementTagNameMap['story-view']>('.themes story-view')) {
  el.items = nature;
  el.loop = true;
}
