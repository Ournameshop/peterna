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

// All known Stage 1 tags we accept from the URL on entry. Anything else
// snaps to the welcome screen — the reducer rejects illegal entries.
const VALID_INTAKE_STAGES = new Set<StageTag>([
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
