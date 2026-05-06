'use client';

// DAW-style multi-track timeline. Each track is a row with:
//   - Header (left): name, kind badge, arm/mute/solo, volume, delete
//   - Lane (right): clip rendered against a beat grid
//
// Audio clips render their waveform peaks (computed in looper.ts when the
// recording finishes loading). MIDI clips render their note events as small
// horizontal bars positioned by `(startTime, duration)` along the loop.
//
// At the top: a unified transport — play/stop, master record, BPM, bars,
// time signature, loop toggle, metronome toggle, position display, and a
// "+ Audio" / "+ MIDI" pair to add new tracks.

import { useMemo, useRef } from 'react';
import type { LoopTrack, NoteEvent } from '@/lib/looper';
import { getMidiNote } from '@/lib/music-theory';

interface TimelineProps {
  // Transport state
  isPlaying: boolean;
  isRecording: boolean;
  bpm: number;
  bars: number;
  beatsPerBar: number;
  currentBeat: number;
  currentPosition: number; // 0..1
  loopEnabled: boolean;
  metronomeEnabled: boolean;
  tracks: LoopTrack[];

  // Transport actions
  onPlay: () => void;
  onStop: () => void;
  onSeekTo: (position: number) => void;
  onStartRecording: (trackId?: string) => void;
  onStopRecording: () => void;

  // Config
  onSetBpm: (bpm: number) => void;
  onSetBars: (bars: number) => void;
  onSetBeatsPerBar: (b: number) => void;
  onSetMetronomeEnabled: (b: boolean) => void;
  onSetLoopEnabled: (b: boolean) => void;

  // Tracks
  onAddAudioTrack: () => void;
  onAddMidiTrack: () => void;
  onRemoveTrack: (id: string) => void;
  onClearTrack: (id: string) => void;
  onClearAllTracks: () => void;
  onSetTrackMuted: (id: string, m: boolean) => void;
  onSetTrackSolo: (id: string, s: boolean) => void;
  onSetTrackVolume: (id: string, v: number) => void;
  onArmTrack: (id: string | null) => void;
}

const HEADER_W = 220;
const LANE_HEIGHT = 56;

export function Timeline(props: TimelineProps) {
  const {
    isPlaying,
    isRecording,
    bpm,
    bars,
    beatsPerBar,
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
    onAddAudioTrack,
    onAddMidiTrack,
    onRemoveTrack,
    onClearTrack,
    onClearAllTracks,
    onSetTrackMuted,
    onSetTrackSolo,
    onSetTrackVolume,
    onArmTrack,
  } = props;

  const armedTrack = tracks.find((t) => t.isArmed) ?? null;
  const totalBeats = bars * beatsPerBar;

  const handleMasterRecord = () => {
    if (isRecording) {
      onStopRecording();
      return;
    }
    if (armedTrack && armedTrack.kind === 'audio') {
      onStartRecording(armedTrack.id);
      return;
    }
    if (armedTrack && armedTrack.kind === 'midi') {
      // MIDI tracks record via the player's noteOn — we just need transport rolling.
      // Nothing to do with the audio recorder.
      if (!isPlaying) onPlay();
      return;
    }
    // No armed track — record into a new audio track (legacy behavior).
    onStartRecording();
  };

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] overflow-hidden">
      <TransportBar
        isPlaying={isPlaying}
        isRecording={isRecording}
        armedTrack={armedTrack}
        bpm={bpm}
        bars={bars}
        beatsPerBar={beatsPerBar}
        currentPosition={currentPosition}
        loopEnabled={loopEnabled}
        metronomeEnabled={metronomeEnabled}
        onPlay={onPlay}
        onStop={onStop}
        onMasterRecord={handleMasterRecord}
        onSetBpm={onSetBpm}
        onSetBars={onSetBars}
        onSetBeatsPerBar={onSetBeatsPerBar}
        onSetMetronomeEnabled={onSetMetronomeEnabled}
        onSetLoopEnabled={onSetLoopEnabled}
        onClearAll={onClearAllTracks}
      />

      {/* Beat ruler */}
      <BeatRuler
        bars={bars}
        beatsPerBar={beatsPerBar}
        currentPosition={currentPosition}
        onSeekTo={onSeekTo}
      />

      {/* Track rows */}
      <div className="relative">
        {tracks.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[#555] font-mono">
            No tracks yet — add one below.
          </div>
        ) : (
          tracks.map((t) => (
            <TrackRow
              key={t.id}
              track={t}
              totalBeats={totalBeats}
              currentPosition={currentPosition}
              onSeekTo={onSeekTo}
              onSetMuted={(m) => onSetTrackMuted(t.id, m)}
              onSetSolo={(s) => onSetTrackSolo(t.id, s)}
              onSetVolume={(v) => onSetTrackVolume(t.id, v)}
              onArm={() => onArmTrack(t.isArmed ? null : t.id)}
              onRemove={() => onRemoveTrack(t.id)}
              onClear={() => onClearTrack(t.id)}
            />
          ))
        )}
      </div>

      {/* Add-track footer */}
      <div className="border-t border-[#1f1f1f] px-3 py-2 flex items-center gap-2 bg-[#080808]">
        <button
          onClick={onAddAudioTrack}
          className="text-xs px-2.5 py-1 rounded bg-[#1a1a1a] text-[#ededed] border border-[#2a2a2a] hover:border-[#00ffff] hover:text-[#00ffff]"
        >
          + Audio track
        </button>
        <button
          onClick={onAddMidiTrack}
          className="text-xs px-2.5 py-1 rounded bg-[#1a1a1a] text-[#ededed] border border-[#2a2a2a] hover:border-[#a855f7] hover:text-[#a855f7]"
        >
          + MIDI track
        </button>
        <span className="ml-auto text-[10px] text-[#555] font-mono">
          {tracks.length} track{tracks.length === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface TransportBarProps {
  isPlaying: boolean;
  isRecording: boolean;
  armedTrack: LoopTrack | null;
  bpm: number;
  bars: number;
  beatsPerBar: number;
  currentPosition: number;
  loopEnabled: boolean;
  metronomeEnabled: boolean;
  onPlay: () => void;
  onStop: () => void;
  onMasterRecord: () => void;
  onSetBpm: (b: number) => void;
  onSetBars: (b: number) => void;
  onSetBeatsPerBar: (b: number) => void;
  onSetMetronomeEnabled: (b: boolean) => void;
  onSetLoopEnabled: (b: boolean) => void;
  onClearAll: () => void;
}

function TransportBar({
  isPlaying,
  isRecording,
  armedTrack,
  bpm,
  bars,
  beatsPerBar,
  currentPosition,
  loopEnabled,
  metronomeEnabled,
  onPlay,
  onStop,
  onMasterRecord,
  onSetBpm,
  onSetBars,
  onSetBeatsPerBar,
  onSetMetronomeEnabled,
  onSetLoopEnabled,
  onClearAll,
}: TransportBarProps) {
  const positionLabel = useMemo(() => {
    const totalBeats = bars * beatsPerBar;
    const beat = Math.floor(currentPosition * totalBeats);
    const bar = Math.floor(beat / beatsPerBar) + 1;
    const beatInBar = (beat % beatsPerBar) + 1;
    return `${bar}.${beatInBar}`;
  }, [currentPosition, bars, beatsPerBar]);

  return (
    <div className="border-b border-[#1f1f1f] px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 bg-[#0a0a0a]">
      {/* Play / Stop / Record */}
      <div className="flex items-center gap-1">
        <button
          onClick={onPlay}
          disabled={isPlaying}
          className={`w-8 h-8 rounded flex items-center justify-center font-mono ${
            isPlaying
              ? 'bg-[#00ff88] text-black'
              : 'bg-[#1a1a1a] text-[#ededed] border border-[#2a2a2a] hover:border-[#00ff88] hover:text-[#00ff88]'
          }`}
          title="Play"
        >
          ▶
        </button>
        <button
          onClick={onStop}
          className="w-8 h-8 rounded flex items-center justify-center font-mono bg-[#1a1a1a] text-[#ededed] border border-[#2a2a2a] hover:border-[#888]"
          title="Stop"
        >
          ◼
        </button>
        <button
          onClick={onMasterRecord}
          className={`h-8 px-2.5 rounded flex items-center gap-1.5 text-xs font-medium border ${
            isRecording
              ? 'bg-[#ff4444] text-black border-transparent'
              : 'bg-[#1a1a1a] text-[#ff4444] border-[#2a2a2a] hover:border-[#ff4444]'
          }`}
          title={
            armedTrack
              ? `Record into ${armedTrack.name}`
              : 'No track armed — records to a new audio track'
          }
        >
          <span
            className={`w-2 h-2 rounded-full ${isRecording ? 'bg-black animate-pulse' : 'bg-[#ff4444]'}`}
          />
          REC
        </button>
      </div>

      {/* Position display */}
      <div className="px-2 py-1 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-xs font-mono tabular-nums text-[#ededed] min-w-[60px] text-center">
        {positionLabel}
      </div>

      {/* BPM */}
      <label className="flex items-center gap-1 text-xs text-[#888]">
        <span className="font-mono uppercase tracking-wider text-[10px] text-[#666]">BPM</span>
        <input
          type="number"
          value={bpm}
          onChange={(e) => onSetBpm(Number(e.target.value))}
          className="w-14 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1 py-0.5 text-center text-[#ededed] font-mono"
          min={40}
          max={240}
        />
      </label>

      {/* Bars */}
      <label className="flex items-center gap-1 text-xs text-[#888]">
        <span className="font-mono uppercase tracking-wider text-[10px] text-[#666]">Bars</span>
        <input
          type="number"
          value={bars}
          onChange={(e) => onSetBars(Number(e.target.value))}
          className="w-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1 py-0.5 text-center text-[#ededed] font-mono"
          min={1}
          max={16}
        />
      </label>

      {/* Time-sig */}
      <label className="flex items-center gap-1 text-xs text-[#888]">
        <span className="font-mono uppercase tracking-wider text-[10px] text-[#666]">Sig</span>
        <select
          value={beatsPerBar}
          onChange={(e) => onSetBeatsPerBar(Number(e.target.value))}
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1 py-0.5 text-[#ededed] font-mono text-xs"
        >
          <option value={4}>4/4</option>
          <option value={8}>8/8</option>
          <option value={12}>12/8</option>
          <option value={16}>16/16</option>
        </select>
      </label>

      {/* Loop / metronome toggles */}
      <button
        onClick={() => onSetLoopEnabled(!loopEnabled)}
        className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider border ${
          loopEnabled
            ? 'bg-[#a855f7]/15 text-[#c98aff] border-[#a855f7]/40'
            : 'bg-[#1a1a1a] text-[#666] border-[#2a2a2a]'
        }`}
        title="Loop transport"
      >
        Loop
      </button>
      <button
        onClick={() => onSetMetronomeEnabled(!metronomeEnabled)}
        className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider border ${
          metronomeEnabled
            ? 'bg-[#00ffff]/15 text-[#00ffff] border-[#00ffff]/40'
            : 'bg-[#1a1a1a] text-[#666] border-[#2a2a2a]'
        }`}
        title="Metronome click"
      >
        Click
      </button>

      <button
        onClick={onClearAll}
        className="ml-auto px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider text-[#666] border border-[#1f1f1f] hover:text-[#ff6b6b] hover:border-[#5a1a1a]"
        title="Clear all clips (keeps tracks)"
      >
        Clear
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function BeatRuler({
  bars,
  beatsPerBar,
  currentPosition,
  onSeekTo,
}: {
  bars: number;
  beatsPerBar: number;
  currentPosition: number;
  onSeekTo: (p: number) => void;
}) {
  const totalBeats = bars * beatsPerBar;
  const ruler = useRef<HTMLDivElement>(null);

  return (
    <div className="flex border-b border-[#1f1f1f] bg-[#080808]">
      <div
        className="shrink-0 px-2 flex items-center text-[10px] font-mono uppercase tracking-widest text-[#555]"
        style={{ width: HEADER_W }}
      >
        {bars} bar · {beatsPerBar}/{beatsPerBar}
      </div>
      <div
        ref={ruler}
        className="relative flex-1 h-7 cursor-pointer select-none"
        onClick={(e) => {
          const rect = ruler.current?.getBoundingClientRect();
          if (!rect) return;
          const x = e.clientX - rect.left;
          const pos = Math.max(0, Math.min(1, x / rect.width));
          onSeekTo(pos);
        }}
      >
        {/* Bar lines + numbers */}
        {Array.from({ length: bars + 1 }).map((_, b) => {
          const left = (b / bars) * 100;
          return (
            <div key={`bar-${b}`} className="absolute inset-y-0" style={{ left: `${left}%` }}>
              <div className="absolute inset-y-0 w-px bg-[#2a2a2a]" />
              {b < bars && (
                <span className="absolute top-0.5 left-1 text-[10px] text-[#666] font-mono">
                  {b + 1}
                </span>
              )}
            </div>
          );
        })}
        {/* Beat sub-ticks */}
        {Array.from({ length: totalBeats }).map((_, beat) => {
          if (beat % beatsPerBar === 0) return null; // bar lines handled above
          const left = (beat / totalBeats) * 100;
          return (
            <div
              key={`beat-${beat}`}
              className="absolute bottom-0 w-px h-2 bg-[#1f1f1f]"
              style={{ left: `${left}%` }}
            />
          );
        })}
        {/* Playhead */}
        <div
          className="absolute inset-y-0 w-px pointer-events-none"
          style={{ left: `${currentPosition * 100}%`, background: '#00ffff' }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface TrackRowProps {
  track: LoopTrack;
  totalBeats: number;
  currentPosition: number;
  onSeekTo: (p: number) => void;
  onSetMuted: (m: boolean) => void;
  onSetSolo: (s: boolean) => void;
  onSetVolume: (v: number) => void;
  onArm: () => void;
  onRemove: () => void;
  onClear: () => void;
}

function TrackRow({
  track,
  currentPosition,
  onSeekTo,
  onSetMuted,
  onSetSolo,
  onSetVolume,
  onArm,
  onRemove,
  onClear,
}: TrackRowProps) {
  const isMidi = track.kind === 'midi';
  const accent = track.color;
  const hasContent = isMidi ? track.noteEvents.length > 0 : !!track.buffer;
  const lane = useRef<HTMLDivElement>(null);

  return (
    <div className="flex border-b border-[#161616] hover:bg-[#0f0f0f]" style={{ minHeight: LANE_HEIGHT }}>
      {/* Header */}
      <div
        className="shrink-0 border-r border-[#1f1f1f] flex items-stretch"
        style={{ width: HEADER_W, background: track.isArmed ? 'rgba(255,68,68,0.06)' : '#0a0a0a' }}
      >
        <div className="flex-1 px-2 py-1.5 flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
            <span className="text-xs font-mono text-[#ededed] truncate">{track.name}</span>
            <span
              className="text-[9px] font-mono uppercase tracking-widest px-1 rounded shrink-0"
              style={{
                background: isMidi ? 'rgba(168,85,247,0.18)' : 'rgba(0,255,255,0.18)',
                color: isMidi ? '#c98aff' : '#7be9ff',
              }}
            >
              {isMidi ? 'MIDI' : 'Audio'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Arm */}
            <button
              onClick={onArm}
              className={`w-6 h-6 rounded text-[10px] font-mono font-bold transition-colors ${
                track.isArmed
                  ? 'bg-[#ff4444] text-black'
                  : 'bg-[#1a1a1a] text-[#666] border border-[#2a2a2a] hover:text-[#ff4444] hover:border-[#ff4444]'
              }`}
              title={track.isArmed ? 'Disarm' : 'Arm for record'}
            >
              ●
            </button>
            {/* Mute */}
            <button
              onClick={() => onSetMuted(!track.isMuted)}
              className={`w-6 h-6 rounded text-[10px] font-mono font-bold transition-colors ${
                track.isMuted
                  ? 'bg-[#ffaa00] text-black'
                  : 'bg-[#1a1a1a] text-[#666] border border-[#2a2a2a] hover:text-[#ffaa00] hover:border-[#ffaa00]'
              }`}
              title={track.isMuted ? 'Unmute' : 'Mute'}
            >
              M
            </button>
            {/* Solo */}
            <button
              onClick={() => onSetSolo(!track.isSolo)}
              className={`w-6 h-6 rounded text-[10px] font-mono font-bold transition-colors ${
                track.isSolo
                  ? 'bg-[#00ff88] text-black'
                  : 'bg-[#1a1a1a] text-[#666] border border-[#2a2a2a] hover:text-[#00ff88] hover:border-[#00ff88]'
              }`}
              title={track.isSolo ? 'Un-solo' : 'Solo'}
            >
              S
            </button>
            {/* Volume */}
            <input
              type="range"
              min={-30}
              max={6}
              step={0.5}
              value={track.volume}
              onChange={(e) => onSetVolume(Number(e.target.value))}
              className="flex-1 accent-[#888]"
              style={{ minWidth: 0 }}
              title={`${track.volume.toFixed(1)} dB`}
            />
            {/* Clear / Delete */}
            <button
              onClick={hasContent ? onClear : onRemove}
              className="w-6 h-6 rounded text-[#444] hover:text-[#ff6b6b] text-xs"
              title={hasContent ? 'Clear clip' : 'Delete track'}
            >
              {hasContent ? '⌫' : '✕'}
            </button>
          </div>
        </div>
      </div>

      {/* Lane */}
      <div
        ref={lane}
        className="relative flex-1 cursor-pointer"
        onClick={(e) => {
          const rect = lane.current?.getBoundingClientRect();
          if (!rect) return;
          onSeekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
        }}
        style={{ background: track.isArmed ? 'rgba(255,68,68,0.04)' : '#0a0a0a' }}
      >
        {/* Faint bar grid in the background */}
        <BarGridBackground bars={4} />
        {/* Clip */}
        {hasContent && (
          isMidi ? (
            <MidiClip events={track.noteEvents} color={accent} muted={track.isMuted} />
          ) : (
            <AudioClip peaks={track.peaks} color={accent} muted={track.isMuted} />
          )
        )}
        {!hasContent && track.isArmed && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono uppercase tracking-widest text-[#ff4444] pointer-events-none">
            armed · ready to record
          </div>
        )}
        {/* Playhead */}
        <div
          className="absolute inset-y-0 w-px pointer-events-none"
          style={{ left: `${currentPosition * 100}%`, background: '#00ffff', opacity: 0.6 }}
        />
        {/* Recording indicator */}
        {track.isRecording && (
          <div className="absolute inset-0 border-2 border-[#ff4444] pointer-events-none animate-pulse" />
        )}
      </div>
    </div>
  );
}

function BarGridBackground({ bars }: { bars: number }) {
  return (
    <>
      {Array.from({ length: bars }).map((_, b) => {
        if (b === 0) return null;
        const left = (b / bars) * 100;
        return (
          <div
            key={`bg-${b}`}
            className="absolute inset-y-0 w-px bg-[#1a1a1a]"
            style={{ left: `${left}%` }}
          />
        );
      })}
    </>
  );
}

function AudioClip({
  peaks,
  color,
  muted,
}: {
  peaks: number[] | undefined;
  color: string;
  muted: boolean;
}) {
  if (!peaks || peaks.length === 0) {
    return (
      <div
        className="absolute inset-x-1 inset-y-2 rounded"
        style={{
          background: `linear-gradient(180deg, ${color}33, ${color}11)`,
          border: `1px solid ${color}66`,
          opacity: muted ? 0.4 : 1,
        }}
      />
    );
  }
  return (
    <div
      className="absolute inset-x-1 inset-y-2 rounded overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${color}22, ${color}08)`,
        border: `1px solid ${color}66`,
        opacity: muted ? 0.45 : 1,
      }}
    >
      <div className="absolute inset-0 flex items-center">
        {peaks.map((p, i) => {
          const h = Math.max(2, p * 100);
          return (
            <div
              key={i}
              style={{
                flex: '1 1 auto',
                height: `${h}%`,
                background: color,
                opacity: 0.85,
                margin: '0 0.5px',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function MidiClip({
  events,
  color,
  muted,
}: {
  events: NoteEvent[];
  color: string;
  muted: boolean;
}) {
  // Compute MIDI range so vertical position reflects pitch.
  const { minMidi, maxMidi } = useMemo(() => {
    let lo = 127;
    let hi = 0;
    for (const ev of events) {
      const m = midiOf(ev.note);
      if (m == null) continue;
      if (m < lo) lo = m;
      if (m > hi) hi = m;
    }
    if (hi < lo) {
      lo = 60;
      hi = 72;
    }
    if (hi - lo < 6) {
      const mid = (hi + lo) / 2;
      lo = Math.floor(mid - 3);
      hi = Math.ceil(mid + 3);
    }
    return { minMidi: lo, maxMidi: hi };
  }, [events]);

  return (
    <div
      className="absolute inset-x-1 inset-y-2 rounded overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${color}11, ${color}05)`,
        border: `1px solid ${color}55`,
        opacity: muted ? 0.45 : 1,
      }}
    >
      {events.map((ev, i) => {
        const m = midiOf(ev.note);
        if (m == null) return null;
        const yPct = 100 - ((m - minMidi) / Math.max(1, maxMidi - minMidi)) * 100;
        const xPct = ev.startTime * 100;
        const wPct = Math.max(0.6, ev.duration * 100);
        return (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left: `${xPct}%`,
              top: `calc(${yPct}% - 2px)`,
              width: `${wPct}%`,
              height: 4,
              background: color,
              boxShadow: `0 0 6px ${color}88`,
            }}
            title={`${ev.note} (${(ev.startTime * 100).toFixed(0)}%)`}
          />
        );
      })}
    </div>
  );
}

function midiOf(note: string): number | null {
  // note like "C#4". getMidiNote is exposed by music-theory.
  const m = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!m) return null;
  const name = m[1] as Parameters<typeof getMidiNote>[0];
  const octave = parseInt(m[2], 10);
  try {
    return getMidiNote(name, octave);
  } catch {
    return null;
  }
}
