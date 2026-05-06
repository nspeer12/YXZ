'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioEngine, WaveformType, Effect, EffectType, EffectParams } from '@/lib/audio-engine';
import type * as Tone from 'tone';

/**
 * A finished recording captured from the studio master output (synth +
 * monitored input + effects + looper). In-memory only — refresh wipes them.
 */
export interface StudioTake {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  durationMs: number;
  createdAt: number;
}

export function useAudioEngine() {
  const [isReady, setIsReady] = useState(false);
  const [waveform, setWaveform] = useState<Float32Array>(new Float32Array(256));
  const [harmonics, setHarmonics] = useState<number[]>(new Array(16).fill(0));
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [takes, setTakes] = useState<StudioTake[]>([]);
  const [effects, setEffects] = useState<Effect[]>([]);
  const [inputMonitorEnabled, setInputMonitorEnabledState] = useState(false);
  const engineRef = useRef<AudioEngine | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const recordingStartRef = useRef<number>(0);
  const recordingRafRef = useRef<number | null>(null);

  // Initialize audio engine - MUST be called from user gesture on iOS
  const init = useCallback(async () => {
    // Create engine only when user interacts (required for iOS)
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    
    await engineRef.current.init();
    
    // Now that engine is ready, get initial state
    setWaveform(engineRef.current.getWaveform());
    setHarmonics(engineRef.current.getHarmonics());
    setEffects(engineRef.current.getEffects());
    setIsReady(engineRef.current.isReady());
    
    // Subscribe to effects changes
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    unsubscribeRef.current = engineRef.current.onEffectsChange(() => {
      if (engineRef.current) {
        setEffects(engineRef.current.getEffects());
      }
    });
  }, []);

  const playNote = useCallback((note: string, duration?: string) => {
    if (!engineRef.current?.isReady()) return;
    engineRef.current.playNote(note, duration);
  }, []);

  const stopNote = useCallback(() => {
    if (!engineRef.current?.isReady()) return;
    engineRef.current.stopNote();
  }, []);

  /** Schedule a note at an explicit Tone time — used by the looper for MIDI playback. */
  const scheduleNote = useCallback(
    (note: string, durationSec: number, time: number, velocity: number = 0.8) => {
      if (!engineRef.current?.isReady()) return;
      engineRef.current.scheduleNote(note, durationSec, time, velocity);
    },
    [],
  );

  const setCustomWaveform = useCallback((newWaveform: Float32Array) => {
    if (!engineRef.current) return;
    engineRef.current.setWaveform(newWaveform);
    setWaveform(engineRef.current.getWaveform());
    setHarmonics(engineRef.current.getHarmonics());
  }, []);

  const setCustomHarmonics = useCallback((newHarmonics: number[]) => {
    if (!engineRef.current) return;
    engineRef.current.setHarmonics(newHarmonics);
    setWaveform(engineRef.current.getWaveform());
    setHarmonics(newHarmonics);
  }, []);

  const setPresetWaveform = useCallback((type: WaveformType) => {
    if (!engineRef.current) return;
    engineRef.current.setPresetWaveform(type);
    setWaveform(engineRef.current.getWaveform());
    setHarmonics(engineRef.current.getHarmonics());
  }, []);

  const setEnvelope = useCallback((attack: number, decay: number, sustain: number, release: number) => {
    engineRef.current?.setEnvelope(attack, decay, sustain, release);
  }, []);

  // Effects chain methods
  const addEffect = useCallback((type: EffectType): Effect | null => {
    if (!engineRef.current) return null;
    return engineRef.current.addEffect(type);
  }, []);

  const removeEffect = useCallback((id: string) => {
    engineRef.current?.removeEffect(id);
  }, []);

  const updateEffect = useCallback((id: string, params: Partial<EffectParams[EffectType]>) => {
    engineRef.current?.updateEffectParams(id, params);
    // Manually update the state since param changes don't trigger the listener
    if (engineRef.current) {
      setEffects(engineRef.current.getEffects());
    }
  }, []);

  const toggleEffect = useCallback((id: string, enabled: boolean) => {
    engineRef.current?.setEffectEnabled(id, enabled);
  }, []);

  const moveEffect = useCallback((id: string, direction: 'up' | 'down') => {
    engineRef.current?.moveEffect(id, direction);
  }, []);

  const getAnalyserData = useCallback(() => {
    return engineRef.current?.getAnalyserData() || new Float32Array(256);
  }, []);

  const getFFTData = useCallback(() => {
    return engineRef.current?.getFFTData() || new Float32Array(256);
  }, []);

  const getAnalyser = useCallback((): Tone.Analyser | null => {
    return engineRef.current?.getAnalyser() || null;
  }, []);

  const getOutputGain = useCallback((): Tone.Gain | null => {
    return engineRef.current?.getOutputGain() || null;
  }, []);

  const startRecording = useCallback(async () => {
    if (!engineRef.current) return;
    // Clean up previous recording URL
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
    }
    setRecordingBlob(null);
    await engineRef.current.startRecording();
    recordingStartRef.current = performance.now();
    setRecordingElapsedMs(0);
    setIsRecording(true);
  }, [recordingUrl]);

  /**
   * Stop recording. Captures the master output: synth + monitored input
   * + processed-through-effects + looper playback (everything that reaches
   * the master outputGain). Pushes a new Take onto the list.
   */
  const stopRecording = useCallback(async (namePrefix?: string) => {
    if (!engineRef.current) return null;
    const blob = await engineRef.current.stopRecording();
    const elapsed = performance.now() - recordingStartRef.current;
    setIsRecording(false);
    setRecordingElapsedMs(0);
    if (blob && blob.size > 0) {
      setRecordingBlob(blob);
      const url = URL.createObjectURL(blob);
      setRecordingUrl(url);
      const created = Date.now();
      const id = `take-${created}-${Math.random().toString(36).slice(2, 8)}`;
      const baseName = (namePrefix && namePrefix.trim()) || 'Take';
      const take: StudioTake = {
        id,
        name: `${baseName} ${new Date(created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
        blob,
        url,
        durationMs: Math.round(elapsed),
        createdAt: created,
      };
      setTakes((prev) => [take, ...prev]);
      return take;
    }
    return null;
  }, []);

  const downloadRecording = useCallback(() => {
    if (!recordingBlob) return;
    const url = URL.createObjectURL(recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wavelab-recording-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [recordingBlob]);

  const clearRecording = useCallback(() => {
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
    }
    setRecordingBlob(null);
    setRecordingUrl(null);
  }, [recordingUrl]);

  // --- Takes management ----------------------------------------------------

  const downloadTake = useCallback((take: StudioTake) => {
    const a = document.createElement('a');
    a.href = take.url;
    const safe = take.name.replace(/[^a-z0-9-_]+/gi, '_');
    a.download = `${safe || 'take'}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const renameTake = useCallback((id: string, name: string) => {
    setTakes((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  }, []);

  const deleteTake = useCallback((id: string) => {
    setTakes((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  // --- Audio input pipeline ------------------------------------------------

  const setExternalInputStream = useCallback((stream: MediaStream | null) => {
    engineRef.current?.setExternalInputStream(stream);
  }, []);

  const setInputMonitorEnabled = useCallback((enabled: boolean) => {
    engineRef.current?.setInputMonitorEnabled(enabled);
    setInputMonitorEnabledState(enabled);
  }, []);

  const getInputLevel = useCallback(() => {
    return engineRef.current?.getInputLevel() ?? 0;
  }, []);

  // Update elapsed timer while recording.
  useEffect(() => {
    if (!isRecording) {
      if (recordingRafRef.current != null) cancelAnimationFrame(recordingRafRef.current);
      recordingRafRef.current = null;
      return;
    }
    const tick = () => {
      setRecordingElapsedMs(performance.now() - recordingStartRef.current);
      recordingRafRef.current = requestAnimationFrame(tick);
    };
    recordingRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (recordingRafRef.current != null) cancelAnimationFrame(recordingRafRef.current);
      recordingRafRef.current = null;
    };
  }, [isRecording]);

  return {
    isReady,
    init,
    waveform,
    harmonics,
    playNote,
    stopNote,
    scheduleNote,
    setCustomWaveform,
    setCustomHarmonics,
    setPresetWaveform,
    setEnvelope,
    getAnalyserData,
    getFFTData,
    getAnalyser,
    getOutputGain,
    isRecording,
    recordingUrl,
    recordingElapsedMs,
    startRecording,
    stopRecording,
    downloadRecording,
    clearRecording,
    // Takes
    takes,
    downloadTake,
    renameTake,
    deleteTake,
    // Audio input
    setExternalInputStream,
    setInputMonitorEnabled,
    inputMonitorEnabled,
    getInputLevel,
    // Effects chain
    effects,
    addEffect,
    removeEffect,
    updateEffect,
    toggleEffect,
    moveEffect,
  };
}
