// Server-side Suno music generation client (sunoapi.org).
// IMPORTANT: never import this file from a client component.
// Reads SUNO_API_KEY from process.env at call time.

const SUNO_BASE = "https://api.sunoapi.org";
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 270000; // 4.5 min — stays under the route's maxDuration

interface SunoGenerateResponse {
  code: number;
  msg: string;
  data: { taskId: string };
}

interface SunoTrack {
  id?: string;       // the audioId — required to fetch timestamped lyrics
  audioUrl: string;
  duration: number; // seconds
  title?: string;
}

interface SunoRecordResponse {
  code: number;
  msg: string;
  data: {
    status: string;
    response: { sunoData: SunoTrack[] };
  };
}

export interface SunoGenerateTrackOptions {
  prompt: string;
  instrumental: boolean;
  customMode?: boolean;
  style?: string;
  title?: string;
  model?: "V4" | "V4_5" | "V4_5ALL" | "V5" | "V5_5";
}

export interface SunoGeneratedTrack {
  url: string;
  durationMs: number;
  title?: string;
  taskId: string;        // generation task — needed to fetch timestamped lyrics
  audioId: string;       // the specific track id — needed to fetch timestamped lyrics
}

// One word of a generated song, with precise sung timing (seconds).
export interface SunoAlignedWord {
  word: string;
  success: boolean;
  startS: number;
  endS: number;
  palign?: number;
}

export async function sunoGenerateInstrumental(
  prompt: string,
  _durationSeconds: number
): Promise<SunoGeneratedTrack> {
  void _durationSeconds;
  return sunoGenerateTrack({
    prompt,
    instrumental: true,
    customMode: false,
    model: (process.env.SUNO_MODEL ?? "V4_5") as "V4" | "V4_5" | "V4_5ALL" | "V5" | "V5_5",
  });
}

export async function sunoGenerateTrack(
  opts: SunoGenerateTrackOptions
): Promise<SunoGeneratedTrack> {
  const key = process.env.SUNO_API_KEY;
  if (!key) throw new Error("SUNO_API_KEY not configured");

  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("Suno prompt is required");

  const customMode = opts.customMode ?? false;
  const payload: Record<string, unknown> = {
    prompt,
    instrumental: opts.instrumental,
    customMode,
    model: opts.model ?? process.env.SUNO_MODEL ?? "V4_5",
    // callBackUrl is required by the API but we poll record-info instead of using webhooks.
    callBackUrl: "https://placeholder.invalid/noop",
  };

  if (customMode) {
    const style = opts.style?.trim();
    const title = opts.title?.trim();
    if (!style) throw new Error("Suno custom mode requires style");
    if (!title) throw new Error("Suno custom mode requires title");
    payload.style = style;
    payload.title = title;
  } else {
    if (opts.style?.trim()) payload.style = opts.style.trim();
    if (opts.title?.trim()) payload.title = opts.title.trim();
  }

  // Submit generation job
  const genRes = await fetch(`${SUNO_BASE}/api/v1/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!genRes.ok) {
    const text = await genRes.text().catch(() => "");
    throw new Error(`Suno generate failed: ${genRes.status} ${text}`);
  }

  const genData = (await genRes.json()) as SunoGenerateResponse;
  if (genData.code !== 200 || !genData.data?.taskId) {
    throw new Error(`Suno generate error: ${genData.msg}`);
  }

  const { taskId } = genData.data;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 6;

  // Poll record-info until the audio is ready or we time out.
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    // Network/parse op isolated — any failure leaves pollData null.
    let pollData: SunoRecordResponse | null = null;
    try {
      const pollRes = await fetch(
        `${SUNO_BASE}/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
        { headers: { Authorization: `Bearer ${key}` } }
      );
      if (pollRes.ok) {
        pollData = (await pollRes.json()) as SunoRecordResponse;
      }
    } catch {
      pollData = null;
    }

    // Bad response / non-200 body code — count it; bail after a run of errors
    // rather than burning the full 4.5-minute window on a hard failure.
    if (!pollData || pollData.code !== 200) {
      if (++consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error("Suno status polling failed repeatedly");
      }
      continue;
    }
    consecutiveErrors = 0;

    const status = pollData.data?.status;

    // Hard failures — stop immediately.
    if (
      status === "CREATE_TASK_FAILED" ||
      status === "GENERATE_AUDIO_FAILED" ||
      status === "SENSITIVE_WORD_ERROR"
    ) {
      throw new Error(`Suno generation failed with status: ${status}`);
    }

    // Done. SUCCESS is the normal terminal state. CALLBACK_EXCEPTION means the
    // generation succeeded but the webhook delivery failed — which it always
    // does here, because we send a placeholder callBackUrl and poll instead.
    // The finished audio is in sunoData either way.
    if (status === "SUCCESS" || status === "CALLBACK_EXCEPTION") {
      const track = (pollData.data?.response?.sunoData ?? []).find(
        (t) => t?.audioUrl
      );
      if (!track) {
        throw new Error(`Suno finished (${status}) but returned no audio URL`);
      }
      const durSec = Number(track.duration);
      return {
        url: track.audioUrl,
        durationMs:
          Number.isFinite(durSec) && durSec > 0 ? Math.round(durSec * 1000) : 0,
        title: track.title,
        taskId,
        audioId: track.id ?? "",
      };
    }
    // PENDING / TEXT_SUCCESS / FIRST_SUCCESS — keep polling.
  }

  throw new Error("Suno generation timed out after 4.5 minutes");
}

interface SunoAlignedLyricsResponse {
  code: number;
  msg: string;
  data?: {
    alignedWords?: SunoAlignedWord[];
  };
}

// Fetch word-level timing for a generated lyric track and derive the exact
// moment singing ends (the largest endS over real, non-whitespace words).
// Everything after vocalEndSec is instrumental — safe to fade/trim without
// losing a single lyric. Throws on any API failure so the caller can fall
// back to duration-based timing.
export async function sunoGetTimestampedLyrics(
  taskId: string,
  audioId: string
): Promise<{ vocalEndSec: number; words: SunoAlignedWord[] }> {
  const key = process.env.SUNO_API_KEY;
  if (!key) throw new Error("SUNO_API_KEY not configured");
  if (!taskId || !audioId) throw new Error("taskId and audioId are required");

  const res = await fetch(`${SUNO_BASE}/api/v1/generate/get-timestamped-lyrics`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ taskId, audioId }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Suno timestamped-lyrics failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as SunoAlignedLyricsResponse;
  if (data.code !== 200 || !Array.isArray(data.data?.alignedWords)) {
    throw new Error(`Suno timestamped-lyrics error: ${data.msg ?? "no aligned words"}`);
  }

  const words = data.data.alignedWords;
  let vocalEndSec = 0;
  for (const w of words) {
    // Ignore whitespace-only tokens — they can carry trailing timing past the
    // last real sung word and would falsely extend the vocal end.
    if (w && typeof w.endS === "number" && Number.isFinite(w.endS) && w.word && w.word.trim().length > 0) {
      if (w.endS > vocalEndSec) vocalEndSec = w.endS;
    }
  }
  return { vocalEndSec, words };
}
