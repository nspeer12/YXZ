'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { WaveformType } from '@/lib/audio-engine';

interface WaveCanvasProps {
  waveform: Float32Array;
  onWaveformChange: (waveform: Float32Array) => void;
  onPresetSelect: (type: WaveformType) => void;
  isPlaying?: boolean;
}

const WAVE_SIZE = 256;

export function WaveCanvas({ waveform, onWaveformChange, onPresetSelect, isPlaying }: WaveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pencil' | 'line' | 'smooth'>('pencil');
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const localWaveformRef = useRef<Float32Array>(new Float32Array(waveform));

  // Update local ref when prop changes
  useEffect(() => {
    localWaveformRef.current = new Float32Array(waveform);
  }, [waveform]);

  const drawWaveform = useCallback((ctx: CanvasRenderingContext2D, wave: Float32Array, width: number, height: number) => {
    const centerY = height / 2;
    const amplitude = height / 2 - 20;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    
    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Vertical grid lines
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines (±0.5)
    ctx.beginPath();
    ctx.moveTo(0, centerY - amplitude / 2);
    ctx.lineTo(width, centerY - amplitude / 2);
    ctx.moveTo(0, centerY + amplitude / 2);
    ctx.lineTo(width, centerY + amplitude / 2);
    ctx.stroke();

    // Draw waveform
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 0; i < wave.length; i++) {
      const x = (i / (wave.length - 1)) * width;
      const y = centerY - wave[i] * amplitude;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Glow effect when playing
    if (isPlaying) {
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw points
    ctx.fillStyle = '#00ffff';
    const pointSpacing = Math.max(1, Math.floor(wave.length / 32));
    for (let i = 0; i < wave.length; i += pointSpacing) {
      const x = (i / (wave.length - 1)) * width;
      const y = centerY - wave[i] * amplitude;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Labels
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.fillText('+1', 5, 15);
    ctx.fillText('0', 5, centerY + 4);
    ctx.fillText('-1', 5, height - 5);
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    drawWaveform(ctx, waveform, rect.width, rect.height);
  }, [waveform, isPlaying, drawWaveform]);

  const getWaveformIndex = (clientX: number, clientY: number): { index: number; value: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { index: 0, value: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const index = Math.floor((x / rect.width) * WAVE_SIZE);
    const value = -((y / rect.height) * 2 - 1);
    
    return {
      index: Math.max(0, Math.min(WAVE_SIZE - 1, index)),
      value: Math.max(-1, Math.min(1, value)),
    };
  };

  const interpolatePoints = (from: { x: number; y: number }, to: { x: number; y: number }, wave: Float32Array) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const fromIndex = Math.floor((from.x / rect.width) * WAVE_SIZE);
    const toIndex = Math.floor((to.x / rect.width) * WAVE_SIZE);
    const fromValue = -((from.y / rect.height) * 2 - 1);
    const toValue = -((to.y / rect.height) * 2 - 1);

    const minIndex = Math.min(fromIndex, toIndex);
    const maxIndex = Math.max(fromIndex, toIndex);

    for (let i = minIndex; i <= maxIndex; i++) {
      const t = maxIndex === minIndex ? 0 : (i - minIndex) / (maxIndex - minIndex);
      const value = fromIndex < toIndex 
        ? fromValue + (toValue - fromValue) * t
        : toValue + (fromValue - toValue) * (1 - t);
      wave[Math.max(0, Math.min(WAVE_SIZE - 1, i))] = Math.max(-1, Math.min(1, value));
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    lastPointRef.current = { x, y };

    if (tool === 'pencil') {
      const { index, value } = getWaveformIndex(e.clientX, e.clientY);
      const newWaveform = new Float32Array(localWaveformRef.current);
      newWaveform[index] = value;
      localWaveformRef.current = newWaveform;
      onWaveformChange(newWaveform);
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'pencil' && lastPointRef.current) {
      const newWaveform = new Float32Array(localWaveformRef.current);
      interpolatePoints(lastPointRef.current, { x, y }, newWaveform);
      localWaveformRef.current = newWaveform;
      onWaveformChange(newWaveform);
    }

    lastPointRef.current = { x, y };
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const smoothWaveform = () => {
    const wave = new Float32Array(localWaveformRef.current);
    const smoothed = new Float32Array(WAVE_SIZE);
    
    for (let i = 0; i < WAVE_SIZE; i++) {
      let sum = 0;
      let count = 0;
      for (let j = -3; j <= 3; j++) {
        const idx = (i + j + WAVE_SIZE) % WAVE_SIZE;
        sum += wave[idx];
        count++;
      }
      smoothed[i] = sum / count;
    }
    
    localWaveformRef.current = smoothed;
    onWaveformChange(smoothed);
  };

  const mirrorWaveform = () => {
    const wave = new Float32Array(localWaveformRef.current);
    const mirrored = new Float32Array(WAVE_SIZE);
    
    for (let i = 0; i < WAVE_SIZE / 2; i++) {
      mirrored[i] = wave[i];
      mirrored[WAVE_SIZE - 1 - i] = -wave[i];
    }
    
    localWaveformRef.current = mirrored;
    onWaveformChange(mirrored);
  };

  const clearWaveform = () => {
    const cleared = new Float32Array(WAVE_SIZE);
    localWaveformRef.current = cleared;
    onWaveformChange(cleared);
  };

  const presets: { name: string; type: WaveformType }[] = [
    { name: 'Sine', type: 'sine' },
    { name: 'Square', type: 'square' },
    { name: 'Saw', type: 'sawtooth' },
    { name: 'Triangle', type: 'triangle' },
  ];

  return (
    <div className="bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h3 className="text-sm font-medium text-[#ededed]">Wave Canvas</h3>
        <span className="text-xs text-[#666] font-mono hidden sm:inline">Draw your sound</span>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-36 sm:h-48 rounded cursor-crosshair touch-none"
        style={{ background: '#0a0a0a' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      <div className="flex flex-wrap gap-1 sm:gap-2 mt-2 sm:mt-3">
        <button
          onClick={() => setTool('pencil')}
          className={`px-2 sm:px-3 py-1.5 text-xs rounded transition-colors compact ${
            tool === 'pencil' 
              ? 'bg-[#00ffff] text-black' 
              : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] active:bg-[#2a2a2a]'
          }`}
        >
          ✏️ <span className="hidden sm:inline">Pencil</span>
        </button>
        <button
          onClick={smoothWaveform}
          className="px-2 sm:px-3 py-1.5 text-xs rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] active:bg-[#2a2a2a] transition-colors compact"
        >
          ∿ <span className="hidden sm:inline">Smooth</span>
        </button>
        <button
          onClick={mirrorWaveform}
          className="px-2 sm:px-3 py-1.5 text-xs rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] active:bg-[#2a2a2a] transition-colors compact"
        >
          ↔ <span className="hidden sm:inline">Mirror</span>
        </button>
        <button
          onClick={clearWaveform}
          className="px-2 sm:px-3 py-1.5 text-xs rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] active:bg-[#2a2a2a] transition-colors compact"
        >
          🗑 <span className="hidden sm:inline">Clear</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-1 mt-2 sm:mt-3">
        <span className="text-xs text-[#666] mr-1 sm:mr-2 self-center">Presets:</span>
        {presets.map(preset => (
          <button
            key={preset.type}
            onClick={() => onPresetSelect(preset.type)}
            className="px-2 sm:px-3 py-1 text-xs rounded bg-[#141414] text-[#888] hover:bg-[#1a1a1a] hover:text-[#00ffff] active:bg-[#1a1a1a] transition-colors border border-[#2a2a2a] compact"
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  );
}
