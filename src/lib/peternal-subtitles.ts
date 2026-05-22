// Subtitle utilities for burned synced captions in Peternal tribute videos.

export interface NarrationWord {
  word: string;
  startMs: number;
  endMs: number;
}

export type NarrationTimestamps = NarrationWord[];

export interface SubtitleCue {
  startMs: number;
  endMs: number;
  lines: string[];
}

// ---------------------------------------------------------------------------
// normalizeTimestamps — accepts three shapes, returns null on anything else.
// ---------------------------------------------------------------------------
export function normalizeTimestamps(raw: unknown): NarrationWord[] | null {
  if (!raw || typeof raw !== 'object') return null;

  // Shape (a): ElevenLabs character-level
  if (
    'characters' in (raw as Record<string, unknown>) &&
    'character_start_times_seconds' in (raw as Record<string, unknown>)
  ) {
    const r = raw as {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    };
    if (!Array.isArray(r.characters) || r.characters.length === 0) return null;
    const words: NarrationWord[] = [];
    let wordChars: string[] = [];
    let wordStart = 0;
    let wordEnd = 0;
    const flush = () => {
      if (wordChars.length === 0) return;
      const w = wordChars.join('').trim();
      if (w) words.push({ word: w, startMs: Math.round(wordStart * 1000), endMs: Math.round(wordEnd * 1000) });
      wordChars = [];
    };
    for (let i = 0; i < r.characters.length; i++) {
      const ch = r.characters[i];
      const st = r.character_start_times_seconds[i] ?? 0;
      const en = r.character_end_times_seconds[i] ?? st;
      if (/\s/.test(ch)) {
        flush();
      } else {
        if (wordChars.length === 0) wordStart = st;
        wordChars.push(ch);
        wordEnd = en;
      }
    }
    flush();
    return words.length > 0 ? words : null;
  }

  // Shape (b): word-level array
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    const first = raw[0] as Record<string, unknown>;
    if (typeof first !== 'object' || first === null) return null;
    if (!('word' in first || 'text' in first)) return null;

    const looksLikeSeconds = (v: unknown) => typeof v === 'number' && v < 10000;

    const words: NarrationWord[] = [];
    for (const item of raw as Record<string, unknown>[]) {
      const word = String(item.word ?? item.text ?? '').trim();
      if (!word) continue;
      let start = (item.start ?? item.start_time ?? 0) as number;
      let end = (item.end ?? item.end_time ?? start) as number;
      if (looksLikeSeconds(start)) start = start * 1000;
      if (looksLikeSeconds(end)) end = end * 1000;
      words.push({ word, startMs: Math.round(start), endMs: Math.round(end) });
    }
    return words.length > 0 ? words : null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// wrapText — pack words into exactly ≤ 2 lines of ≤ maxChars.
// All words are represented — none are dropped.
// ---------------------------------------------------------------------------
function wrapText(words: string[], maxChars: number): string[] {
  if (words.length === 0) return [];
  let line1 = '';
  let splitAt = words.length; // index where line 2 starts (default: everything on line 1)
  for (let i = 0; i < words.length; i++) {
    const candidate = i === 0 ? words[i] : `${line1} ${words[i]}`;
    if (candidate.length > maxChars && i > 0) {
      splitAt = i;
      break;
    }
    line1 = candidate;
  }
  if (splitAt === words.length) {
    // All words fit on one line.
    return [line1];
  }
  // Remaining words go on line 2, joined regardless of length.
  const line2 = words.slice(splitAt).join(' ');
  return [line1, line2];
}

const PHRASE_SPLIT_RE = /(?<=[.…;—?!,])\s+|(?=[\n])/g;
const MAX_CUE_WORDS = 8;
const MAX_LINE_CHARS = 32;

// ---------------------------------------------------------------------------
// buildSubtitleCues
// ---------------------------------------------------------------------------
export function buildSubtitleCues({
  script,
  timestamps,
  narrationDurationMs,
}: {
  script: string;
  timestamps: NarrationWord[] | null;
  narrationDurationMs: number;
}): SubtitleCue[] {
  // Split script into raw phrases.
  const rawPhrases = script
    .replace(/\r\n/g, '\n')
    .split(PHRASE_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);

  // Pack phrases into cues of ≤ MAX_CUE_WORDS.
  const cueWordGroups: string[][] = [];
  let current: string[] = [];
  for (const phrase of rawPhrases) {
    const phraseWords = phrase.split(/\s+/).filter(Boolean);
    if (current.length + phraseWords.length > MAX_CUE_WORDS && current.length > 0) {
      cueWordGroups.push(current);
      current = phraseWords;
    } else {
      current = current.concat(phraseWords);
    }
  }
  if (current.length > 0) cueWordGroups.push(current);

  if (cueWordGroups.length === 0) return [];

  // Build lines for each cue (≤ 2 lines, no words dropped).
  const cueLines: string[][] = cueWordGroups.map((words) => wrapText(words, MAX_LINE_CHARS));

  // Sanity-check timestamps: if the last word's endMs is implausibly beyond
  // the narration duration (e.g. wrong units), discard and fall back to
  // even-distribution below.
  const timestampsValid =
    timestamps &&
    timestamps.length > 0 &&
    timestamps[timestamps.length - 1].endMs <= narrationDurationMs * 1.05;

  if (timestampsValid) {
    // Map each cue to its word range in the flat word list.
    const ts = timestamps as NarrationWord[];
    let globalWordIdx = 0;
    const cues: SubtitleCue[] = [];
    for (let c = 0; c < cueWordGroups.length; c++) {
      const wordCount = cueWordGroups[c].length;
      const firstIdx = globalWordIdx;
      const lastIdx = Math.min(globalWordIdx + wordCount - 1, ts.length - 1);
      globalWordIdx += wordCount;

      const firstWord = ts[Math.min(firstIdx, ts.length - 1)];
      const lastWord = ts[lastIdx];
      if (!firstWord || !lastWord) continue;

      const rawStart = firstWord.startMs - 120;
      const rawEnd = lastWord.endMs + 200;
      const startMs = Math.max(0, rawStart);
      const endMs = Math.min(rawEnd, narrationDurationMs);

      // Clamp so cues never overlap previous.
      const prevEnd = cues.length > 0 ? cues[cues.length - 1].endMs : 0;
      const clampedStart = Math.max(startMs, prevEnd + 1);
      if (clampedStart >= endMs) continue;
      if (clampedStart >= narrationDurationMs) continue;

      cues.push({ startMs: clampedStart, endMs, lines: cueLines[c] });
    }
    return cues;
  }

  // No timestamps — distribute evenly weighted by char count.
  const totalChars = cueWordGroups.reduce((s, w) => s + w.join(' ').length, 0) || 1;
  const cues: SubtitleCue[] = [];
  let cursor = 0;
  for (let c = 0; c < cueWordGroups.length; c++) {
    const weight = cueWordGroups[c].join(' ').length / totalChars;
    const rawDuration = Math.round(narrationDurationMs * weight);
    const duration = Math.max(rawDuration, 1200);
    const startMs = cursor;
    const endMs = Math.min(cursor + duration, narrationDurationMs);
    cursor += duration; // advance by clamped duration so next cue starts at or after this one ends
    if (startMs >= narrationDurationMs) break;
    cues.push({ startMs, endMs, lines: cueLines[c] });
  }
  return cues;
}

// ---------------------------------------------------------------------------
// ASS time format: H:MM:SS.cc (centiseconds)
// ---------------------------------------------------------------------------
function msToAss(ms: number): string {
  const totalCs = Math.round(ms / 10);
  const cs = totalCs % 100;
  const totalS = Math.floor(totalCs / 100);
  const s = totalS % 60;
  const totalM = Math.floor(totalS / 60);
  const m = totalM % 60;
  const h = Math.floor(totalM / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// Escape { } in cue text (ASS override tags) and backslashes.
function escapeAssText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

// ---------------------------------------------------------------------------
// buildAssFile
// ---------------------------------------------------------------------------
export function buildAssFile(
  cues: SubtitleCue[],
  { width, height }: { width: number; height: number },
): string {
  const fs = Math.round(width * 0.05);
  const mv = Math.round(height * 0.025);

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Sub,Inter,${fs},&H00E8F1F4,&H000000FF,&H00000000,&HB4140F0A,0,0,0,0,100,100,0,0,4,18,18,2,80,80,${mv},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n');

  const dialogues = cues.map((cue) => {
    const start = msToAss(cue.startMs);
    const end = msToAss(cue.endMs);
    const line1 = escapeAssText(cue.lines[0] ?? '');
    const line2 = escapeAssText(cue.lines[1] ?? '');
    const text = cue.lines.length >= 2 ? `{\\fad(220,220)}${line1}\\N${line2}` : `{\\fad(220,220)}${line1}`;
    return `Dialogue: 0,${start},${end},Sub,,0,0,0,,${text}`;
  });

  return header + '\n' + dialogues.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// escapeFilterPath — escape path for use in ffmpeg ass= filter option.
// ---------------------------------------------------------------------------
export function escapeFilterPath(p: string): string {
  // Normalize to forward slashes first so Windows drive-letter colons (C:)
  // are gone before we escape the remaining genuine ffmpeg special chars.
  const forward = p.replace(/\\/g, '/');
  return forward.replace(/:/g, '\\:').replace(/'/g, "\\'");
}
