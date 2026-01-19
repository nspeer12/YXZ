'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

export type VisualizerMode = 'waveform' | 'spectrum' | 'circular' | 'bars' | 'lissajous';

interface LiveVisualizerProps {
  getAnalyserData: () => Float32Array;
  getFFTData?: () => Float32Array;
  isPlaying: boolean;
  isRecording?: boolean;
  height?: number;
}

const MODE_LABELS: Record<VisualizerMode, string> = {
  waveform: 'Wave',
  spectrum: 'Spectrum',
  circular: 'Circular',
  bars: 'Bars',
  lissajous: 'Lissajous',
};

export function LiveVisualizer({ 
  getAnalyserData, 
  getFFTData,
  isPlaying, 
  isRecording = false, 
  height = 120 
}: LiveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const historyRef = useRef<Float32Array[]>([]);
  const prevDataRef = useRef<Float32Array | null>(null);
  const [mode, setMode] = useState<VisualizerMode>('waveform');

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const canvasHeight = rect.height;
    const padding = 16;
    const drawHeight = canvasHeight - padding * 2;
    const centerY = canvasHeight / 2;

    const data = getAnalyserData();
    const fftData = getFFTData ? getFFTData() : null;

    // Store history for trailing effect
    historyRef.current.push(new Float32Array(data));
    if (historyRef.current.length > 5) {
      historyRef.current.shift();
    }

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, canvasHeight);

    // Check if there's actual audio
    const hasAudio = data.some(v => Math.abs(v) > 0.001);

    // Draw based on mode
    switch (mode) {
      case 'waveform':
        drawWaveform(ctx, data, width, canvasHeight, padding, drawHeight, centerY, hasAudio, isRecording);
        break;
      case 'spectrum':
        drawSpectrum(ctx, fftData || data, width, canvasHeight, padding, hasAudio);
        break;
      case 'circular':
        drawCircular(ctx, data, width, canvasHeight, hasAudio, isRecording);
        break;
      case 'bars':
        drawBars(ctx, data, width, canvasHeight, padding, hasAudio, isRecording);
        break;
      case 'lissajous':
        drawLissajous(ctx, data, prevDataRef.current, width, canvasHeight, hasAudio, isRecording);
        break;
    }

    // Store previous data for lissajous
    prevDataRef.current = new Float32Array(data);

    // Recording indicator
    if (isRecording) {
      const pulse = Math.sin(Date.now() / 200) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255, 68, 68, ${0.3 + pulse * 0.4})`;
      ctx.beginPath();
      ctx.arc(20, 20, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(20, 20, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [getAnalyserData, getFFTData, isRecording, mode]);

  function drawWaveform(
    ctx: CanvasRenderingContext2D, 
    data: Float32Array, 
    width: number, 
    canvasHeight: number, 
    padding: number,
    drawHeight: number,
    centerY: number,
    hasAudio: boolean,
    isRec: boolean
  ) {
    // Draw subtle grid
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    
    // Center line
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Boundary lines
    ctx.strokeStyle = '#141414';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, padding);
    ctx.lineTo(width, padding);
    ctx.moveTo(0, canvasHeight - padding);
    ctx.lineTo(width, canvasHeight - padding);
    ctx.stroke();
    ctx.setLineDash([]);

    if (hasAudio) {
      // Draw history trails
      historyRef.current.forEach((histData, histIndex) => {
        const alpha = (histIndex + 1) / (historyRef.current.length + 1) * 0.25;
        ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();

        const sliceWidth = width / histData.length;
        let x = 0;

        for (let i = 0; i < histData.length; i++) {
          const v = Math.max(-1, Math.min(1, histData[i]));
          const y = centerY - v * (drawHeight / 2);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();
      });

      // Draw current waveform with gradient
      const gradient = ctx.createLinearGradient(0, padding, 0, canvasHeight - padding);
      if (isRec) {
        gradient.addColorStop(0, '#ff6666');
        gradient.addColorStop(0.5, '#ff4444');
        gradient.addColorStop(1, '#ff6666');
      } else {
        gradient.addColorStop(0, '#00ffff');
        gradient.addColorStop(0.5, '#00cccc');
        gradient.addColorStop(1, '#00ffff');
      }

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      const sliceWidth = width / data.length;
      let x = 0;

      for (let i = 0; i < data.length; i++) {
        const v = Math.max(-1, Math.min(1, data[i]));
        const y = centerY - v * (drawHeight / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();

      // Glow effect
      ctx.shadowColor = isRec ? '#ff4444' : '#00ffff';
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      drawIdleAnimation(ctx, width, centerY);
    }
  }

  function drawSpectrum(
    ctx: CanvasRenderingContext2D, 
    data: Float32Array, 
    width: number, 
    canvasHeight: number, 
    padding: number,
    hasAudio: boolean
  ) {
    const barCount = 64;
    const barWidth = (width - padding * 2) / barCount - 2;
    const maxBarHeight = canvasHeight - padding * 2;

    // Draw frequency labels
    ctx.fillStyle = '#333';
    ctx.font = '9px monospace';
    ctx.fillText('20Hz', padding, canvasHeight - 4);
    ctx.fillText('20kHz', width - padding - 30, canvasHeight - 4);

    if (hasAudio) {
      const step = Math.floor(data.length / barCount);
      
      for (let i = 0; i < barCount; i++) {
        // Average a few bins for smoother look
        let sum = 0;
        for (let j = 0; j < step; j++) {
          const idx = i * step + j;
          if (idx < data.length) {
            // FFT values are in dB, convert to 0-1 range
            const db = data[idx];
            const normalized = Math.max(0, (db + 100) / 100);
            sum += normalized;
          }
        }
        const value = sum / step;
        
        const barHeight = Math.max(2, value * maxBarHeight);
        const x = padding + i * (barWidth + 2);
        const y = canvasHeight - padding - barHeight;

        // Gradient color based on frequency
        const hue = 180 - (i / barCount) * 60;
        ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.8)`;
        
        // Draw bar with rounded top
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
        ctx.fill();

        // Glow
        ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    } else {
      // Draw placeholder bars
      for (let i = 0; i < barCount; i++) {
        const x = padding + i * (barWidth + 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x, canvasHeight - padding - 4, barWidth, 4);
      }
    }
  }

  function drawCircular(
    ctx: CanvasRenderingContext2D, 
    data: Float32Array, 
    width: number, 
    canvasHeight: number,
    hasAudio: boolean,
    isRec: boolean
  ) {
    const centerX = width / 2;
    const centerY = canvasHeight / 2;
    const baseRadius = Math.min(width, canvasHeight) / 3;
    const maxRadius = Math.min(width, canvasHeight) / 2 - 10;

    // Draw base circle
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
    ctx.stroke();

    if (hasAudio) {
      ctx.strokeStyle = isRec ? '#ff4444' : '#00ffff';
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i <= data.length; i++) {
        const idx = i % data.length;
        const angle = (i / data.length) * Math.PI * 2 - Math.PI / 2;
        const v = Math.max(-1, Math.min(1, data[idx]));
        const radius = baseRadius + v * (maxRadius - baseRadius) * 0.5;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();

      // Inner glow
      ctx.shadowColor = isRec ? '#ff4444' : '#00ffff';
      ctx.shadowBlur = 20;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Fill with gradient
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
      gradient.addColorStop(0, isRec ? 'rgba(255, 68, 68, 0.1)' : 'rgba(0, 255, 255, 0.1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fill();
    } else {
      // Pulsing idle circle
      const pulse = Math.sin(Date.now() / 500) * 0.1 + 1;
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawBars(
    ctx: CanvasRenderingContext2D, 
    data: Float32Array, 
    width: number, 
    canvasHeight: number, 
    padding: number,
    hasAudio: boolean,
    isRec: boolean
  ) {
    const barCount = 32;
    const barWidth = (width - padding * 2) / barCount - 4;
    const centerY = canvasHeight / 2;
    const maxBarHeight = (canvasHeight - padding * 2) / 2;
    const step = Math.floor(data.length / barCount);

    // Draw center line
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, centerY);
    ctx.lineTo(width - padding, centerY);
    ctx.stroke();

    for (let i = 0; i < barCount; i++) {
      const x = padding + i * (barWidth + 4);
      
      if (hasAudio) {
        // Get average of samples
        let sum = 0;
        for (let j = 0; j < step; j++) {
          const idx = i * step + j;
          if (idx < data.length) {
            sum += Math.abs(data[idx]);
          }
        }
        const value = sum / step;
        const barHeight = Math.max(2, value * maxBarHeight * 2);

        // Color based on intensity
        const intensity = Math.min(1, value * 2);
        const hue = isRec ? 0 : 180;
        ctx.fillStyle = `hsla(${hue}, 100%, ${50 + intensity * 30}%, ${0.7 + intensity * 0.3})`;

        // Draw mirrored bars
        ctx.beginPath();
        ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 2);
        ctx.fill();

        // Glow
        if (intensity > 0.3) {
          ctx.shadowColor = isRec ? '#ff4444' : '#00ffff';
          ctx.shadowBlur = 10 * intensity;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      } else {
        // Idle state
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x, centerY - 2, barWidth, 4);
      }
    }
  }

  function drawLissajous(
    ctx: CanvasRenderingContext2D, 
    data: Float32Array, 
    prevData: Float32Array | null,
    width: number, 
    canvasHeight: number,
    hasAudio: boolean,
    isRec: boolean
  ) {
    const centerX = width / 2;
    const centerY = canvasHeight / 2;
    const scale = Math.min(width, canvasHeight) / 2 - 20;

    // Draw crosshairs
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, 10);
    ctx.lineTo(centerX, canvasHeight - 10);
    ctx.moveTo(10, centerY);
    ctx.lineTo(width - 10, centerY);
    ctx.stroke();

    // Draw circle guide
    ctx.beginPath();
    ctx.arc(centerX, centerY, scale, 0, Math.PI * 2);
    ctx.stroke();

    if (hasAudio && prevData) {
      ctx.strokeStyle = isRec ? '#ff4444' : '#00ffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      // Plot X (current) vs Y (delayed) - creates lissajous patterns
      const delay = 8;
      for (let i = delay; i < data.length; i++) {
        const x = centerX + data[i] * scale;
        const y = centerY + data[i - delay] * scale;

        if (i === delay) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Glow
      ctx.shadowColor = isRec ? '#ff4444' : '#00ffff';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw dot at current position
      const lastIdx = data.length - 1;
      const dotX = centerX + data[lastIdx] * scale;
      const dotY = centerY + data[lastIdx - delay] * scale;
      ctx.fillStyle = isRec ? '#ff6666' : '#66ffff';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Idle - draw small dot in center
      const pulse = Math.sin(Date.now() / 300) * 3;
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(centerX + pulse, centerY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawIdleAnimation(ctx: CanvasRenderingContext2D, width: number, centerY: number) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Animated dots
    const time = Date.now() / 1000;
    const dotCount = 7;
    for (let i = 0; i < dotCount; i++) {
      const dotX = (width / dotCount) * (i + 0.5);
      const dotY = centerY + Math.sin(time * 2 + i * 0.8) * 6;
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    updateCanvasSize();
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [draw]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const modes: VisualizerMode[] = ['waveform', 'spectrum', 'bars', 'circular', 'lissajous'];

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />
      
      {/* Mode selector - scrollable on mobile */}
      <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 flex gap-0.5 sm:gap-1 overflow-x-auto max-w-[calc(100%-60px)]">
        {modes.map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-mono rounded transition-all whitespace-nowrap ${
              mode === m 
                ? 'bg-[#00ffff] text-black' 
                : 'bg-[#1a1a1a] text-[#555] hover:text-[#888] hover:bg-[#222] active:bg-[#222]'
            }`}
            style={{ minHeight: 'auto', minWidth: 'auto' }}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Status indicator */}
      <div className="absolute top-1 sm:top-2 right-1 sm:right-2 flex items-center gap-2">
        {isRecording && (
          <span className="text-[9px] sm:text-[10px] text-[#ff4444] font-mono animate-pulse">● REC</span>
        )}
        {isPlaying && !isRecording && (
          <span className="text-[9px] sm:text-[10px] text-[#00ffff] font-mono">♪ LIVE</span>
        )}
      </div>
    </div>
  );
}
