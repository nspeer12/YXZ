'use client';

import { useRef, useEffect, useCallback } from 'react';

interface FilterEditorProps {
  cutoff: number;
  resonance: number;
  onChange: (cutoff: number, resonance: number) => void;
}

export function FilterEditor({ cutoff, resonance, onChange }: FilterEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawFilter = useCallback(() => {
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

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    
    // Frequency markers
    const freqMarkers = [20, 100, 1000, 5000, 20000];
    freqMarkers.forEach(freq => {
      const x = padding + (Math.log10(freq / 20) / Math.log10(1000)) * (width - padding * 2);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    });

    // Draw filter response curve (low-pass visualization)
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const cutoffX = padding + (Math.log10(cutoff / 20) / Math.log10(1000)) * (width - padding * 2);
    
    for (let x = padding; x < width - padding; x++) {
      const freq = 20 * Math.pow(1000, (x - padding) / (width - padding * 2));
      let gain = 1;
      
      if (freq > cutoff) {
        // Simple low-pass rolloff with resonance peak
        const rolloff = Math.pow(cutoff / freq, 2);
        gain = rolloff;
      }
      
      // Add resonance peak near cutoff
      const distFromCutoff = Math.abs(Math.log10(freq / cutoff));
      if (distFromCutoff < 0.3) {
        gain += resonance * 0.5 * Math.exp(-distFromCutoff * 10);
      }
      
      gain = Math.min(1.5, Math.max(0, gain));
      const y = height - padding - gain * (height - padding * 2);
      
      if (x === padding) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Glow
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill under curve
    ctx.lineTo(width - padding, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.fill();

    // Cutoff line
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cutoffX, padding);
    ctx.lineTo(cutoffX, height - padding);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = '#666';
    ctx.font = '9px monospace';
    ctx.fillText('20Hz', padding - 5, height - 5);
    ctx.fillText('1kHz', width / 2 - 10, height - 5);
    ctx.fillText('20kHz', width - padding - 20, height - 5);

    // Cutoff label
    ctx.fillStyle = '#ff6b35';
    ctx.fillText(`${Math.round(cutoff)}Hz`, cutoffX - 15, padding - 5);
  }, [cutoff, resonance]);

  useEffect(() => {
    drawFilter();
  }, [drawFilter]);

  const handleCutoffChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Exponential scale for cutoff
    const value = parseFloat(e.target.value);
    const freq = 20 * Math.pow(1000, value);
    onChange(freq, resonance);
  };

  const cutoffSliderValue = Math.log10(cutoff / 20) / Math.log10(1000);

  return (
    <div className="bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[#ededed]">Filter</h3>
        <span className="text-xs text-[#666] font-mono">Shape frequencies</span>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-24 rounded"
        style={{ background: '#0a0a0a' }}
      />

      <div className="grid grid-cols-2 gap-4 mt-3">
        <div>
          <label className="text-xs text-[#666] block mb-1">Cutoff</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={cutoffSliderValue}
            onChange={handleCutoffChange}
            className="w-full h-1 accent-[#ff6b35]"
          />
          <div className="text-xs text-[#888] font-mono text-center mt-1">
            {cutoff >= 1000 ? `${(cutoff / 1000).toFixed(1)}kHz` : `${Math.round(cutoff)}Hz`}
          </div>
        </div>
        <div>
          <label className="text-xs text-[#666] block mb-1">Resonance</label>
          <input
            type="range"
            min="0"
            max="20"
            step="0.1"
            value={resonance}
            onChange={(e) => onChange(cutoff, parseFloat(e.target.value))}
            className="w-full h-1 accent-[#00ffff]"
          />
          <div className="text-xs text-[#888] font-mono text-center mt-1">
            {resonance.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="text-xs text-[#666] mt-3">
        💡 Lower cutoff = darker sound. Higher resonance = more pronounced peak at cutoff.
      </div>
    </div>
  );
}
