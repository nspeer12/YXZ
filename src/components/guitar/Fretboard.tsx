'use client';

import { useMemo } from 'react';
import { type Tuning, midiAt, midiToName } from '@/lib/guitar/tuning';
import { STRING_COLORS } from '@/components/guitar/Highway';

export interface FretboardHighlight {
  string: number;
  fret: number;
  /** CSS color for the dot. */
  color?: string;
  /** Optional label drawn inside the dot (e.g. fret number, finger number). */
  label?: string;
  /** Outer ring color, useful for "currently expected" markers. */
  ring?: string;
  /** 0..1; controls dot opacity. */
  intensity?: number;
}

interface FretboardProps {
  tuning: Tuning;
  /** Number of frets to display (default 12). */
  frets?: number;
  /** Fret offset (default 0). For showing higher up the neck. */
  startFret?: number;
  /** Markers drawn on top of the board. */
  highlight?: FretboardHighlight[];
  /** Render each note name on every fret, dimly. Useful for tutorials. */
  showAllNoteNames?: boolean;
  /** Override the rendered height in px. */
  height?: number;
  /** Strings rendered top-to-bottom by default match Rocksmith: high E top, low E bottom. */
  orientation?: 'rocksmith' | 'standard';
  /**
   * Color-code each string with the Highway palette so the fretboard reads
   * as a continuation of the highway above. Default true.
   */
  colorStrings?: boolean;
}

const FRET_DOT_FRETS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const FRET_DOUBLE_DOT_FRETS = new Set([12, 24]);

// Geometry tweaks: leave more room on the left side so open-string labels
// don't collide with the fret-0 highlight dot. Open labels sit further out
// (padX - 32), fret-0 dots sit closer in (padX - 14).
const PAD_X = 40;
const OPEN_LABEL_X = PAD_X - 32;
const OPEN_DOT_X = PAD_X - 14;

export function Fretboard({
  tuning,
  frets = 12,
  startFret = 0,
  highlight = [],
  showAllNoteNames = false,
  height,
  orientation = 'rocksmith',
  colorStrings = true,
}: FretboardProps) {
  const stringCount = tuning.strings.length;

  const width = 1200;
  const innerHeight = height ?? 220;
  const padX = PAD_X;
  const padY = 24;
  const boardWidth = width - padX * 2;
  const boardHeight = innerHeight - padY * 2;
  const fretSpacing = boardWidth / frets;
  const stringSpacing = boardHeight / (stringCount - 1);

  // Map string index to y. Rocksmith: index 0 (low E) at the BOTTOM, index 5 at the top.
  const stringY = (s: number) =>
    padY + (orientation === 'rocksmith' ? (stringCount - 1 - s) : s) * stringSpacing;

  const noteLabels = useMemo(() => {
    if (!showAllNoteNames) return null;
    const labels: Array<{ x: number; y: number; text: string }> = [];
    for (let s = 0; s < stringCount; s++) {
      for (let f = 0; f <= frets; f++) {
        const realFret = startFret + f;
        const midi = midiAt(tuning, s, realFret);
        const { name } = midiToName(midi);
        const x = f === 0 ? OPEN_DOT_X : padX + (f - 0.5) * fretSpacing;
        labels.push({ x, y: stringY(s) + 3, text: name });
      }
    }
    return labels;
  }, [showAllNoteNames, stringCount, frets, startFret, fretSpacing, tuning, stringY, padX]);

  return (
    <svg
      viewBox={`0 0 ${width} ${innerHeight}`}
      preserveAspectRatio="none"
      className="w-full h-auto select-none"
      style={{ aspectRatio: `${width}/${innerHeight}` }}
    >
      {/* Wood / fretboard gradient */}
      <defs>
        <linearGradient id="fbWood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f1610" />
          <stop offset="50%" stopColor="#181009" />
          <stop offset="100%" stopColor="#0f0a06" />
        </linearGradient>
        <linearGradient id="fbFretMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bbbbbb" />
          <stop offset="50%" stopColor="#888888" />
          <stop offset="100%" stopColor="#555555" />
        </linearGradient>
        <radialGradient id="fbInlay" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#5b4528" />
          <stop offset="100%" stopColor="#2a1d10" />
        </radialGradient>
      </defs>

      <rect x={padX} y={padY} width={boardWidth} height={boardHeight} fill="url(#fbWood)" stroke="#3a2a1a" strokeWidth={1} />

      {/* Nut (only if startFret === 0) */}
      {startFret === 0 && (
        <rect x={padX - 6} y={padY - 4} width={6} height={boardHeight + 8} fill="#e6d8b9" />
      )}

      {/* Fret wires */}
      {Array.from({ length: frets + 1 }).map((_, f) => {
        if (f === 0) return null;
        return (
          <line
            key={`fret-${f}`}
            x1={padX + f * fretSpacing}
            y1={padY - 4}
            x2={padX + f * fretSpacing}
            y2={padY + boardHeight + 4}
            stroke="url(#fbFretMetal)"
            strokeWidth={2.2}
            opacity={0.95}
          />
        );
      })}

      {/* Inlay dots */}
      {Array.from({ length: frets }).map((_, idx) => {
        const realFret = startFret + idx + 1;
        const cx = padX + (idx + 0.5) * fretSpacing;
        if (FRET_DOUBLE_DOT_FRETS.has(realFret)) {
          return (
            <g key={`inlay-${realFret}`}>
              <circle cx={cx} cy={padY + boardHeight * 0.25} r={6} fill="url(#fbInlay)" />
              <circle cx={cx} cy={padY + boardHeight * 0.75} r={6} fill="url(#fbInlay)" />
            </g>
          );
        }
        if (FRET_DOT_FRETS.has(realFret)) {
          return (
            <circle key={`inlay-${realFret}`} cx={cx} cy={padY + boardHeight / 2} r={6} fill="url(#fbInlay)" />
          );
        }
        return null;
      })}

      {/* Strings — color-coded, low strings thicker */}
      {Array.from({ length: stringCount }).map((_, s) => {
        // Fixed: string 0 = low E should always be thickest, regardless of orientation.
        const thickness = (stringCount - s) * 0.55 + 0.7; // 4.0 (low E) → 1.25 (high E)
        const color = colorStrings ? STRING_COLORS[s] ?? '#d8d8d8' : '#d8d8d8';
        return (
          <g key={`string-${s}`}>
            {/* Soft glow underlay */}
            <line
              x1={padX}
              y1={stringY(s)}
              x2={padX + boardWidth}
              y2={stringY(s)}
              stroke={color}
              strokeWidth={thickness + 4}
              opacity={0.18}
            />
            <line
              x1={padX}
              y1={stringY(s)}
              x2={padX + boardWidth}
              y2={stringY(s)}
              stroke={color}
              strokeWidth={thickness}
              opacity={0.95}
            />
          </g>
        );
      })}

      {/* Fret numbers below */}
      {Array.from({ length: frets }).map((_, idx) => {
        const realFret = startFret + idx + 1;
        return (
          <text
            key={`num-${realFret}`}
            x={padX + (idx + 0.5) * fretSpacing}
            y={padY + boardHeight + 18}
            fill="#666"
            fontSize={11}
            fontFamily="monospace"
            textAnchor="middle"
          >
            {realFret}
          </text>
        );
      })}

      {/* Open-string labels at far left (clear of any fret-0 highlight dot) */}
      {Array.from({ length: stringCount }).map((_, s) => {
        const midi = midiAt(tuning, s, 0);
        const { name } = midiToName(midi);
        const color = colorStrings ? STRING_COLORS[s] ?? '#888' : '#888';
        return (
          <text
            key={`open-${s}`}
            x={OPEN_LABEL_X}
            y={stringY(s) + 4}
            fill={color}
            fontSize={11}
            fontFamily="monospace"
            fontWeight={700}
            textAnchor="middle"
          >
            {name}
          </text>
        );
      })}

      {/* Optional dim note labels on every fret */}
      {noteLabels?.map((l, i) => (
        <text key={`nl-${i}`} x={l.x} y={l.y} fill="#444" fontSize={9} fontFamily="monospace" textAnchor="middle">
          {l.text}
        </text>
      ))}

      {/* Highlights — fret 0 dot lives between the open-string label and the nut. */}
      {highlight.map((h, i) => {
        if (h.fret < startFret || h.fret > startFret + frets) return null;
        const cx =
          h.fret === startFret
            ? OPEN_DOT_X
            : padX + (h.fret - startFret - 0.5) * fretSpacing;
        const cy = stringY(h.string);
        const color = h.color ?? '#00ffff';
        const opacity = h.intensity ?? 1;
        return (
          <g key={`hl-${i}`} opacity={opacity}>
            {h.ring && (
              <circle cx={cx} cy={cy} r={16} fill="none" stroke={h.ring} strokeWidth={2} />
            )}
            <circle cx={cx} cy={cy} r={12} fill={color} stroke="#000" strokeWidth={1.5} />
            {h.label && (
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fill="#000"
                fontSize={11}
                fontWeight={700}
                fontFamily="monospace"
              >
                {h.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
