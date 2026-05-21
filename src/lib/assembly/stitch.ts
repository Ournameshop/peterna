import 'server-only';

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import ffmpegStatic from 'ffmpeg-static';

/**
 * Phase 7 (Stage 7) — Assembly.
 *
 * Stitches N approved Seedance clips plus optional opening + closing card
 * stills + optional background music into a single MP4. Clips already carry
 * their own ambient audio (Stage 6 generates with audio ON) — music, when
 * present, is mixed underneath at a quiet bed level.
 *
 * Stitching strategy (kept conservative — hard cuts, no transitions):
 *   1. Convert opening + closing card stills (PNG) into 5-second silent
 *      MP4 segments at the session's aspect ratio. The Stage 5.6 card
 *      preview already locked the typography, so we use those rendered
 *      stills directly — no font rendering inside ffmpeg.
 *   2. Concat: [opening_card.mp4] + clip[0..N-1] + [closing_card.mp4].
 *      Uses the concat demuxer with a re-encode pass (all inputs may
 *      differ in codec params after the still→video conversion), which
 *      is the safer path even though it's slower.
 *   3. If a music track is supplied: mix the music in at -18dB beneath
 *      the existing clip audio (already mixed by Seedance) and fade out
 *      over the last 2 seconds. If `silence` was picked at Stage 5.5,
 *      skip the music pass entirely — the clip audio carries the tribute.
 *   4. If narration audio is supplied: layer it ON TOP of the music pass
 *      at full volume (-3dB normalized in the calling route). The route
 *      passes a buffer if/when ElevenLabs narration is wired (Phase 8+ —
 *      Phase 7 will commonly run without narration).
 *
 * Returns the final MP4 buffer. Caller uploads to S3 and inserts the
 * `final_video` asset row.
 *
 * NOT a single ffmpeg invocation — we do several passes through tmpfiles
 * because Node-side composability is easier to reason about than a 50-
 * arg ffmpeg filter graph. The CPU cost is local + free; the wall-clock
 * cost (30–90s per assembly) is acceptable inside `maxDuration=300`.
 */

const FFMPEG_BIN = (ffmpegStatic as unknown as string | null) ?? 'ffmpeg';

if (typeof FFMPEG_BIN !== 'string' || !FFMPEG_BIN) {
  throw new Error('ffmpeg-static did not resolve a binary path');
}

export type AssemblyAspect = '9:16' | '16:9' | '1:1';

export type AssemblyInput = {
  /** Approved Seedance MP4 clip buffers, in beat order. */
  clipBuffers: Buffer[];
  /** Optional opening card still (PNG bytes). Held 5s, silent. */
  openingCardPng?: Buffer | null;
  /** Optional closing card still (PNG bytes). Held 5s, silent. */
  closingCardPng?: Buffer | null;
  /**
   * Optional background music — MP3 / OGG / WAV buffer. When supplied,
   * mixed at `MUSIC_BED_DB` underneath the clip audio. When null and the
   * user picked `silence`, no music pass runs.
   */
  musicBuffer?: Buffer | null;
  musicFilename?: string;
  /**
   * Optional narration audio — MP3 / WAV. Layered at full volume on top
   * of the music bed. Phase 7 will typically run without narration; the
   * narration pipeline lights up in a later phase.
   */
  narrationBuffer?: Buffer | null;
  narrationFilename?: string;
  /** Session aspect ratio — drives the still→video size for the cards. */
  aspect: AssemblyAspect;
};

export type AssemblyOutput = {
  bytes: Buffer;
  mimeType: 'video/mp4';
  durationMs: number;
};

/** Music sits at -18dB beneath the clip audio per spec line 1193. */
const MUSIC_BED_DB = -18;
/** Card stills held this long (seconds). Matches the spec's 5s caption fade window. */
const CARD_HOLD_S = 5;

export async function stitchTribute(input: AssemblyInput): Promise<AssemblyOutput> {
  if (input.clipBuffers.length === 0) {
    throw new Error('stitchTribute called with zero clips');
  }

  const t0 = performance.now();
  const work = await mkdtemp(path.join(tmpdir(), 'peternal-assembly-'));

  try {
    // 1. Write all input artifacts to disk.
    const clipPaths: string[] = [];
    for (let i = 0; i < input.clipBuffers.length; i++) {
      const p = path.join(work, `clip-${String(i).padStart(2, '0')}.mp4`);
      await writeFile(p, input.clipBuffers[i]!);
      clipPaths.push(p);
    }

    // 2. Render card stills (if supplied) into 5s silent video segments.
    const cardSize = sizeForAspect(input.aspect);
    let openingCardVideoPath: string | null = null;
    if (input.openingCardPng) {
      const pngPath = path.join(work, 'opening-card.png');
      await writeFile(pngPath, input.openingCardPng);
      openingCardVideoPath = path.join(work, 'opening-card.mp4');
      await stillToVideo(pngPath, openingCardVideoPath, CARD_HOLD_S, cardSize);
    }
    let closingCardVideoPath: string | null = null;
    if (input.closingCardPng) {
      const pngPath = path.join(work, 'closing-card.png');
      await writeFile(pngPath, input.closingCardPng);
      closingCardVideoPath = path.join(work, 'closing-card.mp4');
      await stillToVideo(pngPath, closingCardVideoPath, CARD_HOLD_S, cardSize);
    }

    // 3. Concat all segments (card + clips + card) into one MP4. Force a
    //    re-encode pass so codec params normalize across the still-derived
    //    cards and the Seedance clips.
    const concatList = [
      ...(openingCardVideoPath ? [openingCardVideoPath] : []),
      ...clipPaths,
      ...(closingCardVideoPath ? [closingCardVideoPath] : []),
    ];

    const concatListPath = path.join(work, 'concat.txt');
    await writeFile(
      concatListPath,
      concatList.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'),
    );

    const concatOutPath = path.join(work, 'concat.mp4');
    await runFfmpeg([
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatListPath,
      // Normalize the size of each segment to the same canvas — the card
      // stills come in at the requested size already, but Seedance may
      // emit non-pixel-exact dimensions; force scale + pad to the target.
      '-vf',
      `scale=${cardSize.w}:${cardSize.h}:force_original_aspect_ratio=decrease,pad=${cardSize.w}:${cardSize.h}:(ow-iw)/2:(oh-ih)/2:color=black,fps=30`,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      '-y',
      concatOutPath,
    ]);

    // 4. Music / narration mixing — optional.
    let finalPath = concatOutPath;
    const hasMusic = Boolean(input.musicBuffer);
    const hasNarration = Boolean(input.narrationBuffer);

    if (hasMusic || hasNarration) {
      const mixedPath = path.join(work, 'mixed.mp4');
      finalPath = mixedPath;

      // Probe duration of the concat output so we can size the music tail fade.
      const totalDurationS = await probeDurationSeconds(concatOutPath);

      const args: string[] = ['-i', concatOutPath];
      let musicInputIdx: number | null = null;
      let narrationInputIdx: number | null = null;
      let nextIdx = 1;

      if (input.musicBuffer) {
        const musicPath = path.join(work, input.musicFilename ?? 'music.mp3');
        await writeFile(musicPath, input.musicBuffer);
        args.push('-i', musicPath);
        musicInputIdx = nextIdx;
        nextIdx += 1;
      }
      if (input.narrationBuffer) {
        const narrationPath = path.join(work, input.narrationFilename ?? 'narration.mp3');
        await writeFile(narrationPath, input.narrationBuffer);
        args.push('-i', narrationPath);
        narrationInputIdx = nextIdx;
        nextIdx += 1;
      }

      // amix combines the clip audio (input 0) + music (-18dB) + narration (0dB).
      // We attenuate the music to MUSIC_BED_DB BEFORE the mix so amix's
      // automatic-normalization doesn't pull it back up.
      const filterParts: string[] = [];
      const mixLabels: string[] = ['[0:a]'];
      if (musicInputIdx != null) {
        filterParts.push(
          `[${musicInputIdx}:a]volume=${MUSIC_BED_DB}dB,afade=t=out:st=${Math.max(0, totalDurationS - 2)}:d=2[music]`,
        );
        mixLabels.push('[music]');
      }
      if (narrationInputIdx != null) {
        filterParts.push(`[${narrationInputIdx}:a]volume=0dB[narr]`);
        mixLabels.push('[narr]');
      }
      filterParts.push(
        `${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=first:normalize=0[aout]`,
      );

      args.push(
        '-filter_complex',
        filterParts.join(';'),
        '-map',
        '0:v',
        '-map',
        '[aout]',
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-shortest',
        '-movflags',
        '+faststart',
        '-y',
        mixedPath,
      );

      await runFfmpeg(args);
    }

    const bytes = await readFile(finalPath);
    return {
      bytes,
      mimeType: 'video/mp4',
      durationMs: Math.round(performance.now() - t0),
    };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {
      // tmpdir cleanup is best-effort
    });
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type Size = { w: number; h: number };

function sizeForAspect(aspect: AssemblyAspect): Size {
  switch (aspect) {
    case '9:16':
      return { w: 1080, h: 1920 };
    case '16:9':
      return { w: 1920, h: 1080 };
    case '1:1':
      return { w: 1080, h: 1080 };
  }
}

/**
 * Convert a still PNG to a 5-second silent MP4 at the target canvas size.
 * Anamorphic-safe: we scale fitting inside the target and pad the rest with
 * black, so different-aspect inputs (e.g. a 1:1 card on a 9:16 canvas)
 * don't crop. Audio is a silent track so the concat demuxer sees the same
 * stream layout as the Seedance clips.
 */
async function stillToVideo(
  pngPath: string,
  outPath: string,
  durationS: number,
  size: Size,
): Promise<void> {
  await runFfmpeg([
    '-loop',
    '1',
    '-t',
    String(durationS),
    '-i',
    pngPath,
    '-f',
    'lavfi',
    '-t',
    String(durationS),
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-vf',
    `scale=${size.w}:${size.h}:force_original_aspect_ratio=decrease,pad=${size.w}:${size.h}:(ow-iw)/2:(oh-ih)/2:color=black,fps=30`,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    '-y',
    outPath,
  ]);
}

/**
 * Read the duration of a file (seconds) via ffmpeg itself (parsing stderr).
 * We avoid pulling in ffprobe-static — ffmpeg-static is enough, and the
 * stderr `Duration: HH:MM:SS.ms` line is a stable contract.
 */
async function probeDurationSeconds(filePath: string): Promise<number> {
  const stderr = await new Promise<string>((resolve, reject) => {
    const child = spawn(FFMPEG_BIN, ['-i', filePath]);
    let buf = '';
    child.stderr.on('data', (chunk: Buffer) => {
      buf += chunk.toString('utf8');
    });
    // ffmpeg without an output argument exits non-zero — that's expected.
    child.on('close', () => resolve(buf));
    child.on('error', reject);
  });
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  const h = parseInt(m[1]!, 10);
  const mn = parseInt(m[2]!, 10);
  const s = parseFloat(m[3]!);
  return h * 3600 + mn * 60 + s;
}

/**
 * Spawn the ffmpeg-static binary with the given args. Rejects on non-zero
 * exit with the tail of stderr so the error surface is meaningful.
 */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderrTail = '';
    child.stderr.on('data', (chunk: Buffer) => {
      // Keep only the last ~4 KB — full stderr can be MBs for long videos.
      stderrTail = (stderrTail + chunk.toString('utf8')).slice(-4096);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderrTail.trim()}`));
      }
    });
  });
}
