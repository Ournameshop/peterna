// POST /api/image/edit
// Reference-conditioned image generation via Gemini 2.5 Flash Image.
// Body: { prompt: string, imageUrls: string[], quality?, aspect?, outputFormat? }
// Response: { url: string } — url is a data:image/...;base64,... data URL.

import { NextResponse } from "next/server";
import { GoogleGenAI, type Part } from "@google/genai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_MODEL = "gemini-2.5-flash-image";

// Map fal aspect strings to Gemini aspect ratio hints appended to the prompt.
const ASPECT_HINT: Record<string, string> = {
  square_hd: "1:1 square aspect ratio",
  landscape_16_9: "16:9 landscape aspect ratio",
  portrait_16_9: "9:16 portrait aspect ratio",
  landscape_4_3: "4:3 landscape aspect ratio",
  portrait_4_3: "3:4 portrait aspect ratio",
};

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

async function resolveToInlineData(
  url: string,
): Promise<{ mimeType: string; data: string } | null> {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    return { mimeType: m[1], data: m[2] };
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType =
      res.headers.get("content-type")?.split(";")[0].trim() || "image/jpeg";
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { mimeType, data };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

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
      { status: 400 },
    );
  }

  // Resolve all reference images to inline base64.
  const inlineImages = (
    await Promise.all(imageUrls.map(resolveToInlineData))
  ).filter((x): x is { mimeType: string; data: string } => x !== null);

  if (inlineImages.length === 0) {
    return NextResponse.json({ error: "could not resolve any imageUrls" }, { status: 400 });
  }

  // Build the aspect hint suffix.
  const aspectHint = body.aspect && body.aspect !== "auto"
    ? ` (${ASPECT_HINT[body.aspect] ?? body.aspect})`
    : "";
  const fullPrompt = prompt + aspectHint;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const parts: Part[] = [
      ...inlineImages.map((img): Part => ({
        inlineData: { mimeType: img.mimeType, data: img.data },
      })),
      { text: fullPrompt },
    ];

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: parts,
    });

    const out: Part[] = response.candidates?.[0]?.content?.parts ?? [];
    const imgPart = out.find((p) => p.inlineData?.data);

    if (!imgPart?.inlineData?.data) {
      const text = response.text ?? "";
      return NextResponse.json(
        { error: "model returned no image", detail: text },
        { status: 502 },
      );
    }

    const mimeType = imgPart.inlineData.mimeType || "image/png";
    const url = `data:${mimeType};base64,${imgPart.inlineData.data}`;
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
