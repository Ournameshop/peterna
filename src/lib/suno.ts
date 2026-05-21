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
  audioUrl: string;
  duration: number; // seconds
}

interface SunoRecordResponse {
  code: number;
  msg: string;
  data: {
    status: string;
    response: { sunoData: SunoTrack[] };
  };
}

export async function sunoGenerateInstrumental(
  prompt: string,
  _durationSeconds: number
): Promise<{ url: string; durationMs: number }> {
  const key = process.env.SUNO_API_KEY;
  if (!key) throw new Error("SUNO_API_KEY not configured");

  // Submit generation job
  const genRes = await fetch(`${SUNO_BASE}/api/v1/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      instrumental: true,
      customMode: false,
      model: "V4",
      // callBackUrl is required by the API but we poll record-info instead of using webhooks
      callBackUrl: "https://placeholder.invalid/noop",
    }),
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

  // Poll until SUCCESS or timeout
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(
      `${SUNO_BASE}/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
      {
        headers: { Authorization: `Bearer ${key}` },
      }
    );

    if (!pollRes.ok) continue;

    const pollData = (await pollRes.json()) as SunoRecordResponse;
    const status = pollData.data?.status;

    if (status === "SUCCESS") {
      const tracks = pollData.data.response?.sunoData ?? [];
      const track = tracks[0];
      if (!track?.audioUrl) throw new Error("Suno returned no audio URL");
      return {
        url: track.audioUrl,
        durationMs: Math.round(track.duration * 1000),
      };
    }

    if (
      status === "CREATE_TASK_FAILED" ||
      status === "GENERATE_AUDIO_FAILED" ||
      status === "SENSITIVE_WORD_ERROR"
    ) {
      throw new Error(`Suno generation failed with status: ${status}`);
    }
    // PENDING / TEXT_SUCCESS / FIRST_SUCCESS — keep polling
  }

  throw new Error("Suno generation timed out after 4.5 minutes");
}
