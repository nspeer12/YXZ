# YXZ — Product Requirements Document

> *"Create. Publish. Remix. Evolve."*

---

## Vision

YXZ is a **browser-based music creation studio** where anyone can make songs using powerful **math-based synthesis tools** and **music theory guidance**—no musical background required. Create your own tracks privately, then publish them for the world to hear and remix. Every published song becomes a seed for new creations.

Think of it as:
- **GarageBand** meets **SoundCloud** meets **GitHub** (for music)
- Pure mathematical sound generation—oscillators, frequencies, harmonics—no black-box AI
- Theory training wheels that help you make choices that sound good while teaching you *why*
- A remix culture where songs evolve through community iteration

**YXZ exists to answer:** *What if anyone could make music, share it, and watch it evolve through remixes?*

---

## Core Philosophy

### 1. Create First, Share When Ready
Your workspace is private. Experiment freely. When you're proud of something, publish it. No pressure.

### 2. Math, Not Magic
Every sound in YXZ comes from transparent, deterministic math—sine waves, frequency modulation, filters, envelopes. You can see exactly how every sound is built. No AI generation, no mystery boxes.

### 3. Theory as Training Wheels
You don't need to know what a "minor seventh" is to use one. YXZ suggests notes that work, highlights when you're about to do something dissonant (and lets you do it anyway), and explains the theory *after* you've felt it work.

### 4. Remix Culture
Every published song can be remixed. When you remix, you get the original's layers, synth patches, and structure to build on. Credit flows back to the original. Great ideas spread.

### 5. Accessible Complexity
Simple to start (play a note, hear a sound), infinitely deep to master (build your own synthesizers from oscillators, create generative sequences).

---

## The Social Model

### Your Songs

```
┌─────────────────────────────────────────────────────────────────┐
│  MY SONGS                                                        │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ ♪ untitled  │  │ ♪ late nite │  │ ♪ demo 3    │              │
│  │   draft     │  │  ✓ published│  │   draft     │              │
│  │             │  │  12 remixes │  │             │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  [+ New Song]                                                    │
└─────────────────────────────────────────────────────────────────┘
```

- **Drafts**: Private, only you can see/edit
- **Published**: Public, anyone can listen and remix
- **Unlisted**: Shareable via link, but not in public feed

### Discover & Remix

```
┌─────────────────────────────────────────────────────────────────┐
│  EXPLORE                                          [🔍 Search]   │
│                                                                  │
│  Trending    New    Most Remixed    Following                   │
│  ────────────────────────────────────────────────               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ♪ "ghost frequency"                        ▶ Play      │    │
│  │  by @spectralwaves                                       │    │
│  │  ♡ 342   ↻ 28 remixes   🎹 Open in Studio               │    │
│  │                                                          │    │
│  │  [Remix This] [View Lineage]                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Remix Lineage

Every song tracks its ancestry:

```
Original: "ghost frequency" by @spectralwaves
    │
    ├── "ghost frequency (dark mix)" by @nightowl
    │       │
    │       └── "haunted" by @basement_producer
    │
    ├── "ghost freq flip" by @beatmaker99
    │
    └── "spectre" by @you ← your remix
```

### Social Features
- **Follow** creators whose taste you like
- **Like** songs to save them
- **Comment** on songs (timestamped to specific moments)
- **Notifications** when someone remixes your song
- **Credit chain**: Remixes always link back to originals

---

## Core Features

### 1. The Instrument — Built-in Piano & Controller

A virtual instrument that works with mouse, keyboard, touch, or MIDI hardware.

**Piano Mode:**
```
┌───┬─┬───┬─┬───┬───┬─┬───┬─┬───┬─┬───┐
│   │█│   │█│   │   │█│   │█│   │█│   │  ← Black keys (sharps/flats)
│   │█│   │█│   │   │█│   │█│   │█│   │
│ C │ │ D │ │ E │ F │ │ G │ │ A │ │ B │  ← White keys
└───┴─┴───┴─┴───┴───┴─┴───┴─┴───┴─┴───┘
  A   W   S   E   D   F   T   G   Y   H    ← Keyboard mapping
```

**Features:**
- **Scale Lock**: Only play notes in the current scale (can't hit a "wrong" note)
- **Chord Helper**: Hold one note, see which other notes make nice chords with it
- **Velocity Sensitivity**: How hard you press affects volume/timbre
- **Sustain/Release**: Hold shift for sustain
- **Octave Shift**: Up/down arrows to move octaves
- **Record Mode**: Record a phrase, loop it, layer on top

**Controller Modes:**
- Piano (traditional layout)
- Pad Grid (4x4, 8x8 for drums/samples)
- XY Pad (for filter sweeps, effects)
- Ribbon (for pitch bends, continuous control)

---

### 2. The Wave Lab — Sound Creation

This is the heart of YXZ. Every sound starts as a wave. You can **see it, draw it, sculpt it, evolve it**.

#### The Core Concept: What Is Sound?

Sound is vibration. A speaker cone moves back and forth, pushing air. The **shape** of that movement determines what you hear:

```
SINE WAVE (pure, smooth)          SQUARE WAVE (buzzy, hollow)
     ╭──╮      ╭──╮                  ┌──┐   ┌──┐   ┌──┐
    ╱    ╲    ╱    ╲                 │  │   │  │   │  │
───╱──────╲──╱──────╲───          ───┘  └───┘  └───┘  └───
            ╲╱                      

SAWTOOTH (bright, rich)           TRIANGLE (soft, mellow)
   /│  /│  /│  /│                     /\      /\
  / │ / │ / │ / │                    /  \    /  \
 /  │/  │/  │/  │                   /    \  /    \
────────────────────              ──      \/      ──
```

YXZ lets you **draw any shape** and hear it instantly.

---

#### Wave Canvas — Draw Your Sound

The primary sound creation tool. A canvas where you literally draw the waveform.

```
┌─────────────────────────────────────────────────────────────────┐
│  WAVE CANVAS                                    [▶ Play Note]   │
│                                                                  │
│      ┌─────────────────────────────────────────────────────┐    │
│   +1 │          ●●●●●                                      │    │
│      │        ●●     ●●                                    │    │
│      │      ●●         ●●                                  │    │
│    0 │─────●─────────────●●────────────────────────────────│    │
│      │                     ●●         ●●                   │    │
│      │                       ●●     ●●                     │    │
│   -1 │                         ●●●●●                       │    │
│      └─────────────────────────────────────────────────────┘    │
│                                                                  │
│  [Pencil ✏️] [Line ╱] [Smooth ∿] [Mirror ↔] [Clear 🗑]          │
│                                                                  │
│  Presets: [Sine] [Square] [Saw] [Triangle] [Noise] [Random]     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**How it works:**
1. Draw any shape with your mouse/finger
2. That shape repeats hundreds of times per second
3. You hear it as a tone
4. Change the shape → change the sound

**Drawing Tools:**
- **Pencil**: Freehand draw
- **Line**: Straight line segments
- **Smooth**: Soften sharp corners
- **Mirror**: Make symmetrical waves
- **Presets**: Start from classic shapes

**Try this:** Draw a sine wave (smooth curve). Now add a sharp spike. Hear how it gets brighter and buzzier? That spike adds high frequencies.

---

#### Harmonic Editor — Build Sound From Layers

Every sound is made of **sine waves stacked together**. The Harmonic Editor shows you exactly which sine waves make up your sound.

```
┌─────────────────────────────────────────────────────────────────┐
│  HARMONIC EDITOR                                                 │
│                                                                  │
│  Each bar = one sine wave at a multiple of the base frequency   │
│                                                                  │
│  100% ┤ ████                                                    │
│       │ ████                                                    │
│   75% ┤ ████  ██                                                │
│       │ ████  ██                                                │
│   50% ┤ ████  ██    ██                                          │
│       │ ████  ██    ██                                          │
│   25% ┤ ████  ██    ██    ░░    ██                              │
│       │ ████  ██    ██    ░░    ██    ░░    ░░                  │
│    0% └──────────────────────────────────────────────────────   │
│         1     2     3     4     5     6     7     8   ← Harmonic│
│       (fund) (oct) (5th) (2oct)                                 │
│                                                                  │
│  Drag bars up/down to adjust │ [▶ Play] [📋 Copy to Wave]       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**What are harmonics?**
- Harmonic 1 (fundamental): The base pitch you hear
- Harmonic 2: One octave higher (2× frequency)
- Harmonic 3: An octave + a fifth higher (3× frequency)
- And so on...

**Sound characteristics:**
- Only odd harmonics (1, 3, 5, 7) → hollow, clarinet-like
- All harmonics decreasing → bright, sawtooth-like
- Just harmonic 1 → pure sine wave
- Random harmonics → metallic, bell-like

**The connection:** Changes in the Harmonic Editor update the Wave Canvas, and vice versa. They're two views of the same sound.

---

#### Spectrum View — See the Frequencies

A real-time display of what frequencies are present in your sound.

```
┌─────────────────────────────────────────────────────────────────┐
│  SPECTRUM                                                        │
│       │                                                          │
│       │ ██                                                       │
│       │ ██                                                       │
│       │ ██ ▄▄                                                    │
│       │ ██ ██ ▄▄    ▄▄                                          │
│       │ ██ ██ ██    ██    ▄▄                                    │
│       │ ██ ██ ██ ░░ ██ ░░ ██ ░░ ░░ ░░ ░░ ░░                    │
│       └──────────────────────────────────────────────────────   │
│        20Hz    200Hz    2kHz    20kHz                           │
│        (bass)  (mids)   (treble)                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

This helps you understand:
- Bass sounds have energy on the left
- Bright sounds have energy on the right
- Filters remove parts of this spectrum

---

#### Filter Sculptor — Shape the Frequencies

Filters remove frequencies from your sound. Instead of cryptic knobs, YXZ lets you **draw the filter shape directly**.

```
┌─────────────────────────────────────────────────────────────────┐
│  FILTER                                                          │
│                                                                  │
│  Draw the shape of what frequencies pass through:               │
│                                                                  │
│  100% │ ████████████████████╲                                   │
│       │ ████████████████████ ╲                                  │
│   50% │ ████████████████████  ╲                                 │
│       │ ████████████████████   ╲                                │
│    0% │ ████████████████████    ╲░░░░░░░░░░░░░░░░░░░░░          │
│       └──────────────────────────────────────────────────────   │
│        20Hz               2kHz                    20kHz         │
│                            ↑                                     │
│                       Cutoff frequency                          │
│                                                                  │
│  Presets: [Low Pass] [High Pass] [Band Pass] [Notch] [Draw]     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**What filters do:**
- **Low Pass**: Removes highs → darker, muffled sound
- **High Pass**: Removes lows → thinner, tinnier sound
- **Band Pass**: Keeps only a range → telephone/radio effect
- **Notch**: Removes a specific frequency → surgical cuts

**Draw mode**: Create any filter shape you want. Weird, creative, experimental.

---

#### Envelope Designer — Shape Over Time

Sound changes over time. An envelope controls **how a parameter evolves** from when you press a key to when you release it.

```
┌─────────────────────────────────────────────────────────────────┐
│  ENVELOPE (Volume)                                               │
│                                                                  │
│  100% │       ●━━━━━━━●                                         │
│       │      ╱         ╲                                        │
│       │     ╱           ╲●━━━━━━━━━━●                           │
│       │    ╱                         ╲                          │
│    0% │───●                           ╲●                        │
│       └──────────────────────────────────────────────────────   │
│         │    │           │            │                          │
│         A    D           S            R                          │
│       Attack Decay    Sustain      Release                      │
│                                                                  │
│  A: 50ms [━━●━━━━━━]   S: 70% [━━━━━━●━━]                       │
│  D: 200ms [━━━━●━━━]   R: 300ms [━━━━●━━]                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**ADSR explained:**
- **Attack**: How fast the sound reaches full volume (0 = instant, long = slow fade in)
- **Decay**: How fast it drops to sustain level
- **Sustain**: Volume while you hold the key (not a time—a level)
- **Release**: How fast it fades after you release the key

**Sound types:**
- Piano: Fast attack, long decay, no sustain, medium release
- Pad: Slow attack, no decay, full sustain, long release
- Pluck: Instant attack, fast decay, no sustain, short release

**Advanced**: Draw freeform envelope shapes for complex evolving sounds.

---

#### Wavetable — Morphing Sounds

Create multiple wave shapes and **morph between them** for evolving, moving sounds.

```
┌─────────────────────────────────────────────────────────────────┐
│  WAVETABLE                                                       │
│                                                                  │
│  Frame 1        Frame 2        Frame 3        Frame 4           │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐      │
│  │  ╭──╮   │    │  /\  /\ │    │ ┌─┐ ┌─┐ │    │ ∿∿∿∿∿∿∿ │      │
│  │ ╱  ╲╱  │    │ /  \/  \│    │ │ │ │ │ │    │         │      │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘      │
│       ↑              ↑              ↑              ↑             │
│       └──────────────┴──────────────┴──────────────┘             │
│                              │                                   │
│  Position: [━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]             │
│            Frame 1 ◄─────────────────────────────► Frame 4      │
│                                                                  │
│  [+ Add Frame]  [LFO Modulate Position]  [Envelope → Position]  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**How it works:**
1. Draw several different wave shapes (frames)
2. Morph between them with a slider
3. Automate the morph with an LFO or envelope
4. Sound evolves continuously as it plays

This is how modern synths create those rich, evolving textures.

---

#### Effects Chain — Final Polish

After shaping your wave, run it through effects:

```
┌─────────────────────────────────────────────────────────────────┐
│  EFFECTS CHAIN                                                   │
│                                                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐      │
│  │DISTORT  │ →  │ CHORUS  │ →  │  DELAY  │ →  │ REVERB  │ → OUT│
│  │ ████░░░ │    │ ██░░░░░ │    │ ███░░░░ │    │ █████░░ │      │
│  │ [Edit]  │    │ [Edit]  │    │ [Edit]  │    │ [Edit]  │      │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘      │
│                                                                  │
│  [+ Add Effect]   Available: Distortion, Chorus, Phaser,        │
│                   Flanger, Delay, Reverb, Compressor, EQ        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

Each effect has simple, visual controls—no cryptic parameters.

---

#### Putting It Together — The Sound Creation Flow

```
1. WAVE          2. FILTER         3. ENVELOPE       4. EFFECTS
   Draw your        Shape the         Control how       Add space,
   basic tone       frequencies       it evolves        grit, color
                    
   ╭──╮             ████╲             ●━●               🔊→🌀→OUT
  ╱    ╲            ████ ╲           ╱   ╲●━●
                                    ●       ╲●

                            ↓
                    
                    YOUR SOUND
                    (save as preset, use in songs)
```

---

#### Preset Library

Don't want to build from scratch? Start with presets and tweak:

**Included presets:**
- **Keys**: Piano, Electric Piano, Organ, Clav
- **Bass**: Sub Bass, Synth Bass, Plucky Bass, Wobble
- **Leads**: Saw Lead, Square Lead, Soft Lead, Screamer
- **Pads**: Warm Pad, Dark Pad, Shimmer, Evolving
- **Drums**: Kick, Snare, Hi-Hat, Clap, Tom, Percussion
- **FX**: Riser, Downlifter, Impact, Texture

Every preset can be opened in the Wave Lab to see how it's made and modify it.

---

#### Sound Sharing

Created something cool? Share it:
- Save as a preset in your library
- Publish to the community preset library
- Include in your song (remixers get access to your sounds)

---

### 3. The Guide — Music Theory System

Theory that teaches through doing, not lecturing.

**Scale System:**
```
Current Scale: C Major (the "happy" scale)

Available notes highlighted on piano:
C  D  E  F  G  A  B  C
●  ●  ●  ●  ●  ●  ●  ●

Try these scales:
├── C Minor      → "sad" version
├── C Pentatonic → "can't go wrong" (5 notes)
├── C Blues      → adds the "blue note"
├── C Dorian     → "jazzy minor"
└── C Lydian     → "dreamy, floating"
```

**Chord Helper:**
When you play a note, YXZ shows you:
- Which chords contain that note
- Common chord progressions from here
- What emotion each chord tends to evoke

```
You played: C

Chords you could build:
┌─────────────┬────────────┬─────────────────────┐
│ Chord       │ Notes      │ Feeling             │
├─────────────┼────────────┼─────────────────────┤
│ C Major     │ C E G      │ Happy, resolved     │
│ C Minor     │ C Eb G     │ Sad, introspective  │
│ C7          │ C E G Bb   │ Bluesy, wants move  │
│ Cmaj7       │ C E G B    │ Dreamy, sophisticated│
│ Csus4       │ C F G      │ Suspended, tense    │
└─────────────┴────────────┴─────────────────────┘
```

**Rhythm Guide:**
- Visual metronome with subdivisions
- Common patterns for different genres
- Polyrhythm visualizer (see how 3 against 4 works)

**Theory Unlocks:**
As you use features, brief explanations appear:
- "You just played a **V-I progression** (G→C). This is called a 'perfect cadence'—it sounds final because..."
- "That dissonance you heard? The notes are only a half-step apart. Dissonance creates tension that wants to resolve."

---

### 4. The Sequencer — Pattern Builder

Record and arrange musical patterns without needing real-time performance skills.

**Grid Sequencer:**
```
     1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16
C5   ●                   ●                   ●
B4                                       
A4           ●                   ●                   ●
G4       ●       ●           ●       ●           ●       ●
E4   
D4
C4   ●               ●               ●               ●
     ─────────────────────────────────────────────────────────────
     | beat 1  | beat 2  | beat 3  | beat 4  |  (4/4 time)
```

**Features:**
- Click to place notes
- Drag to adjust length
- Quantize to grid (or not—swing/humanize)
- Copy/paste patterns
- Layer multiple patterns

**Generative Sequences:**
Math-based pattern generation (deterministic algorithms, not AI):
- **Euclidean Rhythms**: Distribute N hits across M steps as evenly as possible
- **Cellular Automata**: Rules-based pattern evolution (like Game of Life for music)
- **Probability**: Each step has a % chance of playing
- **Arpeggiators**: Automatically play chord notes in patterns

---

### 5. The Arrangement — Song Structure

Build full songs from patterns and sections.

**Timeline View:**
```
┌─────────────────────────────────────────────────────────────────┐
│  0:00      0:30      1:00      1:30      2:00      2:30        │
│  ├─────────┼─────────┼─────────┼─────────┼─────────┼─────────  │
│                                                                  │
│  DRUMS    [====INTRO====][========VERSE========][===CHORUS===] │
│  BASS     [             ][========VERSE========][===CHORUS===] │
│  SYNTH    [====INTRO====][========VERSE========][===CHORUS===] │
│  PAD      [====INTRO====][                     ][===CHORUS===] │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Drag patterns onto timeline
- Create sections (intro, verse, chorus, etc.)
- Automate parameters over time (filter sweeps, volume swells)
- Loop sections for editing

---

### 6. The Mix — Levels & Space

Control how layers sit together in your song.

**Per-Layer Controls:**
- Volume
- Pan (left/right)
- Effects sends (reverb, delay)
- EQ (simple 3-band)
- Mute/Solo

**Master Section:**
- Master volume
- Limiter (prevent clipping)
- Master effects

**Visualizers:**
- Frequency spectrum (see which frequencies are occupied)
- Stereo field (see where sounds are placed left/right)
- Loudness meter

---

## Music Theory Crash Course (Built Into YXZ)

Since you're new to theory, YXZ will teach you these concepts through interaction:

### The Basics

**Notes**: There are 12 unique notes that repeat across octaves
```
C  C#  D  D#  E  F  F#  G  G#  A  A#  B  (then C again, higher)
```

**Scales**: A scale is a subset of notes that "go together"
- **Major scale**: Happy sound (C D E F G A B)
- **Minor scale**: Sad sound (C D Eb F G Ab Bb)
- **Pentatonic**: 5 notes, very hard to sound bad

**Chords**: Multiple notes played together
- **Major chord**: Happy (root + 4 semitones + 3 semitones)
- **Minor chord**: Sad (root + 3 semitones + 4 semitones)

**Rhythm**: How notes are spaced in time
- **Beat**: The pulse you tap your foot to
- **Measure/Bar**: Usually 4 beats grouped together
- **Tempo**: How fast (BPM = beats per minute)

### YXZ Makes This Easy

You don't need to memorize any of this. YXZ will:
1. **Lock you to a scale** so you can't play "wrong" notes
2. **Suggest chords** that work with what you're playing
3. **Quantize timing** so you're always on beat (unless you want off-beat)
4. **Explain after** — once you do something cool, it tells you what you did

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         YXZ CLIENT                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │   Piano/    │ │   Visual    │ │  Sequencer  │               │
│  │ Controller  │ │   Synth     │ │  & Arrange  │               │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘               │
│         │               │               │                        │
│         └───────────────┴───────────────┘                        │
│                         │                                        │
│              ┌──────────┴──────────┐                            │
│              │    WEB AUDIO API    │  ← Browser's audio engine  │
│              │    (Math-based)     │                            │
│              └──────────┬──────────┘                            │
│                         │                                        │
│              ┌──────────┴──────────┐                            │
│              │   Audio Worklet     │  ← Custom DSP in workers   │
│              │   (Oscillators,     │                            │
│              │    Filters, etc)    │                            │
│              └─────────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ REST API / WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         YXZ SERVER                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │   Songs &   │ │   Users &   │ │   Social    │               │
│  │   Projects  │ │   Auth      │ │  (likes,    │               │
│  │             │ │             │ │   follows)  │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│                                                                  │
│  Database: PostgreSQL (songs, users, social graph)              │
│  Storage: S3/R2 (exported audio files)                          │
└─────────────────────────────────────────────────────────────────┘
```

### Stack
- **Frontend**: Next.js + React + Web Audio API + Tone.js
- **Backend**: FastAPI (Python) for API
- **Database**: PostgreSQL for data, Redis for sessions
- **Storage**: S3-compatible for audio exports
- **Audio**: All synthesis happens client-side via Web Audio API (math-based)

### Song Data Format
Songs are stored as JSON project files containing:
- Tempo, key, scale
- Track definitions (instrument settings, effects)
- Pattern data (note sequences)
- Arrangement (which patterns play when)
- Synth patch definitions

This means:
- **Remixes get full access** to layers, not just audio
- **Small file sizes** (it's data, not audio)
- **Regenerated on playback** (always sounds the same)

### Why Client-Side Audio?
- Zero latency (critical for playing instruments)
- Scales infinitely (each user's computer does the work)
- Transparent (users can see the math)
- No server audio processing costs

---

## User Interface

### Studio View (Creating)
```
┌─────────────────────────────────────────────────────────────────┐
│  YXZ Studio                    "untitled"    [Save] [Publish ▾] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ ARRANGEMENT ───────────────────────────────────────────────┐│
│  │  [INTRO   ][  VERSE 1  ][  CHORUS  ][  VERSE 2  ][OUTRO   ] ││
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ TRACKS ─────────────────────┐  ┌─ INSPECTOR ──────────────┐ │
│  │  🔊 Drums      [M] [S] ══●══ │  │  Scale: C Minor      [▾] │ │
│  │  🔊 Bass       [M] [S] ══●══ │  │  Tempo: 95 BPM       [▾] │ │
│  │  🔊 Synth Lead [M] [S] ══●══ │  │  Time: 4/4           [▾] │ │
│  │  🔊 Pad        [M] [S] ══●══ │  │                          │ │
│  │  [+ Add Track]               │  │  ┌─ CHORD HELPER ──────┐ │ │
│  └──────────────────────────────┘  │  │ Cm   Fm   G    Bb   │ │ │
│                                     │  │ ●    ○    ○    ○    │ │ │
│  ┌─ PATTERN EDITOR ────────────────┐│  └─────────────────────┘ │ │
│  │  ░░●░░░░░●░░░░░●░░░░░░░░░░░░░░░ ││                          │ │
│  │  ░░░░░░░░░░░░░░░░░░░░●░░░░░░░░░ ││  Theory tip:             │ │
│  │  ░░░░●░░░░░●░░░░░●░░░░░●░░░░░░░ ││  "Minor key creates a    │ │
│  │  ●░░░░░░░●░░░░░░░●░░░░░░░●░░░░░ ││   melancholic mood..."   │ │
│  └──────────────────────────────────┘│                          │ │
│                                     └──────────────────────────┘ │
│  ┌─ PIANO ──────────────────────────────────────────────────────┐│
│  │  [  ][##][  ][##][  ][  ][##][  ][##][  ][##][  ]            ││
│  │  [ C ][ D ][ E ][ F ][ G ][ A ][ B ][ C ][ D ][ E ]          ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [● Rec] [▶ Play] [⏹ Stop]  ◀◀ 1 ▶▶  [🔒 Scale Lock: ON]       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Explore View (Discovering)
```
┌─────────────────────────────────────────────────────────────────┐
│  YXZ                              [🔍 Search]    [@username ▾]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Trending] [New] [Most Remixed] [Following] [Your Songs]       │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ▶  "ghost frequency"                              2:34    │ │
│  │     @spectralwaves • 3 days ago                            │ │
│  │     ═══════════●══════════════════════════════════         │ │
│  │     ♡ 342 likes   ↻ 28 remixes   💬 12 comments            │ │
│  │                                                             │ │
│  │     [♡ Like] [↻ Remix] [💬 Comment] [⤴ Share]              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ▶  "late bloom"                                   3:12    │ │
│  │     @nightgarden • 5 days ago                              │ │
│  │     ↻ remix of "spring rain" by @melodist                  │ │
│  │     ...                                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Design Principles
- **Dark mode** by default (easier on eyes, feels like a studio)
- **Neon accents** — cyan for interactive, orange for recording, green for playback
- **Minimal chrome** — the music is the focus
- **Touch-friendly** — works on tablets/phones

---

## Development Phases

### Phase 1: Solo Instrument (Weeks 1-4)
- [ ] Web Audio synthesis engine (oscillators, filters, envelopes)
- [ ] Virtual piano with keyboard input
- [ ] Scale lock system
- [ ] Basic synth presets (piano, bass, pad, lead, drums)
- [ ] Simple sequencer grid
- [ ] Local playback and project save (localStorage)

### Phase 2: Theory Guide (Weeks 5-6)
- [ ] Chord helper overlay
- [ ] Scale selector with audio previews
- [ ] Theory tooltips ("you just played a...")
- [ ] Rhythm guide / metronome

### Phase 3: Full Studio (Weeks 7-8)
- [ ] Multi-track arrangement view
- [ ] Pattern copy/paste/duplicate
- [ ] Basic effects (reverb, delay, distortion)
- [ ] Mix controls (volume, pan, mute, solo)
- [ ] Export to audio file (WAV/MP3)

### Phase 4: Accounts & Publishing (Weeks 9-10)
- [ ] User authentication
- [ ] Cloud project storage
- [ ] Publish songs publicly
- [ ] Basic profile pages
- [ ] Explore/discover feed

### Phase 5: Social & Remix (Weeks 11-12)
- [ ] Remix functionality (fork a published song)
- [ ] Remix lineage tracking
- [ ] Likes, follows, comments
- [ ] Notifications
- [ ] Share links

### Phase 6: Polish & Expand (Ongoing)
- [ ] More synthesis options (FM, granular)
- [ ] Synth builder (modular patching)
- [ ] Mobile optimization
- [ ] MIDI hardware support
- [ ] Preset/patch sharing
- [ ] Collaborative real-time editing (stretch goal)

---

## The Sound of YXZ

Since you mentioned Yeezus and Radiohead as touchstones, here's how YXZ enables that aesthetic:

### Yeezus Sounds (Industrial, Aggressive, Minimal)
- **Distortion/Overdrive**: Push oscillators into clipping
- **Sparse arrangements**: Easy to have just kick + synth + vocal
- **Detuned oscillators**: Slight pitch differences create that thick, ugly sound
- **Hard-gated reverb**: Reverb that cuts off abruptly

### Radiohead Sounds (Textural, Atmospheric, Complex)
- **Layered pads**: Stack multiple oscillators with different filters
- **Arpeggiators**: Interlocking patterns like "Everything In Its Right Place"
- **Evolving textures**: LFOs slowly modulating filter cutoff
- **Odd time signatures**: Sequencer supports 5/4, 7/8, etc.

### Both
- **Space**: Tools for reverb, delay, stereo width
- **Tension**: Dissonance is available (just turn off scale lock)
- **Rhythm**: Polyrhythms, syncopation, unusual grooves

---

## Success Metrics

### Creation
- Songs created per user
- Time spent in studio
- Features used (which synths, which theory tools)

### Publishing
- Songs published
- Publish rate (drafts → published)

### Social
- Remixes per published song
- Likes, comments, follows
- Remix chain depth (original → remix → remix of remix)

### Retention
- Daily/weekly active users
- Return rate after first song

---

## Open Questions

1. **Licensing**: When you remix someone's song, who owns what? Creative Commons by default?

2. **Audio export**: Should we allow exporting stems, or just the full mix?

3. **Monetization**: Free tier vs paid? What goes behind paywall? (More synths? More storage? No ads?)

4. **Collaboration**: Should two people be able to edit the same song in real-time? (Complex but powerful)

5. **Samples**: Should YXZ allow uploading audio samples, or stay pure synthesis?

---

## Why This Will Work

1. **Low barrier**: Anyone can play a note and hear it. Scale lock means it sounds good.

2. **High ceiling**: Synth nerds can build complex patches. Theory heads can explore harmony.

3. **Social proof**: Seeing your song get remixed is incredibly rewarding.

4. **Learning**: People will absorb music theory by doing, not studying.

5. **Network effects**: More songs = more remixes = more discovery = more users.

6. **Unique position**: No other tool combines accessible synthesis + theory education + remix culture.

---

*YXZ: Create. Publish. Remix. Evolve.*
