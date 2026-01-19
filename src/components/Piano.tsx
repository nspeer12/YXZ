'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { NOTE_NAMES, NoteName, SCALES, getNotesInScale, isNoteInScale, getKeyboardMapping, isBlackKey } from '@/lib/music-theory';

interface PianoProps {
  onNoteOn: (note: string) => void;
  onNoteOff: () => void;
  scaleLock: boolean;
  rootNote: NoteName;
  scaleName: string;
  octave: number;
  showKeyboardOverlay?: boolean;
  compact?: boolean;
  externalActiveNotes?: Set<string>;
}

interface KeyProps {
  note: NoteName;
  octave: number;
  isBlack: boolean;
  isInScale: boolean;
  isActive: boolean;
  isLocked: boolean;
  keyboardKey?: string;
  showKeyboardOverlay: boolean;
  onNoteOn: (note: string) => void;
  onNoteOff: () => void;
}

function PianoKey({ note, octave, isBlack, isInScale, isActive, isLocked, keyboardKey, showKeyboardOverlay, onNoteOn, onNoteOff }: KeyProps) {
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isLocked) return;
    e.preventDefault();
    onNoteOn(`${note}${octave}`);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerUp = () => {
    onNoteOff();
  };

  // Responsive sizing: smaller on mobile
  const baseClasses = isBlack
    ? 'w-5 h-16 -mx-2.5 sm:w-8 sm:h-24 sm:-mx-4 z-10 rounded-b-md'
    : 'w-8 h-24 sm:w-12 sm:h-36 rounded-b-lg';

  const colorClasses = isBlack
    ? isActive
      ? 'bg-[#00ffff]'
      : isLocked
        ? 'bg-[#1a1a1a] cursor-not-allowed'
        : isInScale
          ? 'bg-[#1a1a1a] hover:bg-[#2a2a2a] active:bg-[#2a2a2a]'
          : 'bg-[#0a0a0a] hover:bg-[#1a1a1a] active:bg-[#1a1a1a]'
    : isActive
      ? 'bg-[#00ffff]'
      : isLocked
        ? 'bg-[#2a2a2a] cursor-not-allowed'
        : isInScale
          ? 'bg-[#ededed] hover:bg-[#d0d0d0] active:bg-[#d0d0d0]'
          : 'bg-[#888] hover:bg-[#999] active:bg-[#999]';

  return (
    <button
      className={`${baseClasses} ${colorClasses} border border-[#333] relative transition-colors select-none touch-none overflow-visible`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      disabled={isLocked}
      style={{ minHeight: 'auto', minWidth: 'auto' }}
    >
      {/* Note name - hidden on mobile for black keys, smaller text */}
      <span className={`absolute bottom-1 sm:bottom-2 left-1/2 -translate-x-1/2 text-[8px] sm:text-[10px] font-mono ${
        isBlack 
          ? `${isActive ? 'text-black' : 'text-[#666]'} hidden sm:block`
          : isActive ? 'text-black' : isInScale ? 'text-[#333]' : 'text-[#555]'
      }`}>
        {note}
      </span>
      
      {/* Keyboard shortcut overlay - hidden on mobile */}
      {showKeyboardOverlay && keyboardKey && (
        <div className={`absolute left-1/2 -translate-x-1/2 items-center justify-center pointer-events-none hidden sm:flex ${
          isBlack ? 'top-2' : 'top-6'
        }`}>
          <span className={`
            ${isBlack ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-xs'} rounded flex items-center justify-center font-mono uppercase font-bold
            ${isBlack 
              ? isActive 
                ? 'bg-black/30 text-black' 
                : 'bg-[#00ffff]/20 text-[#00ffff] border border-[#00ffff]/40'
              : isActive 
                ? 'bg-black/20 text-black' 
                : 'bg-[#1a1a1a] text-[#00ffff] border border-[#2a2a2a]'
            }
          `}>
            {keyboardKey}
          </span>
        </div>
      )}

      {/* Scale indicator dot */}
      {isInScale && !isActive && !showKeyboardOverlay && (
        <span className={`absolute ${isBlack ? 'bottom-5 sm:bottom-8' : 'bottom-7 sm:bottom-10'} left-1/2 -translate-x-1/2 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${
          isBlack ? 'bg-[#00ffff]' : 'bg-[#00cccc]'
        }`} />
      )}
    </button>
  );
}

export function Piano({ onNoteOn, onNoteOff, scaleLock, rootNote, scaleName, octave, showKeyboardOverlay = false, compact = false, externalActiveNotes }: PianoProps) {
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const keyboardMapping = getKeyboardMapping();
  const pressedKeysRef = useRef<Set<string>>(new Set());
  
  // Combine internal and external active notes
  const allActiveNotes = new Set([...activeNotes, ...(externalActiveNotes || [])]);

  const handleNoteOn = useCallback((note: string) => {
    setActiveNotes(prev => new Set([...prev, note]));
    onNoteOn(note);
  }, [onNoteOn]);

  const handleNoteOff = useCallback(() => {
    setActiveNotes(new Set());
    onNoteOff();
  }, [onNoteOff]);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      
      const key = e.key.toLowerCase();
      if (pressedKeysRef.current.has(key)) return;
      
      const mapping = keyboardMapping[key];
      if (mapping) {
        const adjustedOctave = mapping.octave + (octave - 4);
        const noteString = `${mapping.note}${adjustedOctave}`;
        
        // Check scale lock
        if (scaleLock && !isNoteInScale(mapping.note, rootNote, scaleName)) {
          return;
        }
        
        pressedKeysRef.current.add(key);
        handleNoteOn(noteString);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (pressedKeysRef.current.has(key)) {
        pressedKeysRef.current.delete(key);
        if (pressedKeysRef.current.size === 0) {
          handleNoteOff();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [keyboardMapping, octave, scaleLock, rootNote, scaleName, handleNoteOn, handleNoteOff]);

  // Determine the range of keys to display based on keyboard mapping
  // The mapping covers C4-E5 (17 notes), so we show that range adjusted by octave
  const mappedNotes = Object.values(keyboardMapping);
  const minMappedOctave = Math.min(...mappedNotes.map(m => m.octave));
  const maxMappedOctave = Math.max(...mappedNotes.map(m => m.octave));
  const maxNoteInHighOctave = mappedNotes
    .filter(m => m.octave === maxMappedOctave)
    .map(m => NOTE_NAMES.indexOf(m.note))
    .reduce((max, idx) => Math.max(max, idx), 0);

  // Build keys only for the mapped range
  const keys: Array<{ note: NoteName; octave: number; keyboardKey?: string }> = [];
  
  for (let o = octave; o <= octave + (maxMappedOctave - minMappedOctave); o++) {
    const isLastOctave = o === octave + (maxMappedOctave - minMappedOctave);
    for (let i = 0; i < NOTE_NAMES.length; i++) {
      // Stop after the last mapped note in the highest octave
      if (isLastOctave && i > maxNoteInHighOctave) break;
      
      const note = NOTE_NAMES[i];
      const keyboardKey = Object.entries(keyboardMapping).find(
        ([, v]) => v.note === note && v.octave + (octave - 4) === o
      )?.[0];
      keys.push({ note, octave: o, keyboardKey });
    }
  }

  // Group into white and black keys
  const whiteKeys = keys.filter(k => !isBlackKey(k.note));
  const blackKeyIndices = [1, 3, 6, 8, 10, 13, 15, 18, 20, 22]; // Positions of black keys relative to white keys

  return (
    <div className={compact ? '' : 'bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] p-4'}>
      {!compact && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#ededed]">Piano</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#666] font-mono">Octave: {octave}</span>
          </div>
        </div>
      )}

      {/* Piano keyboard */}
      <div className="relative flex justify-center">
        {/* White keys */}
        <div className="flex">
          {whiteKeys.map((key, i) => {
            const noteString = `${key.note}${key.octave}`;
            const inScale = isNoteInScale(key.note, rootNote, scaleName);
            const isLocked = scaleLock && !inScale;

            return (
              <PianoKey
                key={noteString}
                note={key.note}
                octave={key.octave}
                isBlack={false}
                isInScale={inScale}
                isActive={allActiveNotes.has(noteString)}
                isLocked={isLocked}
                keyboardKey={key.keyboardKey}
                showKeyboardOverlay={showKeyboardOverlay}
                onNoteOn={handleNoteOn}
                onNoteOff={handleNoteOff}
              />
            );
          })}
        </div>

        {/* Black keys - positioned absolutely */}
        <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none">
          <div className="flex">
            {whiteKeys.map((whiteKey, i) => {
              // Check if there should be a black key after this white key
              const nextNote = NOTE_NAMES[(NOTE_NAMES.indexOf(whiteKey.note) + 1) % 12];
              if (!isBlackKey(nextNote)) {
                return <div key={`spacer-${i}`} className="w-8 sm:w-12" />;
              }

              const blackKey = keys.find(k => k.note === nextNote && k.octave === whiteKey.octave);
              if (!blackKey) {
                return <div key={`spacer-${i}`} className="w-8 sm:w-12" />;
              }

              const noteString = `${blackKey.note}${blackKey.octave}`;
              const inScale = isNoteInScale(blackKey.note, rootNote, scaleName);
              const isLocked = scaleLock && !inScale;

              return (
                <div key={noteString} className="w-8 sm:w-12 flex justify-center pointer-events-auto">
                  <PianoKey
                    note={blackKey.note}
                    octave={blackKey.octave}
                    isBlack={true}
                    isInScale={inScale}
                    isActive={allActiveNotes.has(noteString)}
                    isLocked={isLocked}
                    keyboardKey={blackKey.keyboardKey}
                    showKeyboardOverlay={showKeyboardOverlay}
                    onNoteOn={handleNoteOn}
                    onNoteOff={handleNoteOff}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Keyboard hints - only show if overlay is off */}
      {!showKeyboardOverlay && !compact && (
        <div className="mt-4 text-center text-xs text-[#666]">
          <span>Use keyboard: </span>
          <span className="font-mono">A S D F G H J K L</span>
          <span> (white) </span>
          <span className="font-mono">W E T Y U O P</span>
          <span> (black)</span>
        </div>
      )}
    </div>
  );
}
