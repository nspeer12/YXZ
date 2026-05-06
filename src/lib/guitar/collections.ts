// Collections — curated playlists of lessons grouped by theme/era/technique.
// Lessons can appear in multiple collections.
//
// Usage:
//   import { COLLECTIONS, getLessonsInCollection } from '@/lib/guitar/collections';

import { CURRICULUM, type Lesson } from './curriculum';

export interface Collection {
  /** Stable slug used in URLs / persistence. */
  id: string;
  /** Display title. */
  title: string;
  /** Short description shown on the collection card. */
  description: string;
  /** Optional accent color (hex) — falls back to category accent if omitted. */
  accent?: string;
  /** Optional emoji or short glyph for the card. */
  glyph?: string;
  /** Lesson ids in playback order. Lessons not in CURRICULUM are silently skipped. */
  lessonIds: string[];
}

export const COLLECTIONS: Collection[] = [
  {
    id: 'first-week',
    title: 'Your first week',
    description:
      'A gentle on-ramp: tune your ear to the open strings, learn your first chord, and play three songs you actually recognize.',
    accent: '#84cc16',
    glyph: '🌱',
    lessonIds: [
      'open-strings-warmup',
      'open-em-chord',
      'chord-change-em-am',
      'horse-with-no-name',
      'three-little-birds',
      'knockin-on-heavens-door',
      'la-bamba-intro',
    ],
  },
  {
    id: 'riffs-everyone-knows',
    title: 'Riffs everyone knows',
    description:
      'The single-note riffs that every guitarist learns at some point. Play these at a party and someone will smile.',
    accent: '#f97316',
    glyph: '🎸',
    lessonIds: [
      'smoke-on-the-water-intro',
      'seven-nation-army',
      'iron-man-intro',
      'sunshine-of-your-love',
      'day-tripper',
      'back-in-black-intro',
      'you-really-got-me',
    ],
  },
  {
    id: 'campfire-classics',
    title: 'Campfire classics',
    description:
      'Open chords, simple progressions, and singalong tunes. Bring your acoustic and a few friends.',
    accent: '#f59e0b',
    glyph: '🔥',
    lessonIds: [
      'three-little-birds',
      'knockin-on-heavens-door',
      'horse-with-no-name',
      'country-roads',
      'wagon-wheel',
      'free-fallin',
      'wonderwall',
      'stand-by-me',
      'save-tonight',
      'bad-moon-rising',
      'im-yours',
    ],
  },
  {
    id: '90s-alternative',
    title: '90s alternative',
    description:
      'Flannel, distortion, and four chords that defined a decade. Crank a small amp and let it ring.',
    accent: '#a855f7',
    glyph: '📻',
    lessonIds: [
      'wonderwall',
      'come-as-you-are',
      'enter-sandman-intro',
      'save-tonight',
    ],
  },
  {
    id: 'four-chord-pop',
    title: 'Four-chord pop magic',
    description:
      'The same four chords power half the radio. Once you have them down, you have a hundred songs.',
    accent: '#ec4899',
    glyph: '🎶',
    lessonIds: [
      'stand-by-me',
      'im-yours',
      'let-it-be',
      'wagon-wheel',
      'save-tonight',
      'riptide',
    ],
  },
  {
    id: 'metal-starter-pack',
    title: 'Metal starter pack',
    description:
      'Power chords, palm mutes, and the riffs that built heavy music. Start here, end up wherever.',
    accent: '#ef4444',
    glyph: '🤘',
    lessonIds: [
      'iron-man-intro',
      'paranoid',
      'enter-sandman-intro',
      'beat-it-verse',
      'back-in-black-intro',
    ],
  },
  {
    id: '60s-foundations',
    title: '60s foundations',
    description:
      'Where rock guitar came from. The riffs, progressions, and folk tunes that everything since has been built on.',
    accent: '#8b5cf6',
    glyph: '☮️',
    lessonIds: [
      'day-tripper',
      'house-of-the-rising-sun',
      'stand-by-me',
      'hey-jude-verse',
      'you-really-got-me',
      'la-bamba-intro',
      'sunshine-of-your-love',
    ],
  },
  {
    id: '80s-anthems',
    title: '80s anthems',
    description:
      'Hair, neon, and arena-sized hooks. Big chords, big choruses, big amps optional but encouraged.',
    accent: '#06b6d4',
    glyph: '⚡',
    lessonIds: [
      'eye-of-the-tiger-intro',
      'back-in-black-intro',
      'beat-it-verse',
      'free-fallin',
      'sweet-child-o-mine-verse',
    ],
  },
  {
    id: 'acdc-and-friends',
    title: 'Stadium rock',
    description:
      'Big riffs for big rooms. AC/DC, GNR, Metallica, Survivor — the songs designed to be heard from the back row.',
    accent: '#dc2626',
    glyph: '🏟️',
    lessonIds: [
      'back-in-black-intro',
      'highway-to-hell-intro',
      'eye-of-the-tiger-intro',
      'sweet-child-o-mine-verse',
      'enter-sandman-intro',
    ],
  },
];

export function getCollection(id: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.id === id);
}

export function getLessonsInCollection(id: string): Lesson[] {
  const collection = getCollection(id);
  if (!collection) return [];
  const byId = new Map(CURRICULUM.map((l) => [l.id, l]));
  return collection.lessonIds.flatMap((lid) => {
    const l = byId.get(lid);
    return l ? [l] : [];
  });
}

export function collectionsForLesson(lessonId: string): Collection[] {
  return COLLECTIONS.filter((c) => c.lessonIds.includes(lessonId));
}
