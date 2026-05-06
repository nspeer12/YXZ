'use client';

import { useEffect, useRef } from 'react';
import type { UseAudioInputResult } from '@/hooks/useAudioInput';

interface Props {
  audioInput: UseAudioInputResult;
  monitorEnabled: boolean;
  onMonitorToggle: (enabled: boolean) => void;
  onStreamChange: (stream: MediaStream | null) => void;
}

/**
 * Studio audio-input panel. Wraps useAudioInput (shared with guitar mode)
 * and pipes the live MediaStream into the Tone.js effects chain via
 * onStreamChange. Includes monitor toggle + level meter + latency readout.
 */
export function StudioInputPanel({ audioInput, monitorEnabled, onMonitorToggle, onStreamChange }: Props) {
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

  // Pull the underlying MediaStream out of useAudioInput by reading the
  // analyser's source path. useAudioInput keeps the stream internal — we
  // re-acquire via the active device id and the audioContext that the hook
  // already created. Simpler: inspect the hook's internal stream by adding
  // a getter would require changing useAudioInput (not allowed).
  //
  // Instead we duplicate ownership: when the hook is active, we maintain
  // our own getUserMedia call against the same device. This keeps
  // useAudioInput untouched and gives us a stream we control fully.
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

      // Already have a stream for this device? Skip.
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
        /* useAudioInput will surface its own error */
      }
    };
    void acquire();
    return () => {
      cancelled = true;
    };
  }, [isActive, activeDeviceId, onStreamChange]);

  // Tear down the dedicated stream on unmount.
  useEffect(() => {
    return () => {
      if (lastStreamRef.current) {
        lastStreamRef.current.getTracks().forEach((t) => t.stop());
        lastStreamRef.current = null;
        onStreamChange(null);
      }
    };
  }, [onStreamChange]);

  return (
    <div className="space-y-3 p-3">
      {!hasPermission && !isActive && (
        <div>
          <button
            onClick={start_}
            className="w-full px-4 py-3 bg-[#00ffff] text-black font-medium rounded-md hover:bg-[#33ffff] active:bg-[#00cccc] transition-colors text-sm"
          >
            Connect mic / audio interface
          </button>
          <p className="text-[10px] text-[#555] mt-2 leading-relaxed">
            Plug a USB interface or use your built-in mic. The signal flows
            through the same effects chain as the synth.
          </p>
        </div>
      )}

      {(hasPermission || isActive) && (
        <div className="flex items-center gap-2">
          <select
            value={activeDeviceId ?? ''}
            onChange={(e) => {
              if (e.target.value) void selectDevice(e.target.value);
            }}
            className="flex-1 bg-[#1a1a1a] text-xs text-[#ededed] border border-[#2a2a2a] rounded-md px-2 py-2 min-w-0"
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
            className={`px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
              isActive
                ? 'bg-[#1a1a1a] text-[#00ffff] border-[#00ffff]/40 hover:border-[#00ffff]'
                : 'bg-[#00ffff] text-black border-transparent hover:bg-[#33ffff]'
            }`}
          >
            {isActive ? 'Stop' : 'Start'}
          </button>
        </div>
      )}

      {(hasPermission || isActive) && (
        <div>
          <div className="flex items-center justify-between text-[10px] text-[#666] mb-1 font-mono uppercase tracking-wider">
            <span>Input level</span>
            <span>{isActive ? `${Math.round(level * 100)}%` : '—'}</span>
          </div>
          <div className="h-2 bg-[#1a1a1a] rounded overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.min(100, level * 100)}%`,
                background: level > 0.85 ? '#ff4444' : level > 0.5 ? '#ffaa00' : '#00ff88',
              }}
            />
          </div>
        </div>
      )}

      {isActive && (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => onMonitorToggle(!monitorEnabled)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
              monitorEnabled
                ? 'bg-[#00ffff] text-black border-transparent'
                : 'bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:border-[#00ffff]/40 hover:text-[#ededed]'
            }`}
            title={monitorEnabled ? 'Live input is in the chain' : 'Live input is muted (use headphones to avoid feedback)'}
          >
            Monitor: {monitorEnabled ? 'ON' : 'OFF'}
          </button>
          {latencyMs > 0 && (
            <span className="text-[10px] text-[#555] font-mono whitespace-nowrap">
              ~{latencyMs} ms
            </span>
          )}
        </div>
      )}

      {!monitorEnabled && isActive && (
        <p className="text-[10px] text-[#555] leading-relaxed">
          Monitor off: input is silent and not recorded. Turn on with headphones to hear it through the effects chain.
        </p>
      )}

      {error && (
        <p className="text-xs text-[#ff6b6b] bg-[#2a0a0a] border border-[#5a1a1a] rounded p-2">
          {error}
        </p>
      )}
    </div>
  );
}
