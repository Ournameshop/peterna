// POST /api/video/narration
// Generates a narration audio track from text using fal-ai/minimax/speech-02-hd.
//
// Body: { text: string, voice?: string }
// Response: { url: string }

import { NextResponse } from "next/server";
import { fal, describeFalError } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ReqBody {
  text?: string;
  voice?: string;
}

interface SpeechOutput {
  audio: { url: string };
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

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    // MinimaxSpeech02HdInput has no top-level voice_id — the correct field is
    // voice_setting.voice_id (VoiceSetting object). The previous code was silently
    // ignored by the API. voice_id values are Minimax preset strings e.g. "Wise_Woman".
    const input: Parameters<typeof fal.subscribe<"fal-ai/minimax/speech-02-hd">>[1]["input"] = {
      text,
      ...(body.voice ? { voice_setting: { voice_id: body.voice } } : {}),
    };

    const result = await fal.subscribe("fal-ai/minimax/speech-02-hd", {
      input,
      logs: false,
    });
    const url = (result?.data as unknown as SpeechOutput)?.audio?.url;
    if (!url) {
      return NextResponse.json({ error: "no audio url in fal response" }, { status: 502 });
    }
    return NextResponse.json({ url });
  } catch (err) {
    const { message, status } = describeFalError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
