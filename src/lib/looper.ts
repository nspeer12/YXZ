import * as Tone from 'tone';

export interface NoteEvent {
  note: string;
  startTime: number; // 0-1 position in loop
  duration: number;  // duration as fraction of loop
  velocity: number;
}

export interface LoopTrack {
  id: string;
  name: string;
  buffer: Tone.ToneAudioBuffer | null;
  player: Tone.Player | null;
  isRecording: boolean;
  isMuted: boolean;
  isSolo: boolean;
  volume: number;
  color: string;
  noteEvents: NoteEvent[];
}

export interface LooperState {
  isPlaying: boolean;
  isRecording: boolean;
  bpm: number;
  bars: number;
  beatsPerBar: number;
  currentBeat: number;
  loopEnabled: boolean;
  metronomeEnabled: boolean;
  tracks: LoopTrack[];
}

const TRACK_COLORS = [
  '#00ffff', // cyan
  '#ff6b35', // orange
  '#00ff88', // green
  '#ff00ff', // magenta
  '#ffff00', // yellow
  '#00aaff', // blue
  '#ff4444', // red
  '#aa00ff', // purple
];

export class Looper {
  private bpm: number = 120;
  private bars: number = 4;
  private beatsPerBar: number = 4;
  private isPlaying: boolean = false;
  private isRecording: boolean = false;
  private loopEnabled: boolean = true;
  private metronomeEnabled: boolean = true;
  private tracks: LoopTrack[] = [];
  private recorder: Tone.Recorder | null = null;
  private metronome: Tone.MembraneSynth | null = null;
  private metronomeAccent: Tone.MembraneSynth | null = null;
  private transport: typeof Tone.Transport = Tone.Transport;
  private currentBeat: number = 0;
  private beatCallback: ((beat: number) => void) | null = null;
  private stateCallback: ((state: LooperState) => void) | null = null;
  private recordingTrackId: string | null = null;
  private recordingStartPosition: number = 0;
  private inputNode: Tone.Gain | null = null;
  private outputNode: Tone.ToneAudioNode | null = null;
  private currentNoteStart: number | null = null;
  private currentNote: string | null = null;
  private pendingRecordStop: boolean = false;

  constructor() {
    this.tracks = [];
  }

  private metronomeEventId: number | null = null;

  async init(inputNode: Tone.Gain, outputNode?: Tone.ToneAudioNode): Promise<void> {
    this.inputNode = inputNode;
    // Use the same node for output so playback goes through the analyser
    this.outputNode = outputNode || inputNode;
    
    // Reduce latency for tighter sync
    const context = Tone.getContext();
    context.lookAhead = 0.01; // Reduce lookAhead for tighter visual sync
    
    // Create metronome sounds
    this.metronome = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    }).toDestination();
    this.metronome.volume.value = -10;

    this.metronomeAccent = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
    }).toDestination();
    this.metronomeAccent.volume.value = -6;

    // Create recorder for capturing input
    this.recorder = new Tone.Recorder();
    if (this.inputNode) {
      this.inputNode.connect(this.recorder);
    }

    // Setup transport
    this.transport.bpm.value = this.bpm;
    this.transport.loop = true;
    this.transport.loopStart = 0;
    this.updateLoopLength();

    // Schedule metronome and beat tracking
    this.scheduleMetronome();

    // Add initial empty track
    this.addTrack();
  }

  private getSubdivision(): Tone.Unit.Time {
    // Map beatsPerBar to Tone.js subdivision
    switch (this.beatsPerBar) {
      case 4: return '4n';   // Quarter notes
      case 8: return '8n';   // Eighth notes
      case 12: return '8t';  // Triplet eighths
      case 16: return '16n'; // Sixteenth notes
      default: return '4n';
    }
  }

  private scheduleMetronome(): void {
    // Clear existing schedule if any
    if (this.metronomeEventId !== null) {
      this.transport.clear(this.metronomeEventId);
    }

    const subdivision = this.getSubdivision();
    let beatCounter = 0;

    this.metronomeEventId = this.transport.scheduleRepeat((time) => {
      // Calculate which beat we're on within the bar
      const beatInBar = beatCounter % this.beatsPerBar;
      const barNumber = Math.floor(beatCounter / this.beatsPerBar);
      
      this.currentBeat = beatCounter;
      
      if (this.beatCallback) {
        Tone.Draw.schedule(() => {
          this.beatCallback!(beatCounter);
        }, time);
      }

      if (this.metronomeEnabled && this.isPlaying) {
        if (beatInBar === 0) {
          // Downbeat accent
          this.metronomeAccent?.triggerAttackRelease('C2', '16n', time);
        } else {
          // Regular beat
          this.metronome?.triggerAttackRelease('C3', '32n', time);
        }
      }

      beatCounter++;
      
      // Reset counter when loop restarts
      const totalBeats = this.bars * this.beatsPerBar;
      if (beatCounter >= totalBeats) {
        beatCounter = 0;
      }
    }, subdivision);
  }

  private updateLoopLength(): void {
    // Calculate loop end based on bars and beats per bar
    // Tone.js uses bars:quarters:sixteenths format
    this.transport.loopEnd = `${this.bars}:0:0`;
  }

  // Called when a note starts playing (for tracking note events)
  noteOn(note: string): void {
    if (!this.isRecording || !this.recordingTrackId) return;
    
    this.currentNote = note;
    this.currentNoteStart = this.getCurrentPosition();
  }

  // Called when a note stops playing
  noteOff(): void {
    if (!this.isRecording || !this.recordingTrackId || !this.currentNote || this.currentNoteStart === null) return;
    
    const track = this.tracks.find(t => t.id === this.recordingTrackId);
    if (!track) return;
    
    const endPosition = this.getCurrentPosition();
    let duration = endPosition - this.currentNoteStart;
    
    // Handle wrap-around (note started near end and ended at beginning)
    if (duration < 0) {
      duration = (1 - this.currentNoteStart) + endPosition;
    }
    
    // Minimum duration for visibility
    duration = Math.max(0.01, duration);
    
    track.noteEvents.push({
      note: this.currentNote,
      startTime: this.currentNoteStart,
      duration: duration,
      velocity: 0.8,
    });
    
    this.currentNote = null;
    this.currentNoteStart = null;
    this.notifyStateChange();
  }

  private notifyStateChange(): void {
    if (this.stateCallback) {
      this.stateCallback(this.getState());
    }
  }

  getState(): LooperState {
    return {
      isPlaying: this.isPlaying,
      isRecording: this.isRecording,
      bpm: this.bpm,
      bars: this.bars,
      beatsPerBar: this.beatsPerBar,
      currentBeat: this.currentBeat,
      loopEnabled: this.loopEnabled,
      metronomeEnabled: this.metronomeEnabled,
      tracks: [...this.tracks],
    };
  }

  onBeat(callback: (beat: number) => void): void {
    this.beatCallback = callback;
  }

  onStateChange(callback: (state: LooperState) => void): void {
    this.stateCallback = callback;
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(40, Math.min(240, bpm));
    this.transport.bpm.value = this.bpm;
    this.notifyStateChange();
  }

  setBars(bars: number): void {
    this.bars = Math.max(1, Math.min(16, bars));
    this.updateLoopLength();
    this.notifyStateChange();
  }

  setBeatsPerBar(beats: number): void {
    // Allow 4, 8, 12, 16 beats per bar
    const validBeats = [4, 8, 12, 16];
    if (validBeats.includes(beats)) {
      this.beatsPerBar = beats;
      this.updateLoopLength();
      // Reschedule metronome with new subdivision
      this.scheduleMetronome();
      this.notifyStateChange();
    }
  }

  setMetronomeEnabled(enabled: boolean): void {
    this.metronomeEnabled = enabled;
    this.notifyStateChange();
  }

  setLoopEnabled(enabled: boolean): void {
    this.loopEnabled = enabled;
    this.transport.loop = enabled;
    this.notifyStateChange();
  }

  addTrack(): LoopTrack {
    const id = `track-${Date.now()}`;
    const track: LoopTrack = {
      id,
      name: `Track ${this.tracks.length + 1}`,
      buffer: null,
      player: null,
      isRecording: false,
      isMuted: false,
      isSolo: false,
      volume: 0,
      color: TRACK_COLORS[this.tracks.length % TRACK_COLORS.length],
      noteEvents: [],
    };
    this.tracks.push(track);
    this.notifyStateChange();
    return track;
  }

  removeTrack(trackId: string): void {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.player?.stop();
      track.player?.dispose();
    }
    this.tracks = this.tracks.filter(t => t.id !== trackId);
    this.notifyStateChange();
  }

  setTrackVolume(trackId: string, volume: number): void {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.volume = volume;
      if (track.player) {
        track.player.volume.value = volume;
      }
      this.notifyStateChange();
    }
  }

  setTrackMuted(trackId: string, muted: boolean): void {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.isMuted = muted;
      if (track.player) {
        track.player.mute = muted;
      }
      this.notifyStateChange();
    }
  }

  setTrackSolo(trackId: string, solo: boolean): void {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.isSolo = solo;
      this.updateSoloStates();
      this.notifyStateChange();
    }
  }

  private updateSoloStates(): void {
    const hasSolo = this.tracks.some(t => t.isSolo);
    this.tracks.forEach(track => {
      if (track.player) {
        if (hasSolo) {
          track.player.mute = !track.isSolo && !track.isMuted;
        } else {
          track.player.mute = track.isMuted;
        }
      }
    });
  }

  play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    
    // Sync all track players before starting transport
    this.tracks.forEach(track => {
      if (track.player && track.buffer) {
        try {
          track.player.unsync();
          track.player.sync().start(0);
        } catch (e) {
          console.warn('Error syncing track player:', e);
        }
      }
    });
    
    // Start transport
    this.transport.start();
    
    this.notifyStateChange();
  }

  pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.transport.pause();
    this.notifyStateChange();
  }

  stop(): void {
    if (this.isRecording) {
      this.stopRecording();
    }
    
    this.isPlaying = false;
    this.transport.stop();
    this.transport.position = 0;
    this.currentBeat = 0;
    
    // Stop all players
    this.tracks.forEach(track => {
      if (track.player) {
        try {
          track.player.unsync();
          track.player.stop();
        } catch (e) {
          // Player may not be started
        }
      }
    });
    
    // Reschedule metronome to reset beat counter
    this.scheduleMetronome();
    
    this.notifyStateChange();
  }

  seekTo(position: number): void {
    // Position is 0-1 representing loop position
    const wasPlaying = this.isPlaying;
    
    // Calculate the time position based on loop length
    const loopDuration = this.getLoopDuration();
    const timePosition = position * loopDuration;
    
    // Convert to bars:beats:sixteenths format
    const totalBeats = this.bars * 4; // Tone.js uses 4/4 time internally
    const beatPosition = position * totalBeats;
    const barNum = Math.floor(beatPosition / 4);
    const beatNum = beatPosition % 4;
    
    // Stop transport temporarily for clean seek
    if (wasPlaying) {
      this.transport.pause();
    }
    
    // Set position
    this.transport.position = `${barNum}:${beatNum}:0`;
    
    // Update current beat for UI
    this.currentBeat = Math.floor(position * this.bars * this.beatsPerBar);
    
    // Restart players at new position if was playing
    if (wasPlaying) {
      this.tracks.forEach(track => {
        if (track.player && track.buffer) {
          try {
            track.player.unsync();
            // Start player at the correct offset within the loop
            const offset = position * loopDuration;
            track.player.sync().start(0, offset);
          } catch (e) {
            console.warn('Error seeking track player:', e);
          }
        }
      });
      this.transport.start();
    }
    
    this.notifyStateChange();
  }

  async startRecording(trackId?: string): Promise<void> {
    if (this.isRecording || !this.recorder) return;

    // Find or create track to record to
    let track: LoopTrack | undefined;
    if (trackId) {
      track = this.tracks.find(t => t.id === trackId);
    } else {
      // Find first empty track or create new one
      track = this.tracks.find(t => !t.buffer);
      if (!track) {
        track = this.addTrack();
      }
    }

    if (!track) return;

    this.recordingTrackId = track.id;
    track.isRecording = true;
    this.isRecording = true;

    // Reset to beginning of loop for clean alignment
    // This ensures the recording starts at position 0
    if (this.isPlaying) {
      this.transport.position = 0;
    }
    this.recordingStartPosition = 0;

    // Start recording
    await this.recorder.start();

    // Auto-start playback if not already playing
    if (!this.isPlaying) {
      this.play();
    }

    this.notifyStateChange();
  }

  async stopRecording(): Promise<void> {
    if (!this.isRecording || !this.recorder || !this.recordingTrackId) return;

    const track = this.tracks.find(t => t.id === this.recordingTrackId);
    if (!track) return;

    // Stop recording and get the blob
    const blob = await this.recorder.stop();
    track.isRecording = false;
    this.isRecording = false;

    // Check if we got any audio data
    if (blob.size === 0) {
      console.warn('Recording produced empty blob');
      this.recordingTrackId = null;
      this.recordingStartPosition = 0;
      this.notifyStateChange();
      return;
    }

    // Create player for this track using blob URL
    if (track.player) {
      track.player.dispose();
    }
    
    // Calculate loop length based on bars (using 4/4 time)
    const loopDuration = this.getLoopDuration();
    
    // Create a blob URL for the recorded audio
    const blobUrl = URL.createObjectURL(blob);
    
    try {
      // Create player directly from blob URL
      track.player = new Tone.Player({
        url: blobUrl,
        loop: true,
        loopStart: 0,
        loopEnd: loopDuration,
        onload: () => {
          // Store the buffer reference after loading
          if (track.player) {
            track.buffer = track.player.buffer;
          }
          this.notifyStateChange();
        },
        onerror: (err) => {
          console.error('Error loading recorded audio:', err);
        }
      });
      
      // Connect to output node (goes through analyser) or fallback to destination
      if (this.outputNode) {
        track.player.connect(this.outputNode);
      } else {
        track.player.toDestination();
      }
      
      track.player.volume.value = track.volume;

      // Wait for the player to load
      await new Promise<void>((resolve, reject) => {
        if (!track.player) {
          reject(new Error('Player not created'));
          return;
        }
        
        // Check if already loaded
        if (track.player.loaded) {
          resolve();
          return;
        }
        
        // Set up load handlers
        const checkLoaded = setInterval(() => {
          if (track.player?.loaded) {
            clearInterval(checkLoaded);
            resolve();
          }
        }, 50);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkLoaded);
          if (track.player?.loaded) {
            resolve();
          } else {
            reject(new Error('Timeout loading audio'));
          }
        }, 5000);
      });

      // If still playing, sync and start the new track
      if (this.isPlaying && track.player.loaded) {
        track.player.sync().start(0);
      }
    } catch (err) {
      console.error('Failed to create player from recording:', err);
    }

    this.recordingTrackId = null;
    this.recordingStartPosition = 0;
    this.notifyStateChange();
  }

  clearTrack(trackId: string): void {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      if (track.player) {
        track.player.stop();
        track.player.dispose();
        track.player = null;
      }
      track.buffer = null;
      track.noteEvents = [];
      this.notifyStateChange();
    }
  }

  clearAllTracks(): void {
    this.tracks.forEach(track => {
      if (track.player) {
        track.player.stop();
        track.player.dispose();
        track.player = null;
      }
      track.buffer = null;
      track.noteEvents = [];
    });
    this.notifyStateChange();
  }

  tapTempo(): number {
    // Simple tap tempo - would need to track multiple taps for accuracy
    // For now, just return current BPM
    return this.bpm;
  }

  getLoopDuration(): number {
    // Loop duration is based on bars * 4 beats per bar (standard 4/4 time in Tone.js)
    return (60 / this.bpm) * 4 * this.bars;
  }

  getTotalBeats(): number {
    return this.bars * this.beatsPerBar;
  }

  getCurrentPosition(): number {
    // Use transport.progress for accurate loop position (0-1)
    // This works even when paused (maintains position)
    const progress = this.transport.progress;
    return typeof progress === 'number' ? progress : 0;
  }

  dispose(): void {
    this.stop();
    this.tracks.forEach(track => {
      track.player?.dispose();
    });
    this.metronome?.dispose();
    this.metronomeAccent?.dispose();
    this.recorder?.dispose();
  }
}

// Singleton instance
let looperInstance: Looper | null = null;

export function getLooper(): Looper {
  if (!looperInstance) {
    looperInstance = new Looper();
  }
  return looperInstance;
}
