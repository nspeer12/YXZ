// Acoustic-guitar-ish preview synth.
//
// Uses Tone.js PluckSynth (Karplus-Strong physical-modeling) wrapped in a
// PolySynth so we can play full chords, plus a short reverb for room. It
// won't fool anyone into thinking it's a real Martin, but it sounds far more
// guitar-like than a generic sine/square synth and gives the player a clear
// reference for tempo, melody contour, and chord changes.

import * as Tone from 'tone';
import type { TargetNote } from './grading';
import { midiToName } from './tuning';

export interface PreviewState {
  isPlaying: boolean;
  /** Beat the preview clock is currently at. -1 if not playing. */
  currentBeat: number;
}

export type PreviewListener = (state: PreviewState) => void;

/**
 * One-shot preview player. Construct, call `play(targets, bpm)`, optionally
 * subscribe to state via `addListener`. `dispose()` releases everything.
 */
// PluckSynth is monophonic and can't be wrapped in Tone.PolySynth (which
// expects a Monophonic voice). For chord strums we instead keep a small
// pool of PluckSynth voices and round-robin through them — each pluck
// gets its own voice so they ring out together like a real guitar.
const VOICE_POOL_SIZE = 12;

export class GuitarPreview {
  private voices: Tone.PluckSynth[] = [];
  private voiceIndex = 0;
  private reverb: Tone.Reverb | null = null;
  private gain: Tone.Gain | null = null;
  private listeners = new Set<PreviewListener>();
  private rafId: number | null = null;
  private startedAtCtxTime = 0;
  private msPerBeat = 0;
  private totalBeats = 0;
  private playing = false;
  /** Tone events scheduled, so we can cancel them on stop. */
  private scheduledIds: number[] = [];

  /** Lazily build the audio graph on first play (must be from a user gesture). */
  private async ensureGraph() {
    if (this.voices.length > 0) return;
    await Tone.start();
    this.gain = new Tone.Gain(0.6).toDestination();
    this.reverb = new Tone.Reverb({ decay: 1.4, wet: 0.18 }).connect(this.gain);
    for (let i = 0; i < VOICE_POOL_SIZE; i++) {
      const v = new Tone.PluckSynth({
        // Karplus-Strong params tuned for acoustic-guitar-like feel.
        attackNoise: 1,
        dampening: 4500,
        resonance: 0.88,
        release: 1.2,
      }).connect(this.reverb);
      this.voices.push(v);
    }
  }

  private nextVoice(): Tone.PluckSynth {
    const v = this.voices[this.voiceIndex];
    this.voiceIndex = (this.voiceIndex + 1) % this.voices.length;
    return v;
  }

  addListener(fn: PreviewListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    const state: PreviewState = {
      isPlaying: this.playing,
      currentBeat: this.playing ? this.computeCurrentBeat() : -1,
    };
    this.listeners.forEach((l) => l(state));
  }

  private computeCurrentBeat(): number {
    if (this.voices.length === 0) return -1;
    const elapsedMs = (Tone.now() - this.startedAtCtxTime) * 1000;
    return elapsedMs / this.msPerBeat;
  }

  /** Play through the targets at the given BPM. Resolves immediately; emits state via listeners. */
  async play(targets: TargetNote[], bpm: number): Promise<void> {
    await this.ensureGraph();
    if (this.voices.length === 0) return;
    this.stop();

    this.msPerBeat = 60000 / bpm;
    this.totalBeats =
      Math.max(...targets.map((t) => t.beat + (t.duration ?? 1)), 0) + 1;
    const ctx = Tone.getContext();
    // Tiny lookahead so the first hit isn't clipped.
    const startAt = Tone.now() + 0.05;
    this.startedAtCtxTime = startAt;
    this.playing = true;

    for (const target of targets) {
      const t = startAt + (target.beat * this.msPerBeat) / 1000;
      const dur = Math.max(0.12, ((target.duration ?? 1) * this.msPerBeat) / 1000 * 0.95);

      if (target.chord && target.chord.length > 1) {
        // Strum: pluck each string in order with a small offset (~12ms per
        // string from low to high). Each string gets its own PluckSynth
        // voice so they ring out together.
        const sorted = [...target.chord].sort((a, b) => a.string - b.string);
        sorted.forEach((c, i) => {
          const midi = midiAtFromTarget(target, c.string, c.fret);
          const note = midiToName(midi).full;
          const offset = i * 0.012;
          this.nextVoice().triggerAttackRelease(note, dur, t + offset);
        });
      } else {
        const note = midiToName(target.midi).full;
        this.nextVoice().triggerAttackRelease(note, dur, t);
      }
    }

    // Schedule stop after the last note's tail rings out.
    const totalDurationMs =
      this.totalBeats * this.msPerBeat + 1500; // tail
    const stopAt = Tone.now() + totalDurationMs / 1000;
    const stopId = Tone.getTransport().scheduleOnce(() => {
      this.playing = false;
      this.emit();
    }, stopAt - Tone.now());
    this.scheduledIds.push(stopId as unknown as number);

    // rAF loop to update listeners (~30 Hz for the cursor).
    let last = 0;
    const tick = () => {
      if (!this.playing) return;
      const now = performance.now();
      if (now - last >= 33) {
        last = now;
        this.emit();
      }
      // If we've passed the end, stop.
      if (this.computeCurrentBeat() > this.totalBeats + 1.5) {
        this.playing = false;
        this.emit();
        return;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
    void ctx;
    this.emit();
  }

  stop() {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.scheduledIds.forEach((id) => Tone.getTransport().clear(id));
    this.scheduledIds = [];
    this.voices.forEach((v) => v.triggerRelease(Tone.now()));
    if (this.playing) {
      this.playing = false;
      this.emit();
    }
  }

  dispose() {
    this.stop();
    this.voices.forEach((v) => v.dispose());
    this.reverb?.dispose();
    this.gain?.dispose();
    this.voices = [];
    this.reverb = null;
    this.gain = null;
    this.listeners.clear();
  }
}

/**
 * Compute MIDI at a given (string, fret) using the same tuning the target
 * came from. We embed the offset on `target.midi` (which is already at
 * (target.string, target.fret)) and walk to the chord position from there.
 */
function midiAtFromTarget(target: TargetNote, string: number, fret: number): number {
  // target.midi corresponds to (target.string, target.fret). Adjacent strings
  // in standard tuning are 5 semitones apart except B↔G which is 4. We just
  // use the standard intervals: low E=0, A=+5, D=+10, G=+15, B=+19, e=+24.
  const stringOffsets = [0, 5, 10, 15, 19, 24];
  const baseLowE = target.midi - target.fret - stringOffsets[target.string];
  return baseLowE + stringOffsets[string] + fret;
}
