'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { WaveCanvas } from '@/components/WaveCanvas';
import { HarmonicEditor } from '@/components/HarmonicEditor';
import { Piano } from '@/components/Piano';
import { EnvelopeEditor } from '@/components/EnvelopeEditor';
import { ScaleSelector } from '@/components/ScaleSelector';
import { EffectsRackPanel } from '@/components/EffectsRackPanel';
import { LiveVisualizer } from '@/components/LiveVisualizer';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { ModeSwitcher, type AppMode } from '@/components/common/ModeSwitcher';
import { StudioGuitarInput } from '@/components/studio/StudioGuitarInput';
import { StudioRecorderPanel } from '@/components/studio/StudioRecorderPanel';
import { Timeline } from '@/components/studio/Timeline';
import { useAudioEngine, type StudioTake } from '@/hooks/useAudioEngine';
import { useAudioInput } from '@/hooks/useAudioInput';
import { usePitchDetection } from '@/hooks/usePitchDetection';
import { useLooper } from '@/hooks/useLooper';
import { useMIDI } from '@/hooks/useMIDI';
import { NoteName } from '@/lib/music-theory';
import { WaveformType, EffectType, EffectParams } from '@/lib/audio-engine';

interface StudioModeProps {
  onSwitchMode: (mode: AppMode) => void;
}

export function StudioMode({ onSwitchMode }: StudioModeProps) {
  const {
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
    getOutputGain,
    effects,
    addEffect,
    removeEffect,
    updateEffect,
    toggleEffect,
    moveEffect,
    isRecording: isMasterRecording,
    recordingElapsedMs,
    startRecording,
    stopRecording,
    takes,
    downloadTake,
    deleteTake,
    renameTake,
    setExternalInputStream,
    setInputMonitorEnabled,
    inputMonitorEnabled,
  } = useAudioEngine();

  const outputGain = isReady ? getOutputGain() : null;

  const looper = useLooper(outputGain);
  const audioInput = useAudioInput();
  const pitch = usePitchDetection(audioInput.analyser);

  const [bottomTab, setBottomTab] = useState<'piano' | 'guitar'>('piano');
  const [isPlaying, setIsPlaying] = useState(false);
  const [scaleLock, setScaleLock] = useState(false);
  const [rootNote, setRootNote] = useState<NoteName>('C');
  const [scaleName, setScaleName] = useState('pentatonic');
  const [octave, setOctave] = useState(4);
  const [attack, setAttack] = useState(0.01);
  const [decay, setDecay] = useState(0.2);
  const [sustain, setSustain] = useState(0.5);
  const [release, setRelease] = useState(0.5);
  const [showKeyboardOverlay, setShowKeyboardOverlay] = useState(true);
  const [midiActiveNotes, setMidiActiveNotes] = useState<Set<string>>(new Set());
  const [takeNamePrefix, setTakeNamePrefix] = useState('Take');

  const midiNotesRef = useRef<Set<string>>(new Set());

  const handleMIDINoteOn = useCallback((note: string, _velocity: number) => {
    if (!isReady) return;
    midiNotesRef.current.add(note);
    setMidiActiveNotes(new Set(midiNotesRef.current));
    setIsPlaying(true);
    playNote(note);
  }, [isReady, playNote]);

  const handleMIDINoteOff = useCallback((note: string) => {
    midiNotesRef.current.delete(note);
    setMidiActiveNotes(new Set(midiNotesRef.current));
    if (midiNotesRef.current.size === 0) {
      setIsPlaying(false);
      stopNote();
    }
  }, [stopNote]);

  const { isSupported: midiSupported, isConnected: midiConnected, devices: midiDevices, activeDevice, connectToDevice } = useMIDI(
    handleMIDINoteOn,
    handleMIDINoteOff
  );

  // Keyboard shortcuts for octave shifting (arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOctave(prev => Math.max(1, prev - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setOctave(prev => Math.min(7, prev + 1));
      }
      // Spacebar for play/stop
      if (e.key === ' ' && looper.isInitialized) {
        e.preventDefault();
        if (looper.isPlaying) {
          looper.stop();
        } else {
          looper.play();
        }
      }
      // R for record
      if (e.key.toLowerCase() === 'r' && looper.isInitialized && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (looper.isRecording) {
          looper.stopRecording();
        } else {
          looper.startRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [looper]);

  const handleInit = async () => {
    try {
      await init();
    } catch (e) {
      console.error('Failed to initialize audio:', e);
    }
  };

  const handleNoteOn = useCallback((note: string) => {
    if (!isReady) return;
    setIsPlaying(true);
    playNote(note);
    if (looper.isRecording) {
      looper.noteOn(note);
    }
  }, [isReady, playNote, looper]);

  const handleNoteOff = useCallback(() => {
    setIsPlaying(false);
    stopNote();
    if (looper.isRecording) {
      looper.noteOff();
    }
  }, [stopNote, looper]);

  const handleWaveformChange = useCallback((newWaveform: Float32Array) => {
    setCustomWaveform(newWaveform);
  }, [setCustomWaveform]);

  const handleHarmonicsChange = useCallback((newHarmonics: number[]) => {
    setCustomHarmonics(newHarmonics);
  }, [setCustomHarmonics]);

  const handlePresetSelect = useCallback((type: WaveformType) => {
    setPresetWaveform(type);
  }, [setPresetWaveform]);

  const handleEnvelopeChange = useCallback((a: number, d: number, s: number, r: number) => {
    setAttack(a);
    setDecay(d);
    setSustain(s);
    setRelease(r);
    setEnvelope(a, d, s, r);
  }, [setEnvelope]);

  const handleAddEffect = useCallback((type: EffectType) => {
    addEffect(type);
  }, [addEffect]);

  const handleRemoveEffect = useCallback((id: string) => {
    removeEffect(id);
  }, [removeEffect]);

  const handleUpdateEffect = useCallback((id: string, params: Partial<EffectParams[EffectType]>) => {
    updateEffect(id, params);
  }, [updateEffect]);

  const handleToggleEffect = useCallback((id: string, enabled: boolean) => {
    toggleEffect(id, enabled);
  }, [toggleEffect]);

  const handleMoveEffect = useCallback((id: string, direction: 'up' | 'down') => {
    moveEffect(id, direction);
  }, [moveEffect]);

  const handleStartMasterRecord = useCallback(() => {
    void startRecording();
  }, [startRecording]);

  const handleStopMasterRecord = useCallback(() => {
    void stopRecording(takeNamePrefix);
  }, [stopRecording, takeNamePrefix]);

  const handleAddTakeToLooper = useCallback(async (take: StudioTake) => {
    await looper.addTrackFromBlob(take.blob, take.name);
  }, [looper]);

  // When the audio input hook stops or unmounts, ensure the engine forgets
  // the stream and monitor turns off.
  useEffect(() => {
    if (!audioInput.isActive && inputMonitorEnabled) {
      setInputMonitorEnabled(false);
    }
  }, [audioInput.isActive, inputMonitorEnabled, setInputMonitorEnabled]);

  // Register the synth as the looper's MIDI playback trigger so MIDI
  // tracks recorded into the looper actually replay through the synth.
  useEffect(() => {
    if (!looper.isInitialized) return;
    looper.setMidiTrigger((note, durationSec, time, velocity) => {
      scheduleNote(note, durationSec, time, velocity);
    });
    return () => {
      looper.setMidiTrigger(null);
    };
  }, [looper.isInitialized, looper.setMidiTrigger, scheduleNote]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4 tracking-tighter">
            <span className="text-[#00ffff]">Wave</span>
            <span className="text-[#ff6b35]">Lab</span>
            <span className="text-[#666] text-base sm:text-lg md:text-xl ml-2 sm:ml-3 font-normal block sm:inline">
              Studio
            </span>
          </h1>
          <p className="text-[#666] mb-8 text-base sm:text-lg">Create. Publish. Remix.</p>
          <button
            onClick={handleInit}
            className="px-6 sm:px-8 py-4 bg-[#00ffff] text-black font-medium rounded-lg hover:bg-[#00cccc] active:bg-[#00aaaa] transition-colors text-base sm:text-lg min-h-[56px]"
          >
            Start Making Music
          </button>
          <p className="text-[#444] text-sm mt-4">Tap to enable audio</p>
          <button
            onClick={() => onSwitchMode('home')}
            className="block mx-auto mt-8 text-xs text-[#555] hover:text-[#888] transition-colors"
          >
            ← Back to mode picker
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#ededed] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-3 sm:px-6 py-2 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tighter whitespace-nowrap shrink-0">
            <span className="text-[#00ffff]">Wave</span>
            <span className="text-[#ff6b35]">Lab</span>
          </h1>
          <ModeSwitcher mode="studio" onChange={onSwitchMode} />
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <button
            onClick={isMasterRecording ? handleStopMasterRecord : handleStartMasterRecord}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
              isMasterRecording
                ? 'bg-[#ff4444] text-black border-transparent hover:bg-[#ff6666]'
                : 'bg-[#1a1a1a] text-[#ededed] border-[#2a2a2a] hover:border-[#ff4444] hover:text-[#ff4444]'
            }`}
            title="Record master output"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isMasterRecording ? 'bg-black animate-pulse' : 'bg-[#ff4444]'
              }`}
            />
            <span className="hidden sm:inline">{isMasterRecording ? 'Stop' : 'Rec'}</span>
            {isMasterRecording && (
              <span className="font-mono tabular-nums">
                {Math.floor(recordingElapsedMs / 60000)}:{Math.floor((recordingElapsedMs % 60000) / 1000).toString().padStart(2, '0')}
              </span>
            )}
          </button>
          {midiSupported && (
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${midiConnected ? 'bg-[#00ff88]' : 'bg-[#444]'}`} />
              <select
                value={activeDevice || ''}
                onChange={(e) => e.target.value && connectToDevice(e.target.value)}
                className="bg-[#1a1a1a] text-xs text-[#888] border border-[#2a2a2a] rounded px-2 py-1 max-w-[120px] sm:max-w-none"
              >
                <option value="">MIDI: {midiDevices.length === 0 ? 'None' : 'Select'}</option>
                {midiDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-[10px] text-[#555] font-mono hidden lg:block">
            <span className="text-[#666]">Space</span> play/stop
            <span className="mx-2">|</span>
            <span className="text-[#666]">R</span> record
          </div>
        </div>
      </header>

      {/* Live visualizer strip — thin band so it doesn't dominate */}
      <div className="shrink-0 px-2 sm:px-4 py-2 border-b border-[#2a2a2a]">
        <LiveVisualizer
          getAnalyserData={getAnalyserData}
          getFFTData={getFFTData}
          isPlaying={isPlaying || looper.isPlaying}
          isRecording={looper.isRecording}
          height={64}
        />
      </div>

      {/*
        MAIN AREA: recording / playback / editing.
        The looper and the master recorder live here as a unified surface.
        Top: recorder (master takes). Below: looper transport + tracks.
        Both flow into the same effects chain (configured on the bottom panel)
        so what you record is what you hear.
      */}
      <main className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3">
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d]">
          <div className="px-3 py-2 border-b border-[#1f1f1f] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isMasterRecording ? 'bg-[#ff4444] animate-pulse' : 'bg-[#444]'}`} />
              <span className="text-xs uppercase tracking-widest text-[#888] font-mono">Recorder</span>
              {isMasterRecording && (
                <span className="text-[#ff4444] font-mono text-xs tabular-nums">
                  REC {Math.floor(recordingElapsedMs / 60000)}:{Math.floor((recordingElapsedMs % 60000) / 1000).toString().padStart(2, '0')}
                </span>
              )}
            </div>
            <span className="text-[10px] text-[#555] font-mono">
              {takes.length > 0 ? `${takes.length} take${takes.length === 1 ? '' : 's'}` : 'No takes yet'}
            </span>
          </div>
          <StudioRecorderPanel
            isRecording={isMasterRecording}
            recordingElapsedMs={recordingElapsedMs}
            takes={takes}
            namePrefix={takeNamePrefix}
            onNamePrefixChange={setTakeNamePrefix}
            onStart={handleStartMasterRecord}
            onStop={handleStopMasterRecord}
            onDownloadTake={downloadTake}
            onDeleteTake={deleteTake}
            onRenameTake={renameTake}
            onAddToLooper={handleAddTakeToLooper}
          />
        </div>

        {looper.isInitialized && (
          <Timeline
            isPlaying={looper.isPlaying}
            isRecording={looper.isRecording}
            bpm={looper.bpm}
            bars={looper.bars}
            beatsPerBar={looper.beatsPerBar}
            currentBeat={looper.currentBeat}
            currentPosition={looper.currentPosition}
            loopEnabled={looper.loopEnabled}
            metronomeEnabled={looper.metronomeEnabled}
            tracks={looper.tracks}
            onPlay={looper.play}
            onStop={looper.stop}
            onSeekTo={looper.seekTo}
            onStartRecording={looper.startRecording}
            onStopRecording={looper.stopRecording}
            onSetBpm={looper.setBpm}
            onSetBars={looper.setBars}
            onSetBeatsPerBar={looper.setBeatsPerBar}
            onSetMetronomeEnabled={looper.setMetronomeEnabled}
            onSetLoopEnabled={looper.setLoopEnabled}
            onAddAudioTrack={() => looper.addTrack('audio')}
            onAddMidiTrack={() => looper.addMidiTrack()}
            onRemoveTrack={looper.removeTrack}
            onClearTrack={looper.clearTrack}
            onClearAllTracks={looper.clearAllTracks}
            onSetTrackMuted={looper.setTrackMuted}
            onSetTrackSolo={looper.setTrackSolo}
            onSetTrackVolume={looper.setTrackVolume}
            onArmTrack={looper.armTrack}
          />
        )}
      </main>

      {/*
        BOTTOM INSTRUMENT PANEL.
        Tabs: Piano | Guitar — each is a fully-equipped instrument.
        Above the tab content sits a SHARED Effects accordion (the chain
        every instrument flows through). Inside the Piano tab there are
        synth-design accordions (Wave Shape / Harmonics / Scale / Envelope)
        — they're piano-specific so they live here, not in the main area.
        Inside the Guitar tab is the StudioGuitarInput (input controls,
        tuner, fretboard, quick-pedalboard).
        Has its own scroll so accordions can grow without pushing the main
        recording area off-screen.
      */}
      <div
        className="shrink-0 border-t border-[#2a2a2a] bg-[#0a0a0a] px-2 md:px-4 py-2 safe-bottom overflow-y-auto"
        style={{ maxHeight: 'min(60vh, 540px)' }}
      >
        <div className="flex items-center justify-between gap-2 mb-2 sticky top-0 z-10 bg-[#0a0a0a] -mx-2 md:-mx-4 px-2 md:px-4 py-1">
          {/* Tab bar */}
          <div className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-1">
            <button
              onClick={() => setBottomTab('piano')}
              className={`px-2.5 py-1 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                bottomTab === 'piano'
                  ? 'bg-[#1a1a1a] text-[#ededed]'
                  : 'text-[#888] hover:text-[#ededed] hover:bg-[#141414]'
              }`}
              style={bottomTab === 'piano' ? { boxShadow: 'inset 0 0 0 1px #00ffff55' } : undefined}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: bottomTab === 'piano' ? '#00ffff' : '#444' }} />
                Piano
              </span>
            </button>
            <button
              onClick={() => setBottomTab('guitar')}
              className={`px-2.5 py-1 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                bottomTab === 'guitar'
                  ? 'bg-[#1a1a1a] text-[#ededed]'
                  : 'text-[#888] hover:text-[#ededed] hover:bg-[#141414]'
              }`}
              style={bottomTab === 'guitar' ? { boxShadow: 'inset 0 0 0 1px #ff6b3555' } : undefined}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: bottomTab === 'guitar' ? '#ff6b35' : audioInput.isActive ? '#00ff88' : '#444' }} />
                Guitar
                {audioInput.isActive && bottomTab !== 'guitar' && (
                  <span className="text-[9px] uppercase text-[#00ff88] font-mono">live</span>
                )}
              </span>
            </button>
          </div>

          {/* Per-tab controls */}
          {bottomTab === 'piano' ? (
            <div className="flex items-center gap-2 md:gap-4">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setOctave(Math.max(1, octave - 1))}
                  className="w-8 h-8 md:w-6 md:h-6 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] active:bg-[#2a2a2a] transition-colors text-xs border border-[#2a2a2a] compact"
                  title="Octave down"
                >
                  ▼
                </button>
                <span className="text-xs text-[#ededed] font-mono w-12 md:w-14 text-center">Oct {octave}</span>
                <button
                  onClick={() => setOctave(Math.min(7, octave + 1))}
                  className="w-8 h-8 md:w-6 md:h-6 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] active:bg-[#2a2a2a] transition-colors text-xs border border-[#2a2a2a] compact"
                  title="Octave up"
                >
                  ▲
                </button>
                <span className="text-[10px] text-[#555] ml-1 font-mono hidden md:inline">(↑/↓)</span>
              </div>
              {midiConnected && (
                <span className="text-xs text-[#00ff88] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
                  <span className="hidden md:inline">MIDI</span>
                </span>
              )}
              <button
                onClick={() => setShowKeyboardOverlay(!showKeyboardOverlay)}
                className={`px-2 py-1 text-xs rounded transition-colors hidden md:block ${
                  showKeyboardOverlay
                    ? 'bg-[#00ffff] text-black'
                    : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] border border-[#2a2a2a]'
                }`}
              >
                {showKeyboardOverlay ? '⌨️ ON' : '⌨️ Keys'}
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-[#666] font-mono uppercase tracking-widest">
              Live guitar · effects chain
            </span>
          )}
        </div>

        {/* Shared effects rack — every instrument's signal feeds the same chain. */}
        <div className="mb-2">
          <CollapsibleSection
            title="Effects rack"
            defaultExpanded={false}
            badge={effects.length > 0 ? `${effects.length} effect${effects.length === 1 ? '' : 's'}` : 'empty'}
          >
            <EffectsRackPanel
              effects={effects}
              onAddEffect={handleAddEffect}
              onRemoveEffect={handleRemoveEffect}
              onUpdateEffect={handleUpdateEffect}
              onToggleEffect={handleToggleEffect}
              onMoveEffect={handleMoveEffect}
            />
          </CollapsibleSection>
        </div>

        {bottomTab === 'piano' ? (
          <div className="space-y-2">
            {/* Synth-design accordions — the piano IS the synth, so its
                voice controls live with it. Default-collapsed so the panel
                doesn't blow up; click to dial in your sound. */}
            <CollapsibleSection title="Wave shape" defaultExpanded={false}>
              <WaveCanvas
                waveform={waveform}
                onWaveformChange={handleWaveformChange}
                onPresetSelect={handlePresetSelect}
                isPlaying={isPlaying}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Harmonics" defaultExpanded={false} badge="16 partials">
              <HarmonicEditor
                harmonics={harmonics}
                onHarmonicsChange={handleHarmonicsChange}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Scale & key" defaultExpanded={false} badge={scaleLock ? 'locked' : 'free'}>
              <div className="p-2 sm:p-3">
                <ScaleSelector
                  rootNote={rootNote}
                  scaleName={scaleName}
                  scaleLock={scaleLock}
                  onRootChange={setRootNote}
                  onScaleChange={setScaleName}
                  onScaleLockChange={setScaleLock}
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Envelope (ADSR)" defaultExpanded={false}>
              <EnvelopeEditor
                attack={attack}
                decay={decay}
                sustain={sustain}
                release={release}
                onChange={handleEnvelopeChange}
              />
            </CollapsibleSection>

            {/* The actual playable surface — always visible, always at the bottom. */}
            <div className="w-full pt-2">
              <Piano
                onNoteOn={handleNoteOn}
                onNoteOff={handleNoteOff}
                scaleLock={scaleLock}
                rootNote={rootNote}
                scaleName={scaleName}
                octave={octave}
                showKeyboardOverlay={showKeyboardOverlay}
                compact={true}
                externalActiveNotes={midiActiveNotes}
              />
            </div>
          </div>
        ) : (
          <StudioGuitarInput
            audioInput={audioInput}
            pitch={pitch}
            monitorEnabled={inputMonitorEnabled}
            onMonitorToggle={setInputMonitorEnabled}
            onStreamChange={setExternalInputStream}
            effects={effects}
            onAddEffect={handleAddEffect}
            onRemoveEffect={handleRemoveEffect}
          />
        )}
      </div>
    </div>
  );
}
