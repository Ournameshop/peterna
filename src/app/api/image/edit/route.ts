// POST /api/image/edit
// Image-to-image via fal.ai openai/gpt-image-2/edit.
// Body: { prompt: string, imageUrls: string[], quality?, aspect?, outputFormat? }
// `imageUrls[0]` is the primary reference (e.g. the user's pet photo).

import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";
import { rehost } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReqBody {
  prompt?: string;
  imageUrls?: string[];
  maskImageUrl?: string;
  quality?: "low" | "medium" | "high";
  aspect?:
    | "auto"
    | "landscape_4_3"
    | "square_hd"
    | "landscape_16_9"
    | "portrait_4_3"
    | "portrait_16_9";
  outputFormat?: "png" | "jpeg" | "webp";
}

export async function POST(req: Request) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
  }
  // OPENAI_API_KEY is optional — fal proxies openai/gpt-image-2/edit with FAL_KEY alone.

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const prompt = (body.prompt || "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }
  const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter(Boolean) : [];
  if (imageUrls.length === 0) {
    return NextResponse.json(
      { error: "imageUrls[] required (at least one source image)" },
      { status: 400 }
    );
  }

  // gpt-image-2/edit needs real URLs — upload any data: URIs (the user's
  // uploaded photo files) to fal storage first.
  let resolvedUrls: string[];
  try {
    resolvedUrls = await Promise.all(
      imageUrls.map(async (u) => {
        if (!u.startsWith("data:")) return u;
        const m = u.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) throw new Error("malformed data URI");
        const blob = new Blob([Buffer.from(m[2], "base64")], { type: m[1] });
        return await fal.storage.upload(blob);
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "reference upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  try {
    const input: Record<string, unknown> = {
      prompt,
      image_urls: resolvedUrls,
      image_size: body.aspect || "auto",
      quality: body.quality || "medium",
      output_format: body.outputFormat || "png",
      ...(process.env.OPENAI_API_KEY ? { openai_api_key: process.env.OPENAI_API_KEY } : {}),
    };
    if (body.maskImageUrl) input.mask_image_url = body.maskImageUrl;

    const result = await fal.subscribe("openai/gpt-image-2/edit", {
      input,
      logs: false,
    });

    const url = result?.data?.images?.[0]?.url;
    if (!url) {
      return NextResponse.json(
        { error: "no image url in fal response" },
        { status: 502 }
      );
    }
    const hostedUrl = await rehost(url, "image", body.outputFormat || "png");
    return NextResponse.json({ url: hostedUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
