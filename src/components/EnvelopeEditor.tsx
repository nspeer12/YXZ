'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface EnvelopeEditorProps {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  onChange: (attack: number, decay: number, sustain: number, release: number) => void;
}

export function EnvelopeEditor({ attack, decay, sustain, release, onChange }: EnvelopeEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState<'attack' | 'decay' | 'sustain' | 'release' | null>(null);

  const drawEnvelope = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 20;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.stroke();

    // Calculate envelope points
    const totalTime = attack + decay + 0.3 + release; // 0.3 for sustain phase
    const timeScale = graphWidth / Math.max(totalTime, 0.1);
    
    const attackX = padding + attack * timeScale;
    const decayX = attackX + decay * timeScale;
    const sustainX = decayX + 0.3 * timeScale;
    const releaseX = sustainX + release * timeScale;

    const peakY = padding;
    const sustainY = padding + (1 - sustain) * graphHeight;
    const bottomY = height - padding;

    // Draw envelope curve
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, bottomY);
    ctx.lineTo(attackX, peakY);
    ctx.lineTo(decayX, sustainY);
    ctx.lineTo(sustainX, sustainY);
    ctx.lineTo(releaseX, bottomY);
    ctx.stroke();

    // Glow
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw control points
    const points = [
      { x: attackX, y: peakY, label: 'A', id: 'attack' },
      { x: decayX, y: sustainY, label: 'D', id: 'decay' },
      { x: sustainX, y: sustainY, label: 'S', id: 'sustain' },
      { x: releaseX, y: bottomY, label: 'R', id: 'release' },
    ];

    points.forEach(point => {
      ctx.fillStyle = dragging === point.id ? '#ff6b35' : '#00ffff';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.fillText(point.label, point.x - 3, point.y + 20);
    });

    // Labels
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.fillText('Level', 5, 15);
    ctx.fillText('Time', width - 35, height - 5);
  }, [attack, decay, sustain, release, dragging]);

  useEffect(() => {
    drawEnvelope();
  }, [drawEnvelope]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = 20;
    const graphWidth = rect.width - padding * 2;
    const graphHeight = rect.height - padding * 2;

    const totalTime = attack + decay + 0.3 + release;
    const timeScale = graphWidth / Math.max(totalTime, 0.1);
    
    const attackX = padding + attack * timeScale;
    const decayX = attackX + decay * timeScale;
    const sustainX = decayX + 0.3 * timeScale;
    const releaseX = sustainX + release * timeScale;

    const peakY = padding;
    const sustainY = padding + (1 - sustain) * graphHeight;
    const bottomY = rect.height - padding;

    const points = [
      { x: attackX, y: peakY, id: 'attack' as const },
      { x: decayX, y: sustainY, id: 'decay' as const },
      { x: sustainX, y: sustainY, id: 'sustain' as const },
      { x: releaseX, y: bottomY, id: 'release' as const },
    ];

    for (const point of points) {
      const dist = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
      if (dist < 15) {
        setDragging(point.id);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = 20;
    const graphWidth = rect.width - padding * 2;
    const graphHeight = rect.height - padding * 2;

    const relativeX = (x - padding) / graphWidth;
    const relativeY = (y - padding) / graphHeight;

    switch (dragging) {
      case 'attack': {
        const newAttack = Math.max(0.001, Math.min(2, relativeX * 2));
        onChange(newAttack, decay, sustain, release);
        break;
      }
      case 'decay': {
        const newDecay = Math.max(0.001, Math.min(2, (relativeX - attack / 2) * 2));
        const newSustain = Math.max(0, Math.min(1, 1 - relativeY));
        onChange(attack, Math.max(0.001, newDecay), newSustain, release);
        break;
      }
      case 'sustain': {
        const newSustain = Math.max(0, Math.min(1, 1 - relativeY));
        onChange(attack, decay, newSustain, release);
        break;
      }
      case 'release': {
        const startX = (attack + decay + 0.3) / 2;
        const newRelease = Math.max(0.001, Math.min(3, (relativeX - startX) * 2));
        onChange(attack, decay, sustain, newRelease);
        break;
      }
    }
  };

  const handlePointerUp = () => {
    setDragging(null);
  };

  return (
    <div className="bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[#ededed]">Envelope (ADSR)</h3>
        <span className="text-xs text-[#666] font-mono">Shape over time</span>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-32 rounded cursor-pointer touch-none"
        style={{ background: '#0a0a0a' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      <div className="grid grid-cols-4 gap-2 mt-3">
        <div className="text-center">
          <div className="text-[10px] text-[#666] mb-1">Attack</div>
          <input
            type="range"
            min="0.001"
            max="2"
            step="0.01"
            value={attack}
            onChange={(e) => onChange(parseFloat(e.target.value), decay, sustain, release)}
            className="w-full h-1 accent-[#00ffff]"
          />
          <div className="text-[10px] text-[#888] font-mono">{(attack * 1000).toFixed(0)}ms</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-[#666] mb-1">Decay</div>
          <input
            type="range"
            min="0.001"
            max="2"
            step="0.01"
            value={decay}
            onChange={(e) => onChange(attack, parseFloat(e.target.value), sustain, release)}
            className="w-full h-1 accent-[#00ffff]"
          />
          <div className="text-[10px] text-[#888] font-mono">{(decay * 1000).toFixed(0)}ms</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-[#666] mb-1">Sustain</div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={sustain}
            onChange={(e) => onChange(attack, decay, parseFloat(e.target.value), release)}
            className="w-full h-1 accent-[#00ffff]"
          />
          <div className="text-[10px] text-[#888] font-mono">{Math.round(sustain * 100)}%</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-[#666] mb-1">Release</div>
          <input
            type="range"
            min="0.001"
            max="3"
            step="0.01"
            value={release}
            onChange={(e) => onChange(attack, decay, sustain, parseFloat(e.target.value))}
            className="w-full h-1 accent-[#00ffff]"
          />
          <div className="text-[10px] text-[#888] font-mono">{(release * 1000).toFixed(0)}ms</div>
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex gap-1 mt-3">
        <span className="text-xs text-[#666] mr-2">Presets:</span>
        <button
          onClick={() => onChange(0.01, 0.3, 0.4, 0.5)}
          className="px-2 py-1 text-[10px] rounded bg-[#141414] text-[#888] hover:bg-[#1a1a1a] hover:text-[#00ffff] transition-colors border border-[#2a2a2a]"
        >
          Piano
        </button>
        <button
          onClick={() => onChange(0.5, 0.1, 0.8, 1.0)}
          className="px-2 py-1 text-[10px] rounded bg-[#141414] text-[#888] hover:bg-[#1a1a1a] hover:text-[#00ffff] transition-colors border border-[#2a2a2a]"
        >
          Pad
        </button>
        <button
          onClick={() => onChange(0.001, 0.1, 0, 0.1)}
          className="px-2 py-1 text-[10px] rounded bg-[#141414] text-[#888] hover:bg-[#1a1a1a] hover:text-[#00ffff] transition-colors border border-[#2a2a2a]"
        >
          Pluck
        </button>
        <button
          onClick={() => onChange(0.001, 0.05, 1.0, 0.2)}
          className="px-2 py-1 text-[10px] rounded bg-[#141414] text-[#888] hover:bg-[#1a1a1a] hover:text-[#00ffff] transition-colors border border-[#2a2a2a]"
        >
          Organ
        </button>
      </div>
    </div>
  );
}
