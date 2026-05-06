'use client';

import { useEffect, useRef } from 'react';
import { Fretboard } from '@/components/guitar/Fretboard';
import { STANDARD_TUNING, fretsForNote, TUNE_TOLERANCE_CENTS } from '@/lib/guitar/tuning';
import type { UseAudioInputResult } from '@/hooks/useAudioInput';
import type { UsePitchDetectionResult } from '@/hooks/usePitchDetection';
import type { Effect, EffectType } from '@/lib/audio-engine';

// Pedalboard order, left to right, mimicking a typical rock signal chain.
const PEDALS: { type: EffectType; label: string; color: string }[] = [
  { type: 'compressor', label: 'Comp', color: '#37db5b' },
  { type: 'distortion', label: 'Drive', color: '#ff3535' },
  { type: 'autowah', label: 'Wah', color: '#ffc233' },
  { type: 'chorus', label: 'Chorus', color: '#3aa3ff' },
  { type: 'delay', label: 'Delay', color: '#b558ff' },
  { type: 'reverb', label: 'Reverb', color: '#00ffff' },
];

interface Props {
  audioInput: UseAudioInputResult;
  pitch: UsePitchDetectionResult;
  monitorEnabled: boolean;
  onMonitorToggle: (enabled: boolean) => void;
  onStreamChange: (stream: MediaStream | null) => void;
  effects: Effect[];
  onAddEffect: (type: EffectType) => void;
  onRemoveEffect: (id: string) => void;
}

/**
 * Studio bottom-drawer panel for live guitar input. Combines the audio-input
 * controls (device picker, start/stop, level meter, monitor toggle), a
 * compact tuner readout, a quick pedalboard toggle row, and a Fretboard
 * showing the currently-detected pitch.
 *
 * The acquired MediaStream is handed to the audio engine so the live signal
 * flows through the same effects chain as the synth and ends up in the
 * recorder. This is the single owner of the input stream in Studio mode.
 */
export function StudioGuitarInput({
  audioInput,
  pitch,
  monitorEnabled,
  onMonitorToggle,
  onStreamChange,
  effects,
  onAddEffect,
  onRemoveEffect,
}: Props) {
  const {
    isActive,
    hasPermission,
    devices,
    activeDeviceId,
    level,
    error,
    latencyMs,
    start,
    stop,
    selectDevice,
  } = audioInput;

  const start_ = () => void start();
  const lastStreamRef = useRef<MediaStream | null>(null);

  // Acquire a dedicated MediaStream for the engine to consume. We mirror the
  // active device id from the shared `useAudioInput` hook (which holds its
  // own stream for the analyser / level meter).
  useEffect(() => {
    let cancelled = false;
    const acquire = async () => {
      if (!isActive || !activeDeviceId) {
        if (lastStreamRef.current) {
          lastStreamRef.current.getTracks().forEach((t) => t.stop());
          lastStreamRef.current = null;
          onStreamChange(null);
        }
        return;
      }
      const current = lastStreamRef.current;
      if (current && current.getAudioTracks()[0]?.getSettings().deviceId === activeDeviceId) {
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: activeDeviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
          } as MediaTrackConstraints,
          video: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (lastStreamRef.current) {
          lastStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        lastStreamRef.current = stream;
        onStreamChange(stream);
      } catch {
        /* useAudioInput surfaces its own error */
      }
    };
    void acquire();
    return () => {
      cancelled = true;
    };
  }, [isActive, activeDeviceId, onStreamChange]);

  useEffect(() => {
    return () => {
      if (lastStreamRef.current) {
        lastStreamRef.current.getTracks().forEach((t) => t.stop());
        lastStreamRef.current = null;
        onStreamChange(null);
      }
    };
  }, [onStreamChange]);

  const detectedFrets = pitch.midiNote != null ? fretsForNote(STANDARD_TUNING, pitch.midiNote) : [];
  const fretHighlights = detectedFrets.map(({ string, fret }) => ({
    string,
    fret,
    color: '#00ff88',
    intensity: 0.85,
    label: String(fret),
  }));

  const pedalIsOn = (type: EffectType) =>
    effects.some((e) => e.type === type && e.enabled !== false);
  const togglePedal = (type: EffectType) => {
    const existing = effects.find((e) => e.type === type);
    if (existing) {
      onRemoveEffect(existing.id);
    } else {
      onAddEffect(type);
    }
  };

  const showInTune =
    isActive && pitch.midiNote != null && Math.abs(pitch.cents) <= TUNE_TOLERANCE_CENTS;

  return (
    <div className="space-y-2">
      {/* Top row: input device + level + tuner readout + monitor + latency */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {!hasPermission && !isActive ? (
          <button
            onClick={start_}
            className="px-3 py-2 bg-[#ff6b35] text-black font-medium rounded-md hover:bg-[#ff8855] active:bg-[#cc5520] transition-colors text-xs"
          >
            Connect guitar / mic
          </button>
        ) : (
          <>
            <select
              value={activeDeviceId ?? ''}
              onChange={(e) => {
                if (e.target.value) void selectDevice(e.target.value);
              }}
              className="bg-[#1a1a1a] text-xs text-[#ededed] border border-[#2a2a2a] rounded-md px-2 py-1.5 max-w-[180px] sm:max-w-[260px] truncate"
            >
              {devices.length === 0 && <option value="">No inputs detected</option>}
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
            <button
              onClick={isActive ? stop : start_}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                isActive
                  ? 'bg-[#1a1a1a] text-[#ff6b35] border-[#ff6b35]/40 hover:border-[#ff6b35]'
                  : 'bg-[#ff6b35] text-black border-transparent hover:bg-[#ff8855]'
              }`}
            >
              {isActive ? 'Stop' : 'Start'}
            </button>

            {/* Level meter (compact) */}
            <div className="hidden sm:flex items-center gap-1.5 min-w-[120px]">
              <span className="text-[9px] uppercase tracking-widest text-[#666] font-mono">Lvl</span>
              <div className="h-2 flex-1 bg-[#1a1a1a] rounded overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.min(100, level * 100)}%`,
                    background: level > 0.85 ? '#ff4444' : level > 0.5 ? '#ffaa00' : '#00ff88',
                  }}
                />
              </div>
            </div>

            {/* Tuner readout */}
            <div className="flex items-baseline gap-2 min-w-[110px]">
              <span
                className={`text-base font-bold tabular-nums ${
                  showInTune ? 'text-[#00ff88]' : isActive && pitch.midiNote != null ? 'text-[#ededed]' : 'text-[#444]'
                }`}
              >
                {pitch.noteName != null && isActive ? `${pitch.noteName}${pitch.octave ?? ''}` : '—'}
              </span>
              {isActive && pitch.midiNote != null && (
                <span
                  className="text-[10px] font-mono"
                  style={{
                    color: showInTune
                      ? '#00ff88'
                      : Math.abs(pitch.cents) < 20
                        ? '#ffaa00'
                        : '#ff6b35',
                  }}
                >
                  {pitch.cents >= 0 ? `+${Math.round(pitch.cents)}` : Math.round(pitch.cents)}¢
                </span>
              )}
            </div>

            <button
              onClick={() => onMonitorToggle(!monitorEnabled)}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md border transition-colors ${
                monitorEnabled
                  ? 'bg-[#00ffff] text-black border-transparent'
                  : 'bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:border-[#00ffff]/40 hover:text-[#ededed]'
              }`}
              title={monitorEnabled ? 'Live input is in the chain' : 'Live input is muted (use headphones to avoid feedback)'}
            >
              Monitor {monitorEnabled ? 'ON' : 'OFF'}
            </button>

            {latencyMs > 0 && (
              <span className="text-[10px] text-[#555] font-mono whitespace-nowrap hidden md:inline">
                ~{latencyMs}ms
              </span>
            )}
          </>
        )}
      </div>

      {/* Pedalboard toggles */}
      {(hasPermission || isActive) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-widest text-[#666] font-mono mr-1">Pedals</span>
          {PEDALS.map((p) => {
            const on = pedalIsOn(p.type);
            return (
              <button
                key={p.type}
                onClick={() => togglePedal(p.type)}
                className="px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider rounded transition-colors border"
                style={{
                  background: on ? p.color : '#0d0d0d',
                  color: on ? '#000' : p.color,
                  borderColor: on ? p.color : `${p.color}55`,
                  fontWeight: on ? 700 : 500,
                  boxShadow: on ? `0 0 10px ${p.color}66` : undefined,
                }}
                title={on ? `${p.label} engaged — click to disable` : `Engage ${p.label}`}
              >
                {on ? '●' : '○'} {p.label}
              </button>
            );
          })}
          <span className="text-[9px] text-[#444] font-mono ml-1 hidden md:inline">
            tweak in the effects rack
          </span>
        </div>
      )}

      {/* Fretboard with detected pitch highlight */}
      <div className="rounded-md border border-[#1f1f1f] bg-[#0d0d0d] p-2">
        <Fretboard tuning={STANDARD_TUNING} frets={12} height={130} highlight={fretHighlights} />
      </div>

      {!isActive && !hasPermission && (
        <p className="text-[10px] text-[#555] leading-relaxed">
          Plug a USB audio interface (Focusrite Scarlett, etc.) and pick it from the dropdown. The
          signal flows through the same effects chain as the synth — engage pedals above to apply
          drive/delay/reverb to your live guitar. Master record captures everything.
        </p>
      )}

      {error && (
        <p className="text-[11px] text-[#ff6b6b] bg-[#2a0a0a] border border-[#5a1a1a] rounded p-2">
          {error}
        </p>
      )}
    </div>
  );
}
