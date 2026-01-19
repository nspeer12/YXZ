'use client';

import { NOTE_NAMES, NoteName, SCALES, getNotesInScale } from '@/lib/music-theory';

interface ScaleSelectorProps {
  rootNote: NoteName;
  scaleName: string;
  scaleLock: boolean;
  onRootChange: (root: NoteName) => void;
  onScaleChange: (scale: string) => void;
  onScaleLockChange: (locked: boolean) => void;
}

export function ScaleSelector({ 
  rootNote, 
  scaleName, 
  scaleLock, 
  onRootChange, 
  onScaleChange,
  onScaleLockChange 
}: ScaleSelectorProps) {
  const scale = SCALES[scaleName];
  const notesInScale = getNotesInScale(rootNote, scaleName);

  return (
    <div>
      <div className="flex items-center justify-end mb-2 sm:mb-3">
        <button
          onClick={() => onScaleLockChange(!scaleLock)}
          className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-1 text-xs rounded-full transition-colors compact ${
            scaleLock 
              ? 'bg-[#00ffff] text-black' 
              : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] active:bg-[#2a2a2a]'
          }`}
        >
          {scaleLock ? '🔒' : '🔓'} Scale Lock {scaleLock ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Root Note */}
        <div>
          <label className="text-xs text-[#666] block mb-2">Root Note</label>
          <div className="grid grid-cols-6 gap-1">
            {NOTE_NAMES.map(note => (
              <button
                key={note}
                onClick={() => onRootChange(note)}
                className={`px-1.5 sm:px-2 py-2 sm:py-1.5 text-xs rounded transition-colors compact ${
                  rootNote === note
                    ? 'bg-[#00ffff] text-black font-medium'
                    : 'bg-[#141414] text-[#888] hover:bg-[#1a1a1a] hover:text-white active:bg-[#1a1a1a]'
                } ${note.includes('#') ? 'text-[10px]' : ''}`}
              >
                {note}
              </button>
            ))}
          </div>
        </div>

        {/* Scale Type */}
        <div>
          <label className="text-xs text-[#666] block mb-2">Scale</label>
          <select
            value={scaleName}
            onChange={(e) => onScaleChange(e.target.value)}
            className="w-full bg-[#141414] border border-[#2a2a2a] rounded px-3 py-2 sm:py-1.5 text-sm text-[#ededed] focus:outline-none focus:border-[#00ffff]"
          >
            {Object.entries(SCALES).map(([key, s]) => (
              <option key={key} value={key}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Scale info */}
      {scale && (
        <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-[#141414] rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#ededed]">
              {rootNote} {scale.name}
            </span>
            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#00ffff]">
              {scale.mood}
            </span>
          </div>
          <p className="text-xs text-[#666] mb-2 sm:mb-3 hidden sm:block">{scale.description}</p>
          
          {/* Notes in scale */}
          <div className="flex gap-1 flex-wrap">
            {notesInScale.map((note, i) => (
              <span 
                key={`${note}-${i}`}
                className={`px-2 py-1 text-xs rounded ${
                  note === rootNote 
                    ? 'bg-[#00ffff] text-black font-medium' 
                    : 'bg-[#1a1a1a] text-[#888]'
                }`}
              >
                {note}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Scale lock hint */}
      {scaleLock && (
        <div className="mt-2 sm:mt-3 text-xs text-[#00ffff] flex items-center gap-2">
          <span>🔒</span>
          <span className="hidden sm:inline">Only notes in {rootNote} {scale?.name} are playable</span>
          <span className="sm:hidden">Locked to {rootNote} {scale?.name}</span>
        </div>
      )}
    </div>
  );
}
