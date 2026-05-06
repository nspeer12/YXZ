'use client';

// Vertical Rocksmith-inspired note "highway", rendered with HTML/CSS.
//
// Notes scroll down toward the NOW line at the bottom; tokens have CONSTANT
// pixel sizes (depth cue is opacity, not growth — the grow-on-approach
// effect was distracting and warped the layout).
//
// Visual states:
//   - pending: dim gray (unplayed; preview only)
//   - active: white outline (in the hit window — NOT yet activated)
//   - hit: green pulse with ✓ (the only state that "lights up")
//   - missed: red dimmed with ✕
//
// Chords:
//   Rendered as a single name card on the highway (e.g. "Em ↓"). The chord
//   shape itself is shown in the lesson player's "Now" strip (live chord
//   diagram) and on the fretboard below — keeping the highway readable and
//   focused on TIMING.

import type { TargetNote } from '@/lib/guitar/grading';
import type { Tuning } from '@/lib/guitar/tuning';
import type { ChordAnnotation } from '@/lib/guitar/lesson-schema';

export type TargetStatus = 'pending' | 'active' | 'hit' | 'missed';

// Approximate Rocksmith palette: low E red, A yellow, D blue, G orange, B green, high E purple.
export const STRING_COLORS: Record<number, string> = {
  0: '#ff3535',
  1: '#ffc233',
  2: '#3aa3ff',
  3: '#ff8a2a',
  4: '#37db5b',
  5: '#b558ff',
};

// Standard guitar-string letter labels — non-color cue for colorblind users.
//   string 0 = low E (thickest), string 5 = high E (thinnest, lowercase by convention).
export const STRING_LETTERS: Record<number, string> = {
  0: 'E',
  1: 'A',
  2: 'D',
  3: 'G',
  4: 'B',
  5: 'e',
};

// Reference geometry — shared with the Fretboard so fret-X positions align.
const VIEWBOX_W = 1200;
const PAD_X = 40;
const FRET_MARKER_FRETS = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);

interface HighwayProps {
  targets: TargetNote[];
  /** Per-target status, indexed by target id. */
  statusById: Map<string, TargetStatus>;
  /** ms elapsed since the start of the exercise (may be NEGATIVE during lead-in). */
  elapsedMs: number;
  /** ms per beat at the current effective tempo. */
  msPerBeat: number;
  /** Tuning (used for string color count). */
  tuning: Tuning;
  /** Highest fret used by any target — drives the visible fret range. */
  maxFret: number;
  /** ms ahead of NOW we render. Default 3500. */
  lookaheadMs?: number;
  /** ms past NOW that a fading note remains visible. Default 350. */
  lookbackMs?: number;
  /** Render height in px. Default 340. */
  height?: number;
  /** Display-only chord-name annotations rendered as floating labels at their beats. */
  chordAnnotations?: ChordAnnotation[];
}

/** Convert a viewBox X coordinate (0..1200) to a CSS left percentage. */
function xPct(xViewbox: number): number {
  return (xViewbox / VIEWBOX_W) * 100;
}

/** Render center X (in viewBox units) for a played fret. */
function fretCenterX(fret: number, fretSpacing: number): number {
  if (fret === 0) return PAD_X - 22; // open: just left of the nut
  return PAD_X + (fret - 0.5) * fretSpacing;
}

/**
 * Pull a short chord name out of a target's label.
 *   "Em chord (root: E)" → "Em"
 *   "Am chord"            → "Am"
 *   "E5"                  → "E5"
 *   "Em7sus"              → "Em7sus"
 * Falls back to the empty string if no usable label.
 */
export function chordNameFromTarget(target: TargetNote): string {
  const raw = target.label?.trim();
  if (!raw) return '';
  // Strip trailing parenthetical like "(root: E)" or "(open)".
  const noParen = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
  // Strip trailing " chord" / " chord:" / " strum".
  const noSuffix = noParen.replace(/\s+(?:chord|strum)\b.*$/i, '').trim();
  // If we ate the whole thing, fall back to the original.
  return noSuffix || noParen || raw;
}

export function Highway({
  targets,
  statusById,
  elapsedMs,
  msPerBeat,
  tuning,
  maxFret,
  lookaheadMs = 3500,
  lookbackMs = 350,
  height = 340,
  chordAnnotations,
}: HighwayProps) {
  const stringCount = tuning.strings.length;
  const frets = Math.max(12, maxFret + 1);
  const boardW = VIEWBOX_W - PAD_X * 2;
  const fretSpacing = boardW / frets;
  const TOP_PAD = 28;
  const BOTTOM_PAD = 18;
  const nowLineY = height - BOTTOM_PAD;

  // Beat ticks scrolling down as horizontal background guides.
  const beatTicks: number[] = [];
  if (msPerBeat > 0) {
    const startBeat = Math.floor(elapsedMs / msPerBeat);
    for (let b = startBeat; b * msPerBeat - elapsedMs <= lookaheadMs; b++) {
      beatTicks.push(b);
    }
  }

  // Beat pulse on the NOW line — fades from 1 to 0 across each beat so the
  // NOW line briefly flashes at every metronome click. Helps the player feel
  // exactly WHEN to play a note vs. just where it is on screen.
  const beatPhase = msPerBeat > 0 ? Math.max(0, ((elapsedMs % msPerBeat) + msPerBeat) % msPerBeat) / msPerBeat : 0;
  const beatPulse = Math.max(0, 1 - beatPhase * 5); // sharp peak at beat boundary
  const nowGlowAlpha = 0.55 + 0.45 * beatPulse;
  const hitZoneHalfHeight = 26; // px above/below NOW that counts as the hit window visually

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-[#1f1f1f]"
      style={{
        height,
        background: 'linear-gradient(180deg, #050505 0%, #080808 70%, #0e0e0e 100%)',
      }}
    >
      {/* Vertical fret guide lines */}
      {Array.from({ length: frets + 1 }).map((_, f) => {
        if (f === 0) return null;
        const left = xPct(PAD_X + f * fretSpacing);
        const isMarker = FRET_MARKER_FRETS.has(f);
        return (
          <div
            key={`fret-${f}`}
            className="absolute pointer-events-none"
            style={{
              left: `${left}%`,
              top: TOP_PAD,
              bottom: BOTTOM_PAD,
              width: 1,
              background: isMarker ? '#1f1f1f' : '#141414',
            }}
          />
        );
      })}

      {/* Fret marker numbers at the top */}
      {Array.from({ length: frets }).map((_, idx) => {
        const realFret = idx + 1;
        if (!FRET_MARKER_FRETS.has(realFret)) return null;
        const left = xPct(PAD_X + (idx + 0.5) * fretSpacing);
        return (
          <span
            key={`top-${realFret}`}
            className="absolute font-mono pointer-events-none"
            style={{
              left: `${left}%`,
              top: 4,
              transform: 'translateX(-50%)',
              fontSize: 16,
              color: '#3a3a3a',
            }}
          >
            {realFret}
          </span>
        );
      })}

      {/* Beat tick lines */}
      {beatTicks.map((beat) => {
        const noteTimeMs = beat * msPerBeat;
        const offsetMs = noteTimeMs - elapsedMs;
        if (offsetMs < 0 || offsetMs > lookaheadMs) return null;
        const progress = 1 - offsetMs / lookaheadMs;
        const y = TOP_PAD + progress * (nowLineY - TOP_PAD);
        const isBar = beat % 4 === 0;
        const padPercent = xPct(PAD_X);
        return (
          <div
            key={`beat-${beat}`}
            className="absolute pointer-events-none"
            style={{
              left: `${padPercent}%`,
              right: `${padPercent}%`,
              top: y,
              borderTop: isBar ? '1px solid #222' : '1px dashed #141414',
              opacity: 0.7,
            }}
          />
        );
      })}

      {/* NOW glow leading into the line */}
      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          top: nowLineY - 60,
          height: 60,
          background: `linear-gradient(180deg, transparent, rgba(0,255,255,${0.12 + 0.18 * beatPulse}))`,
        }}
      />
      {/* HIT ZONE band — a clearly delimited window above the NOW line where
          a note "should land". Gives the player a visible target to aim at,
          like the strum bar in Guitar Hero. */}
      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          top: nowLineY - hitZoneHalfHeight,
          height: hitZoneHalfHeight,
          background: `linear-gradient(180deg, rgba(0,255,255,${0.04 + 0.08 * beatPulse}), rgba(0,255,255,${0.18 + 0.18 * beatPulse}))`,
          borderTop: '1px dashed rgba(0,255,255,0.32)',
        }}
      />
      {/* NOW line — pulses at every beat */}
      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          top: nowLineY - 1,
          height: 3,
          background: '#00ffff',
          boxShadow: `0 0 ${10 + 22 * beatPulse}px rgba(0,255,255,${nowGlowAlpha})`,
          opacity: nowGlowAlpha,
        }}
      />
      {/* Bottom shadow band — visually catches notes that pass NOW so they
          fade out cleanly. */}
      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          top: nowLineY + 2,
          height: 14,
          background: 'linear-gradient(180deg, rgba(0,255,255,0.08), transparent)',
        }}
      />
      <span
        className="absolute font-mono pointer-events-none"
        style={{
          left: `calc(${xPct(PAD_X)}% - 2px)`,
          top: nowLineY - 14,
          fontSize: 10,
          letterSpacing: '0.18em',
          color: '#00ffff',
          opacity: 0.85,
          transform: 'translateX(-100%)',
        }}
      >
        NOW
      </span>

      {/* Targets — sort back-to-front so closer notes paint on top. */}
      {[...targets]
        .sort((a, b) => b.beat - a.beat)
        .map((target) => {
          const noteTimeMs = target.beat * msPerBeat;
          const offsetMs = noteTimeMs - elapsedMs;
          if (offsetMs > lookaheadMs + 200) return null;
          if (offsetMs < -lookbackMs) return null;

          const progressRaw = 1 - offsetMs / lookaheadMs; // 0 at top, 1 at NOW, >1 past
          const progressClamped = Math.max(0, Math.min(1, progressRaw));
          const yCenter = TOP_PAD + progressRaw * (nowLineY - TOP_PAD);

          const status = statusById.get(target.id) ?? 'pending';

          // Single-note vs. chord
          const isChord = target.chord != null && target.chord.length > 1;

          if (!isChord) {
            const stringNudgeY = (target.string - (stringCount - 1) / 2) * 4;
            const cx = fretCenterX(target.fret, fretSpacing);
            const left = xPct(cx);
            const yPx = yCenter + stringNudgeY;

            return (
              <NoteToken
                key={`${target.id}-${target.beat}`}
                target={target}
                string={target.string}
                fret={target.fret}
                leftPct={left}
                yPx={yPx}
                progress={progressClamped}
                status={status}
                isPrimary
              />
            );
          }

          // Chord: render a single labeled card per beat. Constant size so
          // depth-via-growth doesn't warp readability — opacity carries the
          // depth cue. The Now strip's chord diagram (in LessonPlayer) shows
          // the voicing when the chord is at NOW; this card is just the
          // chord name + strum direction.
          const chordName = chordNameFromTarget(target) || 'Chord';

          // Place the card at the chord's average fret column so it scrolls
          // down a sensible lane on the highway.
          const avgFret =
            target.chord!.reduce((s, c) => s + c.fret, 0) / target.chord!.length;
          const cx = fretCenterX(avgFret, fretSpacing);
          const left = xPct(cx);

          const cardW = 78;
          const cardH = 36;

          const styling = chordCardStyling(status, progressClamped);
          const trailLen = Math.min(120, cardW * 2);

          return (
            <div
              key={`${target.id}-${target.beat}`}
              className="absolute pointer-events-none"
              style={{
                left: `${left}%`,
                top: yCenter,
                transform: 'translate(-50%, -50%)',
                opacity: styling.opacity,
              }}
            >
              {/* Trail */}
              <div
                className="absolute"
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)',
                  top: -trailLen - cardH / 2 + 2,
                  width: 2,
                  height: trailLen,
                  background: `linear-gradient(180deg, transparent, ${styling.trailColor})`,
                  opacity: 0.35,
                  borderRadius: 2,
                }}
              />
              {/* Chord card */}
              <div
                className="rounded-md border flex items-center justify-center gap-1.5"
                style={{
                  width: cardW,
                  height: cardH,
                  background: styling.bg,
                  borderColor: styling.border,
                  borderWidth: styling.borderWidth,
                  boxShadow: styling.glow,
                  transition: 'background-color 100ms, border-color 100ms, box-shadow 100ms',
                }}
              >
                <span
                  style={{
                    color: styling.text,
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: '0.03em',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    lineHeight: 1,
                  }}
                >
                  {chordName}
                </span>
                {/* Strum direction marker. Default ↓; targets can opt into ↑
                    (or "x" for muted strum) via the optional `strum` field. */}
                <span
                  style={{
                    color: styling.text,
                    fontSize: 12,
                    opacity: 0.85,
                    lineHeight: 1,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  {strumGlyph(target.strum)}
                </span>
                {status === 'hit' && (
                  <span style={{ color: styling.text, fontSize: 12, lineHeight: 1 }}>✓</span>
                )}
                {status === 'missed' && (
                  <span style={{ color: styling.text, fontSize: 12, lineHeight: 1 }}>✕</span>
                )}
              </div>
            </div>
          );
        })}

      {/* Chord-annotation labels — display-only chord-name markers anchored
          to a beat. Smaller and more subtle than chord targets; they don't
          glow or get graded. Useful for songs where the chord progression
          is shown over a riff that's actually graded. */}
      {chordAnnotations && chordAnnotations.length > 0 && chordAnnotations.map((c) => {
        const noteTimeMs = c.beat * msPerBeat;
        const offsetMs = noteTimeMs - elapsedMs;
        if (offsetMs > lookaheadMs + 200) return null;
        if (offsetMs < -lookbackMs * 2) return null;
        const progressRaw = 1 - offsetMs / lookaheadMs;
        const progressClamped = Math.max(0, Math.min(1, progressRaw));
        const y = TOP_PAD + progressRaw * (nowLineY - TOP_PAD);
        const opacity = Math.max(0.45, progressClamped);
        return (
          <div
            key={`anno-${c.beat}-${c.name}`}
            className="absolute pointer-events-none"
            style={{
              left: '50%',
              top: y,
              transform: 'translate(-50%, -50%)',
              opacity,
            }}
          >
            <div
              className="px-2 py-0.5 rounded font-bold"
              style={{
                background: 'rgba(255, 170, 0, 0.12)',
                border: '1px solid rgba(255, 170, 0, 0.35)',
                color: '#ffc233',
                fontSize: 12 + 4 * progressClamped,
                letterSpacing: '0.04em',
                fontFamily: 'system-ui, sans-serif',
                textShadow: '0 0 6px rgba(0,0,0,0.7)',
                whiteSpace: 'nowrap',
              }}
            >
              {c.name}
            </div>
          </div>
        );
      })}

      {/* Bottom fret-number ribbon */}
      {Array.from({ length: frets }).map((_, idx) => {
        const realFret = idx + 1;
        const left = xPct(PAD_X + (idx + 0.5) * fretSpacing);
        const major = FRET_MARKER_FRETS.has(realFret);
        return (
          <span
            key={`bot-${realFret}`}
            className="absolute font-mono pointer-events-none"
            style={{
              left: `${left}%`,
              bottom: 2,
              transform: 'translateX(-50%)',
              fontSize: 10,
              color: major ? '#888' : '#3a3a3a',
            }}
          >
            {realFret}
          </span>
        );
      })}
    </div>
  );
}

interface NoteTokenProps {
  target: TargetNote;
  string: number;
  fret: number;
  leftPct: number;
  yPx: number;
  progress: number; // 0..1 (top to NOW)
  status: TargetStatus;
  isPrimary: boolean;
}

function NoteToken({ string, fret, leftPct, yPx, progress, status, isPrimary }: NoteTokenProps) {
  const baseColor = STRING_COLORS[string] ?? '#888';

  // Constant size. Depth cue comes from opacity, not from growth — the
  // grow-on-approach effect was distracting and warped the layout.
  const w = isPrimary ? 38 : 30;
  const h = w * 0.74;

  let bg = baseColor;
  let textColor = '#000';
  let opacity = isPrimary ? 1 : 0.9;
  let glow: string | undefined = `0 0 ${w * 0.35}px ${baseColor}66`;
  let borderColor: string | undefined;
  let borderWidth = 0;
  let symbol: string | null = null;

  if (status === 'hit') {
    // Activated only on hit — green pulse with checkmark.
    bg = '#00ff88';
    textColor = '#000';
    glow = `0 0 ${w * 0.7}px rgba(0,255,136,0.7)`;
    opacity = 0.65;
    symbol = '✓';
  } else if (status === 'missed') {
    // Missed — red dimmed with an ✕.
    bg = '#2a1010';
    textColor = '#ff8080';
    glow = `0 0 ${w * 0.3}px rgba(255,68,68,0.25)`;
    borderColor = '#7a2a2a';
    borderWidth = 1;
    opacity = 0.55;
    symbol = '✕';
  } else if (status === 'active') {
    // In the hit window — neutral white outline, no fill change. The card
    // only "activates" once the player actually nails the note.
    bg = '#1a1a1a';
    textColor = '#ededed';
    borderColor = '#ffffff';
    borderWidth = 1.5;
    glow = `0 0 ${w * 0.45}px rgba(255,255,255,0.35)`;
    opacity = 1;
  } else {
    // pending — gray, fading in as it approaches.
    bg = '#2a2a2a';
    textColor = '#bdbdbd';
    glow = undefined;
    borderColor = baseColor;
    borderWidth = 1;
    opacity = (isPrimary ? 0.95 : 0.8) * Math.max(0.4, 0.4 + progress * 0.6);
  }

  // Trail above the note.
  const trailLen = Math.min(120, w * 3.2);

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${leftPct}%`,
        top: yPx,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Trail */}
      <div
        className="absolute"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          top: -trailLen - h / 2 + 2,
          width: 2,
          height: trailLen,
          background: `linear-gradient(180deg, transparent, ${baseColor})`,
          opacity: status === 'pending' ? 0.25 : 0.4,
          borderRadius: 2,
        }}
      />
      {/* Note token */}
      <div
        className="rounded-md flex items-center justify-center font-mono font-bold leading-none"
        style={{
          width: w,
          height: h,
          background: bg,
          color: textColor,
          opacity,
          borderColor,
          borderWidth,
          borderStyle: borderWidth ? 'solid' : undefined,
          boxShadow: glow,
          fontSize: fret >= 10 ? 12 : 14,
          transition: 'background-color 100ms, opacity 120ms, box-shadow 100ms, border-color 100ms',
        }}
      >
        {symbol ? `${symbol} ${fret}` : fret}
      </div>
    </div>
  );
}

// ---------- Status styling helpers ----------

interface CardStyling {
  bg: string;
  border: string;
  text: string;
  trailColor: string;
  glow: string | undefined;
  borderWidth: number;
  opacity: number;
}

function chordCardStyling(status: TargetStatus, progress: number): CardStyling {
  switch (status) {
    case 'hit':
      return {
        bg: 'rgba(0, 60, 36, 0.92)',
        border: '#00ff88',
        text: '#00ff88',
        trailColor: '#00ff88',
        glow: '0 0 22px rgba(0,255,136,0.55)',
        borderWidth: 1.5,
        opacity: 0.7,
      };
    case 'missed':
      return {
        bg: 'rgba(38, 12, 12, 0.9)',
        border: '#7a2a2a',
        text: '#ff8080',
        trailColor: '#ff6b35',
        glow: '0 0 14px rgba(255,68,68,0.25)',
        borderWidth: 1,
        opacity: 0.6,
      };
    case 'active':
      // In hit window — neutral white outline, NOT yet activated.
      return {
        bg: 'rgba(20,20,20,0.95)',
        border: '#ffffff',
        text: '#ededed',
        trailColor: '#cccccc',
        glow: '0 0 18px rgba(255,255,255,0.3)',
        borderWidth: 1.5,
        opacity: 1,
      };
    default:
      // pending — subtle gray that fades in.
      return {
        bg: 'rgba(28,28,28,0.88)',
        border: '#3a3a3a',
        text: '#cfcfcf',
        trailColor: '#666',
        glow: undefined,
        borderWidth: 1,
        opacity: Math.max(0.5, 0.4 + progress * 0.6),
      };
  }
}

function strumGlyph(strum?: string): string {
  if (strum === 'up') return '↑';
  if (strum === 'mute') return '×';
  return '↓';
}
