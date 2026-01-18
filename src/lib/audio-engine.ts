import * as Tone from 'tone';

export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom';

export interface AudioEngineState {
  isPlaying: boolean;
  waveform: Float32Array;
  harmonics: number[];
  filterCutoff: number;
  filterResonance: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

const WAVEFORM_SIZE = 256;

export class AudioEngine {
  private synth: Tone.Synth | null = null;
  private customOscillator: Tone.ToneOscillatorNode | null = null;
  private periodicWave: PeriodicWave | null = null;
  private filter: Tone.Filter | null = null;
  private reverb: Tone.Reverb | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private distortion: Tone.Distortion | null = null;
  private analyser: Tone.Analyser | null = null;
  private recorder: Tone.Recorder | null = null;
  private isInitialized = false;
  private isRecording = false;
  private currentWaveform: Float32Array;
  private harmonics: number[];
  
  constructor() {
    this.currentWaveform = this.generateSineWave();
    this.harmonics = new Array(16).fill(0);
    this.harmonics[0] = 1; // Fundamental
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    await Tone.start();
    
    // Create effects chain
    this.filter = new Tone.Filter({
      frequency: 5000,
      type: 'lowpass',
      rolloff: -24,
      Q: 1,
    });
    
    this.distortion = new Tone.Distortion({
      distortion: 0,
      wet: 0,
    });
    
    this.delay = new Tone.FeedbackDelay({
      delayTime: 0.25,
      feedback: 0.3,
      wet: 0,
    });
    
    this.reverb = new Tone.Reverb({
      decay: 2,
      wet: 0.2,
    });
    
    // Create analyser for visualization (waveform)
    this.analyser = new Tone.Analyser('waveform', 256);
    
    // Create recorder for recording
    this.recorder = new Tone.Recorder();
    
    // Create synth with custom oscillator support
    this.synth = new Tone.Synth({
      oscillator: {
        type: 'sine',
      },
      envelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.5,
        release: 0.5,
      },
    });
    
    // Connect chain: synth -> filter -> distortion -> delay -> reverb -> analyser -> recorder -> output
    this.synth.chain(this.filter, this.distortion, this.delay, this.reverb, this.analyser, Tone.getDestination());
    this.analyser.connect(this.recorder);
    
    this.isInitialized = true;
  }

  generateSineWave(): Float32Array {
    const wave = new Float32Array(WAVEFORM_SIZE);
    for (let i = 0; i < WAVEFORM_SIZE; i++) {
      wave[i] = Math.sin((i / WAVEFORM_SIZE) * Math.PI * 2);
    }
    return wave;
  }

  generateSquareWave(): Float32Array {
    const wave = new Float32Array(WAVEFORM_SIZE);
    for (let i = 0; i < WAVEFORM_SIZE; i++) {
      wave[i] = i < WAVEFORM_SIZE / 2 ? 1 : -1;
    }
    return wave;
  }

  generateSawtoothWave(): Float32Array {
    const wave = new Float32Array(WAVEFORM_SIZE);
    for (let i = 0; i < WAVEFORM_SIZE; i++) {
      wave[i] = 2 * (i / WAVEFORM_SIZE) - 1;
    }
    return wave;
  }

  generateTriangleWave(): Float32Array {
    const wave = new Float32Array(WAVEFORM_SIZE);
    for (let i = 0; i < WAVEFORM_SIZE; i++) {
      const t = i / WAVEFORM_SIZE;
      wave[i] = t < 0.5 ? 4 * t - 1 : 3 - 4 * t;
    }
    return wave;
  }

  generateNoiseWave(): Float32Array {
    const wave = new Float32Array(WAVEFORM_SIZE);
    for (let i = 0; i < WAVEFORM_SIZE; i++) {
      wave[i] = Math.random() * 2 - 1;
    }
    return wave;
  }

  waveformFromHarmonics(harmonics: number[]): Float32Array {
    const wave = new Float32Array(WAVEFORM_SIZE);
    
    for (let i = 0; i < WAVEFORM_SIZE; i++) {
      let value = 0;
      for (let h = 0; h < harmonics.length; h++) {
        if (harmonics[h] > 0) {
          value += harmonics[h] * Math.sin((i / WAVEFORM_SIZE) * Math.PI * 2 * (h + 1));
        }
      }
      wave[i] = value;
    }
    
    // Normalize
    const max = Math.max(...Array.from(wave).map(Math.abs));
    if (max > 0) {
      for (let i = 0; i < WAVEFORM_SIZE; i++) {
        wave[i] /= max;
      }
    }
    
    return wave;
  }

  harmonicsFromWaveform(waveform: Float32Array): number[] {
    const harmonics: number[] = [];
    const N = waveform.length;
    
    // Simple DFT to extract first 16 harmonics
    for (let k = 1; k <= 16; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        real += waveform[n] * Math.cos(angle);
        imag -= waveform[n] * Math.sin(angle);
      }
      
      const magnitude = Math.sqrt(real * real + imag * imag) / (N / 2);
      harmonics.push(Math.min(1, magnitude));
    }
    
    // Normalize
    const max = Math.max(...harmonics);
    if (max > 0) {
      for (let i = 0; i < harmonics.length; i++) {
        harmonics[i] /= max;
      }
    }
    
    return harmonics;
  }

  setWaveform(waveform: Float32Array): void {
    this.currentWaveform = waveform;
    this.harmonics = this.harmonicsFromWaveform(waveform);
    this.updateOscillatorWaveform();
  }

  setHarmonics(harmonics: number[]): void {
    this.harmonics = harmonics;
    this.currentWaveform = this.waveformFromHarmonics(harmonics);
    this.updateOscillatorWaveform();
  }

  private updateOscillatorWaveform(): void {
    if (!this.synth || !this.isInitialized) return;
    
    // Create PeriodicWave from harmonics
    const real = new Float32Array(this.harmonics.length + 1);
    const imag = new Float32Array(this.harmonics.length + 1);
    
    real[0] = 0; // DC offset
    imag[0] = 0;
    
    for (let i = 0; i < this.harmonics.length; i++) {
      real[i + 1] = 0;
      imag[i + 1] = -this.harmonics[i]; // Sine components
    }
    
    try {
      const audioContext = Tone.getContext().rawContext as AudioContext;
      this.periodicWave = audioContext.createPeriodicWave(real, imag, { disableNormalization: false });
      
      // Update synth oscillator type to custom
      if (this.synth.oscillator) {
        // Tone.js doesn't directly support PeriodicWave, so we'll use partials
        const partials = this.harmonics.slice(0, 8); // Limit for performance
        this.synth.oscillator.type = 'custom';
        this.synth.oscillator.partials = partials;
      }
    } catch (e) {
      console.warn('Could not update oscillator waveform:', e);
    }
  }

  setPresetWaveform(type: WaveformType): void {
    switch (type) {
      case 'sine':
        this.currentWaveform = this.generateSineWave();
        if (this.synth) this.synth.oscillator.type = 'sine';
        break;
      case 'square':
        this.currentWaveform = this.generateSquareWave();
        if (this.synth) this.synth.oscillator.type = 'square';
        break;
      case 'sawtooth':
        this.currentWaveform = this.generateSawtoothWave();
        if (this.synth) this.synth.oscillator.type = 'sawtooth';
        break;
      case 'triangle':
        this.currentWaveform = this.generateTriangleWave();
        if (this.synth) this.synth.oscillator.type = 'triangle';
        break;
      case 'custom':
        this.updateOscillatorWaveform();
        break;
    }
    this.harmonics = this.harmonicsFromWaveform(this.currentWaveform);
  }

  getWaveform(): Float32Array {
    return this.currentWaveform;
  }

  getHarmonics(): number[] {
    return this.harmonics;
  }

  setFilter(cutoff: number, resonance: number): void {
    if (!this.filter) return;
    this.filter.frequency.value = cutoff;
    this.filter.Q.value = resonance;
  }

  setEnvelope(attack: number, decay: number, sustain: number, release: number): void {
    if (!this.synth) return;
    this.synth.envelope.attack = attack;
    this.synth.envelope.decay = decay;
    this.synth.envelope.sustain = sustain;
    this.synth.envelope.release = release;
  }

  setDistortion(amount: number): void {
    if (!this.distortion) return;
    this.distortion.distortion = amount;
    this.distortion.wet.value = amount > 0 ? 1 : 0;
  }

  setDelay(time: number, feedback: number, wet: number): void {
    if (!this.delay) return;
    this.delay.delayTime.value = time;
    this.delay.feedback.value = feedback;
    this.delay.wet.value = wet;
  }

  setReverb(decay: number, wet: number): void {
    if (!this.reverb) return;
    this.reverb.decay = decay;
    this.reverb.wet.value = wet;
  }

  playNote(note: string, duration?: string): void {
    if (!this.synth || !this.isInitialized) return;
    
    if (duration) {
      this.synth.triggerAttackRelease(note, duration);
    } else {
      this.synth.triggerAttack(note);
    }
  }

  stopNote(): void {
    if (!this.synth) return;
    this.synth.triggerRelease();
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getAnalyserData(): Float32Array {
    if (!this.analyser) return new Float32Array(256);
    return this.analyser.getValue() as Float32Array;
  }

  getAnalyser(): Tone.Analyser | null {
    return this.analyser;
  }

  async startRecording(): Promise<void> {
    if (!this.recorder || this.isRecording) return;
    await this.recorder.start();
    this.isRecording = true;
  }

  async stopRecording(): Promise<Blob | null> {
    if (!this.recorder || !this.isRecording) return null;
    this.isRecording = false;
    const recording = await this.recorder.stop();
    return recording;
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  dispose(): void {
    this.synth?.dispose();
    this.filter?.dispose();
    this.distortion?.dispose();
    this.delay?.dispose();
    this.reverb?.dispose();
    this.analyser?.dispose();
    this.recorder?.dispose();
    this.isInitialized = false;
  }
}

// Singleton instance
let audioEngineInstance: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!audioEngineInstance) {
    audioEngineInstance = new AudioEngine();
  }
  return audioEngineInstance;
}
