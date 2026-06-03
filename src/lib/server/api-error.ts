// server-only — consistent error surfacing for 3rd-party service failures.
//
// Every external integration (Suno, fal → ElevenLabs/Seedance/OpenAI-image,
// Gemini, S3, Postgres) should report WHICH service failed and the REAL upstream
// reason — never a bare generic string that hides the cause. Use these helpers in
// every route's catch block so failures are diagnosable in logs and honest in the UI.

import { NextResponse } from "next/server";

// fal's ApiError puts the useful, specific reason in `.body` — often
// `{ detail: "..." }` or `{ detail: [{ msg }] }` (e.g. content-policy or bad-input
// rejections) — while `.message` is generic ("Unprocessable Entity"). Dig the
// detail out so the actual reason reaches the caller.
function extractDetail(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const body = (err as { body?: unknown }).body;
  if (!body || typeof body !== "object") return null;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === "object" ? (d as { msg?: string }).msg : typeof d === "string" ? d : null))
      .filter((m): m is string => !!m);
    if (msgs.length) return msgs.join("; ");
  }
  return null;
}

// Best human-readable message for any thrown value.
export function describeError(err: unknown): string {
  const detail = extractDetail(err);
  if (err instanceof Error) return detail ? `${err.message}: ${detail}` : err.message;
  if (typeof err === "string") return err;
  if (detail) return detail;
  try {
    return JSON.stringify(err);
  } catch {
    return "unknown error";
  }
}

// Standard error response for a failed 3rd-party call. Logs with the service tag
// and returns `{ error, service }` so the client can show which provider failed
// and surface the real reason.
export function serviceErrorResponse(service: string, err: unknown, status = 502): NextResponse {
  const message = describeError(err);
  console.error(`[${service}] ${message}`, err);
  return NextResponse.json({ error: message, service }, { status });
}
