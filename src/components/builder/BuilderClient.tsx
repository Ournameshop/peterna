"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  reduceState,
  createInitialState,
  needsPronunciationCheck,
  type StageTag,
  type WizardState,
  type WizardEvent,
  type InferredProfile,
  type PhotoAsset,
} from "@/lib/builder/state";
import {
  COPY,
  RETURNING_USER,
  NAME_PROMPT,
  MEMORY_FRAMING,
  GENDER_FRAMING,
  RELATIONSHIP_FRAMING,
  TRAITS_FRAMING,
  FAVORITES_FRAMING,
  CREATOR_FRAMING,
  YEARS_FRAMING,
  substitutePetName,
} from "@/lib/library/copy";
import {
  GENDER_OPTIONS,
  type GenderId,
} from "@/lib/library/pronouns";
import {
  RELATIONSHIPS,
  type RelationshipId,
} from "@/lib/library/relationships";
import {
  MEMORY_PROMPTS,
  PERSONALITY_TRAITS,
  FAVORITE_THINGS,
  type MemoryPromptId,
  type PersonalityTraitId,
  type FavoriteThingId,
} from "@/lib/library/intake";
import WizardShell from "./WizardShell";
import WelcomePanel from "./WelcomePanel";
import PhotoUrlField from "./PhotoUrlField";
import PillPicker, { type Pill } from "./PillPicker";
import TextField from "./TextField";
import ConfirmationCard from "./ConfirmationCard";

// Orchestrates the Stage 1 wizard. Owns the state machine + the side-effects
// (PATCH on transition, vision-pass kick on photos-and-name).
//
// Backend integration:
//   - The PATCH endpoint may not exist yet at the time of this commit. We
//     wrap network calls in a tiny `patchSession()` helper that logs in dev
//     and quietly no-ops on 404/error so the wizard can still walk locally.
//     When the backend lands, this helper picks it up automatically.
//   - Vision-pass is fired as soon as photos + name are present.

type Props = {
  initialSessionId: string | null;
  initialStage: StageTag | null;
  initialState?: WizardState;
};

type SessionPatch = Partial<{
  pet_name: string;
  pet_name_pronunciation: string | null;
  pet_gender: GenderId;
  relationship: RelationshipId;
  personality_traits: PersonalityTraitId[];
  favorite_things: FavoriteThingId[];
  creator_name: string | null;
  years_label: string | null;
  memory_prompt_type: MemoryPromptId | null;
  memory_prompt_answer: string | null;
  is_returning_user: boolean;
  inferred_profile: InferredProfile;
  stage: StageTag;
}>;

async function patchSession(
  sessionId: string | null,
  patch: SessionPatch,
): Promise<void> {
  if (!sessionId) return;
  // Dev breadcrumb: this is the contract the backend agent will see.
  if (process.env.NODE_ENV !== "production") {
    console.log("[builder] PATCH /api/session/" + sessionId, patch);
  }
  try {
    const res = await fetch(`/api/session/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    // 404 is expected until the backend lands; treat as a no-op.
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => "");
      if (process.env.NODE_ENV !== "production") {
        console.warn("[builder] PATCH failed", res.status, body);
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[builder] PATCH network error", err);
    }
  }
}

async function ensureSession(): Promise<{
  session_id: string;
  resume_token: string;
} | null> {
  try {
    const res = await fetch("/api/session/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as
      | { ok: true; session_id: string; resume_token: string }
      | { ok: false; error: string };
    if (json.ok) return { session_id: json.session_id, resume_token: json.resume_token };
    return null;
  } catch {
    return null;
  }
}

export default function BuilderClient({
  initialSessionId,
  initialStage,
  initialState,
}: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(
    reduceState,
    initialState ??
      (() => {
        const s = createInitialState(initialSessionId);
        if (initialStage) s.stage = initialStage;
        return s;
      })(),
  );

  const [submitting, setSubmitting] = useState(false);
  const [visionInFlight, setVisionInFlight] = useState(false);
  const visionStartedRef = useRef(false);

  // Bootstrap: if we don't yet have a session, create one and reflect into URL.
  useEffect(() => {
    if (state.data.session_id) return;
    let cancelled = false;
    (async () => {
      const created = await ensureSession();
      if (cancelled) return;
      if (created) {
        dispatch({
          type: "session_loaded",
          state: {
            stage: state.stage,
            data: { ...state.data, session_id: created.session_id },
          },
        });
        // Reflect ID into URL without a navigation
        const params = new URLSearchParams(window.location.search);
        params.set("session", created.session_id);
        router.replace(`/builder?${params.toString()}`, { scroll: false });
      }
    })();
    return () => {
      cancelled = true;
    };
    // intentionally only runs once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect stage into URL whenever it changes (idempotent).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!state.data.session_id) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("step") === state.stage) return;
    params.set("session", state.data.session_id);
    params.set("step", state.stage);
    router.replace(`/builder?${params.toString()}`, { scroll: false });
  }, [state.stage, state.data.session_id, router]);

  // Vision pass — kicks once we have at least one photo + a name. The result
  // is dispatched into the reducer. We deliberately fire even if the user is
  // already past intake_vision_review; the result will be persisted by the
  // backend but the UI won't navigate backward.
  useEffect(() => {
    if (visionStartedRef.current) return;
    if (!state.data.session_id) return;
    if (state.data.pet_photos.length === 0) return;
    if (!state.data.pet_name) return;
    if (state.data.inferred_profile) return;
    visionStartedRef.current = true;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      setVisionInFlight(true);
      try {
        const res = await fetch("/api/vision-pass", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: state.data.session_id }),
        });
        const json = (await res.json().catch(() => null)) as
          | { ok: true; inferred_profile: InferredProfile; confidence?: unknown }
          | { ok: true; vision_failure: true }
          | { ok: false; error: string }
          | null;
        if (json && "ok" in json && json.ok === true) {
          if ("vision_failure" in json && json.vision_failure) {
            dispatch({ type: "vision_pass_failed" });
          } else if ("inferred_profile" in json) {
            dispatch({
              type: "vision_pass_complete",
              profile: json.inferred_profile,
            });
          }
        }
      } catch {
        // backend not up yet — leave state alone; the user can still walk
        // past the confirmation card via the fallback in ConfirmationCard.
      } finally {
        if (!cancelled) setVisionInFlight(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    state.data.session_id,
    state.data.pet_photos.length,
    state.data.pet_name,
    state.data.inferred_profile,
  ]);

  const petName = state.data.pet_name;

  // Wrap dispatch with side-effect-aware helper for PATCH integration.
  const dispatchAndSave = useCallback(
    async (event: WizardEvent, patch?: SessionPatch) => {
      // Compute next state through the same reducer for stage save
      const next = reduceState(state, event);
      dispatch(event);
      if (patch || next.stage !== state.stage) {
        await patchSession(state.data.session_id, {
          ...(patch ?? {}),
          ...(next.stage !== state.stage ? { stage: next.stage } : {}),
        });
      }
    },
    [state],
  );

  // -------------------------------------------------------------------------
  // Stage-specific render
  // -------------------------------------------------------------------------

  function renderStage() {
    switch (state.stage) {
      case "intake_welcome":
        return (
          <PillPicker
            pills={[{ id: "begin", label: "Start when you're ready" }]}
            autoSubmitOnPick
            onSubmit={() => {
              void dispatchAndSave({ type: "start_intake" });
            }}
          />
        );

      case "intake_returning_user_check":
        return (
          <PillPicker
            question={RETURNING_USER.question}
            pills={[
              { id: "first", label: RETURNING_USER.buttons.first_time },
              { id: "returning", label: RETURNING_USER.buttons.returning },
            ]}
            autoSubmitOnPick
            onSubmit={(ids) => {
              const isReturning = ids[0] === "returning";
              void dispatchAndSave(
                { type: "returning_user_answered", isReturning },
                { is_returning_user: isReturning },
              );
            }}
          />
        );

      case "intake_photos":
        if (!state.data.session_id) {
          return <Loading label="Setting things up…" />;
        }
        return (
          <PhotoUrlField
            sessionId={state.data.session_id}
            petName={petName}
            variant={state.data.pet_photos.length === 0 ? "first" : "followup"}
            onComplete={(photos: PhotoAsset[]) => {
              void dispatchAndSave({ type: "photos_uploaded", photos });
            }}
            onSkip={() => {
              void dispatchAndSave({ type: "photos_skipped" });
            }}
          />
        );

      case "intake_name":
        return (
          <TextField
            question={NAME_PROMPT.question}
            placeholder={NAME_PROMPT.placeholder}
            required
            maxLength={60}
            submitLabel={NAME_PROMPT.submit}
            submitting={submitting}
            onSubmit={(name) => {
              const needsPronoun = needsPronunciationCheck(name);
              setSubmitting(true);
              void dispatchAndSave(
                { type: "name_submitted", petName: name, pronunciationNeeded: needsPronoun },
                { pet_name: name },
              ).finally(() => setSubmitting(false));
            }}
          />
        );

      case "intake_name_pronunciation":
        return (
          <TextField
            question={substitutePetName(NAME_PROMPT.pronunciation_question, petName)}
            placeholder={NAME_PROMPT.pronunciation_placeholder}
            allowEmpty
            submitting={submitting}
            onSubmit={(pronunciation) => {
              setSubmitting(true);
              void dispatchAndSave(
                { type: "pronunciation_submitted", pronunciation: pronunciation || null },
                { pet_name_pronunciation: pronunciation || null },
              ).finally(() => setSubmitting(false));
            }}
            onSkip={() => {
              void dispatchAndSave(
                { type: "pronunciation_submitted", pronunciation: null },
                { pet_name_pronunciation: null },
              );
            }}
            skipLabel={NAME_PROMPT.pronunciation_skip}
          />
        );

      case "intake_vision_review": {
        if (visionInFlight && !state.data.inferred_profile) {
          return <Loading label={substitutePetName("Looking at your photos of [PET_NAME]…", petName)} />;
        }
        const profile = state.data.inferred_profile;
        if (!profile) {
          // Vision pass hasn't returned and we don't have a backend; offer a manual fallback.
          return (
            <ConfirmationCard
              petName={petName ?? "your pet"}
              profile={{ vision_failure: true }}
              onConfirm={(p) =>
                void dispatchAndSave(
                  { type: "profile_confirmed", profile: p },
                  { inferred_profile: p },
                )
              }
              onVisionFailureContinue={() => {
                void dispatchAndSave({ type: "vision_pass_failed" });
              }}
              submitting={submitting}
            />
          );
        }
        return (
          <ConfirmationCard
            petName={petName ?? "your pet"}
            profile={profile}
            submitting={submitting}
            onConfirm={(p) => {
              setSubmitting(true);
              void dispatchAndSave(
                { type: "profile_confirmed", profile: p },
                { inferred_profile: p },
              ).finally(() => setSubmitting(false));
            }}
          />
        );
      }

      case "intake_memory": {
        const pills: Pill[] = MEMORY_PROMPTS.map((m) => ({
          id: m.id,
          label: substitutePetName(m.label, petName),
        }));
        return (
          <PillPicker
            question={substitutePetName(MEMORY_FRAMING.question, petName)}
            pills={pills}
            variant="rich"
            onSubmit={(ids) => {
              void dispatchAndSave({
                type: "memory_prompt_chosen",
                promptId: ids[0] as MemoryPromptId,
              });
            }}
            onSkip={() => {
              void dispatchAndSave({ type: "memory_skipped" });
            }}
            skipLabel={MEMORY_FRAMING.skip}
          />
        );
      }

      case "intake_memory_freetext": {
        const prompt = MEMORY_PROMPTS.find(
          (p) => p.id === state.data.memory_prompt_type,
        );
        return (
          <TextField
            question={substitutePetName(prompt?.label ?? MEMORY_FRAMING.question, petName)}
            placeholder={prompt?.placeholder}
            multiline
            maxLength={500}
            allowEmpty
            submitLabel={MEMORY_FRAMING.free_text_continue}
            skipLabel={MEMORY_FRAMING.free_text_skip}
            submitting={submitting}
            onSubmit={(answer) => {
              setSubmitting(true);
              void dispatchAndSave(
                {
                  type: "memory_answered",
                  promptId: state.data.memory_prompt_type,
                  answer: answer.length > 0 ? answer : null,
                },
                {
                  memory_prompt_type: state.data.memory_prompt_type,
                  memory_prompt_answer: answer.length > 0 ? answer : null,
                },
              ).finally(() => setSubmitting(false));
            }}
            onSkip={() => {
              void dispatchAndSave(
                {
                  type: "memory_answered",
                  promptId: state.data.memory_prompt_type,
                  answer: null,
                },
                {
                  memory_prompt_type: state.data.memory_prompt_type,
                  memory_prompt_answer: null,
                },
              );
            }}
          />
        );
      }

      case "intake_gender": {
        const pills: Pill[] = GENDER_OPTIONS.map((g) => ({
          id: g.id,
          label: g.label,
          description: g.sublabel,
        }));
        return (
          <PillPicker
            question={substitutePetName(GENDER_FRAMING.question, petName)}
            pills={pills}
            variant="rich"
            autoSubmitOnPick
            onSubmit={(ids) => {
              const gender = ids[0] as GenderId;
              void dispatchAndSave(
                { type: "gender_chosen", gender },
                { pet_gender: gender },
              );
            }}
          />
        );
      }

      case "intake_relationship": {
        const pills: Pill[] = RELATIONSHIPS.map((r) => ({
          id: r.id,
          label: r.label,
        }));
        return (
          <PillPicker
            question={substitutePetName(RELATIONSHIP_FRAMING.question, petName)}
            pills={pills}
            variant="rich"
            autoSubmitOnPick
            onSubmit={(ids) => {
              const relationship = ids[0] as RelationshipId;
              void dispatchAndSave(
                { type: "relationship_chosen", relationship },
                { relationship },
              );
            }}
          />
        );
      }

      case "intake_traits": {
        const pills: Pill[] = PERSONALITY_TRAITS.map((t) => ({
          id: t.id,
          label: t.label,
        }));
        return (
          <PillPicker
            question={substitutePetName(TRAITS_FRAMING.question, petName)}
            hint={TRAITS_FRAMING.hint}
            pills={pills}
            multi
            minPicks={1}
            maxPicks={3}
            submitLabel={TRAITS_FRAMING.submit}
            skipLabel={TRAITS_FRAMING.skip}
            submitting={submitting}
            onSkip={() => {
              void dispatchAndSave(
                { type: "traits_chosen", traits: [] },
                { personality_traits: [] },
              );
            }}
            onSubmit={(ids) => {
              setSubmitting(true);
              void dispatchAndSave(
                {
                  type: "traits_chosen",
                  traits: ids as PersonalityTraitId[],
                },
                { personality_traits: ids as PersonalityTraitId[] },
              ).finally(() => setSubmitting(false));
            }}
          />
        );
      }

      case "intake_favorites": {
        const pills: Pill[] = FAVORITE_THINGS.map((f) => ({
          id: f.id,
          label: f.label,
        }));
        return (
          <PillPicker
            question={substitutePetName(FAVORITES_FRAMING.question, petName)}
            hint={FAVORITES_FRAMING.hint}
            pills={pills}
            multi
            minPicks={1}
            maxPicks={3}
            submitLabel={FAVORITES_FRAMING.submit}
            skipLabel={FAVORITES_FRAMING.skip}
            submitting={submitting}
            onSkip={() => {
              void dispatchAndSave(
                { type: "favorites_chosen", favorites: [] },
                { favorite_things: [] },
              );
            }}
            onSubmit={(ids) => {
              setSubmitting(true);
              void dispatchAndSave(
                {
                  type: "favorites_chosen",
                  favorites: ids as FavoriteThingId[],
                },
                { favorite_things: ids as FavoriteThingId[] },
              ).finally(() => setSubmitting(false));
            }}
          />
        );
      }

      case "intake_creator":
        return (
          <TextField
            question={CREATOR_FRAMING.question}
            placeholder={CREATOR_FRAMING.placeholder}
            allowEmpty
            submitLabel={CREATOR_FRAMING.submit}
            skipLabel={CREATOR_FRAMING.skip}
            submitting={submitting}
            onSubmit={(name) => {
              setSubmitting(true);
              void dispatchAndSave(
                { type: "creator_submitted", creatorName: name || null },
                { creator_name: name || null },
              ).finally(() => setSubmitting(false));
            }}
            onSkip={() => {
              void dispatchAndSave(
                { type: "creator_submitted", creatorName: null },
                { creator_name: null },
              );
            }}
          />
        );

      case "intake_years": {
        // Two-step: pill picker → optional textfield → submit.
        const askingDates = state.stage === "intake_years"; // always here
        // We render a small inline state inside the picker by giving it three pills.
        return (
          <YearsBlock
            petName={petName}
            submitting={submitting}
            onChosen={(label) => {
              setSubmitting(true);
              void dispatchAndSave(
                { type: "years_submitted", yearsLabel: label },
                { years_label: label },
              ).finally(() => setSubmitting(false));
            }}
            askingDates={askingDates}
          />
        );
      }

      case "intake_complete":
        return (
          <CompletePanel
            petName={petName}
            traits={state.data.personality_traits}
            favorites={state.data.favorite_things}
          />
        );

      default:
        return <Loading label="Loading your next step…" />;
    }
  }

  const shouldShowBanner = state.stage !== "intake_welcome";
  const shouldShowWelcomeAbove = state.stage === "intake_welcome";

  return (
    <>
      {shouldShowWelcomeAbove ? <WelcomePanel petName={petName} /> : null}
      <WizardShell
        stage={state.stage}
        petName={petName}
        showBanner={shouldShowBanner}
      >
        {renderStage()}
      </WizardShell>
    </>
  );
}

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------

function Loading({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 16px",
        gap: 14,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "2px solid rgba(0,0,0,0.08)",
          borderTopColor: "rgba(0,0,0,0.45)",
          animation: "peternaSpin 800ms linear infinite",
        }}
      />
      <p style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>{label}</p>
      <style>{`@keyframes peternaSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function YearsBlock({
  petName,
  askingDates,
  submitting,
  onChosen,
}: {
  petName: string | null;
  askingDates: boolean;
  submitting: boolean;
  onChosen: (label: string | null) => void;
}) {
  const [mode, setMode] = useState<"choose" | "enter" | "done">("choose");
  if (!askingDates) return null;
  if (mode === "enter") {
    return (
      <TextField
        question="The years you had [PET_NAME]"
        placeholder={YEARS_FRAMING.free_text_placeholder}
        allowEmpty
        submitting={submitting}
        submitLabel={YEARS_FRAMING.free_text_continue}
        skipLabel="Never mind"
        onSubmit={(value) => {
          onChosen(value.length > 0 ? value : null);
          setMode("done");
        }}
        onSkip={() => {
          onChosen(null);
          setMode("done");
        }}
      />
    );
  }
  return (
    <PillPicker
      question={substitutePetName(YEARS_FRAMING.question, petName)}
      pills={[
        { id: "yes", label: YEARS_FRAMING.buttons.yes },
        { id: "no_dates", label: YEARS_FRAMING.buttons.no_dates },
        { id: "skip", label: YEARS_FRAMING.buttons.skip },
      ]}
      variant="rich"
      autoSubmitOnPick
      onSubmit={(ids) => {
        if (ids[0] === "yes") {
          setMode("enter");
        } else {
          onChosen(null);
          setMode("done");
        }
      }}
    />
  );
}

function CompletePanel({
  petName,
  traits,
  favorites,
}: {
  petName: string | null;
  traits: ReadonlyArray<string>;
  favorites: ReadonlyArray<string>;
}) {
  const name = petName ?? "your pet";
  const fragments = useMemo(() => {
    const list: string[] = [];
    if (traits.length > 0) {
      const labels = traits
        .map((id) => PERSONALITY_TRAITS.find((t) => t.id === id)?.label)
        .filter(Boolean);
      if (labels.length > 0) {
        list.push(`We'll carry that — ${labels.join(", ").toLowerCase()}.`);
      }
    }
    if (favorites.length > 0) {
      const labels = favorites
        .map((id) => FAVORITE_THINGS.find((f) => f.id === id)?.label)
        .filter(Boolean);
      if (labels.length > 0) {
        list.push(`And ${labels.join(" · ").toLowerCase()}.`);
      }
    }
    return list;
  }, [traits, favorites]);

  return (
    <section
      aria-label="Intake complete"
      style={{
        background: "#FFFBF3",
        border: `1px solid rgba(0,0,0,0.06)`,
        borderRadius: 18,
        padding: "36px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <p
        style={{
          margin: 0,
          fontStyle: "italic",
          fontSize: 28,
          lineHeight: 1.4,
        }}
      >
        Thank you for telling us about {name}.
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.6,
          opacity: 0.78,
          maxWidth: 540,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {fragments.length > 0
          ? fragments.join(" ")
          : `We'll start working on ${name}'s likeness next.`}
      </p>
      <p
        style={{
          margin: 0,
          marginTop: 6,
          fontSize: 13,
          opacity: 0.55,
        }}
      >
        {COPY.SHELL_COPY.stuck_footer}
      </p>
    </section>
  );
}
