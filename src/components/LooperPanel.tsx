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
  onSeekTo: (position: number) => void;
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
  onSetTrackVolume: (trackId: string, volume: number) => void;
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
  onSeekTo,
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
  onSetTrackVolume,
}: LooperPanelProps) {
  const [bpmInput, setBpmInput] = useState(bpm.toString());
  const [isDragging, setIsDragging] = useState(false);
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

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const position = Math.max(0, Math.min(1, x / rect.width));
    onSeekTo(position);
  };

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleTimelineClick(e);
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleTimelineClick(e);
    }
  };

  const handleTimelineMouseUp = () => {
    setIsDragging(false);
  };

  const handleTimelineMouseLeave = () => {
    setIsDragging(false);
  };

  return (
    <div>
      {/* Transport & Settings - Responsive grid */}
      <div className="space-y-3 sm:space-y-0 mb-4">
        {/* Row 1: Transport Controls */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Play/Stop */}
            <button
              onClick={isPlaying ? onStop : onPlay}
              className={`w-11 h-11 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-lg transition-colors ${
                isPlaying
                  ? 'bg-[#00ffff] text-black'
                  : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] active:bg-[#2a2a2a] border border-[#2a2a2a]'
              }`}
              title={isPlaying ? 'Stop' : 'Play'}
            >
              {isPlaying ? '⏹' : '▶'}
            </button>

            {/* Record */}
            <button
              onClick={isRecording ? onStopRecording : () => onStartRecording()}
              className={`w-11 h-11 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-all ${
                isRecording
                  ? 'bg-[#ff4444] text-white animate-pulse'
                  : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#ff4444] active:bg-[#2a2a2a] border border-[#2a2a2a]'
              }`}
              title={isRecording ? 'Stop Recording' : 'Record'}
            >
              <span className={`w-3 h-3 rounded-full ${isRecording ? 'bg-white' : 'bg-[#ff4444]'}`} />
            </button>

            {/* Loop Toggle */}
            <button
              onClick={() => onSetLoopEnabled(!loopEnabled)}
              className={`w-11 h-11 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-sm transition-colors ${
                loopEnabled
                  ? 'bg-[#00ff88] text-black'
                  : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] active:bg-[#2a2a2a] border border-[#2a2a2a]'
              }`}
              title={loopEnabled ? 'Loop On' : 'Loop Off'}
            >
              🔁
            </button>

            {/* Metronome Toggle */}
            <button
              onClick={() => onSetMetronomeEnabled(!metronomeEnabled)}
              className={`w-11 h-11 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-sm transition-colors ${
                metronomeEnabled
                  ? 'bg-[#ff6b35] text-black'
                  : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] active:bg-[#2a2a2a] border border-[#2a2a2a]'
              }`}
              title={metronomeEnabled ? 'Metronome On' : 'Metronome Off'}
            >
              🥁
            </button>
          </div>

          {/* BPM Control */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onSetBpm(Math.max(40, bpm - 5))}
              className="w-8 h-8 sm:w-7 sm:h-7 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] active:bg-[#2a2a2a] text-xs border border-[#2a2a2a] compact"
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
              <span className="text-xs text-[#666] hidden sm:inline">BPM</span>
            </div>
            <button
              onClick={() => onSetBpm(Math.min(240, bpm + 5))}
              className="w-8 h-8 sm:w-7 sm:h-7 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] active:bg-[#2a2a2a] text-xs border border-[#2a2a2a] compact"
            >
              +
            </button>
          </div>

          {/* Clear All - visible on mobile in first row */}
          <button
            onClick={onClearAllTracks}
            className="px-3 py-2 sm:py-1.5 text-xs rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#ff6b35] active:bg-[#2a2a2a] transition-colors border border-[#2a2a2a] sm:hidden compact"
            title="Clear all tracks"
          >
            Clear
          </button>
        </div>

        {/* Row 2: Bars & Beats (hidden on mobile, shown inline on desktop) */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap sm:hidden">
          {/* Bars Control */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSetBars(Math.max(1, bars - 1))}
              className="w-8 h-8 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] active:bg-[#2a2a2a] text-xs border border-[#2a2a2a] compact"
            >
              -
            </button>
            <span className="text-sm font-mono text-[#ededed] w-14 text-center">{bars} bars</span>
            <button
              onClick={() => onSetBars(Math.min(16, bars + 1))}
              className="w-8 h-8 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] active:bg-[#2a2a2a] text-xs border border-[#2a2a2a] compact"
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
                className={`w-8 h-8 text-xs rounded transition-colors compact ${
                  beatsPerBar === b
                    ? 'bg-[#00ffff] text-black'
                    : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] active:bg-[#2a2a2a] border border-[#2a2a2a]'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: Bars, Beats, Clear inline */}
        <div className="hidden sm:flex items-center justify-between gap-4 mt-3">
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
      </div>

      {/* Timeline / Progress Bar - Clickable */}
      <div className="mb-4">
        <div 
          className="relative h-6 bg-[#1a1a1a] rounded cursor-pointer select-none"
          onMouseDown={handleTimelineMouseDown}
          onMouseMove={handleTimelineMouseMove}
          onMouseUp={handleTimelineMouseUp}
          onMouseLeave={handleTimelineMouseLeave}
        >
          {/* Beat grid lines */}
          {Array.from({ length: totalBeats }).map((_, i) => (
            <div
              key={i}
              className={`absolute top-0 bottom-0 w-px ${
                i % beatsPerBar === 0 ? 'bg-[#444]' : 'bg-[#2a2a2a]'
              }`}
              style={{ left: `${(i / totalBeats) * 100}%` }}
            />
          ))}
          
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white z-20 shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            style={{ left: `${currentPosition * 100}%` }}
          />
          
          {/* Playhead handle (larger click target) */}
          <div
            className="absolute top-0 w-3 h-3 -translate-x-1/2 bg-white rounded-full z-20"
            style={{ left: `${currentPosition * 100}%` }}
          />
        </div>
        
        {/* Bar numbers */}
        <div className="flex mt-1">
          {Array.from({ length: bars }).map((_, i) => (
            <div 
              key={i} 
              className="flex-1 text-[10px] text-[#555] font-mono"
            >
              {i + 1}
            </div>
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2">
              {/* Top row on mobile: color, name, M/S buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Track color indicator */}
                <div
                  className="w-2 h-6 sm:h-8 rounded-full shrink-0"
                  style={{ backgroundColor: track.color }}
                />

                {/* Track name & status */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm text-[#ededed] truncate">{track.name}</span>
                  {track.isRecording && (
                    <span className="text-[10px] text-[#ff4444] animate-pulse">● REC</span>
                  )}
                  {!track.buffer && !track.isRecording && track.noteEvents.length === 0 && (
                    <span className="text-[10px] text-[#555]">Empty</span>
                  )}
                  {track.noteEvents.length > 0 && (
                    <span className="text-[10px] text-[#666] hidden sm:inline">{track.noteEvents.length} notes</span>
                  )}
                </div>

                {/* Mobile: Mute/Solo inline */}
                <div className="flex items-center gap-1 sm:hidden">
                  <button
                    onClick={() => onSetTrackMuted(track.id, !track.isMuted)}
                    className={`w-8 h-8 rounded text-xs transition-colors compact ${
                      track.isMuted
                        ? 'bg-[#ff6b35] text-black'
                        : 'bg-[#1a1a1a] text-[#888] active:bg-[#2a2a2a]'
                    }`}
                  >
                    M
                  </button>
                  <button
                    onClick={() => onSetTrackSolo(track.id, !track.isSolo)}
                    className={`w-8 h-8 rounded text-xs transition-colors compact ${
                      track.isSolo
                        ? 'bg-[#ffff00] text-black'
                        : 'bg-[#1a1a1a] text-[#888] active:bg-[#2a2a2a]'
                    }`}
                  >
                    S
                  </button>
                  {!track.buffer && !isRecording && (
                    <button
                      onClick={() => onStartRecording(track.id)}
                      className="w-8 h-8 rounded bg-[#1a1a1a] text-[#888] active:bg-[#2a2a2a] text-xs transition-colors compact"
                    >
                      ●
                    </button>
                  )}
                  {(track.buffer || track.noteEvents.length > 0) && (
                    <button
                      onClick={() => onClearTrack(track.id)}
                      className="w-8 h-8 rounded bg-[#1a1a1a] text-[#888] active:bg-[#2a2a2a] text-xs transition-colors compact"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Desktop: Track controls */}
              <div className="hidden sm:flex items-center gap-2 ml-auto shrink-0">
                {/* Volume slider */}
                <div className="flex items-center gap-1 w-24">
                  <span className="text-[9px] text-[#555]">🔊</span>
                  <input
                    type="range"
                    min="-40"
                    max="6"
                    step="1"
                    value={track.volume}
                    onChange={(e) => onSetTrackVolume(track.id, parseFloat(e.target.value))}
                    className="w-full h-1 accent-[#00ffff] cursor-pointer"
                    title={`Volume: ${track.volume > 0 ? '+' : ''}${track.volume}dB`}
                  />
                  <span className="text-[9px] text-[#555] font-mono w-8 text-right">
                    {track.volume > 0 ? '+' : ''}{track.volume}
                  </span>
                </div>

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

            {/* Note events timeline - clickable */}
            <div 
              className="relative h-8 bg-[#0a0a0a] mx-2 mb-2 rounded overflow-hidden cursor-pointer"
              onMouseDown={handleTimelineMouseDown}
              onMouseMove={handleTimelineMouseMove}
              onMouseUp={handleTimelineMouseUp}
              onMouseLeave={handleTimelineMouseLeave}
            >
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
                  className="absolute top-1 bottom-1 rounded-sm pointer-events-none"
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
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white z-10 pointer-events-none"
                style={{ 
                  left: `${currentPosition * 100}%`,
                  boxShadow: '0 0 6px rgba(255,255,255,0.5)'
                }}
              />

              {/* Recording indicator */}
              {track.isRecording && (
                <div className="absolute inset-0 bg-[#ff4444]/20 animate-pulse pointer-events-none" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
