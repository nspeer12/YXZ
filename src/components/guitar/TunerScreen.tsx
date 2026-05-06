'use client';

import { useEffect, useMemo, useState } from 'react';
import { AudioInputSelector } from '@/components/guitar/AudioInputSelector';
import { STANDARD_TUNING, TUNE_TOLERANCE_CENTS, midiToName, type Tuning } from '@/lib/guitar/tuning';
import type { UseAudioInputResult } from '@/hooks/useAudioInput';
import type { UsePitchDetectionResult } from '@/hooks/usePitchDetection';

interface Props {
  audioInput: UseAudioInputResult;
  pitch: UsePitchDetectionResult;
  onExit: () => void;
}

type TargetMode = 'auto' | number;

const NEEDLE_RANGE_CENTS = 50;
// How long after a string's last in-tune sample we still show its ✓.
const TUNED_PERSIST_MS = 8000;
// How close (in semitones) we need to be to a string for it to be the
// auto-detected target. > 1.5 = give up.
const AUTO_PICK_THRESHOLD_SEMITONES = 1.5;

export function TunerScreen({ audioInput, pitch, onExit }: Props) {
  const [mode, setMode] = useState<TargetMode>('auto');
  // Per-string timestamp of last in-tune confirmation.
  const [tunedAt, setTunedAt] = useState<Record<number, number>>({});
  // Tick once per second so "tuned ✓" badges age out.
  const [, setNow] = useState(Date.now());

  const tuning: Tuning = STANDARD_TUNING;
  const stringCount = tuning.strings.length;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-detect: which string is the current pitch closest to (within 1.5 semitones)?
  const closestString = useMemo(() => {
    if (pitch.midiNote == null || pitch.clarity < 0.85) return null;
    let best = -1;
    let bestDist = Infinity;
    for (let s = 0; s < stringCount; s++) {
      const dist = Math.abs(pitch.midiNote - tuning.strings[s]);
      if (dist < bestDist) {
        best = s;
        bestDist = dist;
      }
    }
    return bestDist <= AUTO_PICK_THRESHOLD_SEMITONES ? best : null;
  }, [pitch.midiNote, pitch.clarity, tuning.strings, stringCount]);

  const targetIndex: number | null = mode === 'auto' ? closestString : mode;
  const targetMidi = targetIndex != null ? tuning.strings[targetIndex] : null;

  // Cents off from target.
  const cents = useMemo(() => {
    if (targetMidi == null || pitch.midiNote == null) return null;
    return (pitch.midiNote - targetMidi) * 100 + pitch.cents;
  }, [targetMidi, pitch.midiNote, pitch.cents]);

  const inTune =
    audioInput.isActive &&
    pitch.clarity > 0.9 &&
    cents != null &&
    Math.abs(cents) <= TUNE_TOLERANCE_CENTS;

  // When in tune for the active target, mark it.
  useEffect(() => {
    if (!inTune || targetIndex == null) return;
    setTunedAt((prev) => {
      // Avoid spurious re-renders: only update if we hadn't already marked it
      // very recently.
      const last = prev[targetIndex];
      if (last && Date.now() - last < 500) return prev;
      return { ...prev, [targetIndex]: Date.now() };
    });
  }, [inTune, targetIndex]);

  const allTuned = useMemo(() => {
    const cutoff = Date.now() - TUNED_PERSIST_MS;
    for (let s = 0; s < stringCount; s++) {
      if (!tunedAt[s] || tunedAt[s] < cutoff) return false;
    }
    return true;
  }, [tunedAt, stringCount]);

  const needlePct = cents == null ? 0 : Math.max(-1, Math.min(1, cents / NEEDLE_RANGE_CENTS));
  const needleX = 50 + needlePct * 45;

  const detectedNote = pitch.noteName ? `${pitch.noteName}${pitch.octave ?? ''}` : '—';
  const targetLabel =
    targetMidi != null ? midiToName(targetMidi).full : audioInput.isActive ? 'play any string' : 'connect input';

  const directionHint = (() => {
    if (cents == null || !audioInput.isActive || pitch.midiNote == null) return null;
    if (Math.abs(cents) <= TUNE_TOLERANCE_CENTS) return 'in tune';
    if (cents > 0) return `${Math.round(cents)}¢ sharp — tune down`;
    return `${Math.round(Math.abs(cents))}¢ flat — tune up`;
  })();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex flex-col">
      <header className="border-b border-[#2a2a2a] px-3 sm:px-6 py-2 flex items-center justify-between gap-2 shrink-0">
        <button
          onClick={onExit}
          className="text-xs text-[#888] hover:text-[#ededed] transition-colors px-2 py-1 rounded border border-[#2a2a2a] shrink-0"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base sm:text-lg font-semibold tracking-tight">Tuner</span>
          <span className="text-[10px] uppercase tracking-widest text-[#666] font-mono truncate hidden sm:inline">
            {tuning.name}
          </span>
        </div>
        <div className="w-12 shrink-0" />
      </header>

      <main className="flex-1 flex flex-col p-4 sm:p-8 max-w-3xl w-full mx-auto">
        {/* Audio input strip — collapsed if active */}
        {!audioInput.isActive && (
          <div className="mb-6 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-3 sm:p-4">
            <h2 className="text-xs uppercase tracking-wider text-[#666] mb-3">Audio input</h2>
            <AudioInputSelector audioInput={audioInput} />
          </div>
        )}

        {/* Big detected note */}
        <div className="text-center mb-2">
          <div className="text-[11px] uppercase tracking-widest text-[#666] font-mono mb-2">
            {mode === 'auto' ? 'Auto-detect' : `Target: ${targetLabel}`}
          </div>
          <div
            className={`text-7xl sm:text-9xl font-bold tabular-nums leading-none transition-colors ${
              inTune
                ? 'text-[#00ff88]'
                : audioInput.isActive && pitch.midiNote != null
                  ? 'text-[#ededed]'
                  : 'text-[#333]'
            }`}
          >
            {audioInput.isActive ? detectedNote : '—'}
          </div>
          <div className="text-[11px] sm:text-sm font-mono text-[#666] mt-2">
            {audioInput.isActive && pitch.frequency
              ? `${pitch.frequency.toFixed(1)} Hz · clarity ${Math.round(pitch.clarity * 100)}%`
              : 'idle'}
          </div>
        </div>

        {/* Needle */}
        <div className="my-6 sm:my-8">
          <div className="relative h-24 sm:h-32 bg-[#0a0a0a] border border-[#2a2a2a] rounded-md overflow-hidden">
            {/* Center line */}
            <div className="absolute inset-y-0 left-1/2 w-px bg-[#444]" />
            {/* Tolerance band */}
            <div
              className="absolute inset-y-0 bg-[#00ff88]/12"
              style={{
                left: `calc(50% - ${(TUNE_TOLERANCE_CENTS / NEEDLE_RANGE_CENTS) * 45}%)`,
                width: `${(TUNE_TOLERANCE_CENTS / NEEDLE_RANGE_CENTS) * 90}%`,
              }}
            />
            {/* Tick marks every 10c */}
            {Array.from({ length: 11 }).map((_, i) => {
              const c = -50 + i * 10;
              const x = 50 + (c / NEEDLE_RANGE_CENTS) * 45;
              const major = c === 0;
              return (
                <div
                  key={i}
                  className="absolute top-0"
                  style={{
                    left: `${x}%`,
                    height: major ? '100%' : '40%',
                    borderLeft: major ? '1px solid #444' : '1px solid #1f1f1f',
                  }}
                />
              );
            })}
            {/* Needle */}
            {audioInput.isActive && pitch.midiNote != null && cents != null && (
              <div
                className="absolute top-2 bottom-2 w-1.5 rounded transition-all duration-100"
                style={{
                  left: `calc(${needleX}% - 3px)`,
                  background: inTune ? '#00ff88' : Math.abs(cents) < 20 ? '#ffaa00' : '#ff6b35',
                  boxShadow: inTune ? '0 0 18px #00ff88aa' : 'none',
                }}
              />
            )}
            {/* Cent markers */}
            <div className="absolute inset-x-0 bottom-1 flex justify-between px-2 text-[10px] sm:text-xs font-mono text-[#666]">
              <span>-50¢</span>
              <span>-25</span>
              <span>0</span>
              <span>+25</span>
              <span>+50¢</span>
            </div>
          </div>

          {/* Direction hint */}
          <div
            className={`text-center mt-3 text-sm sm:text-base font-mono uppercase tracking-widest ${
              inTune ? 'text-[#00ff88]' : 'text-[#888]'
            }`}
          >
            {directionHint ?? (audioInput.isActive ? 'listening…' : 'press start')}
          </div>
        </div>

        {/* String chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] uppercase tracking-widest text-[#666]">Strings</h3>
            <button
              onClick={() => setMode('auto')}
              className={`text-[10px] uppercase tracking-widest font-mono px-2 py-1 rounded ${
                mode === 'auto'
                  ? 'bg-[#00ffff]/15 text-[#00ffff]'
                  : 'text-[#666] hover:text-[#ededed]'
              }`}
            >
              Auto-detect
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
            {Array.from({ length: stringCount }).map((_, idx) => {
              // Display low → high, left → right (string 0 = low E on the left).
              const s = idx;
              const midi = tuning.strings[s];
              const name = midiToName(midi);
              const last = tunedAt[s] ?? 0;
              const recentlyTuned = Date.now() - last < TUNED_PERSIST_MS;
              const isCurrent = targetIndex === s;
              return (
                <button
                  key={s}
                  onClick={() => setMode(s)}
                  className={`flex flex-col items-center justify-center py-3 rounded-md border transition-colors ${
                    isCurrent
                      ? 'border-[#00ffff] bg-[#001818] text-[#ededed]'
                      : 'border-[#2a2a2a] bg-[#0d0d0d] text-[#888] hover:text-[#ededed]'
                  }`}
                >
                  <span className="text-base sm:text-lg font-bold">
                    {name.name}
                    <span className="text-[10px] sm:text-xs text-[#666] font-mono ml-0.5">
                      {name.octave}
                    </span>
                  </span>
                  <span
                    className={`text-[9px] mt-0.5 font-mono ${
                      recentlyTuned ? 'text-[#00ff88]' : 'text-[#444]'
                    }`}
                  >
                    {recentlyTuned ? '✓ tuned' : `string ${stringCount - s}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* All-tuned banner */}
        {allTuned && (
          <div className="mt-6 rounded-lg border border-[#00ff88]/40 bg-[#001a10] p-4 text-center">
            <div className="text-2xl mb-1">🎸</div>
            <div className="text-sm font-medium text-[#00ff88]">All six strings in tune</div>
            <div className="text-[11px] text-[#666] mt-1 font-mono">Have fun. Pluck again to re-check.</div>
          </div>
        )}

        {/* Compact input controls when active */}
        {audioInput.isActive && (
          <div className="mt-6 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-3">
            <AudioInputSelector audioInput={audioInput} />
          </div>
        )}
      </main>
    </div>
  );
}
