'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { WaveCanvas } from '@/components/WaveCanvas';
import { HarmonicEditor } from '@/components/HarmonicEditor';
import { Piano } from '@/components/Piano';
import { EnvelopeEditor } from '@/components/EnvelopeEditor';
import { ScaleSelector } from '@/components/ScaleSelector';
import { FilterEditor } from '@/components/FilterEditor';
import { LiveVisualizer } from '@/components/LiveVisualizer';
import { LooperPanel } from '@/components/LooperPanel';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useLooper } from '@/hooks/useLooper';
import { useMIDI } from '@/hooks/useMIDI';
import { NoteName } from '@/lib/music-theory';
import { WaveformType } from '@/lib/audio-engine';

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
    setFilter,
    setEnvelope,
    getAnalyserData,
    getOutputGain,
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
  const [filterCutoff, setFilterCutoff] = useState(5000);
  const [filterResonance, setFilterResonance] = useState(1);
  const [showKeyboardOverlay, setShowKeyboardOverlay] = useState(true);
  const [midiActiveNotes, setMidiActiveNotes] = useState<Set<string>>(new Set());
  
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

  const handleFilterChange = useCallback((cutoff: number, resonance: number) => {
    setFilterCutoff(cutoff);
    setFilterResonance(resonance);
    setFilter(cutoff, resonance);
  }, [setFilter]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-4 tracking-tighter">
            <span className="text-[#00ffff]">Y</span>
            <span className="text-[#ff6b35]">X</span>
            <span className="text-[#00ff88]">Z</span>
          </h1>
          <p className="text-[#666] mb-8 text-lg">Create. Publish. Remix.</p>
          <button
            onClick={handleInit}
            className="px-8 py-4 bg-[#00ffff] text-black font-medium rounded-lg hover:bg-[#00cccc] transition-colors text-lg"
          >
            Start Making Music
          </button>
          <p className="text-[#444] text-sm mt-4">Click to enable audio</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#ededed] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-6 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tighter">
            <span className="text-[#00ffff]">Y</span>
            <span className="text-[#ff6b35]">X</span>
            <span className="text-[#00ff88]">Z</span>
          </h1>
          <span className="text-xs text-[#666] font-mono">Wave Lab</span>
        </div>
        <div className="flex items-center gap-4">
          {/* MIDI Status */}
          {midiSupported && (
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${midiConnected ? 'bg-[#00ff88]' : 'bg-[#444]'}`} />
              <select
                value={activeDevice || ''}
                onChange={(e) => e.target.value && connectToDevice(e.target.value)}
                className="bg-[#1a1a1a] text-xs text-[#888] border border-[#2a2a2a] rounded px-2 py-1"
              >
                <option value="">MIDI: {midiDevices.length === 0 ? 'No devices' : 'Select device'}</option>
                {midiDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Keyboard shortcuts hint */}
          <div className="text-[10px] text-[#555] font-mono">
            <span className="text-[#666]">Space</span> play/stop
            <span className="mx-2">|</span>
            <span className="text-[#666]">R</span> record
          </div>
        </div>
      </header>

      {/* Live Visualizer - Compact */}
      <div className="shrink-0 px-4 py-2 border-b border-[#2a2a2a]">
        <LiveVisualizer
          getAnalyserData={getAnalyserData}
          isPlaying={isPlaying || looper.isPlaying}
          isRecording={looper.isRecording}
          height={40}
        />
      </div>

      {/* Main content - scrollable */}
      <main className="flex-1 overflow-y-auto p-4">
        {/* Looper Panel - Collapsible */}
        {looper.isInitialized && (
          <div className="mb-4">
            <CollapsibleSection title="Looper" defaultExpanded={true} badge={`${looper.bpm} BPM`}>
              <div className="p-3">
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
                />
              </div>
            </CollapsibleSection>
          </div>
        )}

        {/* Sound Design Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left column */}
          <div className="space-y-4">
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
          <div className="space-y-4">
            {/* Scale Selector - Expanded by default */}
            <CollapsibleSection title="Scale & Key" defaultExpanded={true} badge={scaleLock ? 'locked' : 'free'}>
              <div className="p-3">
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

            {/* Filter - Collapsed by default */}
            <CollapsibleSection title="Filter" defaultExpanded={false} badge={`${Math.round(filterCutoff)}Hz`}>
              <FilterEditor
                cutoff={filterCutoff}
                resonance={filterResonance}
                onChange={handleFilterChange}
              />
            </CollapsibleSection>
          </div>
        </div>
      </main>

      {/* Piano - Fixed at bottom, full width */}
      <div className="shrink-0 border-t border-[#2a2a2a] bg-[#0a0a0a] px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-medium text-[#ededed]">Piano</h3>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setOctave(Math.max(1, octave - 1))}
                className="w-6 h-6 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] transition-colors text-xs border border-[#2a2a2a]"
                title="Octave down (↓)"
              >
                ▼
              </button>
              <span className="text-xs text-[#ededed] font-mono w-14 text-center">Oct {octave}</span>
              <button 
                onClick={() => setOctave(Math.min(7, octave + 1))}
                className="w-6 h-6 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] transition-colors text-xs border border-[#2a2a2a]"
                title="Octave up (↑)"
              >
                ▲
              </button>
              <span className="text-[10px] text-[#555] ml-1 font-mono">(↑/↓)</span>
            </div>
            {midiConnected && (
              <span className="text-xs text-[#00ff88] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
                MIDI
              </span>
            )}
          </div>
          <button
            onClick={() => setShowKeyboardOverlay(!showKeyboardOverlay)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              showKeyboardOverlay
                ? 'bg-[#00ffff] text-black'
                : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] border border-[#2a2a2a]'
            }`}
          >
            {showKeyboardOverlay ? '⌨️ ON' : '⌨️ Keys'}
          </button>
        </div>
        
        {/* Full-width piano container */}
        <div className="w-full overflow-x-auto">
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
