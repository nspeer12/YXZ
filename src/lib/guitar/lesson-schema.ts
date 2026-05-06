// JSON schema and parser for lesson files.
//
// Lessons live as JSON files under `src/lib/guitar/lessons/*.json` and are
// imported statically by `lessons/index.ts`. The schema below defines what an
// authored lesson file looks like; `parseLesson` turns the JSON into a runtime
// `Lesson` (with MIDI numbers resolved from string/fret + tuning).
//
// Authoring conventions (see also: .claude/skills/create-guitar-lesson):
//   - String index 0 = LOW E (thickest). 5 = HIGH E (thinnest).
//   - Fret 0 = open string.
//   - `beat` is in beats from the start of the exercise (after count-in).
//   - `duration` is in beats and defaults to 1.
//   - BPM applies to the whole exercise.

import type { TargetNote } from './grading';
import { TUNINGS, midiAt, midiToName, type Tuning, STANDARD_TUNING } from './tuning';

// Local copies of the discriminator types so this file does not depend on
// curriculum.ts (which imports back from here at runtime).
type LessonCategory = 'tuning' | 'notes' | 'chords' | 'scales' | 'rhythm' | 'song';
type LessonDifficulty = 'starter' | 'beginner' | 'intermediate' | 'advanced';

/** Display-only annotation: a lyric segment anchored to a beat. */
export interface LyricBeat {
  beat: number;
  text: string;
}

/** Display-only annotation: a chord-name label at a beat (e.g. "G", "Em7"). */
export interface ChordAnnotation {
  beat: number;
  name: string;
  /** Optional voicing for visualization (e.g. on the fretboard). */
  voicing?: Array<{ string: number; fret: number }>;
}

interface ParsedExercise {
  id: string;
  title: string;
  instruction?: string;
  bpm: number;
  beatsPerBar?: number;
  countInBeats?: number;
  loop?: boolean;
  targets: TargetNote[];
  lyrics?: LyricBeat[];
  chordAnnotations?: ChordAnnotation[];
}

export interface ParsedLesson {
  id: string;
  title: string;
  description: string;
  category: LessonCategory;
  difficulty: LessonDifficulty;
  prerequisites: string[];
  passAccuracy?: number;
  media?: LessonMediaJson;
  credits?: string;
  tuningId: string;
  exercises: ParsedExercise[];
  artist?: string;
  year?: number;
  tags?: string[];
}

export interface LessonMediaJson {
  /** YouTube video URL or bare video ID. */
  youtube?: string;
  /** Spotify track URI (`spotify:track:...`), share URL, or embed URL. */
  spotify?: string;
  /** URL to original tab source (Ultimate Guitar, Songsterr, etc.). */
  tabSource?: string;
  /** Optional preview image (album art etc.). */
  image?: string;
}

export interface TargetJson {
  /** Stable id within the exercise (e.g. "1", "n3", "riff-a"). */
  id: string;
  /** 0 = low E, 5 = high E. The GRADED string — pitch detection checks this string's note. */
  string: number;
  /** Fret 0 (open) to 24. The GRADED fret. */
  fret: number;
  /** Beat position within the exercise. */
  beat: number;
  /** Duration in beats. Defaults to 1. */
  duration?: number;
  /** Optional human-readable label, e.g. "C", "open low E", "Em chord". */
  label?: string;
  /**
   * Full chord voicing for visualization. When set, the highway renders every
   * position in this list as a linked group so the player can see the shape.
   * Pitch grading still operates on the primary `(string, fret)` above
   * (typically the chord root). Should include the primary position in the
   * list — the renderer recognizes it.
   */
  chord?: Array<{ string: number; fret: number }>;
  /** Optional strum direction for chord targets. Default 'down'. Display only. */
  strum?: 'down' | 'up' | 'mute';
}

export interface LyricBeatJson {
  beat: number;
  text: string;
}

export interface ChordAnnotationJson {
  beat: number;
  name: string;
  voicing?: Array<{ string: number; fret: number }>;
}

export interface ExerciseJson {
  id: string;
  title: string;
  instruction?: string;
  bpm: number;
  beatsPerBar?: number;
  countInBeats?: number;
  loop?: boolean;
  targets: TargetJson[];
  /**
   * Display-only stream: lyric text anchored to beats. Rendered above the tab
   * sheet (Ultimate-Guitar style) and as a rolling caption above the Highway.
   * Has no effect on grading.
   */
  lyrics?: LyricBeatJson[];
  /**
   * Display-only stream: chord-name labels at specific beats. Rendered above
   * the lyric line in the tab sheet. Distinct from the `chord` field on a
   * target — annotations are not graded; targets are.
   */
  chordAnnotations?: ChordAnnotationJson[];
}

export interface LessonJson {
  id: string;
  title: string;
  description: string;
  category: LessonCategory;
  difficulty: LessonDifficulty;
  /** Tuning id from `TUNINGS`. Defaults to "standard". */
  tuning?: string;
  /** Lessons that should ideally be done first (suggestions only — not enforced). */
  prerequisites?: string[];
  /** Pass threshold 0..1, default 0.7. */
  passAccuracy?: number;
  media?: LessonMediaJson;
  /** Optional credits / authoring notes shown in the UI. */
  credits?: string;
  exercises: ExerciseJson[];
  /** Original recording artist (for song lessons). */
  artist?: string;
  /** Release year (for song lessons). */
  year?: number;
  /** Free-form tags for cataloging (e.g. "campfire", "rock-classic", "90s"). */
  tags?: string[];
}

export class LessonValidationError extends Error {
  constructor(message: string, readonly path: string) {
    super(`[${path}] ${message}`);
    this.name = 'LessonValidationError';
  }
}

function assert(cond: unknown, msg: string, path: string): asserts cond {
  if (!cond) throw new LessonValidationError(msg, path);
}

function resolveTuning(id: string | undefined): Tuning {
  if (!id) return STANDARD_TUNING;
  return TUNINGS.find((t) => t.id === id) ?? STANDARD_TUNING;
}

function parseTarget(json: TargetJson, path: string, tuning: Tuning): TargetNote {
  assert(typeof json.id === 'string' && json.id.length > 0, 'target.id required', path);
  assert(Number.isInteger(json.string) && json.string >= 0 && json.string < tuning.strings.length, `string must be 0..${tuning.strings.length - 1}`, path);
  assert(Number.isInteger(json.fret) && json.fret >= 0 && json.fret <= 24, 'fret must be 0..24', path);
  assert(Number.isFinite(json.beat) && json.beat >= 0, 'beat must be ≥ 0', path);
  if (json.duration != null) {
    assert(Number.isFinite(json.duration) && json.duration > 0, 'duration must be > 0', path);
  }
  let chord: Array<{ string: number; fret: number }> | undefined;
  if (json.chord) {
    assert(Array.isArray(json.chord), 'target.chord must be an array', path);
    chord = json.chord.map((c, i) => {
      assert(Number.isInteger(c.string) && c.string >= 0 && c.string < tuning.strings.length, `chord[${i}].string out of range`, path);
      assert(Number.isInteger(c.fret) && c.fret >= 0 && c.fret <= 24, `chord[${i}].fret out of range`, path);
      return { string: c.string, fret: c.fret };
    });
  }
  let strum: 'down' | 'up' | 'mute' | undefined;
  if (json.strum != null) {
    assert(json.strum === 'down' || json.strum === 'up' || json.strum === 'mute',
      'strum must be "down" | "up" | "mute"', path);
    strum = json.strum;
  }
  const midi = midiAt(tuning, json.string, json.fret);
  return {
    id: json.id,
    midi,
    string: json.string,
    fret: json.fret,
    beat: json.beat,
    duration: json.duration,
    label: json.label ?? midiToName(midi).full,
    chord,
    strum,
  };
}

function parseExercise(json: ExerciseJson, path: string, tuning: Tuning): ParsedExercise {
  assert(typeof json.id === 'string' && json.id.length > 0, 'exercise.id required', path);
  assert(typeof json.title === 'string' && json.title.length > 0, 'exercise.title required', path);
  assert(Number.isFinite(json.bpm) && json.bpm > 0 && json.bpm < 400, 'bpm must be (0, 400)', path);
  assert(Array.isArray(json.targets), 'targets must be an array', path);
  assert(json.targets.length > 0, 'exercise must have at least one target', path);

  const targets = json.targets.map((t, i) => parseTarget(t, `${path}.targets[${i}]`, tuning));

  let lyrics: LyricBeat[] | undefined;
  if (json.lyrics) {
    assert(Array.isArray(json.lyrics), 'lyrics must be an array', path);
    lyrics = json.lyrics.map((l, i) => {
      const lp = `${path}.lyrics[${i}]`;
      assert(Number.isFinite(l.beat) && l.beat >= 0, 'lyric.beat must be ≥ 0', lp);
      assert(typeof l.text === 'string', 'lyric.text required', lp);
      return { beat: l.beat, text: l.text };
    });
  }

  let chordAnnotations: ChordAnnotation[] | undefined;
  if (json.chordAnnotations) {
    assert(Array.isArray(json.chordAnnotations), 'chordAnnotations must be an array', path);
    chordAnnotations = json.chordAnnotations.map((c, i) => {
      const cp = `${path}.chordAnnotations[${i}]`;
      assert(Number.isFinite(c.beat) && c.beat >= 0, 'chord.beat must be ≥ 0', cp);
      assert(typeof c.name === 'string' && c.name.length > 0, 'chord.name required', cp);
      let voicing: Array<{ string: number; fret: number }> | undefined;
      if (c.voicing) {
        voicing = c.voicing.map((v, j) => {
          const vp = `${cp}.voicing[${j}]`;
          assert(Number.isInteger(v.string) && v.string >= 0 && v.string < tuning.strings.length, 'voicing.string out of range', vp);
          assert(Number.isInteger(v.fret) && v.fret >= 0 && v.fret <= 24, 'voicing.fret out of range', vp);
          return { string: v.string, fret: v.fret };
        });
      }
      return { beat: c.beat, name: c.name, voicing };
    });
  }

  return {
    id: json.id,
    title: json.title,
    instruction: json.instruction,
    bpm: json.bpm,
    beatsPerBar: json.beatsPerBar,
    countInBeats: json.countInBeats,
    loop: json.loop,
    targets,
    lyrics,
    chordAnnotations,
  };
}

const VALID_CATEGORIES: LessonCategory[] = ['tuning', 'notes', 'chords', 'scales', 'rhythm', 'song'];
const VALID_DIFFICULTIES: LessonDifficulty[] = ['starter', 'beginner', 'intermediate', 'advanced'];

export function parseLesson(json: LessonJson, path = 'lesson'): ParsedLesson {
  assert(typeof json.id === 'string' && json.id.length > 0, 'id required', path);
  assert(typeof json.title === 'string' && json.title.length > 0, 'title required', path);
  assert(typeof json.description === 'string', 'description required', path);
  assert(VALID_CATEGORIES.includes(json.category), `category must be one of ${VALID_CATEGORIES.join(', ')}`, path);
  assert(VALID_DIFFICULTIES.includes(json.difficulty), `difficulty must be one of ${VALID_DIFFICULTIES.join(', ')}`, path);
  assert(Array.isArray(json.exercises) && json.exercises.length > 0, 'lesson must have at least one exercise', path);

  const tuning = resolveTuning(json.tuning);
  const exercises = json.exercises.map((e, i) => parseExercise(e, `${path}.exercises[${i}]`, tuning));

  if (json.year != null) {
    assert(Number.isInteger(json.year) && json.year > 1800 && json.year < 2100, 'year out of range', path);
  }
  if (json.tags != null) {
    assert(Array.isArray(json.tags) && json.tags.every((t) => typeof t === 'string'), 'tags must be string[]', path);
  }

  return {
    id: json.id,
    title: json.title,
    description: json.description,
    category: json.category,
    difficulty: json.difficulty,
    prerequisites: json.prerequisites ?? [],
    passAccuracy: json.passAccuracy ?? 0.7,
    media: json.media,
    credits: json.credits,
    tuningId: tuning.id,
    exercises,
    artist: json.artist,
    year: json.year,
    tags: json.tags,
  };
}

export function parseLessons(jsonArray: LessonJson[]): ParsedLesson[] {
  const seen = new Set<string>();
  return jsonArray.map((json, i) => {
    const lesson = parseLesson(json, `lessons[${i}]`);
    if (seen.has(lesson.id)) {
      throw new LessonValidationError(`duplicate lesson id "${lesson.id}"`, `lessons[${i}]`);
    }
    seen.add(lesson.id);
    return lesson;
  });
}

// ---- Media URL helpers ----

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function youtubeIdFromUrl(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (YOUTUBE_ID_RE.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '');
      return YOUTUBE_ID_RE.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v');
        return id && YOUTUBE_ID_RE.test(id) ? id : null;
      }
      const matchEmbed = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})$/);
      if (matchEmbed) return matchEmbed[1];
      const matchShorts = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})$/);
      if (matchShorts) return matchShorts[1];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export function spotifyEmbedFromUrl(input: string): { kind: 'track' | 'album' | 'playlist' | 'episode'; id: string } | null {
  if (!input) return null;
  const trimmed = input.trim();
  // spotify:track:ID
  const uriMatch = trimmed.match(/^spotify:(track|album|playlist|episode):([A-Za-z0-9]+)$/);
  if (uriMatch) {
    return { kind: uriMatch[1] as 'track', id: uriMatch[2] };
  }
  try {
    const url = new URL(trimmed);
    if (url.hostname === 'open.spotify.com' || url.hostname === 'spotify.com') {
      // /track/ID, /album/ID, /playlist/ID, /episode/ID, or /embed/track/ID
      const m = url.pathname.match(/^\/(?:embed\/)?(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
      if (m) return { kind: m[1] as 'track', id: m[2] };
    }
  } catch {
    /* not a URL */
  }
  return null;
}
