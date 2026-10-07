// Pure, deterministic song↔scene alignment planner. No I/O — the caller fetches
// Suno's word-level timestamps and passes them in; this module only does math.
//
// Productizes the manual fix proven on real tributes: a Suno lyric song's sung
// timing rarely lines up with the fixed beat grid (opening card + beatCount*
// perBeatMs + closing card). Two knobs close the gap without ever touching a
// lyric: trimming the song's silent/instrumental intro, and holding the closing
// card a little longer so the last sung word never gets cut off.

export interface AlignedWordLite {
  word: string;
  startS: number;
  endS: number;
}

export interface LyricFitOptions {
  videoSeconds: number;      // full video length incl. cards
  cardLeadSec: number;       // opening-card seconds (beats start after this)
  maxTrimSec?: number;       // default 12
  maxCardExtraSec?: number;  // default 2 — how much closing-card hold we may add
  tailFadeSec?: number;      // default 2.5 — compose's end fade
}

export interface LyricFitReport {
  trimSec: number;               // recommended intro trim (0.5s grid)
  cardExtraMs: number;           // extra closing-card ms needed for the last line (0 if none)
  meanAbsErrorSec: number;       // mean |sungTime - targetTime| across matched lines, after trim
  matchedLines: number;
  totalLines: number;
  tailClipped: boolean;          // true if last sung word still lands past video end + extra
  lines: { line: string; targetS: number; sungS: number | null; afterTrimS: number | null }[];
}

// A large-but-finite sentinel for "no matched lines" so the report stays JSON-safe.
const NO_MATCH_ERROR_SEC = 999;

function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

// First 3 significant (>2 chars once normalized) words of a lyric line, in order.
function significantWords(line: string): string[] {
  return line
    .split(/\s+/)
    .map(normalizeWord)
    .filter((w) => w.length > 2)
    .slice(0, 3);
}

export function planLyricFit(
  words: AlignedWordLite[],
  lyricLines: string[],
  opts: LyricFitOptions,
): LyricFitReport {
  const maxTrimSec = opts.maxTrimSec ?? 12;
  const maxCardExtraSec = opts.maxCardExtraSec ?? 2;

  const normWords = words.map((w) => ({ ...w, norm: normalizeWord(w.word) }));
  const totalLines = lyricLines.length;

  // Forward-only cursor: lines must match in order, so once a word is consumed
  // by a line it's never reused by an earlier-in-source (but later-scanned) line.
  let cursor = 0;
  const lines: LyricFitReport["lines"] = [];

  for (let i = 0; i < lyricLines.length; i++) {
    const line = lyricLines[i];
    const targetS = totalLines > 0
      ? opts.cardLeadSec + (i / totalLines) * (opts.videoSeconds - opts.cardLeadSec * 2)
      : opts.cardLeadSec;
    const sig = significantWords(line);

    let sungS: number | null = null;
    if (sig.length > 0) {
      let searchCursor = cursor;
      let firstIdx: number | null = null;
      let ok = true;
      for (const target of sig) {
        let found = -1;
        for (let j = searchCursor; j < normWords.length; j++) {
          if (normWords[j].norm === target) { found = j; break; }
        }
        if (found === -1) { ok = false; break; }
        if (firstIdx === null) firstIdx = found;
        searchCursor = found + 1;
      }
      if (ok && firstIdx !== null) {
        sungS = normWords[firstIdx].startS;
        cursor = searchCursor;
      }
    }

    lines.push({ line, targetS, sungS, afterTrimS: null });
  }

  const firstMatched = lines.find((l) => l.sungS !== null) ?? null;
  const firstSungWordStart = firstMatched?.sungS ?? 0;
  const maxT = Math.max(0, Math.min(maxTrimSec, firstSungWordStart - 0.5));

  let bestT = 0;
  let bestErr = Infinity;
  for (let T = 0; T <= maxT + 1e-9; T += 0.5) {
    let sum = 0;
    let n = 0;
    for (const l of lines) {
      if (l.sungS === null) continue;
      sum += Math.abs((l.sungS - T) - l.targetS);
      n++;
    }
    const err = n > 0 ? sum / n : Infinity;
    if (err < bestErr) { bestErr = err; bestT = T; }
  }

  const matchedLines = lines.filter((l) => l.sungS !== null).length;
  for (const l of lines) {
    l.afterTrimS = l.sungS !== null ? l.sungS - bestT : null;
  }

  // Last sung word overall (matches the vocalEndSec convention: largest endS
  // over real, non-whitespace words) — this is what the closing card must cover.
  let lastWordEnd = 0;
  for (const w of normWords) {
    if (w.word && w.word.trim().length > 0 && Number.isFinite(w.endS) && w.endS > lastWordEnd) {
      lastWordEnd = w.endS;
    }
  }
  const lastWordEndAfterTrim = lastWordEnd - bestT;

  let cardExtraMs = 0;
  let tailClipped = false;
  if (lastWordEndAfterTrim > opts.videoSeconds - 0.5) {
    if (lastWordEndAfterTrim <= opts.videoSeconds + maxCardExtraSec) {
      const rounded = Math.ceil(((lastWordEndAfterTrim - (opts.videoSeconds - 0.5)) * 1000) / 500) * 500;
      cardExtraMs = Math.min(maxCardExtraSec * 1000, rounded);
    } else {
      tailClipped = true;
      cardExtraMs = maxCardExtraSec * 1000;
    }
  }

  return {
    trimSec: bestT,
    cardExtraMs,
    meanAbsErrorSec: Number.isFinite(bestErr) ? bestErr : NO_MATCH_ERROR_SEC,
    matchedLines,
    totalLines,
    tailClipped,
    lines,
  };
}

// Lowest meanAbsErrorSec among fits whose tail isn't clipped; if all are
// clipped (or the list is empty of non-clipped options), fall back to the
// lowest meanAbsErrorSec overall.
export function pickBestFit(fits: LyricFitReport[]): number {
  let bestIdx = -1;
  let bestErr = Infinity;
  for (let i = 0; i < fits.length; i++) {
    if (fits[i].tailClipped) continue;
    if (fits[i].meanAbsErrorSec < bestErr) { bestErr = fits[i].meanAbsErrorSec; bestIdx = i; }
  }
  if (bestIdx !== -1) return bestIdx;

  bestErr = Infinity;
  for (let i = 0; i < fits.length; i++) {
    if (fits[i].meanAbsErrorSec < bestErr) { bestErr = fits[i].meanAbsErrorSec; bestIdx = i; }
  }
  return bestIdx;
}
