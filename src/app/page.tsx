'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { WaveCanvas } from '@/components/WaveCanvas';
import { HarmonicEditor } from '@/components/HarmonicEditor';
import { Piano } from '@/components/Piano';
import { EnvelopeEditor } from '@/components/EnvelopeEditor';
import { ScaleSelector } from '@/components/ScaleSelector';
import { EffectsRackPanel } from '@/components/EffectsRackPanel';
import { LiveVisualizer } from '@/components/LiveVisualizer';
import { LooperPanel } from '@/components/LooperPanel';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useLooper } from '@/hooks/useLooper';
import { useMIDI } from '@/hooks/useMIDI';
import { NoteName } from '@/lib/music-theory';
import { WaveformType, EffectType, EffectParams } from '@/lib/audio-engine';

export default function Home() {
  const {
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
    getFFTData,
    getOutputGain,
    effects,
    addEffect,
    removeEffect,
    updateEffect,
    toggleEffect,
    moveEffect,
  } = useAudioEngine();

  const outputGain = isReady ? getOutputGain() : null;
  
  const looper = useLooper(outputGain);

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
  const [showMobileEffects, setShowMobileEffects] = useState(false);
  
  const midiNotesRef = useRef<Set<string>>(new Set());

  const handleMIDINoteOn = useCallback((note: string, velocity: number) => {
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
    await init();
  };

  const handleNoteOn = useCallback((note: string) => {
    if (!isReady) return;
    setIsPlaying(true);
    playNote(note);
    // Track note for looper visualization
    if (looper.isRecording) {
      looper.noteOn(note);
    }
  }, [isReady, playNote, looper]);

  const handleNoteOff = useCallback(() => {
    setIsPlaying(false);
    stopNote();
    // Track note end for looper visualization
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

  // Effects handlers
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

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-4xl sm:text-6xl font-bold mb-4 tracking-tighter">
            <span className="text-[#00ffff]">Wave</span>
            <span className="text-[#ff6b35]">Lab</span>
          </h1>
          <p className="text-[#666] mb-8 text-base sm:text-lg">Create. Publish. Remix.</p>
          <button
            onClick={handleInit}
            className="px-6 sm:px-8 py-4 bg-[#00ffff] text-black font-medium rounded-lg hover:bg-[#00cccc] active:bg-[#00aaaa] transition-colors text-base sm:text-lg min-h-[56px]"
          >
            Start Making Music
          </button>
          <p className="text-[#444] text-sm mt-4">Tap to enable audio</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#ededed] flex flex-col overflow-hidden">
      {/* Mobile Effects Overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 z-40 mobile-only mobile-overlay ${showMobileEffects ? 'open' : ''}`}
        onClick={() => setShowMobileEffects(false)}
      />

      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-3 sm:px-6 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Mobile Effects Toggle */}
          <button
            onClick={() => setShowMobileEffects(!showMobileEffects)}
            className="mobile-only w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[#888] hover:text-[#00ffff] active:bg-[#2a2a2a]"
          >
            <span className="text-lg">🎚️</span>
          </button>
          <h1 className="text-lg sm:text-xl font-bold tracking-tighter">
            <span className="text-[#00ffff]">Wave</span>
            <span className="text-[#ff6b35]">Lab</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {/* MIDI Status */}
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
          
          {/* Keyboard shortcuts hint - hidden on mobile */}
          <div className="text-[10px] text-[#555] font-mono hidden md:block">
            <span className="text-[#666]">Space</span> play/stop
            <span className="mx-2">|</span>
            <span className="text-[#666]">R</span> record
          </div>
        </div>
      </header>

      {/* Main layout with left sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar - Effects Chain (Desktop) / Slide-out (Mobile) */}
        <aside className={`
          fixed md:relative inset-y-0 left-0 z-50 md:z-auto
          w-72 shrink-0 border-r border-[#2a2a2a] bg-[#050505] overflow-y-auto
          mobile-drawer ${showMobileEffects ? 'open' : ''}
          pt-14 md:pt-0
        `}>
          <div className="p-3">
            {/* Mobile close button */}
            <button
              onClick={() => setShowMobileEffects(false)}
              className="mobile-only absolute top-2 right-2 w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[#888]"
            >
              ✕
            </button>
            <EffectsRackPanel
              effects={effects}
              onAddEffect={handleAddEffect}
              onRemoveEffect={handleRemoveEffect}
              onUpdateEffect={handleUpdateEffect}
              onToggleEffect={handleToggleEffect}
              onMoveEffect={handleMoveEffect}
            />
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Live Visualizer */}
          <div className="shrink-0 px-2 sm:px-4 py-2 border-b border-[#2a2a2a]">
            <LiveVisualizer
              getAnalyserData={getAnalyserData}
              getFFTData={getFFTData}
              isPlaying={isPlaying || looper.isPlaying}
              isRecording={looper.isRecording}
              height={80}
            />
          </div>

          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto p-2 sm:p-4">
            {/* Looper Panel - Collapsible */}
            {looper.isInitialized && (
              <div className="mb-3 sm:mb-4">
                <CollapsibleSection title="Looper" defaultExpanded={false} badge={`${looper.bpm} BPM`}>
                  <div className="p-2 sm:p-3">
                    <LooperPanel
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
                      onAddTrack={looper.addTrack}
                      onRemoveTrack={looper.removeTrack}
                      onClearTrack={looper.clearTrack}
                      onClearAllTracks={looper.clearAllTracks}
                      onSetTrackMuted={looper.setTrackMuted}
                      onSetTrackSolo={looper.setTrackSolo}
                      onSetTrackVolume={looper.setTrackVolume}
                    />
                  </div>
                </CollapsibleSection>
              </div>
            )}

            {/* Sound Design Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {/* Left column */}
              <div className="space-y-3 sm:space-y-4">
                {/* Wave Canvas - Expanded by default */}
                <CollapsibleSection title="Wave Shape" defaultExpanded={true}>
                  <WaveCanvas
                    waveform={waveform}
                    onWaveformChange={handleWaveformChange}
                    onPresetSelect={handlePresetSelect}
                    isPlaying={isPlaying}
                  />
                </CollapsibleSection>

                {/* Harmonic Editor - Collapsed by default */}
                <CollapsibleSection title="Harmonics" defaultExpanded={false} badge="16 partials">
                  <HarmonicEditor
                    harmonics={harmonics}
                    onHarmonicsChange={handleHarmonicsChange}
                  />
                </CollapsibleSection>
              </div>

              {/* Right column */}
              <div className="space-y-3 sm:space-y-4">
                {/* Scale Selector - Expanded by default */}
                <CollapsibleSection title="Scale & Key" defaultExpanded={true} badge={scaleLock ? 'locked' : 'free'}>
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

                {/* Envelope - Expanded by default */}
                <CollapsibleSection title="Envelope (ADSR)" defaultExpanded={true}>
                  <EnvelopeEditor
                    attack={attack}
                    decay={decay}
                    sustain={sustain}
                    release={release}
                    onChange={handleEnvelopeChange}
                  />
                </CollapsibleSection>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Piano - Fixed at bottom, full width */}
      <div className="shrink-0 border-t border-[#2a2a2a] bg-[#0a0a0a] px-2 md:px-4 py-2 safe-bottom">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 md:gap-4">
            <h3 className="text-xs md:text-sm font-medium text-[#ededed] hidden md:block">Piano</h3>
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
          </div>
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
        
        {/* Full-width piano container */}
        <div className="w-full overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
          <div className="min-w-fit flex justify-center">
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
      </div>
    </div>
  );
}
