'use client';

import type { UseAudioInputResult } from '@/hooks/useAudioInput';

interface Props {
  audioInput: UseAudioInputResult;
}

export function AudioInputSelector({ audioInput }: Props) {
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

  return (
    <div className="space-y-3">
      {!hasPermission && !isActive && (
        <div>
          <button
            onClick={start_}
            className="w-full px-4 py-3 bg-[#ff6b35] text-black font-medium rounded-md hover:bg-[#ff8855] active:bg-[#cc5520] transition-colors"
          >
            Connect mic / audio interface
          </button>
          <p className="text-[10px] text-[#555] mt-2 leading-relaxed">
            Plug your guitar into a USB audio interface (Focusrite Scarlett, etc.) and the browser
            will treat it as an input device. A laptop mic also works for early lessons — pitch
            detection will just be a little noisier.
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
            className="flex-1 bg-[#1a1a1a] text-sm text-[#ededed] border border-[#2a2a2a] rounded-md px-2 py-2"
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
                ? 'bg-[#1a1a1a] text-[#ff6b35] border-[#ff6b35]/40 hover:border-[#ff6b35]'
                : 'bg-[#ff6b35] text-black border-transparent hover:bg-[#ff8855]'
            }`}
          >
            {isActive ? 'Stop' : 'Start'}
          </button>
        </div>
      )}

      {/* Level meter */}
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
        <div className="flex items-center justify-between text-[10px] text-[#555] font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            Live
          </span>
          {latencyMs > 0 && <span>~{latencyMs} ms latency</span>}
        </div>
      )}

      {error && (
        <p className="text-xs text-[#ff6b6b] bg-[#2a0a0a] border border-[#5a1a1a] rounded p-2">
          {error}
        </p>
      )}
    </div>
  );
}
