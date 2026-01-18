// Music theory utilities

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type NoteName = typeof NOTE_NAMES[number];

export interface Scale {
  name: string;
  intervals: number[];
  description: string;
  mood: string;
}

export const SCALES: Record<string, Scale> = {
  major: {
    name: 'Major',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    description: 'The happy scale. Bright, uplifting, resolved.',
    mood: 'happy',
  },
  minor: {
    name: 'Minor',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    description: 'The sad scale. Dark, emotional, introspective.',
    mood: 'sad',
  },
  pentatonic: {
    name: 'Pentatonic',
    intervals: [0, 2, 4, 7, 9],
    description: "5 notes that can't go wrong. Safe, versatile, universal.",
    mood: 'neutral',
  },
  blues: {
    name: 'Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    description: 'Pentatonic with the blue note. Soulful, expressive.',
    mood: 'soulful',
  },
  dorian: {
    name: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    description: 'Minor with a raised 6th. Jazzy, sophisticated.',
    mood: 'jazzy',
  },
  phrygian: {
    name: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    description: 'Spanish/Middle Eastern flavor. Exotic, dark.',
    mood: 'exotic',
  },
  lydian: {
    name: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    description: 'Major with raised 4th. Dreamy, floating, ethereal.',
    mood: 'dreamy',
  },
  mixolydian: {
    name: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    description: 'Major with flat 7th. Bluesy rock feel.',
    mood: 'rock',
  },
  chromatic: {
    name: 'Chromatic',
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    description: 'All 12 notes. No restrictions, full freedom.',
    mood: 'free',
  },
};

export interface Chord {
  name: string;
  intervals: number[];
  symbol: string;
  feeling: string;
}

export const CHORD_TYPES: Record<string, Chord> = {
  major: {
    name: 'Major',
    intervals: [0, 4, 7],
    symbol: '',
    feeling: 'Happy, bright, resolved',
  },
  minor: {
    name: 'Minor',
    intervals: [0, 3, 7],
    symbol: 'm',
    feeling: 'Sad, dark, introspective',
  },
  diminished: {
    name: 'Diminished',
    intervals: [0, 3, 6],
    symbol: 'dim',
    feeling: 'Tense, unstable, suspenseful',
  },
  augmented: {
    name: 'Augmented',
    intervals: [0, 4, 8],
    symbol: 'aug',
    feeling: 'Unsettled, dreamy, mysterious',
  },
  major7: {
    name: 'Major 7th',
    intervals: [0, 4, 7, 11],
    symbol: 'maj7',
    feeling: 'Dreamy, sophisticated, lush',
  },
  minor7: {
    name: 'Minor 7th',
    intervals: [0, 3, 7, 10],
    symbol: 'm7',
    feeling: 'Smooth, jazzy, mellow',
  },
  dominant7: {
    name: 'Dominant 7th',
    intervals: [0, 4, 7, 10],
    symbol: '7',
    feeling: 'Bluesy, wants to resolve, tension',
  },
  sus2: {
    name: 'Suspended 2nd',
    intervals: [0, 2, 7],
    symbol: 'sus2',
    feeling: 'Open, ambiguous, floaty',
  },
  sus4: {
    name: 'Suspended 4th',
    intervals: [0, 5, 7],
    symbol: 'sus4',
    feeling: 'Tense, wants to resolve',
  },
};

export function getNotesInScale(root: NoteName, scaleName: string): NoteName[] {
  const scale = SCALES[scaleName];
  if (!scale) return [];
  
  const rootIndex = NOTE_NAMES.indexOf(root);
  return scale.intervals.map(interval => NOTE_NAMES[(rootIndex + interval) % 12]);
}

export function isNoteInScale(note: NoteName, root: NoteName, scaleName: string): boolean {
  const scaleNotes = getNotesInScale(root, scaleName);
  return scaleNotes.includes(note);
}

export function getMidiNote(noteName: NoteName, octave: number): number {
  const noteIndex = NOTE_NAMES.indexOf(noteName);
  return (octave + 1) * 12 + noteIndex;
}

export function getNoteFromMidi(midiNote: number): { name: NoteName; octave: number } {
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  return { name: NOTE_NAMES[noteIndex], octave };
}

export function noteToFrequency(noteName: NoteName, octave: number): number {
  const midiNote = getMidiNote(noteName, octave);
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

export function frequencyToNote(freq: number): { name: NoteName; octave: number; cents: number } {
  const midiNote = 69 + 12 * Math.log2(freq / 440);
  const roundedMidi = Math.round(midiNote);
  const cents = Math.round((midiNote - roundedMidi) * 100);
  const { name, octave } = getNoteFromMidi(roundedMidi);
  return { name, octave, cents };
}

export function getChordNotes(root: NoteName, chordType: string, octave: number = 4): string[] {
  const chord = CHORD_TYPES[chordType];
  if (!chord) return [];
  
  const rootIndex = NOTE_NAMES.indexOf(root);
  return chord.intervals.map(interval => {
    const noteIndex = (rootIndex + interval) % 12;
    const noteOctave = octave + Math.floor((rootIndex + interval) / 12);
    return `${NOTE_NAMES[noteIndex]}${noteOctave}`;
  });
}

export function getChordsContainingNote(note: NoteName): Array<{ root: NoteName; type: string; chord: Chord }> {
  const results: Array<{ root: NoteName; type: string; chord: Chord }> = [];
  
  for (const root of NOTE_NAMES) {
    for (const [type, chord] of Object.entries(CHORD_TYPES)) {
      const rootIndex = NOTE_NAMES.indexOf(root);
      const noteIndex = NOTE_NAMES.indexOf(note);
      const interval = (noteIndex - rootIndex + 12) % 12;
      
      if (chord.intervals.includes(interval)) {
        results.push({ root, type, chord });
      }
    }
  }
  
  return results;
}

export function getSuggestedChords(root: NoteName, scaleName: string): Array<{ root: NoteName; type: string; numeral: string }> {
  const scale = SCALES[scaleName];
  if (!scale) return [];
  
  const rootIndex = NOTE_NAMES.indexOf(root);
  const suggestions: Array<{ root: NoteName; type: string; numeral: string }> = [];
  
  // Common chord degrees for major/minor scales
  const majorNumerals = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
  const majorTypes = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'];
  
  const minorNumerals = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
  const minorTypes = ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'];
  
  const numerals = scaleName === 'minor' ? minorNumerals : majorNumerals;
  const types = scaleName === 'minor' ? minorTypes : majorTypes;
  
  scale.intervals.forEach((interval, i) => {
    if (i < numerals.length) {
      suggestions.push({
        root: NOTE_NAMES[(rootIndex + interval) % 12],
        type: types[i],
        numeral: numerals[i],
      });
    }
  });
  
  return suggestions;
}

// Piano key helpers
export function isBlackKey(noteName: NoteName): boolean {
  return noteName.includes('#');
}

export function getKeyboardMapping(): Record<string, { note: NoteName; octave: number }> {
  return {
    'a': { note: 'C', octave: 4 },
    'w': { note: 'C#', octave: 4 },
    's': { note: 'D', octave: 4 },
    'e': { note: 'D#', octave: 4 },
    'd': { note: 'E', octave: 4 },
    'f': { note: 'F', octave: 4 },
    't': { note: 'F#', octave: 4 },
    'g': { note: 'G', octave: 4 },
    'y': { note: 'G#', octave: 4 },
    'h': { note: 'A', octave: 4 },
    'u': { note: 'A#', octave: 4 },
    'j': { note: 'B', octave: 4 },
    'k': { note: 'C', octave: 5 },
    'o': { note: 'C#', octave: 5 },
    'l': { note: 'D', octave: 5 },
    'p': { note: 'D#', octave: 5 },
    ';': { note: 'E', octave: 5 },
  };
}

// Theory explanations
export function explainInterval(semitones: number): string {
  const intervals: Record<number, string> = {
    0: 'Unison (same note)',
    1: 'Minor 2nd (half step) — tense, dissonant',
    2: 'Major 2nd (whole step) — slightly tense',
    3: 'Minor 3rd — sad, dark',
    4: 'Major 3rd — happy, bright',
    5: 'Perfect 4th — open, floating',
    6: 'Tritone — very tense, "the devil\'s interval"',
    7: 'Perfect 5th — stable, powerful',
    8: 'Minor 6th — bittersweet',
    9: 'Major 6th — warm, sweet',
    10: 'Minor 7th — bluesy, wants to resolve',
    11: 'Major 7th — dreamy, jazzy',
    12: 'Octave — same note, higher',
  };
  return intervals[semitones % 12] || `${semitones} semitones`;
}
