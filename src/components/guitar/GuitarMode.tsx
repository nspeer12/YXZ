'use client';

import { useMemo, useState, useCallback } from 'react';
import { ModeSwitcher, type AppMode } from '@/components/common/ModeSwitcher';
import { AudioInputSelector } from '@/components/guitar/AudioInputSelector';
import { Tuner } from '@/components/guitar/Tuner';
import { TunerScreen } from '@/components/guitar/TunerScreen';
import { Fretboard } from '@/components/guitar/Fretboard';
import { LessonCard } from '@/components/guitar/LessonCard';
import { LessonPlayer } from '@/components/guitar/LessonPlayer';
import { useAudioInput } from '@/hooks/useAudioInput';
import { usePitchDetection } from '@/hooks/usePitchDetection';
import { useLessonProgress } from '@/hooks/useLessonProgress';
import { CURRICULUM, getLesson, type Lesson, type LessonCategory } from '@/lib/guitar/curriculum';
import { STANDARD_TUNING, fretsForNote } from '@/lib/guitar/tuning';

const CATEGORY_ORDER: LessonCategory[] = ['tuning', 'notes', 'chords', 'scales', 'rhythm', 'song'];

const CATEGORY_TITLES: Record<LessonCategory, string> = {
  tuning: 'Tune up',
  notes: 'Notes & melodies',
  chords: 'Chords',
  scales: 'Scales',
  rhythm: 'Rhythm & technique',
  song: 'Songs',
};

const DIFFICULTY_RANK: Record<Lesson['difficulty'], number> = {
  starter: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

interface GuitarModeProps {
  onSwitchMode: (mode: AppMode) => void;
}

type Screen =
  | { kind: 'home' }
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'tuner' };

export function GuitarMode({ onSwitchMode }: GuitarModeProps) {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [patientMode, setPatientMode] = useState(false);

  const audioInput = useAudioInput();
  const pitch = usePitchDetection(audioInput.analyser);
  const progress = useLessonProgress();

  const startLesson = useCallback((lessonId: string) => {
    setScreen({ kind: 'lesson', lessonId });
  }, []);

  const openTuner = useCallback(() => {
    setScreen({ kind: 'tuner' });
  }, []);

  const exitLesson = useCallback(() => {
    setScreen({ kind: 'home' });
  }, []);

  // Highlight which fret(s) currently match the detected pitch — useful for the
  // "explore" widget on the home screen.
  const detectedFrets = pitch.midiNote != null
    ? fretsForNote(STANDARD_TUNING, pitch.midiNote)
    : [];

  if (screen.kind === 'lesson') {
    const lesson = getLesson(screen.lessonId);
    if (!lesson) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex items-center justify-center">
          <div className="text-center">
            <p className="mb-4">Lesson not found.</p>
            <button onClick={exitLesson} className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded">Back</button>
          </div>
        </div>
      );
    }
    const lessonIndex = CURRICULUM.findIndex((l) => l.id === lesson.id);
    const nextLesson = lessonIndex >= 0 ? CURRICULUM[lessonIndex + 1] : undefined;
    return (
      <LessonPlayer
        // Key by lesson id so navigating to a new lesson actually
        // re-mounts the player (resets phase, bpm, exerciseIndex, results, etc).
        key={lesson.id}
        lesson={lesson}
        audioInput={audioInput}
        pitch={pitch}
        patientMode={patientMode}
        onComplete={(result) => {
          progress.recordLessonResult(lesson.id, result);
        }}
        onExit={exitLesson}
        nextLesson={nextLesson}
        onStartLesson={startLesson}
      />
    );
  }

  if (screen.kind === 'tuner') {
    return <TunerScreen audioInput={audioInput} pitch={pitch} onExit={exitLesson} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-3 sm:px-6 py-2 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tighter whitespace-nowrap shrink-0">
            <span className="text-[#ff6b35]">Guitar</span>
            <span className="text-[#00ffff] hidden sm:inline"> Lab</span>
          </h1>
          <ModeSwitcher mode="guitar" onChange={onSwitchMode} />
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={openTuner}
            className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#00ff88] hover:text-[#00ff88] text-[#ededed] transition-colors flex items-center gap-1.5 whitespace-nowrap"
            title="Open dedicated tuner"
          >
            <span>🎵</span>
            <span className="hidden sm:inline">Tuner</span>
          </button>
          <label className="flex items-center gap-1.5 text-xs text-[#888] cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={patientMode}
              onChange={(e) => setPatientMode(e.target.checked)}
              className="accent-[#00ff88]"
            />
            <span className="hidden sm:inline">Patient mode</span>
            <span className="sm:hidden">Patient</span>
          </label>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-3 sm:p-6 max-w-6xl w-full mx-auto">
        {/* Audio input + tuner row */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-3 sm:p-4">
            <h2 className="text-xs uppercase tracking-wider text-[#666] mb-3">Audio input</h2>
            <AudioInputSelector audioInput={audioInput} />
          </div>
          <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-3 sm:p-4">
            <h2 className="text-xs uppercase tracking-wider text-[#666] mb-3">Tuner</h2>
            <Tuner pitch={pitch} active={audioInput.isActive} />
          </div>
        </section>

        {/* Fretboard explorer */}
        <section className="mb-4 sm:mb-6">
          <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs uppercase tracking-wider text-[#666]">Fretboard</h2>
              <span className="text-[10px] text-[#555]">
                {pitch.midiNote != null && pitch.clarity > 0.85
                  ? `Detected: ${pitch.noteName ?? '?'}${pitch.octave ?? ''}`
                  : 'Play a note to see it light up'}
              </span>
            </div>
            <Fretboard
              tuning={STANDARD_TUNING}
              frets={12}
              highlight={detectedFrets.map(({ string, fret }) => ({ string, fret, color: '#00ff88' }))}
            />
          </div>
        </section>

        {/* Curriculum */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-wider text-[#666]">Lessons</h2>
            <span className="text-[10px] text-[#555] font-mono">
              {progress.totalCompleted} / {CURRICULUM.length} complete
            </span>
          </div>
          <CurriculumGrid
            lessons={CURRICULUM}
            getStats={progress.getLessonStats}
            onStart={startLesson}
          />
        </section>
      </main>
    </div>
  );
}

interface CurriculumGridProps {
  lessons: Lesson[];
  getStats: (lessonId: string) => ReturnType<ReturnType<typeof useLessonProgress>['getLessonStats']>;
  onStart: (lessonId: string) => void;
}

function CurriculumGrid({ lessons, getStats, onStart }: CurriculumGridProps) {
  const grouped = useMemo(() => {
    const map = new Map<LessonCategory, Lesson[]>();
    for (const lesson of lessons) {
      const arr = map.get(lesson.category) ?? [];
      arr.push(lesson);
      map.set(lesson.category, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]);
    }
    return CATEGORY_ORDER.flatMap((cat) => {
      const arr = map.get(cat);
      return arr && arr.length > 0 ? [{ category: cat, lessons: arr }] : [];
    });
  }, [lessons]);

  return (
    <div className="space-y-6">
      {grouped.map(({ category, lessons: catLessons }) => (
        <div key={category}>
          <h3 className="text-[10px] uppercase tracking-widest text-[#888] mb-2 flex items-center gap-2">
            <span>{CATEGORY_TITLES[category]}</span>
            <span className="text-[#444]">·</span>
            <span className="text-[#444]">{catLessons.length} lesson{catLessons.length === 1 ? '' : 's'}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {catLessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                stats={getStats(lesson.id)}
                locked={false}
                onStart={() => onStart(lesson.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
