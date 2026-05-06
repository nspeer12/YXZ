'use client';

import { useCallback, useEffect, useState } from 'react';
import { CURRICULUM, type Lesson } from '@/lib/guitar/curriculum';
import type { SessionResult } from '@/lib/guitar/grading';

const STORAGE_KEY = 'wavelab.guitar.progress.v1';

export interface LessonStats {
  attempts: number;
  bestAccuracy: number;
  bestAvgCentsOff: number;
  lastAccuracy: number;
  passed: boolean;
  lastPlayedAt: number | null;
}

const EMPTY_STATS: LessonStats = {
  attempts: 0,
  bestAccuracy: 0,
  bestAvgCentsOff: Infinity,
  lastAccuracy: 0,
  passed: false,
  lastPlayedAt: null,
};

interface ProgressState {
  byLesson: Record<string, LessonStats>;
  totalSessions: number;
}

const EMPTY_STATE: ProgressState = {
  byLesson: {},
  totalSessions: 0,
};

function loadState(): ProgressState {
  if (typeof window === 'undefined') return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    return { ...EMPTY_STATE, ...parsed, byLesson: parsed.byLesson ?? {} };
  } catch {
    return EMPTY_STATE;
  }
}

function saveState(state: ProgressState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage may be unavailable */
  }
}

export interface UseLessonProgressResult {
  totalCompleted: number;
  totalSessions: number;
  getLessonStats: (lessonId: string) => LessonStats;
  isUnlocked: (lesson: Lesson) => boolean;
  recordLessonResult: (lessonId: string, result: SessionResult) => void;
  reset: () => void;
}

export function useLessonProgress(): UseLessonProgressResult {
  const [state, setState] = useState<ProgressState>(EMPTY_STATE);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    setState(loadState());
  }, []);

  const getLessonStats = useCallback(
    (lessonId: string): LessonStats => state.byLesson[lessonId] ?? EMPTY_STATS,
    [state],
  );

  // For now every lesson is unlocked — prerequisites are still tracked in
  // lesson data as suggestions but we don't gate on them.
  const isUnlocked = useCallback((_lesson: Lesson): boolean => true, []);

  const recordLessonResult = useCallback((lessonId: string, result: SessionResult) => {
    setState((prev) => {
      const lesson = CURRICULUM.find((l) => l.id === lessonId);
      const passThreshold = lesson?.passAccuracy ?? 0.7;
      const existing = prev.byLesson[lessonId] ?? EMPTY_STATS;
      const updated: LessonStats = {
        attempts: existing.attempts + 1,
        bestAccuracy: Math.max(existing.bestAccuracy, result.accuracy),
        bestAvgCentsOff: Math.min(existing.bestAvgCentsOff, result.averageCentsOff || Infinity),
        lastAccuracy: result.accuracy,
        passed: existing.passed || result.accuracy >= passThreshold,
        lastPlayedAt: Date.now(),
      };
      const next: ProgressState = {
        ...prev,
        byLesson: { ...prev.byLesson, [lessonId]: updated },
        totalSessions: prev.totalSessions + 1,
      };
      saveState(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState(EMPTY_STATE);
    saveState(EMPTY_STATE);
  }, []);

  const totalCompleted = Object.values(state.byLesson).filter((s) => s.passed).length;

  return {
    totalCompleted,
    totalSessions: state.totalSessions,
    getLessonStats,
    isUnlocked,
    recordLessonResult,
    reset,
  };
}
