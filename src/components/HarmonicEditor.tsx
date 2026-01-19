'use client';

import { useRef } from 'react';

interface HarmonicEditorProps {
  harmonics: number[];
  onHarmonicsChange: (harmonics: number[]) => void;
}

export function HarmonicEditor({ harmonics, onHarmonicsChange }: HarmonicEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSliderChange = (index: number, value: number) => {
    const newHarmonics = [...harmonics];
    newHarmonics[index] = value;
    onHarmonicsChange(newHarmonics);
  };

  const handleBarClick = (e: React.MouseEvent, index: number) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const value = 1 - (y / rect.height);
    handleSliderChange(index, Math.max(0, Math.min(1, value)));
  };

  const handleBarDrag = (e: React.PointerEvent, index: number) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    
    const updateValue = (clientY: number) => {
      const y = clientY - rect.top;
      const value = 1 - (y / rect.height);
      handleSliderChange(index, Math.max(0, Math.min(1, value)));
    };

    updateValue(e.clientY);
    
    const handleMove = (moveEvent: PointerEvent) => {
      updateValue(moveEvent.clientY);
    };

    const handleUp = () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  };

  const harmonicLabels = [
    '1 (fund)',
    '2 (oct)',
    '3 (5th)',
    '4 (2oct)',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
  ];

  const harmonicDescriptions: Record<number, string> = {
    1: 'Fundamental — the base pitch',
    2: 'Octave — same note, higher',
    3: 'Fifth above octave — adds richness',
    4: 'Two octaves up',
    5: 'Major third + 2 octaves',
    6: 'Fifth + 2 octaves',
    7: 'Slightly flat minor 7th',
    8: 'Three octaves up',
  };

  return (
    <div className="bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h3 className="text-sm font-medium text-[#ededed]">Harmonic Editor</h3>
        <span className="text-xs text-[#666] font-mono hidden sm:inline">Build from sine waves</span>
      </div>

      <div className="text-xs text-[#666] mb-2 sm:mb-3 hidden sm:block">
        Drag bars to adjust. Each bar = a sine wave at a multiple of the base frequency.
      </div>

      <div 
        ref={containerRef}
        className="flex gap-0.5 sm:gap-1 h-24 sm:h-32 items-end"
      >
        {harmonics.slice(0, 16).map((value, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div 
              className="w-full h-20 sm:h-28 bg-[#141414] rounded-t relative cursor-ns-resize group touch-none"
              onPointerDown={(e) => handleBarDrag(e, index)}
            >
              {/* Background bar */}
              <div className="absolute inset-0 rounded-t" />
              
              {/* Value bar */}
              <div 
                className="absolute bottom-0 left-0 right-0 rounded-t transition-all duration-75"
                style={{ 
                  height: `${value * 100}%`,
                  background: index === 0 
                    ? 'linear-gradient(to top, #00ffff, #00cccc)'
                    : `linear-gradient(to top, rgba(0, 255, 255, ${0.8 - index * 0.04}), rgba(0, 200, 200, ${0.6 - index * 0.03}))`,
                }}
              />

              {/* Hover value display - hidden on mobile */}
              <div className="absolute inset-0 hidden sm:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-mono text-white bg-black/70 px-1 rounded">
                  {Math.round(value * 100)}%
                </span>
              </div>
            </div>
            
            {/* Label - smaller on mobile */}
            <div className="text-[8px] sm:text-[9px] text-[#666] mt-0.5 sm:mt-1 text-center truncate w-full">
              {index + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Legend - hidden on mobile */}
      <div className="mt-2 sm:mt-3 grid-cols-4 gap-2 text-[10px] text-[#666] hidden sm:grid">
        <div>1: fundamental</div>
        <div>2: octave</div>
        <div>3: +fifth</div>
        <div>4: 2 oct</div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1 mt-2 sm:mt-3">
        <span className="text-xs text-[#666] mr-1 sm:mr-2 self-center">Quick:</span>
        <button
          onClick={() => {
            const h = new Array(16).fill(0);
            h[0] = 1;
            onHarmonicsChange(h);
          }}
          className="px-2 py-1 text-[10px] rounded bg-[#141414] text-[#888] hover:bg-[#1a1a1a] hover:text-[#00ffff] active:bg-[#1a1a1a] transition-colors border border-[#2a2a2a] compact"
        >
          Pure
        </button>
        <button
          onClick={() => {
            const h = new Array(16).fill(0);
            for (let i = 0; i < 8; i += 2) {
              h[i] = 1 / (i + 1);
            }
            onHarmonicsChange(h);
          }}
          className="px-2 py-1 text-[10px] rounded bg-[#141414] text-[#888] hover:bg-[#1a1a1a] hover:text-[#00ffff] active:bg-[#1a1a1a] transition-colors border border-[#2a2a2a] compact"
        >
          Odd
        </button>
        <button
          onClick={() => {
            const h = new Array(16).fill(0);
            for (let i = 0; i < 8; i++) {
              h[i] = 1 / (i + 1);
            }
            onHarmonicsChange(h);
          }}
          className="px-2 py-1 text-[10px] rounded bg-[#141414] text-[#888] hover:bg-[#1a1a1a] hover:text-[#00ffff] active:bg-[#1a1a1a] transition-colors border border-[#2a2a2a] compact"
        >
          Saw
        </button>
        <button
          onClick={() => {
            const h = new Array(16).fill(0);
            h[0] = 1;
            h[2] = 0.5;
            h[4] = 0.3;
            h[6] = 0.15;
            onHarmonicsChange(h);
          }}
          className="px-2 py-1 text-[10px] rounded bg-[#141414] text-[#888] hover:bg-[#1a1a1a] hover:text-[#00ffff] active:bg-[#1a1a1a] transition-colors border border-[#2a2a2a] compact"
        >
          Hollow
        </button>
        <button
          onClick={() => {
            const h = new Array(16).fill(0).map(() => Math.random());
            onHarmonicsChange(h);
          }}
          className="px-2 py-1 text-[10px] rounded bg-[#141414] text-[#888] hover:bg-[#1a1a1a] hover:text-[#00ffff] active:bg-[#1a1a1a] transition-colors border border-[#2a2a2a] compact"
        >
          Random
        </button>
      </div>
    </div>
  );
}
