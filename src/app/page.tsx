'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { WaveCanvas } from '@/components/WaveCanvas';
import { HarmonicEditor } from '@/components/HarmonicEditor';
import { Piano } from '@/components/Piano';
import { EnvelopeEditor } from '@/components/EnvelopeEditor';
import { ScaleSelector } from '@/components/ScaleSelector';
import { FilterEditor } from '@/components/FilterEditor';
import { LiveVisualizer } from '@/components/LiveVisualizer';
import { RecordingControls } from '@/components/RecordingControls';
import { useAudioEngine } from '@/hooks/useAudioEngine';
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
    isRecording,
    recordingUrl,
    startRecording,
    stopRecording,
    downloadRecording,
    clearRecording,
  } = useAudioEngine();

  const [isPlaying, setIsPlaying] = useState(false);
  const [scaleLock, setScaleLock] = useState(true);
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleInit = async () => {
    await init();
  };

  const handleNoteOn = useCallback((note: string) => {
    if (!isReady) return;
    setIsPlaying(true);
    playNote(note);
  }, [isReady, playNote]);

  const handleNoteOff = useCallback(() => {
    setIsPlaying(false);
    stopNote();
  }, [stopNote]);

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
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tighter">
            <span className="text-[#00ffff]">Y</span>
            <span className="text-[#ff6b35]">X</span>
            <span className="text-[#00ff88]">Z</span>
          </h1>
          <span className="text-xs text-[#666] font-mono">Wave Lab</span>
          
          {/* Recording controls */}
          <div className="ml-4 border-l border-[#2a2a2a] pl-4">
            <RecordingControls
              isRecording={isRecording}
              recordingUrl={recordingUrl}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onDownload={downloadRecording}
              onClear={clearRecording}
            />
          </div>
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
          
        </div>
      </header>

      {/* Live Visualizer - Always visible */}
      <div className="shrink-0 px-6 py-3 border-b border-[#2a2a2a]">
        <LiveVisualizer
          getAnalyserData={getAnalyserData}
          isPlaying={isPlaying}
          isRecording={isRecording}
          height={60}
        />
      </div>

      {/* Main content - scrollable */}
      <main className="flex-1 overflow-y-auto p-6 pb-4">
        {/* Scale Selector - Full width */}
        <div className="mb-6">
          <ScaleSelector
            rootNote={rootNote}
            scaleName={scaleName}
            scaleLock={scaleLock}
            onRootChange={setRootNote}
            onScaleChange={setScaleName}
            onScaleLockChange={setScaleLock}
          />
        </div>

        {/* Sound Design - All visible, responsive grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Wave Shape & Harmonics */}
          <div className="lg:col-span-2 space-y-6">
            <WaveCanvas
              waveform={waveform}
              onWaveformChange={handleWaveformChange}
              onPresetSelect={handlePresetSelect}
              isPlaying={isPlaying}
            />
            <HarmonicEditor
              harmonics={harmonics}
              onHarmonicsChange={handleHarmonicsChange}
            />
          </div>

          {/* Envelope & Filter - stacked on right */}
          <div className="space-y-6">
            <EnvelopeEditor
              attack={attack}
              decay={decay}
              sustain={sustain}
              release={release}
              onChange={handleEnvelopeChange}
            />
            <FilterEditor
              cutoff={filterCutoff}
              resonance={filterResonance}
              onChange={handleFilterChange}
            />
          </div>
        </div>
      </main>

      {/* Piano - Fixed at bottom, full width */}
      <div className="shrink-0 border-t border-[#2a2a2a] bg-[#0a0a0a] px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-medium text-[#ededed]">Piano</h3>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setOctave(Math.max(1, octave - 1))}
                className="w-7 h-7 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] transition-colors text-sm border border-[#2a2a2a]"
                title="Octave down (↓)"
              >
                ▼
              </button>
              <span className="text-sm text-[#ededed] font-mono w-16 text-center">Oct {octave}</span>
              <button 
                onClick={() => setOctave(Math.min(7, octave + 1))}
                className="w-7 h-7 rounded bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] hover:text-[#00ffff] transition-colors text-sm border border-[#2a2a2a]"
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
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              showKeyboardOverlay
                ? 'bg-[#00ffff] text-black'
                : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a] border border-[#2a2a2a]'
            }`}
          >
            {showKeyboardOverlay ? '⌨️ Keys ON' : '⌨️ Show Keys'}
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
        
        {/* Keyboard hints - when overlay is off */}
        {!showKeyboardOverlay && (
          <div className="mt-2 text-center text-xs text-[#666]">
            <span>Keyboard: </span>
            <span className="font-mono">A S D F G H J K L ;</span>
            <span> (white) </span>
            <span className="font-mono">W E T Y U O P</span>
            <span> (black) </span>
            <span className="text-[#888]">|</span>
            <span> Octave: </span>
            <span className="font-mono">↑</span>
            <span>/</span>
            <span className="font-mono">↓</span>
          </div>
        )}
      </div>
    </div>
  );
}
