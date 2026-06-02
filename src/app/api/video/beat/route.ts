// POST /api/video/beat
// Generates a single tribute beat via Seedance 2.0.
// Uses queue.submit + caller-supplied webhookUrl for long-running renders;
// falls back to fal.subscribe() (blocking) when `wait: true` is passed.
//
// Body: {
//   beat: { archetype: string, brief: string },
//   pet: { name: string, species: string, traits?: string[], favorites?: string[] },
//   format?: string, theme?: string, style?: string,
//   imageUrls?: string[],   // up to 9 reference images (user photos + 1 char-sheet anchor)
//   videoUrls?: string[],   // up to 3 reference videos
//   audioUrls?: string[],   // up to 3 reference audios
//   duration?: "4".."15"|"auto",
//   resolution?: "480p"|"720p",
//   aspectRatio?: "21:9"|"16:9"|"4:3"|"1:1"|"3:4"|"9:16"|"auto",
//   mode?: "fast"|"standard",   // fast = preview, standard = final
//   wait?: boolean,             // true → block; false → queue + webhook
//   webhookUrl?: string,
// }

import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";
import { rehost } from "@/lib/server/storage";
import { buildBeatPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ReqBody {
  beat?: { archetype?: string; brief?: string; caption?: string; spokenOrTitle?: string };
  beatIndex?: number;
  pet?: { name?: string; species?: string; traits?: string[]; favorites?: string[] };
  format?: string;
  theme?: string;
  style?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  audioUrls?: string[];
  duration?: string;
  resolution?: "480p" | "720p";
  aspectRatio?: "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "auto";
  mode?: "fast" | "standard";
  wait?: boolean;
  webhookUrl?: string;
  userNote?: string;
  cinematographyBrief?: {
    lensMm?: number;
    lensCharacter?: string;
    cameraMove?: string;
    moveIntensity?: string;
    subjectMotion?: string;
    lightingMotion?: string;
    dofBehavior?: string;
    shotStructure?: string;
    ambientAudio?: string;
    audioIntensity?: string;
  };
}

function pickEndpoint(body: ReqBody): string {
  const hasRef = (body.imageUrls?.length || 0) > 0 || (body.videoUrls?.length || 0) > 0;
  const variant = body.mode === "fast" ? "/fast" : "";
  if (hasRef) return `bytedance/seedance-2.0${variant}/reference-to-video`;
  return `bytedance/seedance-2.0${variant}/text-to-video`;
}

export async function POST(req: Request) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const archetype = body.beat?.archetype?.trim();
  const brief = body.beat?.brief?.trim();
  const petName = body.pet?.name?.trim() || "your pet";
  const species = body.pet?.species?.trim() || "pet";
  if (!archetype || !brief) {
    return NextResponse.json(
      { error: "beat.archetype + beat.brief required" },
      { status: 400 }
    );
  }

  const prompt = buildBeatPrompt({
    petName,
    species,
    traits: body.pet?.traits,
    favorites: body.pet?.favorites,
    format: body.format,
    theme: body.theme,
    style: body.style,
    beatArchetype: archetype,
    brief,
    caption: body.beat?.caption,
    spokenOrTitle: body.beat?.spokenOrTitle,
    cinematographyBrief: body.cinematographyBrief,
    userNote: body.userNote,
  });

  const endpoint = pickEndpoint(body);
  const input: Record<string, unknown> = {
    prompt,
    duration: body.duration || "5",
    resolution: body.resolution || "720p",
    aspect_ratio: body.aspectRatio || "16:9",
    // Muted: the music bed (or narration) is the sole audio track in the final tribute.
    // Keeping clip audio would fight the continuous bed and cause choppy cuts.
    generate_audio: false,
  };
  if (body.imageUrls?.length) input.image_urls = body.imageUrls.slice(0, 9);
  if (body.videoUrls?.length) input.video_urls = body.videoUrls.slice(0, 3);
  if (body.audioUrls?.length) input.audio_urls = body.audioUrls.slice(0, 3);

  try {
    if (body.wait) {
      const result = await fal.subscribe(endpoint, { input, logs: false });
      const url = result?.data?.video?.url;
      if (!url) {
        return NextResponse.json(
          { error: "no video url in fal response" },
          { status: 502 }
        );
      }
      const beatIdx = body.beatIndex ?? body.beat?.archetype ?? "?";
      // eslint-disable-next-line no-console
      console.log(`[GEN-BEAT] index=${beatIdx} url=${url}`);
      const hostedUrl = await rehost(url, "beat", "mp4");
      return NextResponse.json({ url: hostedUrl, prompt });
    }

    const submit = await fal.queue.submit(endpoint, {
      input,
      ...(body.webhookUrl ? { webhookUrl: body.webhookUrl } : {}),
    });
    return NextResponse.json({
      requestId: submit.request_id,
      endpoint,
      prompt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
