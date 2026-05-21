import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";

import type { ResumeResponse } from "@/lib/builder/wire-types";

// Resume-link target.
//
// Loads /api/session/resume/[token] server-side; on success, redirects to
// /builder?session=<id>&step=<saved-stage>. On failure, redirects to
// /builder (which creates a fresh session).
//
// Wire shape: see `src/lib/builder/wire-types.ts#ResumeResponse`. The route
// returns `{ session_id, stage, resume_token }` — B4 in qa-phase1-report.md.
//
// Per AGENTS.md (Next 16): params is a Promise in async Server Components.

export const metadata: Metadata = {
  title: "Resume your tribute — Peterna",
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function ResumePage({ params }: PageProps) {
  const { token } = await params;

  if (!token || token.length < 8) {
    redirect("/builder");
  }

  // Build an absolute URL for the server-side fetch. Next 16 requires this
  // (relative URLs don't resolve in RSC fetches).
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const protocol = hdrs.get("x-forwarded-proto") ?? "http";
  const base = `${protocol}://${host}`;

  let session_id: string | null = null;
  let stage: string | null = null;

  try {
    const res = await fetch(`${base}/api/session/resume/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Pass the resume token through; cookies are forwarded automatically
      // by Next 16's RSC fetch.
      body: JSON.stringify({ token }),
      // Don't cache — resume tokens are session-scoped.
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json().catch(() => null)) as ResumeResponse | null;
      if (json && json.ok === true) {
        session_id = json.session_id;
        stage = json.stage ?? null;
      }
    }
  } catch {
    // Backend not up yet — fall through.
  }

  if (session_id) {
    const params = new URLSearchParams();
    params.set("session", session_id);
    if (stage) params.set("step", stage);
    redirect(`/builder?${params.toString()}`);
  }

  // Couldn't resume — drop the user into a fresh wizard. The backend will
  // create a new session when they begin.
  redirect("/builder");
}
