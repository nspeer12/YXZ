---
name: create-guitar-lesson
description: Use this skill when the user wants to author a new guitar lesson for the Guitar Lab in this project — including converting an Ultimate Guitar / tab text / chord chart into a playable lesson, adding a song-based lesson, or designing a technique/scale/chord drill. Triggers on phrases like "create a lesson", "import this tab", "turn this into a lesson", "add a song lesson", "make a chord lesson", or any time the user pastes a guitar tab and asks Claude to convert it.
---

# Create a Guitar Lab lesson

This project's Guitar Lab loads lessons from JSON files at `src/lib/guitar/lessons/*.json`. Each file is a single lesson; lessons are registered in `src/lib/guitar/lessons/index.ts`.

A lesson contains one or more **exercises**, each with a sequence of **target notes**. The lesson runtime grades the player by listening to their guitar through the mic / audio interface and matching detected pitch + timing against the targets.

## Workflow

1. Pick a lesson `id` — kebab-case, unique, descriptive (e.g. `smoke-on-the-water-intro`).
2. Write `src/lib/guitar/lessons/<id>.json` with the schema below.
3. Add `import <camelId> from './<id>.json';` and append it to the `LESSON_JSONS` array in `src/lib/guitar/lessons/index.ts`.
4. Validate by running the build: `npm run build`. The parser will reject malformed lessons with a precise error.

## Schema

```ts
type LessonCategory = 'tuning' | 'notes' | 'chords' | 'scales' | 'rhythm' | 'song';
type LessonDifficulty = 'starter' | 'beginner' | 'intermediate' | 'advanced';

interface LessonJson {
  id: string;                  // kebab-case, unique
  title: string;               // human-friendly, ~3-6 words
  description: string;         // 1-2 sentences shown on the card
  category: LessonCategory;
  difficulty: LessonDifficulty;
  tuning?: 'standard' | 'drop-d' | 'half-step-down' | 'open-g'; // default 'standard'
  prerequisites?: string[];    // soft suggestion (not enforced)
  passAccuracy?: number;       // 0..1, default 0.7
  media?: {
    youtube?: string;          // full URL or 11-char video ID
    spotify?: string;          // spotify URI or share URL (track/album/playlist/episode)
    tabSource?: string;        // URL to original tab (Ultimate Guitar, Songsterr, etc.)
    image?: string;            // optional preview image URL
  };
  credits?: string;            // optional attribution shown in player
  exercises: ExerciseJson[];
}

interface ExerciseJson {
  id: string;                  // unique within the lesson
  title: string;
  instruction?: string;        // shown on the intro screen
  bpm: number;                 // 30-300
  beatsPerBar?: number;        // default 4
  countInBeats?: number;       // default 4
  loop?: boolean;              // default false
  targets: TargetJson[];
}

interface TargetJson {
  id: string;                  // unique within the exercise
  string: number;              // 0 = LOW E (thickest), 5 = high E (thinnest)
  fret: number;                // 0 = open, up to 24
  beat: number;                // 0-indexed beats from start of exercise
  duration?: number;           // beats, default 1
  label?: string;              // optional override (e.g. "C" for chord root)
}
```

## Conventions — read carefully

- **String index 0 is LOW E** (the thickest/lowest-pitched string on a 6-string).
- Standard tuning MIDI: low E=40, A=45, D=50, G=55, B=59, high E=64.
- `beat: 0` is the moment the exercise begins (after the count-in).
- For chord *strums* in this MVP, treat each chord as a single target on the chord root note. Multi-note simultaneous targets aren't graded yet; pick one representative note (usually the root) and label it with the chord name.
- BPM should match the song or be slow enough that a beginner can keep up. **Always include a 60–80 BPM "slow" practice exercise first.**
- Provide **at least two exercises per song lesson**: a slow version and a target-tempo version.

## Tab-to-lesson conversion (cookbook)

A typical ASCII guitar tab looks like:

```
e|------------|
B|------------|
G|--------5-7-|
D|--5--7------|
A|------------|
E|------------|
```

Lines are strings, written **high-to-low**. Hyphens are silence, digits are fret numbers (multi-digit numbers like `10` occupy two columns — count them as a single note at the *first* column).

Steps:

1. Decide BPM and rhythmic resolution. If unsure, assume each character = 1/8 note (eighth note) at 80 BPM.
2. Map tab strings to JSON `string` indices:
   - tab `e` (top) → `string: 5`
   - tab `B` → `string: 4`
   - tab `G` → `string: 3`
   - tab `D` → `string: 2`
   - tab `A` → `string: 1`
   - tab `E` (bottom) → `string: 0`
3. Walk left-to-right. For each column where exactly one string has a digit, emit a target:
   - `beat: column_index * 0.5` (if eighth notes), or `column_index * 0.25` (sixteenth notes)
   - `fret: <the digit>`
   - `duration: 0.5` (or whatever fits the next column)
4. Multi-string columns (chords): for now pick the lowest string in that column as the representative target. Document the full chord in the target's `label`.
5. For lessons converted from tabs, **always set `media.tabSource`** to the source URL so the player can credit it.

### Worked example — first 4 notes of *Smoke on the Water*

Tab line (low strings, eighth notes):
```
D|--0----3----5---|
A|----------------|
E|----------------|
```

JSON exercise (BPM 112, eighth notes → beat increments of 0.5):

```json
{
  "id": "main-riff",
  "title": "Main riff",
  "instruction": "Two strings at once on the original — for now just hit the lower note (D string). Slow practice tempo.",
  "bpm": 56,
  "targets": [
    { "id": "1", "string": 2, "fret": 0, "beat": 0,   "duration": 0.5, "label": "D (open)" },
    { "id": "2", "string": 2, "fret": 3, "beat": 1,   "duration": 0.5, "label": "F" },
    { "id": "3", "string": 2, "fret": 5, "beat": 2,   "duration": 0.5, "label": "G" }
  ]
}
```

## Choosing media

- **YouTube**: prefer a clear, well-shot performance / tutorial video. Paste the full `https://www.youtube.com/watch?v=...` URL or the bare video ID.
- **Spotify**: paste the share URL (`https://open.spotify.com/track/...`) or URI. Embedded players are 152px tall for tracks, 380px for albums/playlists/episodes.
- **Tab source**: link to the original tab so players can read along.

## Pass accuracy guidance

- `tuning` lessons: 0.85 (you really need to be in tune)
- single-note drills: 0.7
- chord/scale drills: 0.6 (chord-grading is approximate in MVP)
- songs: 0.55 (musical performance, give grace)

## Difficulty rubric

- **starter**: open strings only, no fretting, slow tempo
- **beginner**: single-note melodies on one string, simple open chords, ≤90 BPM
- **intermediate**: multi-string riffs, basic barre chords, 90–140 BPM
- **advanced**: fast picking, complex chord changes, full songs at tempo

## After authoring

After dropping the JSON file in `src/lib/guitar/lessons/` and registering it in `index.ts`, run `npm run build` and confirm no validation errors. Then `npm run dev` and click into the new lesson to play through it once before declaring it done.

## When importing from a pasted tab

If the user pastes a tab string (e.g. from Ultimate Guitar):

1. **Confirm the song name + artist + tuning** in 1 short question if any of those are unclear from the paste.
2. Identify the section (intro, verse, chorus, solo) — make a separate exercise per section.
3. Use the cookbook above to convert. Default to eighth-note resolution unless the tab clearly indicates 16ths.
4. Always create both a slow (50% tempo) and target-tempo exercise.
5. Set `media.tabSource` to the URL the user provided (or note "user-supplied tab" in `credits` if no URL).
6. Suggest a YouTube / Spotify link by name; the user can paste the actual URL or accept a search query.

## DO NOT

- Don't author lessons that require pitch detection of multiple simultaneous notes (chord-grading is single-root for now).
- Don't use `string` indices > 5 (this is a 6-string app).
- Don't pick BPMs above 200 — pitch detection latency makes that unreliable.
- Don't embed copyrighted tab text directly; link to the source instead.
