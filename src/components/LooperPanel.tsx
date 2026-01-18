'use client';

import { useState } from 'react';
import { LoopTrack, NoteEvent } from '@/lib/looper';

interface LooperPanelProps {
  isPlaying: boolean;
  isRecording: boolean;
  bpm: number;
  bars: number;
  beatsPerBar: number;
  currentBeat: number;
  currentPosition: number;
  loopEnabled: boolean;
  metronomeEnabled: boolean;
  tracks: LoopTrack[];
  onPlay: () => void;
  onStop: () => void;
  onStartRecording: (trackId?: string) => void;
  onStopRecording: () => void;
  onSetBpm: (bpm: number) => void;
  onSetBars: (bars: number) => void;
  onSetBeatsPerBar: (beats: number) => void;
  onSetMetronomeEnabled: (enabled: boolean) => void;
  onSetLoopEnabled: (enabled: boolean) => void;
  onAddTrack: () => void;
  onRemoveTrack: (trackId: string) => void;
  onClearTrack: (trackId: string) => void;
  onClearAllTracks: () => void;
  onSetTrackMuted: (trackId: string, muted: boolean) => void;
  onSetTrackSolo: (trackId: string, solo: boolean) => void;
}

export function LooperPanel({
  isPlaying,
  isRecording,
  bpm,
  bars,
  beatsPerBar,
  currentBeat,
  currentPosition,
  loopEnabled,
  metronomeEnabled,
  tracks,
  onPlay,
  onStop,
  onStartRecording,
  onStopRecording,
  onSetBpm,
  onSetBars,
  onSetBeatsPerBar,
  onSetMetronomeEnabled,
  onSetLoopEnabled,
  onAddTrack,
  onRemoveTrack,
  onClearTrack,
  onClearAllTracks,
  onSetTrackMuted,
  onSetTrackSolo,
}: LooperPanelProps) {
  const [bpmInput, setBpmInput] = useState(bpm.toString());
  const beatsOptions = [4, 8, 12, 16];

  const handleBpmChange = (value: string) => {
    setBpmInput(value);
    const num = parseInt(value);
    if (!isNaN(num) && num >= 40 && num <= 240) {
      onSetBpm(num);
    }
  };

  const totalBeats = bars * beatsPerBar;
  const currentBeatInLoop = currentBeat % totalBeats;

  return (
    <div>
      {/* Transport & Settings Row */}
      <div className="flex items-center justify-between gap-4 mb-4">
        {/* Transport Controls */}
        <div className="flex items-center gap-2">
          {/* Play/Stop */}
          <button
            onClick={isPlaying ? onStop : onPlay}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors ${
              isPlaying
                ? 'bg-[#00ffff] text-black'
                : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] border border-[#2a2a2a]'
            }`}
            title={isPlaying ? 'Stop' : 'Play'}
          >
            {isPlaying ? '⏹' : '▶'}
          </button>

          {/* Record */}
          <button
            onClick={isRecording ? onStopRecording : () => onStartRecording()}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              isRecording
                ? 'bg-[#ff4444] text-white animate-pulse'
                : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#ff4444] border border-[#2a2a2a]'
            }`}
            title={isRecording ? 'Stop Recording' : 'Record'}
          >
            <span className={`w-3 h-3 rounded-full ${isRecording ? 'bg-white' : 'bg-[#ff4444]'}`} />
          </button>

          {/* Loop Toggle */}
          <button
            onClick={() => onSetLoopEnabled(!loopEnabled)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm transition-colors ${
              loopEnabled
                ? 'bg-[#00ff88] text-black'
                : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] border border-[#2a2a2a]'
            }`}
            title={loopEnabled ? 'Loop On' : 'Loop Off'}
          >
            🔁
          </button>

          {/* Metronome Toggle */}
          <button
            onClick={() => onSetMetronomeEnabled(!metronomeEnabled)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm transition-colors ${
              metronomeEnabled
                ? 'bg-[#ff6b35] text-black'
                : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] border border-[#2a2a2a]'
            }`}
            title={metronomeEnabled ? 'Metronome On' : 'Metronome Off'}
          >
            🥁
          </button>
        </div>

        {/* BPM Control */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSetBpm(Math.max(40, bpm - 5))}
            className="w-7 h-7 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] text-xs border border-[#2a2a2a]"
          >
            -
          </button>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={bpmInput}
              onChange={(e) => handleBpmChange(e.target.value)}
              onBlur={() => setBpmInput(bpm.toString())}
              className="w-12 bg-[#1a1a1a] text-center text-sm font-mono text-[#ededed] border border-[#2a2a2a] rounded px-1 py-1"
            />
            <span className="text-xs text-[#666]">BPM</span>
          </div>
          <button
            onClick={() => onSetBpm(Math.min(240, bpm + 5))}
            className="w-7 h-7 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] text-xs border border-[#2a2a2a]"
          >
            +
          </button>
        </div>

        {/* Bars Control */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSetBars(Math.max(1, bars - 1))}
            className="w-7 h-7 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] text-xs border border-[#2a2a2a]"
          >
            -
          </button>
          <span className="text-sm font-mono text-[#ededed] w-16 text-center">{bars} bars</span>
          <button
            onClick={() => onSetBars(Math.min(16, bars + 1))}
            className="w-7 h-7 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] text-xs border border-[#2a2a2a]"
          >
            +
          </button>
        </div>

        {/* Beats per bar */}
        <div className="flex items-center gap-1">
          {beatsOptions.map((b) => (
            <button
              key={b}
              onClick={() => onSetBeatsPerBar(b)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                beatsPerBar === b
                  ? 'bg-[#00ffff] text-black'
                  : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] border border-[#2a2a2a]'
              }`}
            >
              {b}
            </button>
          ))}
          <span className="text-[10px] text-[#666] ml-1">beats</span>
        </div>

        {/* Clear All */}
        <button
          onClick={onClearAllTracks}
          className="px-3 py-1.5 text-xs rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#ff6b35] transition-colors border border-[#2a2a2a]"
          title="Clear all tracks"
        >
          Clear All
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="relative h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-[#00ffff] transition-all duration-75"
            style={{ width: `${currentPosition * 100}%` }}
          />
          {/* Beat markers */}
          {Array.from({ length: totalBeats }).map((_, i) => (
            <div
              key={i}
              className={`absolute top-0 bottom-0 w-px ${
                i % 4 === 0 ? 'bg-[#444]' : 'bg-[#2a2a2a]'
              }`}
              style={{ left: `${(i / totalBeats) * 100}%` }}
            />
          ))}
        </div>
        {/* Beat numbers */}
        <div className="flex justify-between mt-1">
          {Array.from({ length: bars }).map((_, i) => (
            <span key={i} className="text-[10px] text-[#555] font-mono">
              {i + 1}
            </span>
          ))}
        </div>
      </div>

      {/* Tracks */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#666]">Tracks ({tracks.length})</span>
          <button
            onClick={onAddTrack}
            className="px-2 py-1 text-xs rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] transition-colors border border-[#2a2a2a]"
          >
            + Add Track
          </button>
        </div>

        {tracks.map((track) => (
          <div
            key={track.id}
            className={`rounded-lg border overflow-hidden ${
              track.isRecording
                ? 'border-[#ff4444] bg-[#ff4444]/10'
                : track.buffer || track.noteEvents.length > 0
                ? 'border-[#2a2a2a] bg-[#141414]'
                : 'border-[#2a2a2a] border-dashed bg-[#0a0a0a]'
            }`}
          >
            {/* Track header */}
            <div className="flex items-center gap-3 p-2">
              {/* Track color indicator */}
              <div
                className="w-2 h-8 rounded-full shrink-0"
                style={{ backgroundColor: track.color }}
              />

              {/* Track name & status */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-[#ededed] truncate">{track.name}</span>
                {track.isRecording && (
                  <span className="text-[10px] text-[#ff4444] animate-pulse">● REC</span>
                )}
                {!track.buffer && !track.isRecording && track.noteEvents.length === 0 && (
                  <span className="text-[10px] text-[#555]">Empty</span>
                )}
                {track.noteEvents.length > 0 && (
                  <span className="text-[10px] text-[#666]">{track.noteEvents.length} notes</span>
                )}
              </div>

              {/* Track controls */}
              <div className="flex items-center gap-1 ml-auto shrink-0">
                {/* Mute */}
                <button
                  onClick={() => onSetTrackMuted(track.id, !track.isMuted)}
                  className={`w-7 h-7 rounded text-xs transition-colors ${
                    track.isMuted
                      ? 'bg-[#ff6b35] text-black'
                      : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a]'
                  }`}
                  title={track.isMuted ? 'Unmute' : 'Mute'}
                >
                  M
                </button>

                {/* Solo */}
                <button
                  onClick={() => onSetTrackSolo(track.id, !track.isSolo)}
                  className={`w-7 h-7 rounded text-xs transition-colors ${
                    track.isSolo
                      ? 'bg-[#ffff00] text-black'
                      : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a]'
                  }`}
                  title={track.isSolo ? 'Unsolo' : 'Solo'}
                >
                  S
                </button>

                {/* Record to this track */}
                {!track.buffer && !isRecording && (
                  <button
                    onClick={() => onStartRecording(track.id)}
                    className="w-7 h-7 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#ff4444] text-xs transition-colors"
                    title="Record to this track"
                  >
                    ●
                  </button>
                )}

                {/* Clear track */}
                {(track.buffer || track.noteEvents.length > 0) && (
                  <button
                    onClick={() => onClearTrack(track.id)}
                    className="w-7 h-7 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#ff6b35] text-xs transition-colors"
                    title="Clear track"
                  >
                    ✕
                  </button>
                )}

                {/* Remove track */}
                {tracks.length > 1 && (
                  <button
                    onClick={() => onRemoveTrack(track.id)}
                    className="w-7 h-7 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#ff4444] text-xs transition-colors"
                    title="Remove track"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>

            {/* Note events timeline */}
            <div className="relative h-8 bg-[#0a0a0a] mx-2 mb-2 rounded overflow-hidden">
              {/* Grid lines */}
              {Array.from({ length: totalBeats }).map((_, i) => (
                <div
                  key={i}
                  className={`absolute top-0 bottom-0 w-px ${
                    i % beatsPerBar === 0 ? 'bg-[#333]' : 'bg-[#1a1a1a]'
                  }`}
                  style={{ left: `${(i / totalBeats) * 100}%` }}
                />
              ))}

              {/* Note events */}
              {track.noteEvents.map((event, i) => (
                <div
                  key={i}
                  className="absolute top-1 bottom-1 rounded-sm"
                  style={{
                    left: `${event.startTime * 100}%`,
                    width: `${Math.max(event.duration * 100, 1)}%`,
                    backgroundColor: track.color,
                    opacity: 0.8,
                  }}
                  title={`${event.note}`}
                />
              ))}

              {/* Playhead */}
              {isPlaying && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                  style={{ left: `${currentPosition * 100}%` }}
                />
              )}

              {/* Recording indicator */}
              {track.isRecording && (
                <div className="absolute inset-0 bg-[#ff4444]/20 animate-pulse" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
