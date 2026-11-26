import type { StoryItem } from 'videojs-story-view';

// Openly licensed media, loaded from the original hosts. See the README for credits.
const photo = (id: number) => `https://picsum.photos/id/${id}/720/1280`;
const avatar = (id: number) => `https://picsum.photos/id/${id}/96/96`;

export const OCEANS = 'https://vjs.zencdn.net/v/oceans.mp4';
export const SINTEL = 'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4';
export const BUNNY = 'https://download.blender.org/peach/trailer/trailer_iphone.m4v';

export const travel: StoryItem[] = [
  {
    src: OCEANS,
    duration: 8,
    alt: 'Underwater footage of the ocean',
    title: 'Video.js',
    subtitle: 'Oceans',
    avatar: avatar(64),
  },
  {
    src: photo(1036),
    alt: 'Snowy mountains under a cloudy sky',
    title: 'Wolfgang Lutz',
    subtitle: 'Unsplash',
    avatar: avatar(1036),
  },
  {
    src: SINTEL,
    duration: 10,
    alt: 'Trailer of the Blender open movie Sintel',
    title: 'Blender Studio',
    subtitle: 'Sintel trailer',
    avatar: avatar(1043),
    link: { href: 'https://durian.blender.org/', label: 'About Sintel' },
  },
  {
    src: photo(1015),
    alt: 'A river winding through a valley',
    title: 'Alexey Topolyanskiy',
    subtitle: 'Unsplash',
    avatar: avatar(1015),
  },
  {
    src: BUNNY,
    duration: 10,
    alt: 'Trailer of the Blender open movie Big Buck Bunny',
    title: 'Blender Studio',
    subtitle: 'Big Buck Bunny trailer',
    avatar: avatar(1043),
    link: { href: 'https://peach.blender.org/', label: 'About Big Buck Bunny' },
  },
];

export const nature: StoryItem[] = [
  { src: photo(1018), alt: 'Mountains and a forest by a lake', title: 'Andrew Ridley', subtitle: 'Unsplash', avatar: avatar(1018) },
  { src: photo(1039), alt: 'A waterfall in a green forest', title: 'Andrew Coelho', subtitle: 'Unsplash', avatar: avatar(1039) },
  { src: photo(1044), alt: 'Sunlight over a misty valley', title: 'Steve Carter', subtitle: 'Unsplash', avatar: avatar(1044) },
];

export const videos: StoryItem[] = [
  { src: SINTEL, duration: 8, title: 'Sintel', subtitle: 'Blender Studio', poster: photo(1057) },
  { src: OCEANS, duration: 8, title: 'Oceans', subtitle: 'Video.js sample' },
  { src: photo(1050), title: 'Photo break', subtitle: 'Joseph Barrientos' },
  { src: BUNNY, duration: 8, title: 'Big Buck Bunny', subtitle: 'Blender Studio' },
];
