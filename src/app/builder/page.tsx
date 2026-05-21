import { Suspense } from "react";
import type { Metadata } from "next";
import BuilderClient from "@/components/builder/BuilderClient";
import type { StageTag } from "@/lib/builder/state";

// Entry point for the tribute builder wizard.
//
// Server Component that reads ?session= / ?step= from the URL and defers
// to <BuilderClient/> for the full reactive state machine. The client
// component:
//   - creates a session via POST /api/session/create if no `session_id` is
//     present (when the backend is up; until then it walks locally)
//   - drives the state machine through Stage 1
//   - reflects state into the URL so reload restores
//
// Per AGENTS.md: Next 16 — searchParams is a Promise in async Server
// Components; await it before reading.

export const metadata: Metadata = {
  title: "Build a tribute — Peterna",
  description:
    "A gentle, guided builder for the tribute you'll make of the pet you loved.",
};

// Stage tags we accept from the URL on entry. Anything else snaps to the
// welcome screen — the reducer rejects illegal entries. Covers Stages 1 + 2
// (Phase 2 ships Stage 2 + Stage 2.5/2.6). Stage 3 entry point
// (curators_pick_or_manual) is included so the post-aspect-pick transition
// has a valid URL target for the back/refresh button.
const VALID_INTAKE_STAGES = new Set<StageTag>([
  // Stage 1
  "intake_welcome",
  "intake_returning_user_check",
  "intake_photos",
  "intake_name",
  "intake_name_pronunciation",
  "intake_vision_review",
  "intake_memory",
  "intake_memory_freetext",
  "intake_gender",
  "intake_relationship",
  "intake_traits",
  "intake_favorites",
  "intake_creator",
  "intake_years",
  "intake_complete",
  // Stage 2
  "character_sheet_render",
  "character_sheet_review",
  "character_sheet_refinement",
  "length_pick",
  "aspect_pick",
  // Stage 3 entry (placeholder body in Phase 2)
  "curators_pick_or_manual",
  // Stage 8 — Eulogy PDF (Phase 8)
  "eulogy_render",
  "eulogy_review",
  "eulogy_complete",
  // Phase 9 — Final delivery
  "delivery_ready",
  "delivery_emailed",
]);

type PageProps = {
  searchParams: Promise<{ session?: string; step?: string }>;
};

export default async function BuilderPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const sessionId = typeof sp.session === "string" ? sp.session : null;
  const stepRaw = typeof sp.step === "string" ? sp.step : null;
  const initialStage =
    stepRaw && VALID_INTAKE_STAGES.has(stepRaw as StageTag)
      ? (stepRaw as StageTag)
      : null;

  return (
    <Suspense fallback={null}>
      <BuilderClient
        initialSessionId={sessionId}
        initialStage={initialStage}
      />
    </Suspense>
  );
}
