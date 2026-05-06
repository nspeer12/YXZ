'use client';

import { useEffect, useRef, useState } from 'react';
import { GuitarPitchDetector, EMPTY_PITCH, type DetectedPitch } from '@/lib/guitar/pitch-detector';

/**
 * Continuously analyze the given AnalyserNode for pitch.
 *
 * Returns the latest `DetectedPitch`. Consumers can also subscribe to a
 * raw event stream via `addListener` for cases where they need every sample
 * (e.g. the lesson grader, which can't afford to miss frames between renders).
 */
export interface UsePitchDetectionResult extends DetectedPitch {
  /** Subscribe to every detection sample. Returns an unsubscribe function. */
  addListener: (fn: (pitch: DetectedPitch) => void) => () => void;
}

export function usePitchDetection(analyser: AnalyserNode | null): UsePitchDetectionResult {
  const [latest, setLatest] = useState<DetectedPitch>(EMPTY_PITCH);
  const detectorRef = useRef<GuitarPitchDetector | null>(null);
  const listenersRef = useRef<Set<(pitch: DetectedPitch) => void>>(new Set());

  // Throttle the React state update — listeners get every sample, but the UI
  // only needs ~30fps to feel responsive.
  const lastSetAt = useRef(0);

  useEffect(() => {
    if (!analyser) {
      detectorRef.current = null;
      setLatest(EMPTY_PITCH);
      return;
    }
    const ctx = analyser.context;
    const detector = new GuitarPitchDetector(analyser, ctx.sampleRate);
    detectorRef.current = detector;

    let raf = 0;
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      const pitch = detector.detect();
      // Notify all listeners synchronously.
      listenersRef.current.forEach((fn) => fn(pitch));
      const now = pitch.timestamp;
      if (now - lastSetAt.current >= 33) {
        lastSetAt.current = now;
        setLatest(pitch);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, [analyser]);

  const addListener = (fn: (pitch: DetectedPitch) => void) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  };

  return { ...latest, addListener };
}
