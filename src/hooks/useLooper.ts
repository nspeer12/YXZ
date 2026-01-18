'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getLooper, Looper, LooperState, LoopTrack } from '@/lib/looper';
import * as Tone from 'tone';

export function useLooper(inputNode: Tone.Gain | null) {
  const [state, setState] = useState<LooperState>({
    isPlaying: false,
    isRecording: false,
    bpm: 120,
    bars: 4,
    beatsPerBar: 4,
    currentBeat: 0,
    loopEnabled: true,
    metronomeEnabled: true,
    tracks: [],
  });
  const [currentPosition, setCurrentPosition] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const looperRef = useRef<Looper | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!inputNode) return;

    const looper = getLooper();
    looperRef.current = looper;

    looper.init(inputNode).then(() => {
      setIsInitialized(true);
      setState(looper.getState());
    });

    looper.onStateChange((newState) => {
      setState(newState);
    });

    looper.onBeat((beat) => {
      // Beat callback for visual feedback
    });

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [inputNode]);

  // Update position for progress indicator
  useEffect(() => {
    if (!looperRef.current || !state.isPlaying) {
      setCurrentPosition(0);
      return;
    }

    const updatePosition = () => {
      if (looperRef.current) {
        setCurrentPosition(looperRef.current.getCurrentPosition());
      }
      animationRef.current = requestAnimationFrame(updatePosition);
    };

    animationRef.current = requestAnimationFrame(updatePosition);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [state.isPlaying]);

  const play = useCallback(() => {
    looperRef.current?.play();
  }, []);

  const stop = useCallback(() => {
    looperRef.current?.stop();
  }, []);

  const startRecording = useCallback((trackId?: string) => {
    looperRef.current?.startRecording(trackId);
  }, []);

  const stopRecording = useCallback(() => {
    looperRef.current?.stopRecording();
  }, []);

  const setBpm = useCallback((bpm: number) => {
    looperRef.current?.setBpm(bpm);
  }, []);

  const setBars = useCallback((bars: number) => {
    looperRef.current?.setBars(bars);
  }, []);

  const setBeatsPerBar = useCallback((beats: number) => {
    looperRef.current?.setBeatsPerBar(beats);
  }, []);

  const noteOn = useCallback((note: string) => {
    looperRef.current?.noteOn(note);
  }, []);

  const noteOff = useCallback(() => {
    looperRef.current?.noteOff();
  }, []);

  const setMetronomeEnabled = useCallback((enabled: boolean) => {
    looperRef.current?.setMetronomeEnabled(enabled);
  }, []);

  const setLoopEnabled = useCallback((enabled: boolean) => {
    looperRef.current?.setLoopEnabled(enabled);
  }, []);

  const addTrack = useCallback(() => {
    return looperRef.current?.addTrack();
  }, []);

  const removeTrack = useCallback((trackId: string) => {
    looperRef.current?.removeTrack(trackId);
  }, []);

  const clearTrack = useCallback((trackId: string) => {
    looperRef.current?.clearTrack(trackId);
  }, []);

  const clearAllTracks = useCallback(() => {
    looperRef.current?.clearAllTracks();
  }, []);

  const setTrackVolume = useCallback((trackId: string, volume: number) => {
    looperRef.current?.setTrackVolume(trackId, volume);
  }, []);

  const setTrackMuted = useCallback((trackId: string, muted: boolean) => {
    looperRef.current?.setTrackMuted(trackId, muted);
  }, []);

  const setTrackSolo = useCallback((trackId: string, solo: boolean) => {
    looperRef.current?.setTrackSolo(trackId, solo);
  }, []);

  return {
    ...state,
    currentPosition,
    isInitialized,
    play,
    stop,
    startRecording,
    stopRecording,
    setBpm,
    setBars,
    setBeatsPerBar,
    noteOn,
    noteOff,
    setMetronomeEnabled,
    setLoopEnabled,
    addTrack,
    removeTrack,
    clearTrack,
    clearAllTracks,
    setTrackVolume,
    setTrackMuted,
    setTrackSolo,
  };
}
