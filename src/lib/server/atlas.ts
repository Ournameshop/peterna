// server-only — Atlas Cloud video generation (second broker for the same
// ByteDance Seedance models fal serves). Ported from lifemovie.ai's proven
// client (lib/providers/atlas.ts) in its essentials: multipart uploadMedia →
// generateVideo → poll /model/prediction/{id}. Wired here because fal's
// Seedance declines photoreal HUMAN likeness (422/content) that Atlas passes —
// the together flow needs the owner in frame, so Atlas is the broker when
// ATLAS_API_KEY is configured.
//
// Polling is split from starting: the app's status route polls every few
// seconds from the client, so pollAtlasClip does exactly ONE check per call.

const ATLAS_BASE = (process.env.ATLAS_BASE_URL?.trim() || "https://api.atlascloud.ai/api/v1").replace(/\/$/, "");

export function isAtlasEnabled(): boolean {
  return !!process.env.ATLAS_API_KEY?.trim();
}

export function atlasReferenceModel(): string {
  const base = process.env.ATLAS_SEEDANCE_MODEL?.trim() || "bytedance/seedance-2.0/image-to-video";
  return base.replace(/\/image-to-video$/, "/reference-to-video");
}

const TRANSIENT_HINT = /still being prepared|please retry|try again|not ready|temporarily unavailable|timeout/i;

// Same reference sheets ride along on EVERY beat — cache uploads by source URL
// so a 12-beat run uploads each sheet once, not twelve times. In-process only.
const UPLOAD_CACHE_TTL_MS = 45 * 60 * 1000;
const uploadCache = new Map<string, { url: string; at: number }>();

async function readBody(res: Response): Promise<{ text: string; json: Record<string, unknown> | null }> {
  const text = await res.text().catch(() => "");
  try {
    return { text, json: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { text, json: null };
  }
}

/** Fetch a source (https URL or data: URI) and upload it to Atlas; returns the
 *  Atlas-hosted URL. Cached per source so repeated beats reuse the upload. */
export async function atlasUploadFromSource(source: string, label: string): Promise<string> {
  const key = process.env.ATLAS_API_KEY!.trim();
  const hit = uploadCache.get(source);
  if (hit && Date.now() - hit.at < UPLOAD_CACHE_TTL_MS) return hit.url;

  let bytes: Buffer;
  let mime: string;
  if (source.startsWith("data:")) {
    const m = source.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error(`unsupported data URI for ${label}`);
    mime = m[1];
    bytes = Buffer.from(m[2], "base64");
  } else {
    const res = await fetch(source, { redirect: "follow" });
    if (!res.ok) throw new Error(`fetch reference ${label} failed: ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
    mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  }

  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), `${label}.${ext}`);
  const res = await fetch(`${ATLAS_BASE}/model/uploadMedia`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` }, // no Content-Type — fetch sets the boundary
    body: form,
  });
  const { text, json } = await readBody(res);
  if (!res.ok) throw new Error(`atlas uploadMedia ${label} failed (${res.status}): ${text.slice(0, 300)}`);
  const d = (json?.data ?? json) as Record<string, unknown> | undefined;
  const url = (typeof d?.download_url === "string" && d.download_url) || (typeof d?.url === "string" && d.url) || "";
  if (!url) throw new Error(`atlas uploadMedia ${label}: no url in ${text.slice(0, 200)}`);
  uploadCache.set(source, { url, at: Date.now() });
  return url;
}

const RATIOS = new Set(["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"]);
const RESOLUTIONS = new Set(["480p", "720p", "720p-SR", "1080p", "1080p-SR", "1440p-SR", "4k"]);

/** Start a reference-to-video generation; returns the prediction id. Retries
 *  the start while freshly-uploaded assets finish ingesting server-side.
 *
 *  Prompt blocks ported from lifemovie.ai's audited playbook (its atlas.ts,
 *  shotPrompts CLIP_GUARDS, and failureModes negatives): identity locks lead,
 *  references are labeled BY INDEX (models cross-assign identities when the
 *  mapping is ambiguous), the count/containment block guards what the face
 *  lock cannot ("'do not invent different people' only guards the FACE, not
 *  the count"), and a stable seed nudges look-consistency across a build's
 *  clips (Seedance has no identity param). */
export async function startAtlasClip(opts: {
  prompt: string;
  referenceUrls: string[]; // already Atlas-hosted; [0] = keyframe, then sheets
  durationSec: number;
  resolution: string;
  aspect: string;
  subjects?: { petName?: string; ownerName?: string };
  seed?: number;
}): Promise<string> {
  const key = process.env.ATLAS_API_KEY!.trim();
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const pet = opts.subjects?.petName?.trim();
  const owner = opts.subjects?.ownerName?.trim();
  const labeled = opts.referenceUrls.length === 3 && pet && owner;

  const roleBlock = labeled
    ? `IMAGE ROLES: image 1 is this clip's literal first frame — begin exactly there and move forward only. ` +
      `Image 2 is ${pet}'s identity reference sheet (the animal). Image 3 is ${owner}'s identity reference sheet (the person). `
    : "IMAGE ROLES: image 1 is this clip's literal first frame — begin exactly there and move forward only. " +
      "The remaining images are approved IDENTITY REFERENCE SHEETS; every character and animal must match them exactly. ";

  const identityBlock =
    `IDENTITY LOCK: across every frame keep the same face proportions, hair, body proportions, wardrobe colors and accessories — ` +
    `do not age, beautify, harden, recolor, swap clothing, or morph a character into a different design as motion continues. ` +
    `${owner ? `${owner} must match their sheet exactly — this is a real person's likeness; do not drift toward a generic face. ` : ""}` +
    `${pet ? `${pet} keeps the real animal anatomy — proportions, legs, paws, tail, ears, muzzle, fur and markings — exactly as the sheet; never drift toward a generic breed-average look. ` : ""}` +
    "Never invent, blend, average or swap faces or features; a face briefly in motion re-resolves to the SAME face from the sheet. ";

  const countBlock =
    "COUNT AND CONTAINMENT: render exactly ONE instance of each subject — at no moment are there two of the person or two of the animal, " +
    "and no other person or animal ever enters frame; no invented background figures. " +
    "Every subject present in image 1 remains in or near frame for the whole clip; a subject moving farther away is still the same single subject — " +
    "never re-introduced, never walking in again; the scene is never restarted or restaged. ";

  const body = {
    model: atlasReferenceModel(),
    prompt: roleBlock + identityBlock + countBlock + opts.prompt,
    reference_images: opts.referenceUrls,
    duration: Math.max(4, Math.min(15, Math.round(opts.durationSec))),
    resolution: RESOLUTIONS.has(opts.resolution) ? opts.resolution : "720p",
    ratio: RATIOS.has(opts.aspect) ? opts.aspect : "adaptive",
    generate_audio: false, // music/narration is the tribute's only audio
    bitrate_mode: "high",
    ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
  };

  let res!: Response;
  let text = "";
  for (let i = 0; i <= 4; i++) {
    res = await fetch(`${ATLAS_BASE}/model/generateVideo`, { method: "POST", headers, body: JSON.stringify(body) });
    text = await res.text().catch(() => "");
    const transient = [502, 503, 504].includes(res.status) || (!res.ok && TRANSIENT_HINT.test(text));
    if (!transient || i === 4) break;
    await new Promise((r) => setTimeout(r, 6000 * (i + 1)));
  }
  if (!res.ok) throw new Error(`atlas generateVideo failed (${res.status}): ${text.slice(0, 400)}`);
  let json: Record<string, unknown> | null = null;
  try { json = JSON.parse(text) as Record<string, unknown>; } catch { /* handled below */ }
  const d = (json?.data ?? json) as Record<string, unknown> | undefined;
  const id = (typeof d?.id === "string" && d.id) || (typeof d?.request_id === "string" && d.request_id) || "";
  if (!id) throw new Error(`atlas returned no prediction id: ${text.slice(0, 200)}`);
  return id;
}

export type AtlasPoll =
  | { state: "IN_PROGRESS" }
  | { state: "COMPLETED"; url: string }
  | { state: "FAILED"; reason: string; transient: boolean };

/** ONE status check for a prediction — the caller (status route) is the loop. */
export async function pollAtlasClip(predictionId: string): Promise<AtlasPoll> {
  const key = process.env.ATLAS_API_KEY!.trim();
  const res = await fetch(`${ATLAS_BASE}/model/prediction/${predictionId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const { text, json } = await readBody(res);
  if (!res.ok) throw new Error(`atlas poll failed (${res.status}): ${text.slice(0, 300)}`);
  const d = (json?.data ?? json) as Record<string, unknown> | undefined;
  const status = String(d?.status || "").toLowerCase();

  if (["failed", "error", "canceled", "cancelled"].includes(status)) {
    // Classify on the STATED reason only — the raw body always contains the
    // field name "has_nsfw_contents" which would false-positive a filter match.
    // Atlas reports failed predictions with HTTP 200 and the real code in the
    // body, so include it; a content/likeness decline is TERMINAL — retrying
    // the same frame can never succeed, so name it plainly for the caller.
    const stated = [d?.error, d?.failure_reason, d?.message, json?.message,
      d?.has_nsfw_contents === true ? "has_nsfw_contents=true" : null]
      .filter(Boolean).map(String).join(" ").slice(0, 400);
    const bodyCode = Number(json?.code);
    const codeNote = Number.isFinite(bodyCode) && bodyCode >= 400 ? ` (code ${bodyCode})` : "";
    const FILTER_HINT = /content polic|flagged|safety|nsfw|blocked|likeness|real people|real person|cannot be processed|violat/i;
    const declined = FILTER_HINT.test(stated);
    return {
      state: "FAILED",
      reason: (declined ? "provider declined this content — rerolling the same frame cannot succeed; reframe the scene instead: " : "") + (stated || "atlas prediction failed") + codeNote,
      transient: !declined && TRANSIENT_HINT.test(stated),
    };
  }
  if (["completed", "succeeded", "success", "done"].includes(status)) {
    let outputs: unknown[] = Array.isArray(d?.outputs) ? (d.outputs as unknown[]) : [];
    if (!outputs.length && typeof d?.output === "string") outputs = [d.output];
    const first = outputs[0];
    const url = typeof first === "string"
      ? first
      : first && typeof first === "object" && typeof (first as { url?: unknown }).url === "string"
        ? (first as { url: string }).url
        : "";
    if (!url) return { state: "FAILED", reason: "atlas completed but returned no video URL", transient: false };
    return { state: "COMPLETED", url };
  }
  return { state: "IN_PROGRESS" };
}
