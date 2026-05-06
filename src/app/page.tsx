'use client';

import { useState, useEffect } from 'react';
import { StudioMode } from '@/components/studio/StudioMode';
import { GuitarMode } from '@/components/guitar/GuitarMode';
import type { AppMode } from '@/components/common/ModeSwitcher';

const STORAGE_KEY = 'wavelab.mode';

export default function Home() {
  const [mode, setMode] = useState<AppMode>('home');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'studio' || saved === 'guitar') {
        setMode(saved);
      }
    } catch {
      // ignore (e.g. private mode, SSR mismatch)
    }
    setHydrated(true);
  }, []);

  const handleSwitchMode = (next: AppMode) => {
    setMode(next);
    try {
      if (next === 'home') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  if (!hydrated) {
    return <div className="min-h-screen bg-[#0a0a0a]" />;
  }

  if (mode === 'studio') {
    return <StudioMode onSwitchMode={handleSwitchMode} />;
  }

  if (mode === 'guitar') {
    return <GuitarMode onSwitchMode={handleSwitchMode} />;
  }

  return <ModePicker onPick={handleSwitchMode} />;
}

function ModePicker({ onPick }: { onPick: (mode: AppMode) => void }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10 sm:mb-14">
          <h1 className="text-5xl sm:text-7xl font-bold mb-3 tracking-tighter">
            <span className="text-[#00ffff]">Wave</span>
            <span className="text-[#ff6b35]">Lab</span>
          </h1>
          <p className="text-[#666] text-base sm:text-lg">Pick a mode to get started.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => onPick('guitar')}
            className="group text-left rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] hover:border-[#ff6b35] transition-colors p-5 sm:p-6 min-h-[180px] flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-[#ff6b35]" />
                <span className="text-[10px] uppercase tracking-widest text-[#888]">Learn</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">
                <span className="text-[#ff6b35]">Guitar</span>
                <span className="text-[#00ffff]"> Lab</span>
              </h2>
              <p className="text-sm text-[#888] leading-relaxed">
                Rocksmith-style guitar lessons. Plug in your guitar (or use a mic), tune up, and learn notes,
                chords, and scales with real-time feedback.
              </p>
            </div>
            <div className="mt-4 text-xs text-[#ff6b35] group-hover:underline">Open Guitar Lab →</div>
          </button>

          <button
            onClick={() => onPick('studio')}
            className="group text-left rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] hover:border-[#00ffff] transition-colors p-5 sm:p-6 min-h-[180px] flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-[#00ffff]" />
                <span className="text-[10px] uppercase tracking-widest text-[#888]">Create</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-[#00ffff]">Studio</h2>
              <p className="text-sm text-[#888] leading-relaxed">
                Synthesis lab. Draw waveforms, sculpt harmonics, build effect chains, and loop your ideas
                across multiple tracks.
              </p>
            </div>
            <div className="mt-4 text-xs text-[#00ffff] group-hover:underline">Open Studio →</div>
          </button>
        </div>

        <p className="text-center text-[10px] text-[#444] mt-8 font-mono">
          More modes coming: Jam (DAW) · Songbook · Rhythm trainer
        </p>
      </div>
    </div>
  );
}
