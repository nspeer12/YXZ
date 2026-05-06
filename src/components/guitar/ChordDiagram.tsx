'use client';

// Standard chord-chart diagram. Six strings drawn vertically (low E left → high
// e right by default — matches looking down at the guitar in front of you),
// frets horizontal, dots for fingered notes, "O" for open strings, "X" for
// muted. Sized for inline use either in a hover popover (compact) or beside
// the live "Now" strip in the lesson player.

import { useMemo } from 'react';

interface ChordPosition {
  string: number; // 0 = low E, 5 = high E
  fret: number; // 0 = open
}

interface Props {
  /** Chord name shown above the grid (e.g. "Em", "G", "C"). */
  name: string;
  /** Voicing — list of (string, fret). Strings not present are treated as muted. */
  voicing: ChordPosition[];
  /** Width in px. Height auto-derives. Default 64. */
  size?: number;
  /** Status tint for the box. Default neutral. */
  variant?: 'neutral' | 'active' | 'hit' | 'missed';
  /** Hide the chord name above. Default false. */
  hideName?: boolean;
}

const STRING_COUNT = 6;
const FRET_WINDOW = 4;

export function ChordDiagram({ name, voicing, size = 64, variant = 'neutral', hideName = false }: Props) {
  // Decide which window of frets to show. Default 1..4 (open chords).
  // If the chord lives higher up the neck, slide the window so the lowest
  // fingered fret is row 1, and label the starting fret at the side.
  const { startFret, occupiedByString } = useMemo(() => {
    const occupied = new Map<number, number>();
    for (const v of voicing) occupied.set(v.string, v.fret);
    const fingered = voicing.map((v) => v.fret).filter((f) => f > 0);
    const min = fingered.length === 0 ? 1 : Math.min(...fingered);
    const max = fingered.length === 0 ? 1 : Math.max(...fingered);
    // If max fret <= 4 we keep the standard 1..4 window so opens still read
    // naturally. Otherwise slide the window down.
    const start = max <= FRET_WINDOW ? 1 : Math.max(1, min);
    return { startFret: start, occupiedByString: occupied };
  }, [voicing]);

  const pad = Math.max(8, size * 0.14);
  const labelH = hideName ? 0 : Math.max(14, size * 0.22);
  const topMarkH = Math.max(10, size * 0.16);
  const gridW = size;
  const gridH = size; // square grid; dots within
  const totalH = labelH + topMarkH + gridH + (startFret > 1 ? 0 : 4);

  const stringSpacing = (gridW - pad * 2) / (STRING_COUNT - 1);
  const fretSpacing = gridH / FRET_WINDOW;

  // String layout: index 0 (low E) on the LEFT, high e on the RIGHT — matches
  // the rest of the app's color palette and the Fretboard component.
  const xForStringLeftToRight = (s: number) => pad + s * stringSpacing;

  const yForFretRow = (rowIndex: number) => labelH + topMarkH + (rowIndex + 0.5) * fretSpacing;

  // Variant tint
  const tint =
    variant === 'hit'
      ? { dot: '#00ff88', border: '#00ff88', text: '#00ff88' }
      : variant === 'missed'
        ? { dot: '#ff6b35', border: '#5a1a1a', text: '#ff8080' }
        : variant === 'active'
          ? { dot: '#00ffff', border: '#00ffff', text: '#00ffff' }
          : { dot: '#ededed', border: '#3a3a3a', text: '#ededed' };

  return (
    <svg
      viewBox={`0 0 ${gridW} ${totalH}`}
      width={gridW}
      height={totalH}
      style={{ display: 'block' }}
    >
      {/* Chord name */}
      {!hideName && (
        <text
          x={gridW / 2}
          y={labelH * 0.78}
          textAnchor="middle"
          fontSize={Math.max(12, size * 0.22)}
          fontWeight={800}
          fill={tint.text}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {name}
        </text>
      )}

      {/* Top row: O for open, X for muted, blank for fingered */}
      {Array.from({ length: STRING_COUNT }).map((_, s) => {
        const f = occupiedByString.get(s);
        const x = xForStringLeftToRight(s);
        const y = labelH + topMarkH * 0.7;
        if (f === undefined) {
          return (
            <text key={`tm-${s}`} x={x} y={y} textAnchor="middle" fontSize={topMarkH * 0.85} fill="#666" fontFamily="system-ui">
              ×
            </text>
          );
        }
        if (f === 0) {
          return (
            <circle
              key={`tm-${s}`}
              cx={x}
              cy={y - topMarkH * 0.18}
              r={topMarkH * 0.32}
              fill="none"
              stroke="#888"
              strokeWidth={1.2}
            />
          );
        }
        return null;
      })}

      {/* Nut OR start-fret marker */}
      {startFret === 1 ? (
        <rect
          x={pad}
          y={labelH + topMarkH - 2}
          width={(STRING_COUNT - 1) * stringSpacing}
          height={3}
          fill="#e6d8b9"
        />
      ) : (
        <text
          x={pad - 4}
          y={labelH + topMarkH + fretSpacing * 0.7}
          textAnchor="end"
          fontSize={9}
          fill="#888"
          fontFamily="monospace"
        >
          {startFret}
        </text>
      )}

      {/* Fret grid: horizontal fret wires + vertical strings inside the grid */}
      {Array.from({ length: FRET_WINDOW + 1 }).map((_, i) => (
        <line
          key={`fl-${i}`}
          x1={pad}
          y1={labelH + topMarkH + i * fretSpacing}
          x2={pad + (STRING_COUNT - 1) * stringSpacing}
          y2={labelH + topMarkH + i * fretSpacing}
          stroke="#3a3a3a"
          strokeWidth={i === 0 && startFret === 1 ? 0 : 1}
        />
      ))}
      {Array.from({ length: STRING_COUNT }).map((_, s) => (
        <line
          key={`sl-${s}`}
          x1={xForStringLeftToRight(s)}
          y1={labelH + topMarkH}
          x2={xForStringLeftToRight(s)}
          y2={labelH + topMarkH + FRET_WINDOW * fretSpacing}
          stroke="#3a3a3a"
          strokeWidth={1}
        />
      ))}

      {/* Finger dots */}
      {voicing.map((v, i) => {
        if (v.fret === 0) return null;
        const rowIndex = v.fret - startFret; // 0..FRET_WINDOW-1
        if (rowIndex < 0 || rowIndex >= FRET_WINDOW) return null;
        const cx = xForStringLeftToRight(v.string);
        const cy = yForFretRow(rowIndex);
        return (
          <circle
            key={`d-${i}`}
            cx={cx}
            cy={cy}
            r={Math.max(4, size * 0.075)}
            fill={tint.dot}
            stroke="#000"
            strokeWidth={0.5}
          />
        );
      })}
    </svg>
  );
}

/**
 * Compute the deduped list of chords played in an exercise. Used by the
 * lesson player to show a chord-chart strip / dropdown for chord-heavy
 * lessons. Picks the FIRST occurrence of each chord-name as the canonical
 * voicing to display.
 */
export function uniqueChordsInTargets(
  targets: Array<{ label?: string; chord?: ChordPosition[]; string: number; fret: number }>,
): Array<{ name: string; voicing: ChordPosition[] }> {
  const seen = new Map<string, { name: string; voicing: ChordPosition[] }>();
  for (const t of targets) {
    if (!t.chord || t.chord.length < 2) continue;
    // Strip parenthetical / suffix from label, same logic as Highway.
    const raw = (t.label ?? '').trim();
    if (!raw) continue;
    const noParen = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const noSuffix = noParen.replace(/\s+(?:chord|strum)\b.*$/i, '').trim();
    const name = noSuffix || noParen || raw;
    if (seen.has(name)) continue;
    seen.set(name, { name, voicing: t.chord });
  }
  return Array.from(seen.values());
}
