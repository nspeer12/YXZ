import * as Tone from 'tone';

export interface NoteEvent {
  note: string;
  startTime: number; // 0-1 position in loop
  duration: number;  // duration as fraction of loop
  velocity: number;
}

/**
 * Caller-supplied trigger used to play back MIDI tracks via whatever
 * instrument the consumer wants (the studio synth, an external sampler,
 * etc). Receives note + duration in seconds + transport `time` so it can
 * schedule sample-accurately.
 */
export type MidiTrigger = (
  note: string,
  durationSec: number,
  time: number,
  velocity: number,
) => void;

export type TrackKind = 'audio' | 'midi';

export interface LoopTrack {
  id: string;
  name: string;
  /** "audio" tracks have a `buffer`/`player`; "midi" tracks replay `noteEvents` via the registered MidiTrigger. */
  kind: TrackKind;
  buffer: Tone.ToneAudioBuffer | null;
  player: Tone.Player | null;
  isRecording: boolean;
  isMuted: boolean;
  isSolo: boolean;
  /** Record-arm: clicking the master Record button records into the armed track. */
  isArmed: boolean;
  volume: number;
  color: string;
  noteEvents: NoteEvent[];
  /**
   * Transport offset (seconds) at which this track's recording was started.
   * Used so that on every play/sync we restart the player at the same point
   * within the loop where it was originally captured — preserving the
   * timing of the performance relative to the bar grid.
   */
  startOffset: number;
  /**
   * Pre-computed waveform peaks (0..1) for audio tracks, used by the
   * timeline UI to render thumbnails. ~256 samples across the loop length.
   */
  peaks?: number[];
  /** Tone.Transport ids for any scheduled MIDI events (for cleanup). */
  scheduledIds: number[];
}

/** Compute downsampled peak amplitudes from an AudioBuffer for waveform thumbs. */
function extractPeaks(buffer: Tone.ToneAudioBuffer | AudioBuffer, numPeaks = 256): number[] {
  // Tone.ToneAudioBuffer wraps an AudioBuffer.
  const ab: AudioBuffer | null = (buffer as Tone.ToneAudioBuffer).get
    ? ((buffer as Tone.ToneAudioBuffer).get() ?? null)
    : (buffer as AudioBuffer);
  if (!ab) return [];
  const data = ab.getChannelData(0);
  const total = data.length;
  if (total === 0) return [];
  const blockSize = Math.max(1, Math.floor(total / numPeaks));
  const peaks: number[] = [];
  for (let i = 0; i < numPeaks; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, total);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(data[j]);
      if (v > peak) peak = v;
    }
    peaks.push(peak);
  }
  return peaks;
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
  /** Caller-supplied trigger for MIDI track playback (e.g. studio synth). */
  private midiTrigger: MidiTrigger | null = null;

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

  /**
   * Called when a playable note starts (from the synth/piano). If a MIDI
   * track is currently being recorded into, the event is captured. We
   * accept either: an explicit audio recording in progress with an armed
   * MIDI track, OR a standalone MIDI-armed track being recorded into
   * while transport is rolling (no audio recorder needed).
   */
  noteOn(note: string): void {
    const target = this.midiRecordingTarget();
    if (!target) return;
    this.currentNote = note;
    this.currentNoteStart = this.getCurrentPosition();
  }

  noteOff(): void {
    const target = this.midiRecordingTarget();
    if (!target || !this.currentNote || this.currentNoteStart === null) return;

    const endPosition = this.getCurrentPosition();
    let duration = endPosition - this.currentNoteStart;
    if (duration < 0) duration = 1 - this.currentNoteStart + endPosition;
    duration = Math.max(0.01, duration);

    target.noteEvents.push({
      note: this.currentNote,
      startTime: this.currentNoteStart,
      duration,
      velocity: 0.8,
    });

    this.currentNote = null;
    this.currentNoteStart = null;
    this.notifyStateChange();
  }

  /**
   * Find the track currently receiving recorded MIDI events. Priority:
   *   1. Track currently being audio-recorded (legacy behavior).
   *   2. An armed MIDI track while transport is rolling.
   */
  private midiRecordingTarget(): LoopTrack | null {
    if (this.isRecording && this.recordingTrackId) {
      return this.tracks.find((t) => t.id === this.recordingTrackId) ?? null;
    }
    if (this.isPlaying) {
      const armed = this.tracks.find((t) => t.isArmed && t.kind === 'midi');
      if (armed) return armed;
    }
    return null;
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

  addTrack(kind: TrackKind = 'audio', name?: string): LoopTrack {
    const id = `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const track: LoopTrack = {
      id,
      name: name ?? `${kind === 'midi' ? 'MIDI' : 'Audio'} ${this.tracks.length + 1}`,
      kind,
      buffer: null,
      player: null,
      isRecording: false,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      volume: 0,
      color: TRACK_COLORS[this.tracks.length % TRACK_COLORS.length],
      noteEvents: [],
      startOffset: 0,
      peaks: undefined,
      scheduledIds: [],
    };
    this.tracks.push(track);
    this.notifyStateChange();
    return track;
  }

  /** Convenience: explicit MIDI track. Triggers the registered MidiTrigger on playback. */
  addMidiTrack(name?: string): LoopTrack {
    return this.addTrack('midi', name);
  }

  /** Register an instrument trigger callback. MIDI tracks call this on playback. */
  setMidiTrigger(trigger: MidiTrigger | null): void {
    this.midiTrigger = trigger;
    // Re-schedule active MIDI tracks so they pick up the new trigger.
    if (this.isPlaying) {
      this.tracks.forEach((t) => {
        if (t.kind === 'midi' && t.noteEvents.length > 0) {
          this.scheduleMidiTrack(t);
        }
      });
    }
  }

  /** Mark a single track as armed (record target). Disarms all others. */
  armTrack(trackId: string | null): void {
    this.tracks.forEach((t) => {
      t.isArmed = t.id === trackId;
    });
    this.notifyStateChange();
  }

  private scheduleMidiTrack(track: LoopTrack): void {
    this.unscheduleMidiTrack(track);
    if (!this.midiTrigger || track.isMuted) return;
    if (this.solosActive() && !track.isSolo) return;
    if (track.noteEvents.length === 0) return;

    const loopDuration = this.getLoopDuration();
    const trigger = this.midiTrigger;

    for (const event of track.noteEvents) {
      const offsetSec = event.startTime * loopDuration;
      const durSec = Math.max(0.05, event.duration * loopDuration);
      const id = this.transport.scheduleRepeat(
        (time) => {
          trigger(event.note, durSec, time, event.velocity);
        },
        loopDuration,
        offsetSec,
      );
      track.scheduledIds.push(id);
    }
  }

  private unscheduleMidiTrack(track: LoopTrack): void {
    track.scheduledIds.forEach((id) => this.transport.clear(id));
    track.scheduledIds = [];
  }

  private solosActive(): boolean {
    return this.tracks.some((t) => t.isSolo);
  }

  /**
   * Add a new track and immediately load an existing recording (Blob) into it
   * as a looping player. Useful for moving studio "Takes" into the looper.
   */
  async addTrackFromBlob(blob: Blob, name?: string): Promise<LoopTrack> {
    const track = this.addTrack();
    if (name) {
      track.name = name;
    }

    if (blob.size === 0) {
      this.notifyStateChange();
      return track;
    }

    const loopDuration = this.getLoopDuration();
    const blobUrl = URL.createObjectURL(blob);

    try {
      track.player = new Tone.Player({
        url: blobUrl,
        loop: true,
        loopStart: 0,
        loopEnd: loopDuration,
        onload: () => {
          if (track.player) {
            track.buffer = track.player.buffer;
            track.peaks = extractPeaks(track.buffer);
          }
          this.notifyStateChange();
        },
      });

      if (this.outputNode) {
        track.player.connect(this.outputNode);
      } else {
        track.player.toDestination();
      }
      track.player.volume.value = track.volume;

      await new Promise<void>((resolve, reject) => {
        if (!track.player) {
          reject(new Error('Player not created'));
          return;
        }
        if (track.player.loaded) {
          resolve();
          return;
        }
        const checkLoaded = setInterval(() => {
          if (track.player?.loaded) {
            clearInterval(checkLoaded);
            resolve();
          }
        }, 50);
        setTimeout(() => {
          clearInterval(checkLoaded);
          if (track.player?.loaded) {
            resolve();
          } else {
            reject(new Error('Timeout loading audio'));
          }
        }, 5000);
      });

      if (this.isPlaying && track.player.loaded) {
        // Imported takes are bar-aligned, so always start at loop pos 0.
        track.player.sync().start(track.startOffset || 0);
      }
    } catch (err) {
      console.error('Failed to create player from blob:', err);
    }

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
      // MIDI tracks: re-evaluate scheduling.
      if (track.kind === 'midi' && this.isPlaying) {
        if (muted || (this.solosActive() && !track.isSolo)) {
          this.unscheduleMidiTrack(track);
        } else {
          this.scheduleMidiTrack(track);
        }
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
      if (track.kind === 'midi' && this.isPlaying) {
        const shouldPlay = !track.isMuted && (!hasSolo || track.isSolo);
        if (shouldPlay) {
          this.scheduleMidiTrack(track);
        } else {
          this.unscheduleMidiTrack(track);
        }
      }
    });
  }

  play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // Sync all track players before starting transport. Each player is
    // scheduled at its own startOffset so a track recorded mid-bar plays
    // back at the same point within the loop where it was performed.
    this.tracks.forEach(track => {
      if (track.kind === 'audio' && track.player && track.buffer) {
        try {
          track.player.unsync();
          track.player.sync().start(track.startOffset || 0);
        } catch (e) {
          console.warn('Error syncing track player:', e);
        }
      } else if (track.kind === 'midi') {
        this.scheduleMidiTrack(track);
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

    // Stop all players + clear MIDI schedules.
    this.tracks.forEach(track => {
      if (track.player) {
        try {
          track.player.unsync();
          track.player.stop();
        } catch {
          // Player may not be started
        }
      }
      if (track.kind === 'midi') {
        this.unscheduleMidiTrack(track);
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
      const playheadInLoop = position * loopDuration;
      this.tracks.forEach(track => {
        if (track.player && track.buffer) {
          try {
            track.player.unsync();
            // Compute where inside *this track's buffer* the playhead is.
            // The buffer's blob-time 0 corresponds to loop position
            // `track.startOffset`, so we offset accordingly (and wrap).
            const trackStart = track.startOffset || 0;
            const rel = ((playheadInLoop - trackStart) % loopDuration + loopDuration) % loopDuration;
            track.player.sync().start(trackStart, rel);
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

    // Resolve target track:
    //   1. Explicit trackId (caller's choice).
    //   2. Currently armed track (must be audio — MIDI tracks record via noteOn).
    //   3. First empty audio track.
    //   4. New audio track.
    let track: LoopTrack | undefined;
    if (trackId) {
      track = this.tracks.find(t => t.id === trackId);
    } else {
      const armed = this.tracks.find(t => t.isArmed && t.kind === 'audio');
      if (armed) {
        track = armed;
      } else {
        track = this.tracks.find(t => t.kind === 'audio' && !t.buffer);
        if (!track) {
          track = this.addTrack('audio');
        }
      }
    }

    if (!track || track.kind !== 'audio') return;

    this.recordingTrackId = track.id;
    track.isRecording = true;
    this.isRecording = true;

    // If not playing yet, start playback BEFORE recording so the transport
    // is rolling and the recorder captures from a known position. We start
    // from 0 in that case (no jump cost — nothing was playing).
    if (!this.isPlaying) {
      this.transport.position = 0;
      this.play();
    }

    // Capture the transport position (in seconds, modulo the loop length)
    // at the moment recording starts. The recorder's blob offset 0 will
    // correspond to this transport position; on stop we'll schedule the
    // resulting Player to begin at the same offset so the recording lands
    // exactly where it was performed within the loop.
    const loopDuration = this.getLoopDuration();
    const transportSeconds = Number(this.transport.seconds) || 0;
    // Loop is enabled — fold position into [0, loopDuration).
    this.recordingStartPosition = loopDuration > 0
      ? ((transportSeconds % loopDuration) + loopDuration) % loopDuration
      : transportSeconds;

    // Start recording. Doing this AFTER starting the transport (above)
    // means transport.seconds is non-stale and matches what the audio
    // graph is actually playing.
    await this.recorder.start();

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

    // Remember where in the loop this recording was captured. The Player
    // we create below has its own internal "loop" of [0, loopDuration],
    // so its blob-time 0 == loop position `startOffset`. We schedule
    // `sync().start(startOffset)` so the audio aligns with where the
    // user actually performed it.
    const startOffset = this.recordingStartPosition;
    track.startOffset = startOffset;

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
          // Store the buffer reference + extract waveform peaks for the timeline.
          if (track.player) {
            track.buffer = track.player.buffer;
            track.peaks = extractPeaks(track.buffer);
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

      // If still playing, sync and start the new track at the offset
      // where it was originally recorded so it lines up with the bar grid.
      if (this.isPlaying && track.player.loaded) {
        track.player.sync().start(startOffset);
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
      this.unscheduleMidiTrack(track);
      track.buffer = null;
      track.noteEvents = [];
      track.peaks = undefined;
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
      this.unscheduleMidiTrack(track);
      track.buffer = null;
      track.noteEvents = [];
      track.peaks = undefined;
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
