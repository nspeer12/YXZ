// Lesson types + curriculum loader.
//
// Lessons themselves live in JSON files under `lessons/*.json`. They are
// statically imported in `lessons/index.ts`, parsed and validated, and
// exposed here as the `CURRICULUM` array.
//
// Authoring conventions live in `.claude/skills/create-guitar-lesson/SKILL.md`.

import type { TargetNote } from './grading';
import { LESSON_JSONS } from './lessons';
import { parseLessons, type LessonJson, type LessonMediaJson, type LyricBeat, type ChordAnnotation } from './lesson-schema';

export type LessonCategory = 'tuning' | 'notes' | 'chords' | 'scales' | 'rhythm' | 'song';
export type LessonDifficulty = 'starter' | 'beginner' | 'intermediate' | 'advanced';

export interface Exercise {
  id: string;
  title: string;
  instruction?: string;
  bpm: number;
  beatsPerBar?: number;
  countInBeats?: number;
  targets: TargetNote[];
  loop?: boolean;
  /** Display-only: lyric segments anchored to beats. */
  lyrics?: LyricBeat[];
  /** Display-only: chord-name labels at specific beats. */
  chordAnnotations?: ChordAnnotation[];
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  category: LessonCategory;
  difficulty: LessonDifficulty;
  prerequisites: string[];
  exercises: Exercise[];
  passAccuracy?: number;
  media?: LessonMediaJson;
  credits?: string;
  tuningId?: string;
  artist?: string;
  year?: number;
  tags?: string[];
}

export const CURRICULUM: Lesson[] = parseLessons(LESSON_JSONS as LessonJson[]);

export function getLesson(id: string): Lesson | undefined {
  return CURRICULUM.find((l) => l.id === id);
}

export type { TargetNote } from './grading';
export type { LessonJson, LessonMediaJson, LyricBeat, ChordAnnotation } from './lesson-schema';
