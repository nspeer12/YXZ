// Guitar tuning + fretboard math.
//
// Convention used throughout the app:
//   - `string` is an index 0..N-1 where 0 is the LOWEST-pitched string (low E
//     on a standard 6-string) and N-1 is the highest (high E). This matches
//     how Rocksmith renders strings: thickest at the bottom, thinnest at the
//     top of the lane, but our index 0 is bottom-most.
//   - `fret` is an integer 0..MAX where 0 is "open" (no fret pressed).
//   - MIDI note numbers follow the standard: middle C = C4 = 60.

import { NOTE_NAMES, type NoteName } from '@/lib/music-theory';

export interface Tuning {
  id: string;
  name: string;
  // Open-string MIDI numbers, low to high.
  strings: readonly number[];
}

export const STANDARD_TUNING: Tuning = {
  id: 'standard',
  name: 'Standard (E A D G B E)',
  strings: [40, 45, 50, 55, 59, 64], // E2 A2 D3 G3 B3 E4
};

export const DROP_D_TUNING: Tuning = {
  id: 'drop-d',
  name: 'Drop D (D A D G B E)',
  strings: [38, 45, 50, 55, 59, 64],
};

export const HALF_STEP_DOWN: Tuning = {
  id: 'half-step-down',
  name: 'Eb Standard (Eb Ab Db Gb Bb Eb)',
  strings: [39, 44, 49, 54, 58, 63],
};

export const OPEN_G_TUNING: Tuning = {
  id: 'open-g',
  name: 'Open G (D G D G B D)',
  strings: [38, 43, 50, 55, 59, 62],
};

export const TUNINGS: Tuning[] = [STANDARD_TUNING, DROP_D_TUNING, HALF_STEP_DOWN, OPEN_G_TUNING];

export const STRING_LABELS_LOW_TO_HIGH = ['E (low)', 'A', 'D', 'G', 'B', 'E (high)'];

/** MIDI note number at (string, fret) for the given tuning. */
export function midiAt(tuning: Tuning, string: number, fret: number): number {
  return tuning.strings[string] + fret;
}

/** Convert MIDI note to display name like "E2" or "F#4". */
export function midiToName(midi: number): { name: NoteName; octave: number; full: string } {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { name, octave, full: `${name}${octave}` };
}

/** Convert frequency (Hz) to MIDI note number with cents offset from nearest semitone. */
export function freqToMidi(freq: number): { midi: number; cents: number } {
  if (freq <= 0) return { midi: 0, cents: 0 };
  const continuous = 12 * Math.log2(freq / 440) + 69;
  const midi = Math.round(continuous);
  const cents = (continuous - midi) * 100;
  return { midi, cents };
}

/** All (string, fret) positions on the fretboard that produce the given MIDI note. */
export function fretsForNote(
  tuning: Tuning,
  midi: number,
  maxFrets = 24,
): Array<{ string: number; fret: number }> {
  const result: Array<{ string: number; fret: number }> = [];
  for (let s = 0; s < tuning.strings.length; s++) {
    const fret = midi - tuning.strings[s];
    if (fret >= 0 && fret <= maxFrets) {
      result.push({ string: s, fret });
    }
  }
  return result;
}

/** Find the lowest (closest-to-open) position for a note, useful for first-position lessons. */
export function lowestPositionForNote(
  tuning: Tuning,
  midi: number,
  maxFrets = 24,
): { string: number; fret: number } | null {
  const candidates = fretsForNote(tuning, midi, maxFrets);
  if (candidates.length === 0) return null;
  // Prefer lower fret, then lower string.
  candidates.sort((a, b) => a.fret - b.fret || a.string - b.string);
  return candidates[0];
}

/** Reasonable pitch tolerance in cents for "in tune" detection. */
export const TUNE_TOLERANCE_CENTS = 5;
export const PLAY_TOLERANCE_CENTS = 35;
export const PATIENT_TOLERANCE_CENTS = 60;
