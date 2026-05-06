'use client';

import { useEffect, useRef, useState } from 'react';
import type { StudioTake } from '@/hooks/useAudioEngine';

interface Props {
  isRecording: boolean;
  recordingElapsedMs: number;
  takes: StudioTake[];
  namePrefix: string;
  onNamePrefixChange: (s: string) => void;
  onStart: () => void;
  onStop: () => void;
  onDownloadTake: (take: StudioTake) => void;
  onDeleteTake: (id: string) => void;
  onRenameTake: (id: string, name: string) => void;
  onAddToLooper: (take: StudioTake) => void;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${min}:${sec.toString().padStart(2, '0')}.${tenths}`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Studio recorder. Captures master output (synth + monitored input +
 * effects + looper) into a list of in-memory Takes. Each take can be
 * played, downloaded, renamed, deleted, or loaded into the looper as a
 * new track.
 */
export function StudioRecorderPanel({
  isRecording,
  recordingElapsedMs,
  takes,
  namePrefix,
  onNamePrefixChange,
  onStart,
  onStop,
  onDownloadTake,
  onDeleteTake,
  onRenameTake,
  onAddToLooper,
}: Props) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.addEventListener('ended', () => setPlayingId(null));
    }
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePlay = (take: StudioTake) => {
    if (!audioRef.current) return;
    if (playingId === take.id) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current.pause();
    audioRef.current.src = take.url;
    audioRef.current.currentTime = 0;
    void audioRef.current.play().then(() => setPlayingId(take.id)).catch(() => setPlayingId(null));
  };

  const startEditing = (take: StudioTake) => {
    setEditingId(take.id);
    setEditValue(take.name);
  };

  const commitEditing = () => {
    if (editingId && editValue.trim()) {
      onRenameTake(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-2">
        <button
          onClick={isRecording ? onStop : onStart}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
            isRecording
              ? 'bg-[#ff4444] text-black border-transparent hover:bg-[#ff6666]'
              : 'bg-[#1a1a1a] text-[#ededed] border-[#2a2a2a] hover:border-[#ff4444] hover:text-[#ff4444]'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isRecording ? 'bg-black animate-pulse' : 'bg-[#ff4444]'
            }`}
          />
          {isRecording ? 'Stop' : 'Record'}
        </button>
        <span className="text-xs text-[#888] font-mono tabular-nums w-14">
          {isRecording ? formatElapsed(recordingElapsedMs) : '0:00.0'}
        </span>
      </div>

      <div>
        <label className="block text-[10px] text-[#666] uppercase tracking-wider mb-1 font-mono">
          Name prefix
        </label>
        <input
          type="text"
          value={namePrefix}
          onChange={(e) => onNamePrefixChange(e.target.value)}
          placeholder="Take"
          className="w-full bg-[#1a1a1a] text-xs text-[#ededed] border border-[#2a2a2a] rounded-md px-2 py-2"
        />
      </div>

      <p className="text-[10px] text-[#555] leading-relaxed">
        Captures the master mix: synth + monitored input + effects + looper.
      </p>

      {takes.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-[#1a1a1a]">
          <div className="text-[10px] text-[#666] uppercase tracking-wider font-mono pt-2">
            Takes ({takes.length})
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {takes.map((take) => (
              <div
                key={take.id}
                className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-md p-2 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  {editingId === take.id ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEditing}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEditing();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 bg-[#1a1a1a] text-xs text-[#ededed] border border-[#00ffff]/40 rounded px-1.5 py-1 min-w-0"
                    />
                  ) : (
                    <button
                      onDoubleClick={() => startEditing(take)}
                      title="Double-click to rename"
                      className="flex-1 text-left text-xs text-[#ededed] truncate hover:text-[#00ffff]"
                    >
                      {take.name}
                    </button>
                  )}
                  <span className="text-[10px] text-[#555] font-mono whitespace-nowrap">
                    {formatDuration(take.durationMs)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => togglePlay(take)}
                    className={`flex-1 px-2 py-1 text-[10px] rounded border transition-colors ${
                      playingId === take.id
                        ? 'bg-[#00ffff] text-black border-transparent'
                        : 'bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:text-[#00ffff] hover:border-[#00ffff]/40'
                    }`}
                  >
                    {playingId === take.id ? 'Stop' : 'Play'}
                  </button>
                  <button
                    onClick={() => onAddToLooper(take)}
                    className="flex-1 px-2 py-1 text-[10px] rounded border bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:text-[#ff6b35] hover:border-[#ff6b35]/40 transition-colors"
                    title="Add as a new looper track"
                  >
                    To looper
                  </button>
                  <button
                    onClick={() => onDownloadTake(take)}
                    className="px-2 py-1 text-[10px] rounded border bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:text-[#ededed] hover:border-[#3a3a3a] transition-colors"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => onDeleteTake(take.id)}
                    className="px-2 py-1 text-[10px] rounded border bg-[#1a1a1a] text-[#888] border-[#2a2a2a] hover:text-[#ff4444] hover:border-[#ff4444]/40 transition-colors"
                    title="Delete take"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
