'use client';

// Multi-line tab "sheet" — Ultimate-Guitar-style layout showing the entire
// song at once. Three rows per line, top to bottom:
//
//   1. Chord names      (e.g. "G   D   C")
//   2. Lyrics           (e.g. "Hey ya, hey ya")
//   3. Tab notation     (6 horizontal strings with fret numbers)
//
// Rendered in HTML/CSS (not SVG with preserveAspectRatio="none") so text
// keeps its natural proportions across container widths. X positions of
// notes/labels are emitted as percentages so they line up with the bar
// lines and string rows; vertical layout uses fixed pixel rows.

import { useMemo } from 'react';
import type { Exercise, LyricBeat, ChordAnnotation } from '@/lib/guitar/curriculum';
import type { TargetNote } from '@/lib/guitar/grading';
import { STRING_COLORS } from '@/components/guitar/Highway';

interface TabSheetProps {
  exercise: Exercise;
  /** Highlighted "current" target id (for the tab-mode cursor). */
  currentTargetId?: string | null;
  /** Set of target ids already played (drawn green). */
  hitTargetIds: Set<string>;
  /** Number of measures per line. Default 4. */
  measuresPerLine?: number;
}

interface TabLineProps {
  startBeat: number;
  endBeat: number;
  beatsPerBar: number;
  targets: TargetNote[];
  lyrics: LyricBeat[];
  chordAnnotations: ChordAnnotation[];
  currentTargetId?: string | null;
  hitTargetIds: Set<string>;
}

// Display labels match standard tuning, top-to-bottom: high E → low E.
const STRING_LABEL_AT_INDEX: Record<number, string> = {
  5: 'e',
  4: 'B',
  3: 'G',
  2: 'D',
  1: 'A',
  0: 'E',
};

// Pixel rows inside a single TabLine.
const PAD_LEFT_PX = 32;
const PAD_RIGHT_PX = 12;
const CHORD_ROW_HEIGHT = 18;
const LYRIC_ROW_HEIGHT = 18;
const STRING_GAP = 16;
const STRING_COUNT = 6;
const TAB_HEIGHT = STRING_GAP * (STRING_COUNT - 1);
const LINE_INNER_PADDING = 6; // breathing room above/below the tab grid

export function TabSheet({
  exercise,
  currentTargetId,
  hitTargetIds,
  measuresPerLine = 4,
}: TabSheetProps) {
  const beatsPerBar = exercise.beatsPerBar ?? 4;
  const lyrics = exercise.lyrics ?? [];
  const chordAnnotations = exercise.chordAnnotations ?? [];

  const lines = useMemo(() => {
    const lastBeat = Math.max(
      0,
      ...exercise.targets.map((t) => t.beat + (t.duration ?? 1)),
      ...lyrics.map((l) => l.beat + 1),
      ...chordAnnotations.map((c) => c.beat + 1),
    );
    const totalBeats = Math.ceil(lastBeat / beatsPerBar) * beatsPerBar;
    const beatsPerLine = measuresPerLine * beatsPerBar;
    const numLines = Math.max(1, Math.ceil(totalBeats / beatsPerLine));
    return Array.from({ length: numLines }, (_, i) => ({
      startBeat: i * beatsPerLine,
      endBeat: Math.min((i + 1) * beatsPerLine, totalBeats),
    }));
  }, [exercise.targets, lyrics, chordAnnotations, beatsPerBar, measuresPerLine]);

  return (
    <div className="space-y-4 rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-3 sm:p-4 overflow-x-auto">
      {lines.map(({ startBeat, endBeat }, i) => (
        <TabLine
          key={i}
          startBeat={startBeat}
          endBeat={endBeat}
          beatsPerBar={beatsPerBar}
          targets={exercise.targets.filter((t) => t.beat >= startBeat && t.beat < endBeat)}
          lyrics={lyrics.filter((l) => l.beat >= startBeat && l.beat < endBeat)}
          chordAnnotations={chordAnnotations.filter(
            (c) => c.beat >= startBeat && c.beat < endBeat,
          )}
          currentTargetId={currentTargetId}
          hitTargetIds={hitTargetIds}
        />
      ))}
    </div>
  );
}

function TabLine({
  startBeat,
  endBeat,
  beatsPerBar,
  targets,
  lyrics,
  chordAnnotations,
  currentTargetId,
  hitTargetIds,
}: TabLineProps) {
  const beatsInLine = Math.max(1, endBeat - startBeat);
  const numMeasures = Math.ceil(beatsInLine / beatsPerBar);

  // X position of a beat as a percentage of the inner board width (the part
  // between PAD_LEFT_PX and PAD_RIGHT_PX). We compute against the inner
  // content area so notes and bar lines all line up.
  const xPctForBeat = (beat: number): number => {
    const rel = (beat - startBeat) / beatsInLine;
    return rel * 100;
  };

  // Map our string index (0=low E, 5=high E) to a row index in the tab grid
  // where 0 is the TOP row (high E in UG convention).
  const rowOfString = (s: number): number => STRING_COUNT - 1 - s;

  const totalHeight =
    LINE_INNER_PADDING + CHORD_ROW_HEIGHT + LYRIC_ROW_HEIGHT + TAB_HEIGHT + LINE_INNER_PADDING + 16;
  const tabTop =
    LINE_INNER_PADDING + CHORD_ROW_HEIGHT + LYRIC_ROW_HEIGHT;
  const tabBottom = tabTop + TAB_HEIGHT;

  return (
    <div
      className="relative"
      style={{
        height: totalHeight,
        paddingLeft: PAD_LEFT_PX,
        paddingRight: PAD_RIGHT_PX,
      }}
    >
      {/* Inner positioning context — the strip from PAD_LEFT_PX to (right - PAD_RIGHT_PX). */}
      <div className="relative h-full">
        {/* String name labels at the LEFT edge (outside the inner positioning context). */}
        {Array.from({ length: STRING_COUNT }).map((_, idx) => {
          const s = idx;
          const top = tabTop + rowOfString(s) * STRING_GAP - 7;
          return (
            <div
              key={`sl-${s}`}
              className="absolute font-mono font-bold pointer-events-none"
              style={{
                left: -PAD_LEFT_PX + 4,
                top,
                width: PAD_LEFT_PX - 6,
                fontSize: 11,
                lineHeight: '14px',
                textAlign: 'right',
                color: STRING_COLORS[s] ?? '#888',
              }}
            >
              {STRING_LABEL_AT_INDEX[s]}
            </div>
          );
        })}

        {/* Horizontal string lines */}
        {Array.from({ length: STRING_COUNT }).map((_, s) => (
          <div
            key={`str-${s}`}
            className="absolute inset-x-0 pointer-events-none"
            style={{
              top: tabTop + rowOfString(s) * STRING_GAP,
              height: 1,
              background: '#262626',
            }}
          />
        ))}

        {/* Bar lines (between measures) */}
        {Array.from({ length: numMeasures + 1 }).map((_, m) => {
          const beat = m * beatsPerBar;
          const leftPct = (beat / beatsInLine) * 100;
          const isEdge = m === 0 || m === numMeasures;
          return (
            <div
              key={`bar-${m}`}
              className="absolute pointer-events-none"
              style={{
                left: `${leftPct}%`,
                top: tabTop - 3,
                height: TAB_HEIGHT + 6,
                width: isEdge ? 2 : 1,
                background: isEdge ? '#5a5a5a' : '#3a3a3a',
              }}
            />
          );
        })}

        {/* Chord names row */}
        {chordAnnotations.map((c, i) => (
          <div
            key={`ch-${i}`}
            className="absolute font-bold pointer-events-none"
            style={{
              left: `${xPctForBeat(c.beat)}%`,
              top: LINE_INNER_PADDING,
              fontSize: 13,
              color: '#ffc233',
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: '0.02em',
              transform: 'translateX(-2px)',
              whiteSpace: 'nowrap',
            }}
          >
            {c.name}
          </div>
        ))}

        {/* Lyrics row */}
        {lyrics.map((l, i) => (
          <div
            key={`ly-${i}`}
            className="absolute pointer-events-none"
            style={{
              left: `${xPctForBeat(l.beat)}%`,
              top: LINE_INNER_PADDING + CHORD_ROW_HEIGHT,
              fontSize: 12,
              color: '#ededed',
              fontFamily: 'system-ui, sans-serif',
              transform: 'translateX(-2px)',
              whiteSpace: 'nowrap',
            }}
          >
            {l.text}
          </div>
        ))}

        {/* Beat-cursor for the active target — a tall dashed vertical line. */}
        {targets
          .filter((t) => t.id === currentTargetId)
          .map((t) => {
            const leftPct = xPctForBeat(t.beat);
            return (
              <div
                key={`cursor-${t.id}`}
                className="absolute pointer-events-none"
                style={{
                  left: `${leftPct}%`,
                  top: 2,
                  bottom: 2,
                  width: 1,
                  borderLeft: '1px dashed rgba(0, 255, 255, 0.5)',
                }}
              />
            );
          })}

        {/* Targets: fret numbers placed on each chord position's string */}
        {targets.map((target) => {
          const isChord = target.chord != null && target.chord.length > 1;
          const positions = isChord
            ? target.chord!
            : [{ string: target.string, fret: target.fret }];
          const isCurrent = target.id === currentTargetId;
          const isHit = hitTargetIds.has(target.id);
          const fillColor = isHit ? '#00ff88' : isCurrent ? '#00ffff' : '#ededed';
          const bgColor = isCurrent ? 'rgba(0, 255, 255, 0.18)' : '#0a0a0a';
          const borderColor = isCurrent ? 'rgba(0, 255, 255, 0.7)' : 'transparent';

          // Sorted from top to bottom on the tab so the chord-bracket line
          // connects them in visual order.
          const sortedPositions = [...positions].sort(
            (a, b) => rowOfString(a.string) - rowOfString(b.string),
          );

          const leftPct = xPctForBeat(target.beat);
          // Vertical bracket between top-most and bottom-most position when chord.
          const tops = sortedPositions.map((p) => tabTop + rowOfString(p.string) * STRING_GAP);
          const minTop = Math.min(...tops);
          const maxTop = Math.max(...tops);

          return (
            <div key={`tg-${target.id}`} className="contents">
              {isChord && positions.length > 1 && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${leftPct}%`,
                    top: minTop,
                    height: maxTop - minTop,
                    width: 1,
                    background: isCurrent ? '#00ffff' : '#3a3a3a',
                    opacity: 0.55,
                  }}
                />
              )}
              {sortedPositions.map((p, i) => {
                const top = tabTop + rowOfString(p.string) * STRING_GAP - 8;
                return (
                  <div
                    key={`tgp-${target.id}-${i}`}
                    className="absolute pointer-events-none flex items-center justify-center font-mono font-bold"
                    style={{
                      left: `${leftPct}%`,
                      top,
                      transform: 'translateX(-50%)',
                      minWidth: 16,
                      height: 16,
                      padding: '0 3px',
                      background: bgColor,
                      borderRadius: 3,
                      border: isCurrent ? `1px solid ${borderColor}` : 'none',
                      color: fillColor,
                      fontSize: 10,
                      lineHeight: '14px',
                    }}
                  >
                    {p.fret}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
