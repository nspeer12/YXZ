import * as Tone from 'tone';

export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom';

export type EffectType = 
  | 'filter'
  | 'distortion'
  | 'delay'
  | 'reverb'
  | 'chorus'
  | 'phaser'
  | 'tremolo'
  | 'bitcrusher'
  | 'compressor'
  | 'eq'
  | 'vibrato'
  | 'autowah'
  | 'stereoWidener'
  | 'pingPongDelay'
  | 'limiter'
  | 'autoFilter'
  | 'chebyshev';

export interface EffectParams {
  filter: { frequency: number; resonance: number; type: 'lowpass' | 'highpass' | 'bandpass' };
  distortion: { amount: number };
  delay: { time: number; feedback: number; wet: number };
  reverb: { decay: number; wet: number };
  chorus: { frequency: number; depth: number; wet: number };
  phaser: { frequency: number; octaves: number; wet: number };
  tremolo: { frequency: number; depth: number; wet: number };
  bitcrusher: { bits: number; wet: number };
  compressor: { threshold: number; ratio: number; attack: number; release: number };
  eq: { low: number; mid: number; high: number };
  vibrato: { frequency: number; depth: number; wet: number };
  autowah: { baseFrequency: number; octaves: number; sensitivity: number; wet: number };
  stereoWidener: { width: number };
  pingPongDelay: { delayTime: number; feedback: number; wet: number };
  limiter: { threshold: number };
  autoFilter: { frequency: number; depth: number; baseFrequency: number; octaves: number; wet: number };
  chebyshev: { order: number; wet: number };
}

export interface Effect<T extends EffectType = EffectType> {
  id: string;
  type: T;
  enabled: boolean;
  params: EffectParams[T];
  node: Tone.ToneAudioNode | null;
}

export const DEFAULT_EFFECT_PARAMS: EffectParams = {
  filter: { frequency: 5000, resonance: 1, type: 'lowpass' },
  distortion: { amount: 0.4 },
  delay: { time: 0.25, feedback: 0.3, wet: 0.3 },
  reverb: { decay: 2, wet: 0.3 },
  chorus: { frequency: 1.5, depth: 0.7, wet: 0.5 },
  phaser: { frequency: 0.5, octaves: 3, wet: 0.5 },
  tremolo: { frequency: 4, depth: 0.5, wet: 0.5 },
  bitcrusher: { bits: 4, wet: 0.5 },
  compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25 },
  eq: { low: 0, mid: 0, high: 0 },
  vibrato: { frequency: 5, depth: 0.1, wet: 0.5 },
  autowah: { baseFrequency: 100, octaves: 6, sensitivity: 0, wet: 0.5 },
  stereoWidener: { width: 0.5 },
  pingPongDelay: { delayTime: 0.25, feedback: 0.4, wet: 0.3 },
  limiter: { threshold: -6 },
  autoFilter: { frequency: 1, depth: 1, baseFrequency: 200, octaves: 2.6, wet: 0.5 },
  chebyshev: { order: 50, wet: 0.5 },
};

export const EFFECT_LABELS: Record<EffectType, string> = {
  filter: 'Filter',
  distortion: 'Distortion',
  delay: 'Delay',
  reverb: 'Reverb',
  chorus: 'Chorus',
  phaser: 'Phaser',
  tremolo: 'Tremolo',
  bitcrusher: 'Bitcrusher',
  compressor: 'Compressor',
  eq: 'EQ',
  vibrato: 'Vibrato',
  autowah: 'Auto-Wah',
  stereoWidener: 'Stereo Widener',
  pingPongDelay: 'Ping Pong Delay',
  limiter: 'Limiter',
  autoFilter: 'Auto Filter',
  chebyshev: 'Chebyshev',
};

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
  private analyser: Tone.Analyser | null = null;
  private fftAnalyser: Tone.Analyser | null = null;
  private recorder: Tone.Recorder | null = null;
  private outputGain: Tone.Gain | null = null;
  private isInitialized = false;
  private isRecording = false;
  private currentWaveform: Float32Array;
  private harmonics: number[];
  private effects: Effect[] = [];
  private effectsChangeListeners: (() => void)[] = [];
  
  constructor() {
    this.currentWaveform = this.generateSineWave();
    this.harmonics = new Array(16).fill(0);
    this.harmonics[0] = 1; // Fundamental
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('[AudioEngine] Starting initialization...');
    
    // Ensure audio context is started (required for mobile)
    await Tone.start();
    console.log('[AudioEngine] Tone.start() completed');
    
    // Also ensure the raw audio context is running
    const ctx = Tone.getContext().rawContext as AudioContext;
    console.log('[AudioEngine] Context state before resume:', ctx.state);
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
      console.log('[AudioEngine] Context resumed, new state:', ctx.state);
    }
    
    // Create analyser for visualization (waveform)
    this.analyser = new Tone.Analyser('waveform', 256);
    
    // Create FFT analyser for spectrum visualization
    this.fftAnalyser = new Tone.Analyser('fft', 256);
    
    // Create output gain for routing to looper
    this.outputGain = new Tone.Gain(1);
    
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
    
    // Initial connection (no effects)
    this.rebuildEffectsChain();
    this.outputGain.connect(this.recorder);
    
    this.isInitialized = true;
    
    const finalCtx = Tone.getContext().rawContext as AudioContext;
    console.log('[AudioEngine] Initialization complete, context state:', finalCtx.state);
  }

  private createEffectNode(type: EffectType, params: EffectParams[EffectType]): Tone.ToneAudioNode {
    switch (type) {
      case 'filter': {
        const p = params as EffectParams['filter'];
        return new Tone.Filter({ frequency: p.frequency, type: p.type, Q: p.resonance, rolloff: -24 });
      }
      case 'distortion': {
        const p = params as EffectParams['distortion'];
        return new Tone.Distortion({ distortion: p.amount, wet: p.amount > 0 ? 1 : 0 });
      }
      case 'delay': {
        const p = params as EffectParams['delay'];
        return new Tone.FeedbackDelay({ delayTime: p.time, feedback: p.feedback, wet: p.wet });
      }
      case 'reverb': {
        const p = params as EffectParams['reverb'];
        return new Tone.Reverb({ decay: p.decay, wet: p.wet });
      }
      case 'chorus': {
        const p = params as EffectParams['chorus'];
        return new Tone.Chorus({ frequency: p.frequency, depth: p.depth, wet: p.wet }).start();
      }
      case 'phaser': {
        const p = params as EffectParams['phaser'];
        return new Tone.Phaser({ frequency: p.frequency, octaves: p.octaves, wet: p.wet });
      }
      case 'tremolo': {
        const p = params as EffectParams['tremolo'];
        return new Tone.Tremolo({ frequency: p.frequency, depth: p.depth, wet: p.wet }).start();
      }
      case 'bitcrusher': {
        const p = params as EffectParams['bitcrusher'];
        const bitcrusher = new Tone.BitCrusher(p.bits);
        bitcrusher.wet.value = p.wet;
        return bitcrusher;
      }
      case 'compressor': {
        const p = params as EffectParams['compressor'];
        return new Tone.Compressor({ threshold: p.threshold, ratio: p.ratio, attack: p.attack, release: p.release });
      }
      case 'eq': {
        const p = params as EffectParams['eq'];
        return new Tone.EQ3({ low: p.low, mid: p.mid, high: p.high });
      }
      case 'vibrato': {
        const p = params as EffectParams['vibrato'];
        return new Tone.Vibrato({ frequency: p.frequency, depth: p.depth, wet: p.wet });
      }
      case 'autowah': {
        const p = params as EffectParams['autowah'];
        return new Tone.AutoWah({ baseFrequency: p.baseFrequency, octaves: p.octaves, sensitivity: p.sensitivity, wet: p.wet });
      }
      case 'stereoWidener': {
        const p = params as EffectParams['stereoWidener'];
        return new Tone.StereoWidener({ width: p.width });
      }
      case 'pingPongDelay': {
        const p = params as EffectParams['pingPongDelay'];
        return new Tone.PingPongDelay({ delayTime: p.delayTime, feedback: p.feedback, wet: p.wet });
      }
      case 'limiter': {
        const p = params as EffectParams['limiter'];
        return new Tone.Limiter(p.threshold);
      }
      case 'autoFilter': {
        const p = params as EffectParams['autoFilter'];
        return new Tone.AutoFilter({ frequency: p.frequency, depth: p.depth, baseFrequency: p.baseFrequency, octaves: p.octaves, wet: p.wet }).start();
      }
      case 'chebyshev': {
        const p = params as EffectParams['chebyshev'];
        const chebyshev = new Tone.Chebyshev(p.order);
        chebyshev.wet.value = p.wet;
        return chebyshev;
      }
    }
  }

  private rebuildEffectsChain(): void {
    if (!this.synth || !this.outputGain || !this.analyser) return;

    // Disconnect everything
    this.synth.disconnect();
    this.effects.forEach(effect => {
      if (effect.node) {
        effect.node.disconnect();
      }
    });
    this.outputGain.disconnect();

    // Get enabled effects in order
    const enabledEffects = this.effects.filter(e => e.enabled && e.node);

    if (enabledEffects.length === 0) {
      // Direct connection: synth -> outputGain -> analyser -> destination
      this.synth.connect(this.outputGain);
    } else {
      // Build chain: synth -> effect1 -> effect2 -> ... -> outputGain
      let lastNode: Tone.ToneAudioNode = this.synth;
      for (const effect of enabledEffects) {
        lastNode.connect(effect.node!);
        lastNode = effect.node!;
      }
      lastNode.connect(this.outputGain);
    }

    // Connect outputGain to both analysers and destination
    this.outputGain.connect(this.analyser);
    if (this.fftAnalyser) {
      this.outputGain.connect(this.fftAnalyser);
    }
    this.outputGain.connect(Tone.getDestination());
  }

  private notifyEffectsChange(): void {
    this.effectsChangeListeners.forEach(listener => listener());
  }

  onEffectsChange(listener: () => void): () => void {
    this.effectsChangeListeners.push(listener);
    return () => {
      this.effectsChangeListeners = this.effectsChangeListeners.filter(l => l !== listener);
    };
  }

  addEffect(type: EffectType, enabled: boolean = false): Effect {
    const params = { ...DEFAULT_EFFECT_PARAMS[type] };
    const node = this.createEffectNode(type, params);
    
    const effect: Effect = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      enabled,
      params,
      node,
    };
    
    this.effects.push(effect);
    this.rebuildEffectsChain();
    this.notifyEffectsChange();
    return effect;
  }

  removeEffect(id: string): void {
    const effect = this.effects.find(e => e.id === id);
    if (effect?.node) {
      effect.node.dispose();
    }
    this.effects = this.effects.filter(e => e.id !== id);
    this.rebuildEffectsChain();
    this.notifyEffectsChange();
  }

  updateEffectParams(id: string, params: Partial<EffectParams[EffectType]>): void {
    const effect = this.effects.find(e => e.id === id);
    if (!effect) return;

    effect.params = { ...effect.params, ...params };

    // Update the node parameters
    if (effect.node) {
      this.applyEffectParams(effect);
    }
  }

  private applyEffectParams(effect: Effect): void {
    if (!effect.node) return;

    switch (effect.type) {
      case 'filter': {
        const node = effect.node as Tone.Filter;
        const p = effect.params as EffectParams['filter'];
        node.frequency.value = p.frequency;
        node.Q.value = p.resonance;
        node.type = p.type;
        break;
      }
      case 'distortion': {
        const node = effect.node as Tone.Distortion;
        const p = effect.params as EffectParams['distortion'];
        node.distortion = p.amount;
        node.wet.value = p.amount > 0 ? 1 : 0;
        break;
      }
      case 'delay': {
        const node = effect.node as Tone.FeedbackDelay;
        const p = effect.params as EffectParams['delay'];
        node.delayTime.value = p.time;
        node.feedback.value = p.feedback;
        node.wet.value = p.wet;
        break;
      }
      case 'reverb': {
        const node = effect.node as Tone.Reverb;
        const p = effect.params as EffectParams['reverb'];
        node.decay = p.decay;
        node.wet.value = p.wet;
        break;
      }
      case 'chorus': {
        const node = effect.node as Tone.Chorus;
        const p = effect.params as EffectParams['chorus'];
        node.frequency.value = p.frequency;
        node.depth = p.depth;
        node.wet.value = p.wet;
        break;
      }
      case 'phaser': {
        const node = effect.node as Tone.Phaser;
        const p = effect.params as EffectParams['phaser'];
        node.frequency.value = p.frequency;
        node.octaves = p.octaves;
        node.wet.value = p.wet;
        break;
      }
      case 'tremolo': {
        const node = effect.node as Tone.Tremolo;
        const p = effect.params as EffectParams['tremolo'];
        node.frequency.value = p.frequency;
        node.depth.value = p.depth;
        node.wet.value = p.wet;
        break;
      }
      case 'bitcrusher': {
        const node = effect.node as Tone.BitCrusher;
        const p = effect.params as EffectParams['bitcrusher'];
        node.bits.value = p.bits;
        node.wet.value = p.wet;
        break;
      }
      case 'compressor': {
        const node = effect.node as Tone.Compressor;
        const p = effect.params as EffectParams['compressor'];
        node.threshold.value = p.threshold;
        node.ratio.value = p.ratio;
        node.attack.value = p.attack;
        node.release.value = p.release;
        break;
      }
      case 'eq': {
        const node = effect.node as Tone.EQ3;
        const p = effect.params as EffectParams['eq'];
        node.low.value = p.low;
        node.mid.value = p.mid;
        node.high.value = p.high;
        break;
      }
      case 'vibrato': {
        const node = effect.node as Tone.Vibrato;
        const p = effect.params as EffectParams['vibrato'];
        node.frequency.value = p.frequency;
        node.depth.value = p.depth;
        node.wet.value = p.wet;
        break;
      }
      case 'autowah': {
        const node = effect.node as Tone.AutoWah;
        const p = effect.params as EffectParams['autowah'];
        node.baseFrequency = p.baseFrequency;
        node.octaves = p.octaves;
        node.sensitivity = p.sensitivity;
        node.wet.value = p.wet;
        break;
      }
      case 'stereoWidener': {
        const node = effect.node as Tone.StereoWidener;
        const p = effect.params as EffectParams['stereoWidener'];
        node.width.value = p.width;
        break;
      }
      case 'pingPongDelay': {
        const node = effect.node as Tone.PingPongDelay;
        const p = effect.params as EffectParams['pingPongDelay'];
        node.delayTime.value = p.delayTime;
        node.feedback.value = p.feedback;
        node.wet.value = p.wet;
        break;
      }
      case 'limiter': {
        const node = effect.node as Tone.Limiter;
        const p = effect.params as EffectParams['limiter'];
        node.threshold.value = p.threshold;
        break;
      }
      case 'autoFilter': {
        const node = effect.node as Tone.AutoFilter;
        const p = effect.params as EffectParams['autoFilter'];
        node.frequency.value = p.frequency;
        node.depth.value = p.depth;
        node.baseFrequency = p.baseFrequency;
        node.octaves = p.octaves;
        node.wet.value = p.wet;
        break;
      }
      case 'chebyshev': {
        const node = effect.node as Tone.Chebyshev;
        const p = effect.params as EffectParams['chebyshev'];
        node.order = p.order;
        node.wet.value = p.wet;
        break;
      }
    }
  }

  setEffectEnabled(id: string, enabled: boolean): void {
    const effect = this.effects.find(e => e.id === id);
    if (!effect) return;
    effect.enabled = enabled;
    this.rebuildEffectsChain();
    this.notifyEffectsChange();
  }

  moveEffect(id: string, direction: 'up' | 'down'): void {
    const index = this.effects.findIndex(e => e.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.effects.length) return;

    // Swap
    [this.effects[index], this.effects[newIndex]] = [this.effects[newIndex], this.effects[index]];
    this.rebuildEffectsChain();
    this.notifyEffectsChange();
  }

  getEffects(): Effect[] {
    return this.effects.map(e => ({
      ...e,
      params: { ...e.params },
    }));
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

  setEnvelope(attack: number, decay: number, sustain: number, release: number): void {
    if (!this.synth) return;
    this.synth.envelope.attack = attack;
    this.synth.envelope.decay = decay;
    this.synth.envelope.sustain = sustain;
    this.synth.envelope.release = release;
  }

  playNote(note: string, duration?: string): void {
    if (!this.synth || !this.isInitialized) {
      console.log('[AudioEngine] playNote called but not ready:', { synth: !!this.synth, init: this.isInitialized });
      return;
    }
    
    // Resume audio context if suspended (iOS requirement)
    const ctx = Tone.getContext().rawContext as AudioContext;
    if (ctx.state === 'suspended') {
      console.log('[AudioEngine] Resuming suspended context on note play');
      ctx.resume();
    }
    
    console.log('[AudioEngine] Playing note:', note, 'context state:', ctx.state);
    
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

  getFFTData(): Float32Array {
    if (!this.fftAnalyser) return new Float32Array(256);
    return this.fftAnalyser.getValue() as Float32Array;
  }

  getAnalyser(): Tone.Analyser | null {
    return this.analyser;
  }

  getOutputGain(): Tone.Gain | null {
    return this.outputGain;
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
    this.effects.forEach(effect => effect.node?.dispose());
    this.effects = [];
    this.analyser?.dispose();
    this.fftAnalyser?.dispose();
    this.recorder?.dispose();
    this.outputGain?.dispose();
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
