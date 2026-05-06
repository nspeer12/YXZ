// Real-time pitch detection over a Web Audio AnalyserNode.
//
// Uses the McLeod Pitch Method via `pitchy`, which is a lightweight,
// time-domain autocorrelation algorithm well-suited for monophonic
// instruments (a single guitar string at a time).

import { PitchDetector } from 'pitchy';
import { freqToMidi, midiToName } from './tuning';
import type { NoteName } from '@/lib/music-theory';

export interface DetectedPitch {
  /** Frequency in Hz, or null if no clear pitch detected. */
  frequency: number | null;
  /** Confidence 0..1 (higher = clearer pitch). */
  clarity: number;
  /** Nearest MIDI note number, or null. */
  midiNote: number | null;
  /** Cents offset from `midiNote` (negative = flat, positive = sharp). */
  cents: number;
  /** Note name like "E", "F#", or null. */
  noteName: NoteName | null;
  /** Octave number, or null. */
  octave: number | null;
  /** Time of detection (ms since timeOrigin). */
  timestamp: number;
}

export const EMPTY_PITCH: DetectedPitch = {
  frequency: null,
  clarity: 0,
  midiNote: null,
  cents: 0,
  noteName: null,
  octave: null,
  timestamp: 0,
};

/**
 * Wraps a pitchy `PitchDetector` and an `AnalyserNode` to produce
 * pitch readings on demand. The caller owns the rAF loop.
 */
export class GuitarPitchDetector {
  private detector: PitchDetector<Float32Array>;
  // Modern TS splits `Float32Array` into a generic; `getFloatTimeDomainData` is
  // typed to accept `Float32Array<ArrayBuffer>`, so we anchor the field to that.
  private buffer: Float32Array<ArrayBuffer>;
  private analyser: AnalyserNode;
  private sampleRate: number;
  /** Minimum clarity below which we treat the result as "no pitch". */
  private minClarity = 0.85;

  constructor(analyser: AnalyserNode, sampleRate: number) {
    this.analyser = analyser;
    this.sampleRate = sampleRate;
    const fftSize = analyser.fftSize;
    this.detector = PitchDetector.forFloat32Array(fftSize);
    this.buffer = new Float32Array(fftSize);
  }

  setMinClarity(value: number) {
    this.minClarity = value;
  }

  detect(): DetectedPitch {
    this.analyser.getFloatTimeDomainData(this.buffer);
    const [pitch, clarity] = this.detector.findPitch(this.buffer, this.sampleRate);
    const timestamp = performance.now();

    if (!Number.isFinite(pitch) || pitch <= 0 || clarity < this.minClarity) {
      return { ...EMPTY_PITCH, clarity, timestamp };
    }

    // Reject obvious sub-bass garbage (mic rumble) and ultrasonic spikes.
    if (pitch < 60 || pitch > 1500) {
      return { ...EMPTY_PITCH, clarity, timestamp };
    }

    const { midi, cents } = freqToMidi(pitch);
    const { name, octave } = midiToName(midi);
    return {
      frequency: pitch,
      clarity,
      midiNote: midi,
      cents,
      noteName: name,
      octave,
      timestamp,
    };
  }
}

/**
 * Recommended analyser configuration for guitar pitch detection.
 * Larger fftSize = lower minimum detectable frequency, but more latency.
 * 4096 at 48kHz = ~85ms window, low note: ~12Hz min — plenty for a low E (82Hz).
 */
export function configureAnalyserForGuitar(analyser: AnalyserNode) {
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0;
}
