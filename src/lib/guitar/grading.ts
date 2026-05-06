// Grading logic for lesson exercises.
//
// A lesson exercise is a sequence of "target notes" — each target wants the
// player to hold a particular MIDI note for some window of time. We track
// detected pitches over time and decide pass/fail per target.

import type { DetectedPitch } from './pitch-detector';

export interface TargetNote {
  /** Stable id for this target within the exercise. */
  id: string;
  /** Target MIDI note (e.g. 40 for E2). The graded pitch. */
  midi: number;
  /** Primary fretboard position — also the graded note (string + fret). */
  string: number;
  fret: number;
  /** Beat position in the exercise (0-indexed, fractional ok). */
  beat: number;
  /** Duration in beats (defaults to 1). */
  duration?: number;
  /** Optional human label, e.g. "open low E" or "Em chord". */
  label?: string;
  /**
   * Full chord voicing for visualization only. When set, the highway/fretboard
   * render every position in this list (linked together) so the player sees
   * the whole shape. Grading still uses just `(string, fret)` above.
   */
  chord?: Array<{ string: number; fret: number }>;
  /**
   * Optional strum direction for chord targets. Default 'down'. 'mute' is a
   * percussive (palm-muted / chk) strum. Display only — not graded.
   */
  strum?: 'down' | 'up' | 'mute';
}

export interface GradingConfig {
  /** Cents tolerance for "right pitch". */
  toleranceCents: number;
  /** How long the correct pitch must be sustained (ms) to count as a hit. */
  requiredHoldMs: number;
  /** Window around the target's expected time (ms) within which we'll accept the hit. */
  timingWindowMs: number;
  /** Minimum pitch clarity to consider a sample. */
  minClarity: number;
  /**
   * Chord-specific grading overrides. Strummed chords are inherently noisier
   * than single plucked notes — pitchy (monophonic) latches onto whichever
   * harmonic is loudest at the moment, often an octave of the root or another
   * chord tone. So for chord targets we:
   *   - accept ANY pitch class in the voicing (not just the root)
   *   - require less clarity (chords have lower fundamental SNR)
   *   - require a shorter sustain (the dominant tone shifts during a strum)
   *   - allow looser pitch tolerance (cents detection drifts under polyphony)
   */
  chordToleranceCents: number;
  chordRequiredHoldMs: number;
  chordMinClarity: number;
}

export const DEFAULT_GRADING: GradingConfig = {
  toleranceCents: 35,
  requiredHoldMs: 250,
  timingWindowMs: 800,
  minClarity: 0.9,
  chordToleranceCents: 60,
  chordRequiredHoldMs: 90,
  chordMinClarity: 0.7,
};

export const PATIENT_GRADING: GradingConfig = {
  toleranceCents: 60,
  requiredHoldMs: 150,
  timingWindowMs: 2500,
  minClarity: 0.8,
  chordToleranceCents: 80,
  chordRequiredHoldMs: 60,
  chordMinClarity: 0.6,
};

export type TargetStatus = 'pending' | 'active' | 'hit' | 'missed';

// Standard-tuning string offsets (semitones above low E). Used to compute
// MIDI for chord positions when we only have target.midi (the primary).
const STANDARD_STRING_OFFSETS = [0, 5, 10, 15, 19, 24];

const pitchClass = (midi: number): number => ((midi % 12) + 12) % 12;

/**
 * Set of pitch classes (0..11) we'll accept for this target. For single-note
 * targets it's just the target's pitch class. For chords it's every pitch
 * class in the voicing — strumming makes pitchy latch onto any of them.
 */
export function acceptedPitchClasses(target: TargetNote): Set<number> {
  if (!target.chord || target.chord.length <= 1) {
    return new Set([pitchClass(target.midi)]);
  }
  // Reverse-engineer low-E MIDI from the primary position so we can compute
  // each chord position's MIDI. STANDARD_STRING_OFFSETS may be undefined for
  // out-of-range string indices; the parser already validates string < N so
  // this is mostly defensive.
  const primaryOff: number = STANDARD_STRING_OFFSETS[target.string] ?? 0;
  const baseLowE = target.midi - target.fret - primaryOff;
  const set = new Set<number>();
  for (const c of target.chord) {
    const off: number = STANDARD_STRING_OFFSETS[c.string] ?? 0;
    set.add(pitchClass(baseLowE + off + c.fret));
  }
  return set;
}

const isChordTarget = (target: TargetNote): boolean =>
  target.chord != null && target.chord.length > 1;

export interface TargetResult {
  targetId: string;
  status: TargetStatus;
  /** Average cents-off across the held window, if hit. */
  centsOff?: number;
  /** Time from window-open until first sustained match, if hit. */
  reactionMs?: number;
  /** ms of in-tune sustain accumulated. */
  sustainedMs: number;
}

/**
 * State machine driver for a single target. Feed it pitch samples while it's
 * "active" and it'll transition to `hit` or `missed`.
 */
export class TargetGrader {
  readonly target: TargetNote;
  readonly config: GradingConfig;
  readonly isChord: boolean;
  readonly acceptedClasses: Set<number>;

  status: TargetStatus = 'pending';
  windowOpenAt = 0;
  windowCloseAt = 0;
  matchStartAt: number | null = null;
  sustainedMs = 0;
  centsSum = 0;
  centsSamples = 0;
  reactionMs?: number;

  constructor(target: TargetNote, config: GradingConfig) {
    this.target = target;
    this.config = config;
    this.isChord = isChordTarget(target);
    this.acceptedClasses = acceptedPitchClasses(target);
  }

  open(now: number, durationMs: number) {
    this.status = 'active';
    this.windowOpenAt = now;
    this.windowCloseAt = now + durationMs + this.config.timingWindowMs;
  }

  /** Returns true if the target is now resolved (hit or missed). */
  feed(now: number, pitch: DetectedPitch): boolean {
    if (this.status !== 'active') return this.status === 'hit' || this.status === 'missed';

    const tolerance = this.isChord ? this.config.chordToleranceCents : this.config.toleranceCents;
    const minClarity = this.isChord ? this.config.chordMinClarity : this.config.minClarity;
    const requiredHold = this.isChord ? this.config.chordRequiredHoldMs : this.config.requiredHoldMs;

    let inTune = false;
    if (pitch.midiNote != null && pitch.clarity >= minClarity && Math.abs(pitch.cents) <= tolerance) {
      if (this.isChord) {
        // Accept ANY pitch class in the chord voicing, at any octave. A strum
        // can have its dominant detected harmonic shift between root, 3rd,
        // 5th — all of those should count.
        inTune = this.acceptedClasses.has(pitchClass(pitch.midiNote));
      } else {
        // Single-note: require the exact MIDI (octave matters for melodies).
        inTune = pitch.midiNote === this.target.midi;
      }
    }

    if (inTune) {
      if (this.matchStartAt == null) {
        this.matchStartAt = now;
      }
      const dt = now - (this.matchStartAt ?? now);
      this.sustainedMs = dt;
      this.centsSum += pitch.cents;
      this.centsSamples += 1;

      if (this.sustainedMs >= requiredHold) {
        this.status = 'hit';
        this.reactionMs = (this.matchStartAt ?? now) - this.windowOpenAt;
        return true;
      }
    } else if (this.matchStartAt != null) {
      // For chords, the dominant detected pitch flickers — don't aggressively
      // reset the sustain counter. Single notes still reset on any miss.
      if (!this.isChord) {
        this.matchStartAt = null;
        this.sustainedMs = 0;
      }
    }

    if (now >= this.windowCloseAt) {
      this.status = 'missed';
      return true;
    }
    return false;
  }

  result(): TargetResult {
    return {
      targetId: this.target.id,
      status: this.status,
      centsOff: this.centsSamples > 0 ? this.centsSum / this.centsSamples : undefined,
      reactionMs: this.reactionMs,
      sustainedMs: this.sustainedMs,
    };
  }
}

export interface SessionResult {
  hits: number;
  misses: number;
  total: number;
  accuracy: number;
  averageCentsOff: number;
  averageReactionMs: number;
  perTarget: TargetResult[];
}

export function summarize(results: TargetResult[]): SessionResult {
  const total = results.length;
  const hits = results.filter((r) => r.status === 'hit').length;
  const misses = results.filter((r) => r.status === 'missed').length;
  const centsValues = results.flatMap((r) => (r.centsOff != null ? [Math.abs(r.centsOff)] : []));
  const reactionValues = results.flatMap((r) => (r.reactionMs != null ? [r.reactionMs] : []));
  const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  return {
    hits,
    misses,
    total,
    accuracy: total === 0 ? 0 : hits / total,
    averageCentsOff: avg(centsValues),
    averageReactionMs: avg(reactionValues),
    perTarget: results,
  };
}
