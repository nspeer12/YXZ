'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { configureAnalyserForGuitar } from '@/lib/guitar/pitch-detector';

// Browsers report device labels only after the user has granted mic
// permission at least once. We keep both lists so the UI can show "(unnamed
// input — grant access to see)" placeholders before the first prompt.

export interface AudioInputDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export interface UseAudioInputResult {
  /** True when the AudioContext + MediaStream are running. */
  isActive: boolean;
  /** True when permission has been granted at least once. */
  hasPermission: boolean;
  /** Current device id (or null if not connected). */
  activeDeviceId: string | null;
  /** Available input devices. Populated after first permission grant. */
  devices: AudioInputDevice[];
  /** AnalyserNode tapping the input (after high-pass filter), or null. */
  analyser: AnalyserNode | null;
  /** AudioContext used for the input pipeline. */
  audioContext: AudioContext | null;
  /** Live RMS level 0..1. Updated via rAF. */
  level: number;
  /** Last error message, if any. */
  error: string | null;
  /** Round-trip latency hint in ms (input + output, ballpark). */
  latencyMs: number;

  /** Prompt for permission and start with an optional preferred device id. */
  start: (deviceId?: string) => Promise<void>;
  /** Switch to a different input without tearing down the AudioContext. */
  selectDevice: (deviceId: string) => Promise<void>;
  /** Stop the input and release the mic. */
  stop: () => void;
  /** Refresh the device list. */
  refreshDevices: () => Promise<void>;
}

export function useAudioInput(): UseAudioInputResult {
  const [isActive, setIsActive] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  // Drop everything tied to whatever ctx we currently hold. Used when the
  // existing context is closed (or a stale one is detected from HMR / fast
  // refresh) so we don't reuse nodes from a dead context — that's exactly
  // what triggers "cannot connect to an AudioNode belonging to a different
  // audio context".
  const dropAudioGraph = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch { /* */ }
      sourceRef.current = null;
    }
    if (filterRef.current) {
      try { filterRef.current.disconnect(); } catch { /* */ }
      filterRef.current = null;
    }
    if (analyserRef.current) {
      try { analyserRef.current.disconnect(); } catch { /* */ }
      analyserRef.current = null;
      setAnalyser(null);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Ensure we have an AudioContext (created lazily on first use, must be from a user gesture).
  const ensureContext = useCallback((): AudioContext => {
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      return ctxRef.current;
    }
    // Either no context yet, or the previous one is closed. Scrub all node
    // refs — they belong to the dead context and would throw on reuse.
    dropAudioGraph();
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    ctxRef.current = ctx;
    setAudioContext(ctx);
    return ctx;
  }, [dropAudioGraph]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setError('Audio input enumeration not supported in this browser.');
      return;
    }
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || 'Audio input (grant access to see name)',
          groupId: d.groupId,
        }));
      setDevices(inputs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to list devices.');
    }
  }, []);

  // Hot-plug: refresh devices when the OS reports a change.
  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;
    const handler = () => {
      void refreshDevices();
    };
    navigator.mediaDevices.addEventListener('devicechange', handler);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handler);
  }, [refreshDevices]);

  // Tear down any existing stream + nodes (but leave AudioContext open).
  const teardownStream = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        /* ignore */
      }
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const buildPipeline = useCallback(
    async (deviceId?: string) => {
      const ctx = ensureContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          // Disable processing that hurts pitch detection.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        } as MediaTrackConstraints,
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Always rebuild the analysis graph. Reusing cached filter/analyser
      // across device switches caused "different audio context" errors when
      // the cached node was stuck on a stale context (HMR, switched device
      // sample rates, etc). Creating fresh nodes is essentially free.
      if (filterRef.current) {
        try { filterRef.current.disconnect(); } catch { /* */ }
      }
      if (analyserRef.current) {
        try { analyserRef.current.disconnect(); } catch { /* */ }
      }

      const filter = ctx.createBiquadFilter();
      // High-pass at 60Hz to kill mic rumble + AC hum below low-E (82Hz).
      filter.type = 'highpass';
      filter.frequency.value = 60;
      filterRef.current = filter;

      const analyser = ctx.createAnalyser();
      configureAnalyserForGuitar(analyser);
      analyserRef.current = analyser;
      setAnalyser(analyser);

      filter.connect(analyser);

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(filter);
      // Note: analyser is NOT connected to ctx.destination — we don't want to
      // hear the player's mic.

      const trackSettings = stream.getAudioTracks()[0]?.getSettings() ?? {};
      setActiveDeviceId(trackSettings.deviceId ?? deviceId ?? null);
      setHasPermission(true);
      setIsActive(true);
      setError(null);
      setLatencyMs(Math.round((ctx.baseLatency + (ctx.outputLatency || 0)) * 1000));
    },
    [ensureContext],
  );

  const start = useCallback(
    async (deviceId?: string) => {
      try {
        await buildPipeline(deviceId);
        await refreshDevices();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to start audio input.');
        setIsActive(false);
      }
    },
    [buildPipeline, refreshDevices],
  );

  const selectDevice = useCallback(
    async (deviceId: string) => {
      try {
        teardownStream();
        await buildPipeline(deviceId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to switch device.');
      }
    },
    [buildPipeline, teardownStream],
  );

  const stop = useCallback(() => {
    teardownStream();
    setIsActive(false);
    setActiveDeviceId(null);
  }, [teardownStream]);

  // Level meter loop (RMS over time-domain data).
  useEffect(() => {
    if (!analyser || !isActive) {
      setLevel(0);
      return;
    }
    const buf = new Float32Array(analyser.fftSize);
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      // Map -60dB..0dB to 0..1.
      const db = 20 * Math.log10(Math.max(rms, 1e-6));
      const norm = Math.max(0, Math.min(1, (db + 60) / 60));
      setLevel(norm);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, isActive]);

  // Final cleanup on unmount.
  useEffect(() => {
    return () => {
      teardownStream();
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        void ctxRef.current.close().catch(() => undefined);
      }
    };
  }, [teardownStream]);

  return {
    isActive,
    hasPermission,
    activeDeviceId,
    devices,
    analyser,
    audioContext,
    level,
    error,
    latencyMs,
    start,
    selectDevice,
    stop,
    refreshDevices,
  };
}
