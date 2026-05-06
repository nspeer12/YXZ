'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Fretboard, type FretboardHighlight } from '@/components/guitar/Fretboard';
import { Highway, STRING_COLORS, chordNameFromTarget, type TargetStatus } from '@/components/guitar/Highway';
import { TabSheet } from '@/components/guitar/TabSheet';
import { LessonMedia } from '@/components/guitar/LessonMedia';
import { ChordDiagram, uniqueChordsInTargets } from '@/components/guitar/ChordDiagram';
import { GuitarPreview } from '@/lib/guitar/preview-audio';
import {
  TargetGrader,
  DEFAULT_GRADING,
  PATIENT_GRADING,
  summarize,
  acceptedPitchClasses,
  type SessionResult,
  type TargetResult,
  type TargetNote,
} from '@/lib/guitar/grading';
import type { Lesson, Exercise } from '@/lib/guitar/curriculum';
import type { UseAudioInputResult } from '@/hooks/useAudioInput';
import type { UsePitchDetectionResult } from '@/hooks/usePitchDetection';
import { STANDARD_TUNING, midiToName } from '@/lib/guitar/tuning';

interface Props {
  lesson: Lesson;
  audioInput: UseAudioInputResult;
  pitch: UsePitchDetectionResult;
  patientMode: boolean;
  onComplete: (result: SessionResult) => void;
  onExit: () => void;
  /** Optional next lesson for the "→ Next lesson" CTA on the lesson-complete screen. */
  nextLesson?: Lesson;
  /** Callback to switch to a new lesson without exiting back to the home screen. */
  onStartLesson?: (lessonId: string) => void;
}

type Phase = 'intro' | 'playing' | 'done';
type Mode = 'hero' | 'tab';

/**
 * In Hero mode we don't use a separate count-in phase any more. Instead the
 * `playing` clock starts at a NEGATIVE elapsed time so the metronome can
 * chime through the lead-in beats while the highway scrolls the upcoming
 * notes into view. This gives the player time to read the first note before
 * having to play it.
 */
const HERO_LEAD_IN_BEATS = 4;
const HERO_EXTRA_LEAD_MS = 600; // a touch of extra anticipation past the count

const HIT_COLOR = '#00ff88';
const MISS_COLOR = '#ff4444';
const ACTIVE_COLOR = '#00ffff';
const PENDING_COLOR = '#3a3a3a';

// Pick a sensible default mode for a lesson. Songs/scales/notes default to
// Hero (timing matters); chord and rhythm lessons default to Tab.
function defaultModeForLesson(lesson: Lesson): Mode {
  if (lesson.category === 'chords' || lesson.category === 'tuning') return 'tab';
  return 'hero';
}

export function LessonPlayer({ lesson, audioInput, pitch, patientMode, onComplete, onExit, nextLesson, onStartLesson }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<Mode>(() => defaultModeForLesson(lesson));
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  /** Version bumped when hero-mode grader statuses change — drives re-renders. */
  const [graderVersion, setGraderVersion] = useState(0);
  const bumpGraderVersion = useCallback(() => setGraderVersion((v) => v + 1), []);
  const [sessionResults, setSessionResults] = useState<SessionResult | null>(null);

  // Tab-mode state.
  const [tabIndex, setTabIndex] = useState(0);
  const [tabHits, setTabHits] = useState<Map<string, { centsOff: number }>>(new Map());
  const tabSustainRef = useRef<{ since: number | null; cents: number; samples: number }>({
    since: null,
    cents: 0,
    samples: 0,
  });

  // Audio preview (acoustic guitar synth) — built lazily on first use.
  const previewRef = useRef<GuitarPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  useEffect(() => {
    return () => {
      previewRef.current?.dispose();
      previewRef.current = null;
    };
  }, []);

  const exercise: Exercise = lesson.exercises[exerciseIndex];
  const config = patientMode ? PATIENT_GRADING : DEFAULT_GRADING;

  // Playback controls: BPM (with slow default), loop count, metronome.
  // loopTarget: how many times to play the exercise before showing results.
  // 0 = infinite; 1 = play once; default 3 so beginners get repetition without
  // having to opt in.
  const [bpm, setBpm] = useState(() => Math.max(20, Math.round(exercise.bpm * 0.5)));
  const [loopTarget, setLoopTarget] = useState(3);
  const [loopsCompleted, setLoopsCompleted] = useState(0);
  const [metronomeOn, setMetronomeOn] = useState(true);

  // Reset to 50% of authored BPM when the exercise changes.
  useEffect(() => {
    setBpm(Math.max(20, Math.round(exercise.bpm * 0.5)));
  }, [exerciseIndex, exercise.bpm]);

  const msPerBeat = useMemo(() => 60000 / bpm, [bpm]);
  // Refs read by the long-lived rAF / pitch listener so they always see latest.
  const msPerBeatRef = useRef(msPerBeat);
  useEffect(() => { msPerBeatRef.current = msPerBeat; }, [msPerBeat]);
  const loopTargetRef = useRef(loopTarget);
  useEffect(() => { loopTargetRef.current = loopTarget; }, [loopTarget]);
  const loopsCompletedRef = useRef(0);
  const metronomeOnRef = useRef(metronomeOn);
  useEffect(() => { metronomeOnRef.current = metronomeOn; }, [metronomeOn]);

  // Reset loop counter every time we (re)enter the playing phase or move to a
  // new exercise. Mirrors how `resetHero`/`resetTab` wipe per-pass state.
  useEffect(() => {
    if (phase !== 'playing') return;
    loopsCompletedRef.current = 0;
    setLoopsCompleted(0);
  }, [phase, exerciseIndex]);

  // Chord chart popover (header). Closed by default — beginners can pop it
  // open to see the shapes whenever they need a refresher.
  const [chordChartOpen, setChordChartOpen] = useState(false);
  const exerciseChords = useMemo(
    () => uniqueChordsInTargets(exercise.targets),
    [exercise.targets],
  );
  const chordChartRef = useRef<HTMLDivElement | null>(null);
  // Click-outside to close the popover. Pointerdown so it fires before the
  // toggle button's onClick if you re-click the trigger to close.
  useEffect(() => {
    if (!chordChartOpen) return;
    const onPointer = (e: PointerEvent) => {
      const root = chordChartRef.current;
      if (root && !root.contains(e.target as Node)) {
        setChordChartOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [chordChartOpen]);

  const totalBeats = useMemo(() => {
    return Math.max(...exercise.targets.map((t) => t.beat + (t.duration ?? 1)), 0) + 1;
  }, [exercise]);

  // Highest fret in the exercise — drives the highway's visible fret range.
  const maxFret = useMemo(() => Math.max(0, ...exercise.targets.map((t) => t.fret)), [exercise.targets]);

  // Per-target graders (hero mode only).
  const gradersRef = useRef<TargetGrader[]>([]);
  const collectedResultsRef = useRef<TargetResult[]>([]);
  const startTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const metronomeRef = useRef<{ lastBeatScheduled: number }>({ lastBeatScheduled: -1 });

  const resetHero = useCallback(() => {
    gradersRef.current = exercise.targets.map((t) => new TargetGrader(t, config));
    collectedResultsRef.current = [];
    bumpGraderVersion();
  }, [exercise, config, bumpGraderVersion]);

  const resetTab = useCallback(() => {
    setTabIndex(0);
    setTabHits(new Map());
    tabSustainRef.current = { since: null, cents: 0, samples: 0 };
  }, []);

  // ---- HERO mode pitch listener ----
  useEffect(() => {
    if (phase !== 'playing' || mode !== 'hero') return;
    const unsubscribe = pitch.addListener((sample) => {
      const now = performance.now();
      let resolvedAny = false;
      for (const g of gradersRef.current) {
        if (g.status === 'active') {
          if (g.feed(now, sample)) {
            collectedResultsRef.current.push(g.result());
            resolvedAny = true;
          }
        }
      }
      if (resolvedAny) bumpGraderVersion();
    });
    return unsubscribe;
  }, [phase, mode, pitch, bumpGraderVersion]);

  // Live ref of tabIndex so the (long-lived) pitch listener reads the latest.
  const tabIndexRef = useRef(0);
  useEffect(() => {
    tabIndexRef.current = tabIndex;
  }, [tabIndex]);

  // ---- TAB mode pitch listener ----
  useEffect(() => {
    if (phase !== 'playing' || mode !== 'tab') return;
    // Pre-compute the accepted pitch-class set per target so the listener
    // doesn't recompute on every audio frame.
    const acceptedByIdx = exercise.targets.map((t) => acceptedPitchClasses(t));
    const isChordByIdx = exercise.targets.map((t) => t.chord != null && t.chord.length > 1);

    const unsubscribe = pitch.addListener((sample) => {
      const idx = tabIndexRef.current;
      const targets = exercise.targets;
      if (idx >= targets.length) return;
      const target = targets[idx];
      const isChord = isChordByIdx[idx];

      // Chord-aware thresholds — strums are noisier than single plucks.
      const tolerance = isChord ? config.chordToleranceCents : config.toleranceCents;
      const minClarity = isChord ? config.chordMinClarity : config.minClarity;
      const requiredHold = isChord ? config.chordRequiredHoldMs : config.requiredHoldMs;

      if (sample.midiNote == null || sample.clarity < minClarity) {
        // Single notes reset on any stutter; chords are more forgiving so we
        // leave the accumulator alone (the dominant detected harmonic
        // commonly dips below the clarity floor for a frame between
        // string-decays during a strum).
        if (!isChord) {
          tabSustainRef.current.since = null;
          tabSustainRef.current.cents = 0;
          tabSustainRef.current.samples = 0;
        }
        return;
      }

      let inTune = false;
      if (Math.abs(sample.cents) <= tolerance) {
        if (isChord) {
          const detectedClass = ((sample.midiNote % 12) + 12) % 12;
          inTune = acceptedByIdx[idx].has(detectedClass);
        } else {
          inTune = sample.midiNote === target.midi;
        }
      }

      const now = performance.now();
      if (inTune) {
        if (tabSustainRef.current.since == null) {
          tabSustainRef.current.since = now;
          tabSustainRef.current.cents = sample.cents;
          tabSustainRef.current.samples = 1;
        } else {
          tabSustainRef.current.cents += sample.cents;
          tabSustainRef.current.samples += 1;
        }
        const held = now - (tabSustainRef.current.since ?? now);
        if (held >= requiredHold) {
          const avgCents =
            tabSustainRef.current.samples > 0
              ? tabSustainRef.current.cents / tabSustainRef.current.samples
              : 0;
          // Commit the hit. Sync the ref *immediately* so a sustained note
          // can't accidentally double-trigger before React re-renders.
          tabIndexRef.current = idx + 1;
          setTabHits((prev) => {
            const next = new Map(prev);
            next.set(target.id, { centsOff: avgCents });
            return next;
          });
          setTabIndex((i) => i + 1);
          tabSustainRef.current = { since: null, cents: 0, samples: 0 };
        }
      } else if (!isChord) {
        // Single notes: lost the note, reset accumulator. Chord accumulators
        // persist (a flickering harmonic shouldn't kill progress).
        tabSustainRef.current.since = null;
        tabSustainRef.current.cents = 0;
        tabSustainRef.current.samples = 0;
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, pitch, exercise.targets, config]);

  // ---- Tab-mode completion ----
  useEffect(() => {
    if (phase !== 'playing' || mode !== 'tab') return;
    if (tabIndex < exercise.targets.length) return;

    // Loop mode in tab: count this pass, then either reset to start or
    // fall through to the finish path. Mirrors the hero loop accounting.
    loopsCompletedRef.current += 1;
    setLoopsCompleted(loopsCompletedRef.current);
    const target = loopTargetRef.current;
    const continueLooping = target === 0 || loopsCompletedRef.current < target;
    if (continueLooping) {
      tabIndexRef.current = 0;
      tabSustainRef.current = { since: null, cents: 0, samples: 0 };
      setTabIndex(0);
      setTabHits(new Map());
      return;
    }

    const perTarget: TargetResult[] = exercise.targets.map((t) => {
      const hit = tabHits.get(t.id);
      return {
        targetId: t.id,
        status: 'hit' as const,
        centsOff: hit?.centsOff,
        sustainedMs: config.requiredHoldMs,
      };
    });
    const summary = summarize(perTarget);
    setSessionResults(summary);
    setPhase('done');
  }, [phase, mode, tabIndex, exercise.targets, tabHits, config.requiredHoldMs]);

  // ---- Metronome click ----
  // `force=true` overrides the metronome toggle so the count-in chime always
  // plays even when the user has muted the metronome for the playing phase.
  const click = useCallback(
    (accent: boolean, force = false) => {
      if (!force && !metronomeOnRef.current) return;
      const ctx = audioInput.audioContext;
      if (!ctx || ctx.state === 'closed') return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = accent ? 1500 : 900;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    },
    [audioInput.audioContext],
  );

  // (Count-in is rolled into the `playing` phase via a negative-elapsed lead-in.)

  // Track previous msPerBeat so when tempo changes mid-flight we can shift
  // startTimeRef to preserve the current beat position (otherwise notes jump).
  const lastMsPerBeatRef = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== 'playing' || mode !== 'hero') {
      lastMsPerBeatRef.current = null;
      return;
    }
    const oldMsPerBeat = lastMsPerBeatRef.current;
    if (oldMsPerBeat == null) {
      lastMsPerBeatRef.current = msPerBeat;
      return;
    }
    if (oldMsPerBeat === msPerBeat) return;
    const now = performance.now();
    const oldElapsed = now - startTimeRef.current;
    const oldBeat = oldElapsed / oldMsPerBeat;
    const newElapsed = oldBeat * msPerBeat;
    startTimeRef.current = now - newElapsed;
    lastMsPerBeatRef.current = msPerBeat;
    // Avoid double-clicking the boundary beat.
    metronomeRef.current.lastBeatScheduled = Math.floor(oldBeat) - 1;
  }, [msPerBeat, phase, mode]);

  // ---- Hero mode main exercise loop ----
  useEffect(() => {
    if (phase !== 'playing' || mode !== 'hero') return;
    resetHero();

    // Start time is in the FUTURE so `elapsed` begins negative — that's the
    // lead-in / count-in window. Notes fall into view; the metronome chimes
    // through; the first target hits NOW after the lead-in.
    const initialMsPerBeat = msPerBeatRef.current;
    const leadInMs = HERO_LEAD_IN_BEATS * initialMsPerBeat + HERO_EXTRA_LEAD_MS;
    startTimeRef.current = performance.now() + leadInMs;
    metronomeRef.current.lastBeatScheduled = -HERO_LEAD_IN_BEATS - 2;
    lastMsPerBeatRef.current = initialMsPerBeat;

    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      const now = performance.now();
      const elapsed = now - startTimeRef.current;
      const currentMsPerBeat = msPerBeatRef.current;
      setElapsedMs(elapsed);

      // Beat clicks. During lead-in (currentBeat < 0) we force the chime so
      // the count is always audible even with the metronome toggled off.
      const currentBeat = Math.floor(elapsed / currentMsPerBeat);
      if (currentBeat > metronomeRef.current.lastBeatScheduled && currentBeat < totalBeats) {
        metronomeRef.current.lastBeatScheduled = currentBeat;
        const accent = currentBeat % (exercise.beatsPerBar ?? 4) === 0;
        const inLeadIn = currentBeat < 0;
        click(accent, inLeadIn);
      }

      const leadInMs = 150;
      let openedAny = false;
      gradersRef.current.forEach((g) => {
        if (g.status !== 'pending') return;
        const beatStartMs = g.target.beat * currentMsPerBeat;
        if (elapsed >= beatStartMs - leadInMs) {
          const durationMs = (g.target.duration ?? 1) * currentMsPerBeat;
          g.open(now, durationMs);
          openedAny = true;
        }
      });
      let resolvedAny = false;
      gradersRef.current.forEach((g) => {
        if (g.status === 'active' && now >= g.windowCloseAt) {
          if (g.feed(now, { ...pitch, frequency: null, midiNote: null, clarity: 0 })) {
            collectedResultsRef.current.push(g.result());
            resolvedAny = true;
          }
        }
      });
      if (openedAny || resolvedAny) bumpGraderVersion();

      const exerciseDurationMs = totalBeats * currentMsPerBeat;
      const allDone = gradersRef.current.every((g) => g.status === 'hit' || g.status === 'missed');
      const ranOut = elapsed > exerciseDurationMs + config.timingWindowMs + 500;
      if (allDone || ranOut) {
        gradersRef.current.forEach((g) => {
          if (g.status === 'active' || g.status === 'pending') {
            g.status = 'missed';
            collectedResultsRef.current.push(g.result());
          }
        });

        // Loop mode: count this pass, and either continue or finish.
        // 0 = infinite; otherwise stop after `loopTarget` total passes.
        // Re-apply the lead-in so the next iteration also has count-in space.
        loopsCompletedRef.current += 1;
        setLoopsCompleted(loopsCompletedRef.current);
        const target = loopTargetRef.current;
        const continueLooping = target === 0 || loopsCompletedRef.current < target;
        if (continueLooping) {
          resetHero();
          const mpb = msPerBeatRef.current;
          startTimeRef.current = performance.now() + HERO_LEAD_IN_BEATS * mpb + HERO_EXTRA_LEAD_MS;
          metronomeRef.current.lastBeatScheduled = -HERO_LEAD_IN_BEATS - 2;
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const result = summarize(collectedResultsRef.current);
        setSessionResults(result);
        setPhase('done');
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, exerciseIndex]);

  // ---- Tab mode prep when entering playing phase ----
  useEffect(() => {
    if (phase !== 'playing' || mode !== 'tab') return;
    resetTab();
  }, [phase, mode, exerciseIndex, resetTab]);

  // ---- Fire onComplete on done ----
  const completedRef = useRef<{ exerciseIndex: number; lessonId: string } | null>(null);
  useEffect(() => {
    if (phase !== 'done' || !sessionResults) return;
    const key = { exerciseIndex, lessonId: lesson.id };
    if (
      completedRef.current?.exerciseIndex === key.exerciseIndex &&
      completedRef.current?.lessonId === key.lessonId
    ) {
      return;
    }
    completedRef.current = key;
    if (exerciseIndex === lesson.exercises.length - 1) {
      onComplete(sessionResults);
    }
  }, [phase, sessionResults, exerciseIndex, lesson, onComplete]);

  const playPreview = useCallback(async () => {
    if (!previewRef.current) {
      previewRef.current = new GuitarPreview();
    }
    const preview = previewRef.current;
    const unsubscribe = preview.addListener((s) => setIsPreviewing(s.isPlaying));
    try {
      // Use authored BPM, not the user's adjusted tempo — the preview is a
      // reference of how the song "should sound" at full tempo.
      await preview.play(exercise.targets, exercise.bpm);
    } finally {
      // The listener will flip isPreviewing back to false when the synth
      // finishes; the unsubscribe fires when this component unmounts.
      void unsubscribe;
    }
  }, [exercise.targets, exercise.bpm]);

  const stopPreview = useCallback(() => {
    previewRef.current?.stop();
    setIsPreviewing(false);
  }, []);

  const startExercise = useCallback(async () => {
    if (!audioInput.isActive) {
      try {
        await audioInput.start();
      } catch {
        return;
      }
    }
    setPhase('playing');
  }, [audioInput]);

  const retryExercise = () => {
    setSessionResults(null);
    setPhase('playing');
  };

  const nextExercise = () => {
    setSessionResults(null);
    setExerciseIndex((i) => Math.min(i + 1, lesson.exercises.length - 1));
    setPhase('intro');
  };

  // ---- Hero mode highlight derivation ----
  const heroStatusById = useMemo(() => {
    const map = new Map<string, TargetStatus>();
    for (const g of gradersRef.current) {
      map.set(g.target.id, g.status);
    }
    return map;
  }, [graderVersion, exerciseIndex, mode]);

  const fretboardHighlights: FretboardHighlight[] = useMemo(() => {
    if (mode === 'hero') {
      const out: FretboardHighlight[] = [];
      // Show pending notes only if they're within the next ~4 beats — past
      // that, the fretboard gets cluttered with positions the player won't
      // touch for a while. Hits and the active target are always visible.
      const elapsedBeat = msPerBeat > 0 ? elapsedMs / msPerBeat : 0;
      const PENDING_LOOKAHEAD_BEATS = 4;
      // Pick the SOONEST pending target so the upcoming-shape rendering can
      // preview the next chord/note in particular.
      let nextPending: TargetNote | null = null;
      let nextPendingBeatGap = Infinity;
      for (const g of gradersRef.current) {
        if (g.status !== 'pending') continue;
        const gap = g.target.beat - elapsedBeat;
        if (gap >= -0.25 && gap < nextPendingBeatGap) {
          nextPendingBeatGap = gap;
          nextPending = g.target;
        }
      }

      for (const g of gradersRef.current) {
        const t = g.target;
        let color = PENDING_COLOR;
        let intensity = 0.45;
        let ring: string | undefined;
        const label: string | undefined = String(t.fret);
        let include = true;

        if (g.status === 'hit') {
          color = HIT_COLOR;
          intensity = 0.9;
        } else if (g.status === 'missed') {
          color = MISS_COLOR;
          intensity = 0.6;
        } else if (g.status === 'active') {
          color = ACTIVE_COLOR;
          ring = ACTIVE_COLOR;
          intensity = 1;
        } else {
          // pending — only show if close, and dim future ones progressively.
          const gap = t.beat - elapsedBeat;
          if (gap < -0.25 || gap > PENDING_LOOKAHEAD_BEATS) {
            include = false;
          } else {
            // The very next pending target gets a brighter "preview" treatment
            // (string-color, ring) so the player sees what's coming.
            const isNext = nextPending != null && t.id === nextPending.id;
            if (isNext) {
              color = STRING_COLORS[t.string] ?? PENDING_COLOR;
              ring = '#888';
              intensity = 0.7;
            } else {
              color = PENDING_COLOR;
              intensity = 0.35;
            }
          }
        }

        if (include) {
          out.push({ string: t.string, fret: t.fret, color, ring, intensity, label });
        }

        // For active OR next-upcoming chords, render the rest of the voicing
        // on the fretboard so the player can pre-shape their hand.
        const showShape =
          (g.status === 'active' || (g.status === 'pending' && nextPending != null && t.id === nextPending.id)) &&
          t.chord && t.chord.length > 1;
        if (showShape && t.chord) {
          const isPreview = g.status === 'pending';
          for (const c of t.chord) {
            if (c.string === t.string && c.fret === t.fret) continue;
            out.push({
              string: c.string,
              fret: c.fret,
              color: STRING_COLORS[c.string] ?? '#888',
              intensity: isPreview ? 0.55 : 0.85,
              label: String(c.fret),
            });
          }
        }
      }
      return out;
    }
    // Tab mode: only show hit notes + the current target (with full chord shape).
    const out: FretboardHighlight[] = [];
    exercise.targets.forEach((t, i) => {
      const isDone = tabHits.has(t.id);
      const isActive = i === tabIndex;
      const isFuture = i > tabIndex;
      if (isFuture) return;
      out.push({
        string: t.string,
        fret: t.fret,
        color: isDone ? HIT_COLOR : isActive ? STRING_COLORS[t.string] ?? ACTIVE_COLOR : PENDING_COLOR,
        ring: isActive ? '#fff' : undefined,
        intensity: isActive ? 1 : 0.7,
        label: String(t.fret),
      });
      if (isActive && t.chord && t.chord.length > 1) {
        for (const c of t.chord) {
          if (c.string === t.string && c.fret === t.fret) continue;
          out.push({
            string: c.string,
            fret: c.fret,
            color: STRING_COLORS[c.string] ?? '#888',
            intensity: 0.85,
            label: String(c.fret),
          });
        }
      }
    });
    return out;
  }, [mode, graderVersion, exerciseIndex, exercise.targets, tabHits, tabIndex, elapsedMs, msPerBeat]);

  // Live stats (combined for both modes).
  const liveStats = useMemo(() => {
    if (mode === 'hero') {
      const total = gradersRef.current.length;
      let hits = 0;
      let misses = 0;
      let activeTarget: TargetNote | null = null;
      for (const g of gradersRef.current) {
        if (g.status === 'hit') hits += 1;
        else if (g.status === 'missed') misses += 1;
        else if (g.status === 'active' && !activeTarget) activeTarget = g.target;
      }
      return { total, hits, misses, activeTarget };
    }
    const total = exercise.targets.length;
    const hits = tabHits.size;
    const activeTarget = tabIndex < total ? exercise.targets[tabIndex] : null;
    return { total, hits, misses: 0, activeTarget };
  }, [mode, graderVersion, exerciseIndex, exercise.targets, tabHits, tabIndex]);

  const exerciseDurationMs = totalBeats * msPerBeat;
  const beatProgress =
    phase === 'playing' && mode === 'hero' ? Math.min(1, elapsedMs / exerciseDurationMs) : 0;
  const currentBeat = phase === 'playing' && mode === 'hero' ? Math.floor(elapsedMs / msPerBeat) : 0;

  // Most-recent lyric segment whose beat ≤ current beat. Drives the rolling
  // caption above the highway in Hero mode.
  const currentLyric = useMemo(() => {
    if (!exercise.lyrics || exercise.lyrics.length === 0) return null;
    const beatNow = mode === 'hero' ? elapsedMs / msPerBeat : tabIndex;
    let latest: { beat: number; text: string } | null = null;
    for (const l of exercise.lyrics) {
      if (l.beat <= beatNow) latest = l;
      else break;
    }
    return latest;
  }, [exercise.lyrics, mode, elapsedMs, msPerBeat, tabIndex]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-3 sm:px-6 py-2 flex items-center justify-between shrink-0 relative">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onExit}
            className="text-xs text-[#888] hover:text-[#ededed] transition-colors px-2 py-1 rounded border border-[#2a2a2a]"
          >
            ← Exit
          </button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold truncate">{lesson.title}</h1>
            <p className="text-[10px] text-[#666] font-mono truncate">
              Exercise {exerciseIndex + 1} / {lesson.exercises.length} · {bpm} BPM
              <span className="text-[#444]"> ({Math.round((bpm / exercise.bpm) * 100)}%)</span>
              {' · '}{mode === 'hero' ? 'Hero' : 'Tab'} mode
              {phase === 'playing' && loopTarget === 0 && ` · run ${loopsCompleted + 1} (∞)`}
              {phase === 'playing' && loopTarget > 1 && ` · run ${Math.min(loopsCompleted + 1, loopTarget)}/${loopTarget}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {exerciseChords.length > 0 && (
            <div className="relative" ref={chordChartRef}>
              <button
                onClick={() => setChordChartOpen((v) => !v)}
                className={`text-[11px] font-mono uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
                  chordChartOpen
                    ? 'bg-[#a855f7] border-transparent text-black'
                    : 'border-[#2a2a2a] text-[#888] hover:text-[#ededed] hover:border-[#a855f7]'
                }`}
                title="Show chord shapes for this exercise"
              >
                Chords ({exerciseChords.length})
                <span className="ml-1 text-[9px] opacity-70">{chordChartOpen ? '▲' : '▼'}</span>
              </button>
              {chordChartOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-3 shadow-xl">
                  <div className="flex flex-wrap gap-3 max-w-[min(96vw,520px)]">
                    {exerciseChords.map((c) => (
                      <div key={c.name} className="flex flex-col items-center">
                        <ChordDiagram name={c.name} voicing={c.voicing} size={68} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {patientMode && (
            <span className="text-[10px] uppercase tracking-widest text-[#00ff88] font-mono">Patient</span>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col p-3 sm:p-6 max-w-6xl w-full mx-auto">
        {phase === 'intro' && (
          <IntroPanel
            lesson={lesson}
            exercise={exercise}
            mode={mode}
            onModeChange={setMode}
            isInputActive={audioInput.isActive}
            onStart={startExercise}
            bpm={bpm}
            authoredBpm={exercise.bpm}
            isPreviewing={isPreviewing}
            onPlayPreview={playPreview}
            onStopPreview={stopPreview}
          />
        )}

        {(phase === 'playing' || phase === 'done') && (
          <>
            {/* Playback controls — visible always so you can adjust live. */}
            <PlaybackControls
              bpm={bpm}
              authoredBpm={exercise.bpm}
              onBpmChange={setBpm}
              loopTarget={loopTarget}
              onLoopTargetChange={setLoopTarget}
              metronomeOn={metronomeOn}
              onMetronomeChange={setMetronomeOn}
              mode={mode}
            />

            {/* Live stats — single thin pill row to save vertical space. */}
            <div className="rounded-md border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-1.5 mb-2 flex items-center gap-4 text-xs font-mono">
              <span>
                <span className="text-[#666] uppercase tracking-wider mr-1">Played</span>
                <span className="text-[#00ff88] font-bold">{liveStats.hits}</span>
              </span>
              {mode === 'hero' ? (
                <span>
                  <span className="text-[#666] uppercase tracking-wider mr-1">Missed</span>
                  <span className="text-[#ff6b35] font-bold">{liveStats.misses}</span>
                </span>
              ) : (
                <span>
                  <span className="text-[#666] uppercase tracking-wider mr-1">Notes</span>
                  <span className="text-[#888] font-bold">{liveStats.total}</span>
                </span>
              )}
              <span className="ml-auto">
                <span className="text-[#666] uppercase tracking-wider mr-1">
                  {phase === 'done' ? 'On-pitch' : 'Progress'}
                </span>
                <span className="text-[#00ffff] font-bold">
                  {phase === 'done' && sessionResults
                    ? sessionResults.averageCentsOff > 0
                      ? `±${sessionResults.averageCentsOff.toFixed(0)}¢`
                      : '—'
                    : `${liveStats.hits + liveStats.misses}/${liveStats.total}`}
                </span>
              </span>
            </div>

            {/*
              Status strip: fixed minimum height so the layout doesn't lurch
              when an active note arrives. When the active target is a chord
              we render a mini ChordDiagram inline (sized to the strip) so
              the player can see the shape without the highway card carrying
              a voicing strip. Single-note targets show note name + position.
            */}
            <NowStrip
              phase={phase}
              mode={mode}
              elapsedMs={elapsedMs}
              msPerBeat={msPerBeat}
              activeTarget={liveStats.activeTarget}
              pitchMidi={pitch.midiNote}
              pitchName={pitch.noteName}
              pitchOctave={pitch.octave}
              pitchCents={pitch.cents}
            />

            {/* Rolling lyric caption — visible whenever the exercise has lyrics.
                Same data drives the TabSheet's lyric row in tab mode, so both
                modes show the same thing. */}
            {currentLyric && (
              <div className="rounded-md border border-[#1f1f1f] bg-[#0d0d0d] px-3 py-1.5 mb-2 text-sm text-[#ededed] truncate">
                <span className="text-[10px] uppercase tracking-widest text-[#666] font-mono mr-2">Lyric</span>
                {currentLyric.text}
              </div>
            )}

            {/* Primary visualization (also serves as preview during count-in). */}
            <div className="mb-2">
              {mode === 'hero' ? (
                <Highway
                  targets={exercise.targets}
                  statusById={heroStatusById}
                  elapsedMs={elapsedMs}
                  msPerBeat={msPerBeat}
                  tuning={STANDARD_TUNING}
                  maxFret={maxFret}
                  chordAnnotations={exercise.chordAnnotations}
                />
              ) : (
                <TabSheet
                  exercise={exercise}
                  currentTargetId={
                    tabIndex < exercise.targets.length ? exercise.targets[tabIndex].id : null
                  }
                  hitTargetIds={new Set(Array.from(tabHits.keys()))}
                />
              )}
            </div>

            {/* Fretboard reference — strings + frets at the bottom. */}
            <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-2 sm:p-3 mb-2">
              <Fretboard
                tuning={STANDARD_TUNING}
                frets={Math.max(12, ...exercise.targets.map((t) => t.fret + 2))}
                highlight={fretboardHighlights}
              />
            </div>

            {/* Beat strip (hero only) */}
            {phase === 'playing' && mode === 'hero' && (
              <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#666] mb-1">
                  <span>Beat {currentBeat + 1} / {totalBeats}</span>
                  <span>{Math.round(beatProgress * 100)}%</span>
                </div>
                <div className="h-1 bg-[#1a1a1a] rounded">
                  <div
                    className="h-full bg-[#00ffff] rounded transition-all"
                    style={{ width: `${beatProgress * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Results popup — overlays the playing view at the end of an
                exercise so the stats jump out instead of getting lost in the
                normal page flow. */}
            {phase === 'done' && sessionResults && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                onClick={(e) => {
                  // Click on the backdrop (not the card) is a no-op — we
                  // explicitly want the user to pick an action.
                  if (e.target === e.currentTarget) {
                    /* swallow */
                  }
                }}
              >
                <div className="max-w-md w-full">
                  <ResultsPanel
                    lesson={lesson}
                    exerciseIndex={exerciseIndex}
                    mode={mode}
                    results={sessionResults}
                    onRetry={retryExercise}
                    onNextExercise={
                      exerciseIndex < lesson.exercises.length - 1 ? nextExercise : undefined
                    }
                    onExit={onExit}
                    nextLesson={nextLesson}
                    onStartNextLesson={
                      nextLesson && onStartLesson
                        ? () => onStartLesson(nextLesson.id)
                        : undefined
                    }
                  />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function IntroPanel({
  lesson,
  exercise,
  mode,
  onModeChange,
  isInputActive,
  onStart,
  bpm,
  authoredBpm,
  isPreviewing,
  onPlayPreview,
  onStopPreview,
}: {
  lesson: Lesson;
  exercise: Exercise;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  isInputActive: boolean;
  onStart: () => void;
  bpm: number;
  authoredBpm: number;
  isPreviewing: boolean;
  onPlayPreview: () => void | Promise<void>;
  onStopPreview: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center max-w-2xl mx-auto w-full pt-6 sm:pt-10 pb-6">
      <div className="text-center w-full">
        <p className="text-xs uppercase tracking-widest text-[#666] mb-2">{lesson.category}</p>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">{exercise.title}</h2>
        <p className="text-sm text-[#888] mb-6 leading-relaxed">{exercise.instruction ?? lesson.description}</p>
      </div>

      {lesson.media && (
        <div className="w-full max-w-xl mb-6">
          <LessonMedia media={lesson.media} />
        </div>
      )}

      {/* Mode picker */}
      <div className="w-full max-w-md mb-6">
        <div className="text-[10px] uppercase tracking-widest text-[#666] font-mono mb-2 text-center">
          Practice mode
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ModePill
            active={mode === 'tab'}
            label="Tab"
            description="Play at your own pace. Notes advance as you hit them — no timing pressure."
            accent="#a855f7"
            onClick={() => onModeChange('tab')}
          />
          <ModePill
            active={mode === 'hero'}
            label="Hero"
            description="Rocksmith-style scrolling notes with a metronome. Hit them in time."
            accent="#00ffff"
            onClick={() => onModeChange('hero')}
          />
        </div>
      </div>

      <div className="text-[11px] text-[#555] font-mono mb-4 text-center leading-relaxed">
        Starts at <span className="text-[#ededed]">{bpm} BPM</span> ({Math.round((bpm / authoredBpm) * 100)}% of authored {authoredBpm}).
        <br />
        <span className="text-[#444]">You can change tempo, loop, and metronome live.</span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 mb-2">
        <button
          onClick={isPreviewing ? onStopPreview : () => void onPlayPreview()}
          className={`px-5 py-3 rounded-lg font-medium transition-colors border-2 flex items-center gap-2 ${
            isPreviewing
              ? 'bg-[#1a1a1a] text-[#00ff88] border-[#00ff88]'
              : 'bg-[#0d0d0d] text-[#ededed] border-[#2a2a2a] hover:border-[#00ff88] hover:text-[#00ff88]'
          }`}
          title="Hear how this should sound (acoustic guitar)"
        >
          <span>{isPreviewing ? '◼' : '▶'}</span>
          <span>{isPreviewing ? 'Stop preview' : 'Preview audio'}</span>
        </button>

        <button
          onClick={onStart}
          className="px-6 py-3 bg-[#ff6b35] text-black font-medium rounded-lg hover:bg-[#ff8855] transition-colors"
        >
          {isInputActive ? 'Start' : 'Connect mic & start'}
        </button>
      </div>

      {lesson.credits && (
        <p className="text-[10px] text-[#444] font-mono mt-6">{lesson.credits}</p>
      )}
    </div>
  );
}

function ModePill({
  active,
  label,
  description,
  accent,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-md border px-3 py-3 transition-colors ${
        active ? 'bg-[#0d0d0d] border-transparent' : 'bg-[#0a0a0a] border-[#1f1f1f] hover:border-[#2a2a2a]'
      }`}
      style={active ? { boxShadow: `inset 0 0 0 1px ${accent}` } : undefined}
    >
      <div className="text-sm font-semibold mb-1" style={{ color: active ? accent : '#ededed' }}>
        {label}
      </div>
      <div className="text-[10px] text-[#666] leading-snug">{description}</div>
    </button>
  );
}

function ResultsPanel({
  lesson,
  exerciseIndex,
  mode,
  results,
  onRetry,
  onNextExercise,
  onExit,
  nextLesson,
  onStartNextLesson,
}: {
  lesson: Lesson;
  exerciseIndex: number;
  mode: Mode;
  results: SessionResult;
  onRetry: () => void;
  onNextExercise?: () => void;
  onExit: () => void;
  nextLesson?: Lesson;
  onStartNextLesson?: () => void;
}) {
  const isLast = exerciseIndex === lesson.exercises.length - 1;
  const accentByMode = mode === 'hero' ? '#00ffff' : '#a855f7';

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-4 sm:p-6">
      <div className="text-center mb-4">
        <div className="text-xs uppercase tracking-widest text-[#666] mb-1">
          {isLast ? '🎸  Lesson complete' : 'Exercise complete'}
        </div>
        {isLast && (
          <div className="text-base sm:text-lg font-semibold mt-1 mb-2 text-[#ededed]">
            {lesson.title}
          </div>
        )}
        <div className="text-4xl font-bold" style={{ color: accentByMode }}>
          {results.hits} / {results.total}
        </div>
        <div className="text-xs text-[#888] mt-1 font-mono">
          {mode === 'hero'
            ? `${Math.round(results.accuracy * 100)}% on time`
            : 'Tab run — all notes played at your own pace'}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <ResultStat label="Played" value={results.hits} />
        {mode === 'hero' && <ResultStat label="Missed" value={results.misses} />}
        <ResultStat
          label="Avg cents off"
          value={results.averageCentsOff > 0 ? `±${results.averageCentsOff.toFixed(1)}` : '—'}
        />
        {mode === 'hero' && (
          <ResultStat
            label="Avg reaction"
            value={results.averageReactionMs > 0 ? `${Math.round(results.averageReactionMs)}ms` : '—'}
          />
        )}
        {mode === 'tab' && <ResultStat label="Mode" value="Tab" />}
        {mode === 'tab' && <ResultStat label="Notes" value={results.total} />}
      </div>

      {/* Primary action row */}
      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <button
          onClick={onRetry}
          className="flex-1 px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md hover:bg-[#222] text-sm"
        >
          Run again
        </button>
        {onNextExercise && (
          <button
            onClick={onNextExercise}
            className="flex-1 px-4 py-3 bg-[#00ffff] text-black font-medium rounded-md hover:bg-[#00cccc] text-sm"
          >
            Next exercise →
          </button>
        )}
        {isLast && nextLesson && onStartNextLesson && (
          <button
            onClick={onStartNextLesson}
            className="flex-1 px-4 py-3 bg-[#ff6b35] text-black font-medium rounded-md hover:bg-[#ff8855] text-sm"
            title={nextLesson.title}
          >
            Next lesson →
          </button>
        )}
      </div>

      {/* Secondary action: always show "back to lessons" on a lesson-complete screen */}
      {isLast && (
        <button
          onClick={onExit}
          className="w-full px-4 py-2 text-xs text-[#888] hover:text-[#ededed] border border-[#1f1f1f] rounded-md hover:border-[#2a2a2a]"
        >
          Back to all lessons
        </button>
      )}

      {isLast && nextLesson && (
        <p className="text-[10px] text-[#555] font-mono text-center mt-3">
          Up next: <span className="text-[#888]">{nextLesson.title}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Status strip rendered above the highway / tab sheet. Three states:
 *   - lead-in (hero count-in): big countdown number
 *   - active target: chord diagram (for chord targets) or note name + fret hint
 *   - idle: faint placeholder
 *
 * Fixed minimum height so it doesn't lurch when the active target arrives /
 * leaves; it grows just enough to fit a chord diagram inline.
 */
function NowStrip({
  phase,
  mode,
  elapsedMs,
  msPerBeat,
  activeTarget,
  pitchMidi,
  pitchName,
  pitchOctave,
  pitchCents,
}: {
  phase: 'intro' | 'playing' | 'done';
  mode: 'hero' | 'tab';
  elapsedMs: number;
  msPerBeat: number;
  activeTarget: TargetNote | null;
  pitchMidi: number | null;
  pitchName: string | null;
  pitchOctave: number | null;
  pitchCents: number;
}) {
  const isCountIn = phase === 'playing' && elapsedMs < 0 && mode === 'hero';
  const isActive = phase === 'playing' && !!activeTarget;
  const isChord = isActive && activeTarget!.chord != null && activeTarget!.chord.length > 1;

  return (
    <div className="rounded-lg border border-[#00ffff]/30 bg-[#001818] px-4 mb-2 flex items-center gap-4 min-h-[64px]">
      {isCountIn ? (
        <>
          <div className="text-xs uppercase tracking-widest text-[#00ffff]">Count-in</div>
          <div className="text-3xl font-bold text-[#00ffff] tabular-nums">
            {Math.min(
              HERO_LEAD_IN_BEATS,
              Math.max(1, HERO_LEAD_IN_BEATS - Math.ceil(-elapsedMs / msPerBeat) + 1),
            )}
            <span className="text-sm text-[#666] font-mono ml-1">/{HERO_LEAD_IN_BEATS}</span>
          </div>
          <div className="text-[11px] text-[#888] uppercase tracking-widest">
            Review the upcoming notes
          </div>
        </>
      ) : isActive && isChord ? (
        <NowChord activeTarget={activeTarget!} pitchMidi={pitchMidi} pitchName={pitchName} pitchOctave={pitchOctave} pitchCents={pitchCents} />
      ) : isActive ? (
        <NowNote activeTarget={activeTarget!} pitchMidi={pitchMidi} pitchName={pitchName} pitchOctave={pitchOctave} pitchCents={pitchCents} />
      ) : (
        <div className="text-xs uppercase tracking-widest text-[#444]">— waiting —</div>
      )}
    </div>
  );
}

function NowChord({
  activeTarget,
  pitchMidi,
  pitchName,
  pitchOctave,
  pitchCents,
}: {
  activeTarget: TargetNote;
  pitchMidi: number | null;
  pitchName: string | null;
  pitchOctave: number | null;
  pitchCents: number;
}) {
  const chordName = chordNameFromTarget(activeTarget) || 'Chord';
  const strumLabel =
    activeTarget.strum === 'up' ? '↑ up-strum' : activeTarget.strum === 'mute' ? '× muted' : '↓ down-strum';
  return (
    <>
      <div className="text-xs uppercase tracking-widest text-[#00ffff] shrink-0">Now</div>
      <div className="shrink-0 py-1.5">
        <ChordDiagram
          name={chordName}
          voicing={activeTarget.chord!}
          size={52}
          variant="active"
          hideName
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-xl font-bold leading-none truncate">{chordName}</span>
        <span className="text-[10px] text-[#888] font-mono uppercase tracking-wider truncate">
          {strumLabel}
        </span>
      </div>
      {pitchMidi != null && (
        <span
          className="text-xs font-mono shrink-0"
          style={{ color: '#888' }}
        >
          you: {pitchName}{pitchOctave}{' '}
          {pitchCents >= 0 ? `+${Math.round(pitchCents)}` : Math.round(pitchCents)}¢
        </span>
      )}
    </>
  );
}

function NowNote({
  activeTarget,
  pitchMidi,
  pitchName,
  pitchOctave,
  pitchCents,
}: {
  activeTarget: TargetNote;
  pitchMidi: number | null;
  pitchName: string | null;
  pitchOctave: number | null;
  pitchCents: number;
}) {
  return (
    <>
      <div className="text-xs uppercase tracking-widest text-[#00ffff] shrink-0">Now</div>
      <div className="flex-1 flex items-baseline gap-3 min-w-0">
        <span className="text-2xl font-bold truncate">
          {midiToName(activeTarget.midi).full}
        </span>
        <span className="text-xs text-[#888] truncate">
          {activeTarget.label ?? `String ${activeTarget.string + 1} · Fret ${activeTarget.fret}`}
        </span>
      </div>
      {pitchMidi != null && (
        <span
          className="text-xs font-mono shrink-0"
          style={{
            color:
              pitchMidi === activeTarget.midi
                ? Math.abs(pitchCents) < 25
                  ? '#00ff88'
                  : '#ffaa00'
                : '#ff6b35',
          }}
        >
          you: {pitchName}{pitchOctave}{' '}
          {pitchCents >= 0 ? `+${Math.round(pitchCents)}` : Math.round(pitchCents)}¢
        </span>
      )}
    </>
  );
}

function ResultStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[#1f1f1f] bg-[#0a0a0a] p-2">
      <div className="text-[9px] uppercase tracking-widest text-[#555]">{label}</div>
      <div className="text-base font-semibold text-[#ededed] mt-0.5 font-mono">{value}</div>
    </div>
  );
}

function PlaybackControls({
  bpm,
  authoredBpm,
  onBpmChange,
  loopTarget,
  onLoopTargetChange,
  metronomeOn,
  onMetronomeChange,
  mode,
}: {
  bpm: number;
  authoredBpm: number;
  onBpmChange: (bpm: number) => void;
  /** 0 = infinite. Otherwise: number of times to play through before showing results. */
  loopTarget: number;
  onLoopTargetChange: (target: number) => void;
  metronomeOn: boolean;
  onMetronomeChange: (on: boolean) => void;
  mode: Mode;
}) {
  // Presets are relative to authored BPM so the buttons feel meaningful
  // regardless of whether the song is 60 or 200 BPM authored.
  const presets: { label: string; ratio: number }[] = [
    { label: '25%', ratio: 0.25 },
    { label: '50%', ratio: 0.5 },
    { label: '75%', ratio: 0.75 },
    { label: '100%', ratio: 1.0 },
    { label: '125%', ratio: 1.25 },
  ];

  const stepBpm = (delta: number) => {
    const next = Math.max(20, Math.min(300, bpm + delta));
    onBpmChange(next);
  };

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-2 sm:p-3 mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-[10px] uppercase tracking-widest text-[#666] font-mono">Speed</span>

      <div className="flex gap-1">
        {presets.map((p) => {
          const presetBpm = Math.max(20, Math.round(authoredBpm * p.ratio));
          const active = bpm === presetBpm;
          return (
            <button
              key={p.label}
              onClick={() => onBpmChange(presetBpm)}
              className={`px-2 py-1 rounded font-mono text-[11px] transition-colors ${
                active
                  ? 'bg-[#00ffff] text-black'
                  : 'bg-[#1a1a1a] text-[#888] hover:text-[#ededed] hover:bg-[#222]'
              }`}
              title={`${presetBpm} BPM`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => stepBpm(-5)}
          className="w-7 h-7 rounded bg-[#1a1a1a] text-[#888] hover:text-[#ededed] hover:bg-[#222] font-mono text-base"
          title="-5 BPM"
        >
          −
        </button>
        <span className="text-sm font-mono text-[#ededed] tabular-nums min-w-[64px] text-center">
          {bpm} <span className="text-[#666] text-[10px]">BPM</span>
        </span>
        <button
          onClick={() => stepBpm(5)}
          className="w-7 h-7 rounded bg-[#1a1a1a] text-[#888] hover:text-[#ededed] hover:bg-[#222] font-mono text-base"
          title="+5 BPM"
        >
          +
        </button>
      </div>

      <span className="text-[10px] text-[#444] font-mono hidden sm:inline">
        {Math.round((bpm / authoredBpm) * 100)}% of {authoredBpm}
      </span>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-widest text-[#666] font-mono mr-1">Loops</span>
          {([1, 3, 5, 0] as const).map((target) => {
            const active = loopTarget === target;
            const label = target === 0 ? '∞' : `${target}×`;
            const title =
              target === 0
                ? 'Loop forever — exit when you\'re done'
                : target === 1
                  ? 'Play once, then show results'
                  : `Play ${target}× before showing results`;
            return (
              <button
                key={target}
                onClick={() => onLoopTargetChange(target)}
                title={title}
                className={`px-2 py-1 rounded font-mono text-[11px] transition-colors ${
                  active
                    ? 'bg-[#a855f7] text-black'
                    : 'bg-[#1a1a1a] text-[#888] hover:text-[#ededed] hover:bg-[#222]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {mode === 'hero' && (
          <label className="flex items-center gap-1.5 text-[#888] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={metronomeOn}
              onChange={(e) => onMetronomeChange(e.target.checked)}
              className="accent-[#00ffff]"
            />
            <span className="text-[11px] font-mono uppercase tracking-wider">Metro</span>
          </label>
        )}
      </div>
    </div>
  );
}
