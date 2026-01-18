'use client';

import { useRef, useState, useEffect } from 'react';

interface RecordingControlsProps {
  isRecording: boolean;
  recordingUrl: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onDownload: () => void;
  onClear: () => void;
}

export function RecordingControls({
  isRecording,
  recordingUrl,
  onStartRecording,
  onStopRecording,
  onDownload,
  onClear,
}: RecordingControlsProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayback = () => {
    if (!audioRef.current || !recordingUrl) return;
    
    if (isPlayingBack) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlayingBack(false);
    } else {
      audioRef.current.play();
      setIsPlayingBack(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlayingBack(false);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Record button */}
      <button
        onClick={isRecording ? onStopRecording : onStartRecording}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
          ${isRecording 
            ? 'bg-[#ff4444] text-white animate-pulse' 
            : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#ff4444] border border-[#2a2a2a]'
          }
        `}
      >
        {isRecording ? (
          <>
            <span className="w-3 h-3 rounded-sm bg-white" />
            <span>Stop</span>
            <span className="font-mono text-xs opacity-80">{formatTime(recordingTime)}</span>
          </>
        ) : (
          <>
            <span className="w-3 h-3 rounded-full bg-[#ff4444]" />
            <span>Record</span>
          </>
        )}
      </button>

      {/* Playback controls - only show when there's a recording */}
      {recordingUrl && !isRecording && (
        <>
          <audio 
            ref={audioRef} 
            src={recordingUrl} 
            onEnded={handleAudioEnded}
            className="hidden"
          />
          
          <button
            onClick={handlePlayback}
            className={`
              w-10 h-10 rounded-lg flex items-center justify-center transition-colors border
              ${isPlayingBack 
                ? 'bg-[#00ffff] text-black border-[#00ffff]' 
                : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] border-[#2a2a2a]'
              }
            `}
            title={isPlayingBack ? 'Stop playback' : 'Play recording'}
          >
            {isPlayingBack ? '⏹' : '▶'}
          </button>

          <button
            onClick={onDownload}
            className="w-10 h-10 rounded-lg bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ff88] transition-colors flex items-center justify-center border border-[#2a2a2a]"
            title="Download recording"
          >
            ↓
          </button>

          <button
            onClick={() => {
              if (isPlayingBack && audioRef.current) {
                audioRef.current.pause();
                setIsPlayingBack(false);
              }
              onClear();
            }}
            className="w-10 h-10 rounded-lg bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#ff6b35] transition-colors flex items-center justify-center border border-[#2a2a2a]"
            title="Clear recording"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
