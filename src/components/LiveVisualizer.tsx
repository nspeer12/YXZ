'use client';

import { useRef, useEffect, useCallback } from 'react';

interface LiveVisualizerProps {
  getAnalyserData: () => Float32Array;
  isPlaying: boolean;
  isRecording?: boolean;
  height?: number;
}

export function LiveVisualizer({ getAnalyserData, isPlaying, isRecording = false, height = 80 }: LiveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const historyRef = useRef<Float32Array[]>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = getAnalyserData();
    const width = canvas.width;
    const canvasHeight = canvas.height;

    // Store history for trailing effect
    historyRef.current.push(new Float32Array(data));
    if (historyRef.current.length > 3) {
      historyRef.current.shift();
    }

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, canvasHeight);

    // Draw grid lines
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvasHeight / 2);
    ctx.lineTo(width, canvasHeight / 2);
    ctx.stroke();

    // Check if there's actual audio
    const hasAudio = data.some(v => Math.abs(v) > 0.001);

    if (hasAudio) {
      // Draw history (fading trail)
      historyRef.current.forEach((histData, histIndex) => {
        const alpha = (histIndex + 1) / (historyRef.current.length + 1) * 0.3;
        ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();

        const sliceWidth = width / histData.length;
        let x = 0;

        for (let i = 0; i < histData.length; i++) {
          const v = histData[i];
          const y = (1 - v) * canvasHeight / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();
      });

      // Draw current waveform
      ctx.strokeStyle = isRecording ? '#ff4444' : '#00ffff';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const sliceWidth = width / data.length;
      let x = 0;

      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        const y = (1 - v) * canvasHeight / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();

      // Glow effect
      ctx.shadowColor = isRecording ? '#ff4444' : '#00ffff';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      // Draw flat line when no audio
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvasHeight / 2);
      ctx.lineTo(width, canvasHeight / 2);
      ctx.stroke();

      // Subtle animated dots when idle
      const time = Date.now() / 1000;
      const dotCount = 5;
      for (let i = 0; i < dotCount; i++) {
        const dotX = (width / dotCount) * (i + 0.5);
        const dotY = canvasHeight / 2 + Math.sin(time * 2 + i) * 5;
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

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
  }, [getAnalyserData, isRecording]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    // Start animation loop
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [draw]);

  // Handle resize
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

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />
      <div className="absolute top-2 right-2 flex items-center gap-2">
        {isRecording && (
          <span className="text-[10px] text-[#ff4444] font-mono animate-pulse">● REC</span>
        )}
        {isPlaying && !isRecording && (
          <span className="text-[10px] text-[#00ffff] font-mono">♪ LIVE</span>
        )}
      </div>
    </div>
  );
}
