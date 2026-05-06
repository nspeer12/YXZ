// Lesson registry. Add new lessons by:
//   1. Dropping a `<lesson-id>.json` file into this directory.
//   2. Importing and registering it below.
//
// The order in `LESSON_JSONS` is the recommended progression order. The UI
// groups them by category for display, but other consumers (e.g. a future
// "next lesson" suggester) iterate in this order.
//
// Section order: tuning → notes → rhythm → chords → scales → song.
// Within each section: starter → beginner → intermediate → advanced.

import type { LessonJson } from '../lesson-schema';

// ==== Tuning ====
// (no tuning lessons yet)

// ==== Notes ====
import openStringsWarmup from './open-strings-warmup.json';
import lowENotes from './low-e-notes.json';
import aStringNotes from './a-string-notes.json';
import dStringNotes from './d-string-notes.json';
import gStringNotes from './g-string-notes.json';
import bAndHighEStringNotes from './b-and-high-e-string-notes.json';

// ==== Rhythm & technique ====
import chromaticSpiderWalk from './chromatic-spider-walk.json';
import pickingWarmup1234 from './picking-warmup-1234.json';

// ==== Chords ====
import openEmChord from './open-em-chord.json';
import openAmChord from './open-am-chord.json';
import chordChangeEmAm from './chord-change-em-am.json';
import openMajorChords from './open-major-chords.json';
import chordChangeGC from './chord-change-g-c.json';
import powerChordsE5A5 from './power-chords-e5-a5.json';

// ==== Scales ====
import amPentatonicPosition1 from './am-pentatonic-position-1.json';
import cMajorScalePosition1 from './c-major-scale-position-1.json';

// ==== Songs — starter ====
import badMoonRising from './bad-moon-rising.json';
import freeFallin from './free-fallin.json';
import horseWithNoName from './horse-with-no-name.json';
import knockinOnHeavensDoor from './knockin-on-heavens-door.json';
import laBambaIntro from './la-bamba-intro.json';
import maryHadALittleLamb from './mary-had-a-little-lamb.json';
import saveTonight from './save-tonight.json';
import threeLittleBirds from './three-little-birds.json';
import youReallyGotMe from './you-really-got-me.json';

// ==== Songs — beginner ====
import backInBlackIntro from './back-in-black-intro.json';
import beatItVerse from './beat-it-verse.json';
import comeAsYouAre from './come-as-you-are.json';
import countryRoads from './country-roads.json';
import dayTripper from './day-tripper.json';
import enterSandmanIntro from './enter-sandman-intro.json';
import eyeOfTheTigerIntro from './eye-of-the-tiger-intro.json';
import heyJudeVerse from './hey-jude-verse.json';
import highwayToHellIntro from './highway-to-hell-intro.json';
import houseOfTheRisingSun from './house-of-the-rising-sun.json';
import imYours from './im-yours.json';
import ironManIntro from './iron-man-intro.json';
import letItBe from './let-it-be.json';
import paranoid from './paranoid.json';
import riptide from './riptide.json';
import sevenNationArmy from './seven-nation-army.json';
import smokeOnTheWaterIntro from './smoke-on-the-water-intro.json';
import standByMe from './stand-by-me.json';
import sunshineOfYourLove from './sunshine-of-your-love.json';
import wagonWheel from './wagon-wheel.json';
import wonderwall from './wonderwall.json';
import wonderwallIntro from './wonderwall-intro.json';

// ==== Songs — intermediate ====
import sweetChildOMineVerse from './sweet-child-o-mine-verse.json';

export const LESSON_JSONS: LessonJson[] = [
  // ---- Tuning ----
  // (none yet)

  // ---- Notes ----
  openStringsWarmup as LessonJson,
  lowENotes as LessonJson,
  aStringNotes as LessonJson,
  dStringNotes as LessonJson,
  gStringNotes as LessonJson,
  bAndHighEStringNotes as LessonJson,

  // ---- Rhythm & technique ----
  chromaticSpiderWalk as LessonJson,
  pickingWarmup1234 as LessonJson,

  // ---- Chords ----
  openEmChord as LessonJson,
  openAmChord as LessonJson,
  chordChangeEmAm as LessonJson,
  openMajorChords as LessonJson,
  chordChangeGC as LessonJson,
  powerChordsE5A5 as LessonJson,

  // ---- Scales ----
  amPentatonicPosition1 as LessonJson,
  cMajorScalePosition1 as LessonJson,

  // ---- Songs (starter, alpha by id) ----
  badMoonRising as LessonJson,
  freeFallin as LessonJson,
  horseWithNoName as LessonJson,
  knockinOnHeavensDoor as LessonJson,
  laBambaIntro as LessonJson,
  maryHadALittleLamb as LessonJson,
  saveTonight as LessonJson,
  threeLittleBirds as LessonJson,
  youReallyGotMe as LessonJson,

  // ---- Songs (beginner, alpha by id) ----
  backInBlackIntro as LessonJson,
  beatItVerse as LessonJson,
  comeAsYouAre as LessonJson,
  countryRoads as LessonJson,
  dayTripper as LessonJson,
  enterSandmanIntro as LessonJson,
  eyeOfTheTigerIntro as LessonJson,
  heyJudeVerse as LessonJson,
  highwayToHellIntro as LessonJson,
  houseOfTheRisingSun as LessonJson,
  imYours as LessonJson,
  ironManIntro as LessonJson,
  letItBe as LessonJson,
  paranoid as LessonJson,
  riptide as LessonJson,
  sevenNationArmy as LessonJson,
  smokeOnTheWaterIntro as LessonJson,
  standByMe as LessonJson,
  sunshineOfYourLove as LessonJson,
  wagonWheel as LessonJson,
  wonderwall as LessonJson,
  wonderwallIntro as LessonJson,

  // ---- Songs (intermediate) ----
  sweetChildOMineVerse as LessonJson,
];
