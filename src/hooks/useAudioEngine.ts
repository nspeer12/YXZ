'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAudioEngine, AudioEngine, WaveformType, Effect, EffectType, EffectParams } from '@/lib/audio-engine';
import * as Tone from 'tone';

export function useAudioEngine() {
  const [isReady, setIsReady] = useState(false);
  const [waveform, setWaveform] = useState<Float32Array>(new Float32Array(256));
  const [harmonics, setHarmonics] = useState<number[]>(new Array(16).fill(0));
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [effects, setEffects] = useState<Effect[]>([]);
  const engineRef = useRef<AudioEngine | null>(null);

  useEffect(() => {
    engineRef.current = getAudioEngine();
    setWaveform(engineRef.current.getWaveform());
    setHarmonics(engineRef.current.getHarmonics());
    setEffects(engineRef.current.getEffects());

    // Subscribe to effects changes
    const unsubscribe = engineRef.current.onEffectsChange(() => {
      if (engineRef.current) {
        setEffects(engineRef.current.getEffects());
      }
    });

    return () => unsubscribe();
  }, []);

  const init = useCallback(async () => {
    if (!engineRef.current) return;
    await engineRef.current.init();
    setIsReady(engineRef.current.isReady());
    setWaveform(engineRef.current.getWaveform());
    setHarmonics(engineRef.current.getHarmonics());
  }, []);

  const playNote = useCallback((note: string, duration?: string) => {
    if (!engineRef.current?.isReady()) return;
    engineRef.current.playNote(note, duration);
  }, []);

  const stopNote = useCallback(() => {
    if (!engineRef.current?.isReady()) return;
    engineRef.current.stopNote();
  }, []);

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
    setIsRecording(true);
  }, [recordingUrl]);

  const stopRecording = useCallback(async () => {
    if (!engineRef.current) return null;
    const blob = await engineRef.current.stopRecording();
    setIsRecording(false);
    if (blob) {
      setRecordingBlob(blob);
      const url = URL.createObjectURL(blob);
      setRecordingUrl(url);
      return blob;
    }
    return null;
  }, []);

  const downloadRecording = useCallback(() => {
    if (!recordingBlob) return;
    const url = URL.createObjectURL(recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yxz-recording-${Date.now()}.webm`;
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

  return {
    isReady,
    init,
    waveform,
    harmonics,
    playNote,
    stopNote,
    setCustomWaveform,
    setCustomHarmonics,
    setPresetWaveform,
    setEnvelope,
    getAnalyserData,
    getAnalyser,
    getOutputGain,
    isRecording,
    recordingUrl,
    startRecording,
    stopRecording,
    downloadRecording,
    clearRecording,
    // Effects chain
    effects,
    addEffect,
    removeEffect,
    updateEffect,
    toggleEffect,
    moveEffect,
  };
}
