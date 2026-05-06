'use client';

import type { DetectedPitch } from '@/lib/guitar/pitch-detector';
import { TUNE_TOLERANCE_CENTS } from '@/lib/guitar/tuning';

interface Props {
  pitch: DetectedPitch;
  active: boolean;
  /** Optional override: target a specific note (e.g. for tuning lesson). */
  targetMidi?: number;
}

const NEEDLE_RANGE_CENTS = 50;

export function Tuner({ pitch, active, targetMidi }: Props) {
  const detectingTarget = targetMidi != null && pitch.midiNote === targetMidi;
  const cents =
    targetMidi != null
      ? pitch.midiNote != null
        ? (pitch.midiNote - targetMidi) * 100 + pitch.cents
        : 0
      : pitch.cents;

  const inTune =
    active &&
    pitch.clarity > 0.9 &&
    Math.abs(cents) <= TUNE_TOLERANCE_CENTS &&
    (targetMidi == null || pitch.midiNote === targetMidi);

  const needlePct = Math.max(-1, Math.min(1, cents / NEEDLE_RANGE_CENTS));
  const needleX = 50 + needlePct * 45; // 5..95 percent

  const noteLabel = pitch.noteName ? `${pitch.noteName}${pitch.octave ?? ''}` : '—';

  return (
    <div>
      {/* Big note display */}
      <div className="flex items-baseline justify-between mb-2">
        <span
          className={`text-4xl sm:text-5xl font-bold tracking-tight ${
            inTune ? 'text-[#00ff88]' : active && pitch.midiNote != null ? 'text-[#ededed]' : 'text-[#444]'
          }`}
        >
          {active ? noteLabel : '—'}
        </span>
        <span className="text-xs font-mono text-[#666]">
          {active && pitch.frequency ? `${pitch.frequency.toFixed(1)} Hz` : 'idle'}
        </span>
      </div>

      {/* Needle */}
      <div className="relative h-14 bg-[#0a0a0a] border border-[#2a2a2a] rounded-md overflow-hidden">
        {/* Center line */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-[#444]" />
        {/* Tolerance band */}
        <div
          className="absolute inset-y-0 bg-[#00ff88]/10"
          style={{
            left: `calc(50% - ${(TUNE_TOLERANCE_CENTS / NEEDLE_RANGE_CENTS) * 45}%)`,
            width: `${(TUNE_TOLERANCE_CENTS / NEEDLE_RANGE_CENTS) * 90}%`,
          }}
        />
        {/* Needle */}
        {active && pitch.midiNote != null && (
          <div
            className="absolute top-1 bottom-1 w-1 rounded transition-all duration-75"
            style={{
              left: `calc(${needleX}% - 2px)`,
              background: inTune ? '#00ff88' : Math.abs(cents) < 20 ? '#ffaa00' : '#ff6b35',
            }}
          />
        )}
        {/* Cent markers */}
        <div className="absolute inset-x-0 bottom-0 flex justify-between px-2 text-[9px] font-mono text-[#444]">
          <span>-50¢</span>
          <span>0</span>
          <span>+50¢</span>
        </div>
      </div>

      {/* Status line */}
      <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
        {!active && <span className="text-[#555]">Connect input to start tuning</span>}
        {active && pitch.midiNote == null && <span className="text-[#666]">Listening…</span>}
        {active && pitch.midiNote != null && (
          <>
            <span className={inTune ? 'text-[#00ff88]' : 'text-[#888]'}>
              {inTune
                ? '✓ in tune'
                : cents > 0
                  ? `${Math.round(cents)}¢ sharp`
                  : `${Math.round(Math.abs(cents))}¢ flat`}
            </span>
            <span className="text-[#444]">clarity {Math.round(pitch.clarity * 100)}%</span>
          </>
        )}
      </div>
    </div>
  );
}
