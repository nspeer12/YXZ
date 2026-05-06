'use client';

import type { Lesson } from '@/lib/guitar/curriculum';
import type { LessonStats } from '@/hooks/useLessonProgress';

interface Props {
  lesson: Lesson;
  stats: LessonStats;
  locked: boolean;
  onStart: () => void;
}

const CATEGORY_ACCENT: Record<Lesson['category'], string> = {
  tuning: '#00ff88',
  notes: '#00ffff',
  chords: '#a855f7',
  scales: '#ff6b35',
  rhythm: '#ffaa00',
  song: '#ff4488',
};

const DIFFICULTY_LABEL: Record<Lesson['difficulty'], string> = {
  starter: 'Starter',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export function LessonCard({ lesson, stats, locked, onStart }: Props) {
  const accent = CATEGORY_ACCENT[lesson.category];
  const accuracy = stats.bestAccuracy;
  const passed = stats.passed;

  return (
    <button
      onClick={locked ? undefined : onStart}
      disabled={locked}
      className={`
        text-left rounded-lg border bg-[#0d0d0d] p-4 transition-colors flex flex-col gap-3
        ${locked ? 'border-[#1a1a1a] opacity-50 cursor-not-allowed' : 'border-[#2a2a2a] hover:border-[#3a3a3a] cursor-pointer'}
      `}
      style={!locked ? { boxShadow: passed ? `inset 0 0 0 1px ${accent}66` : undefined } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
            <span className="text-[10px] uppercase tracking-widest text-[#666]">
              {lesson.category} · {DIFFICULTY_LABEL[lesson.difficulty]}
            </span>
          </div>
          <h3 className="text-base font-semibold leading-tight">{lesson.title}</h3>
        </div>
        {locked && <span className="text-xs text-[#555] font-mono">🔒</span>}
        {!locked && passed && <span className="text-xs" style={{ color: accent }}>✓</span>}
      </div>

      <p className="text-xs text-[#888] leading-relaxed line-clamp-3">{lesson.description}</p>

      <div className="flex items-center justify-between text-[10px] font-mono text-[#555]">
        <span className="flex items-center gap-1.5">
          <span>{lesson.exercises.length} exercise{lesson.exercises.length === 1 ? '' : 's'}</span>
          {lesson.media?.youtube && <span title="Has YouTube">▶</span>}
          {lesson.media?.spotify && <span title="Has Spotify" className="text-[#1ed760]">♫</span>}
        </span>
        {stats.attempts > 0 && (
          <span>
            best {Math.round(accuracy * 100)}% · {stats.attempts} attempt{stats.attempts === 1 ? '' : 's'}
          </span>
        )}
        {stats.attempts === 0 && !locked && <span style={{ color: accent }}>Start →</span>}
      </div>
    </button>
  );
}
