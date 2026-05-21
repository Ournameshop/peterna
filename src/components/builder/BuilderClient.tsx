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
  type AspectRatio,
  type StageTag,
  type WizardState,
  type WizardEvent,
  type InferredProfile,
  type PhotoAsset,
} from "@/lib/builder/state";
import type {
  AssemblyApproveRequest,
  AssemblyApproveResponse,
  AssemblyRenderRequest,
  AssemblyRenderResponse,
  DeliveryEmailRequest,
  DeliveryEmailResponse,
  DeliveryFinalizeRequest,
  DeliveryFinalizeResponse,
  EulogyApproveRequest,
  EulogyApproveResponse,
  EulogyRenderRequest,
  EulogyRenderResponse,
  CardPreviewApproveRequest,
  CardPreviewApproveResponse,
  CardPreviewRenderRequest,
  CardPreviewRenderResponse,
  CardPreviewWire,
  CharacterSheetApproveRequest,
  CharacterSheetApproveResponse,
  CharacterSheetRenderRequest,
  CharacterSheetRenderResponse,
  CinematographyApproveRequest,
  CinematographyApproveResponse,
  CinematographyDeriveRequest,
  CinematographyDeriveResponse,
  CinematographyUpdateRequest,
  CinematographyUpdateResponse,
  DpStyleOverlayId,
  FrameVisionWire,
  MotionBriefWire,
  PreviewApproveRequest,
  PreviewApproveResponse,
  PreviewRenderRequest,
  PreviewRenderResponse,
  SessionCreateResponse,
  SessionPatchBody,
  StoryboardApproveRequest,
  StoryboardApproveResponse,
  StoryboardFrameWire,
  StoryboardRenderRequest,
  StoryboardRenderResponse,
  StoryboardRerollRequest,
  StoryboardRerollResponse,
  VideoClipWire,
  VideoRenderRequest,
  VideoRenderResponse,
  VideoRerollRequest,
  VideoRerollResponse,
  VideoStatusResponse,
  VisionPassResponse,
  WordsApproveRequest,
  WordsApproveResponse,
  WordsUpdateRequest,
  WordsUpdateResponse,
} from "@/lib/builder/wire-types";
import {
  ASSEMBLY_COMPLETE,
  CINEMATOGRAPHY_COMPLETE,
  EULOGY_COMPLETE,
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
  STAGE_2_INTRO,
  STAGE_3_COMPLETE,
  BEAT_SHEET_COMPLETE,
  STORYBOARD_COMPLETE,
  WORDS_COMPLETE,
  substitutePetName,
} from "@/lib/library/copy";
import { FORMATS } from "@/lib/library/formats";
import { THEMES } from "@/lib/library/themes";
import { findArtStyle, type ArtStyleId } from "@/lib/library/art-styles";
import type {
  FormatShape,
  ThemeShape,
} from "@/lib/builder/stage3-shapes";
import { getRefinementInstructions } from "@/lib/builder/refinements";
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
import CharacterSheetView from "./CharacterSheetView";
import LengthPicker from "./LengthPicker";
import AspectPicker from "./AspectPicker";
import CuratorPickGrid from "./CuratorPickGrid";
import CuratorStyleConfirm from "./CuratorStyleConfirm";
import FormatGrid from "./FormatGrid";
import ThemeCategoryGrid from "./ThemeCategoryGrid";
import ThemeGrid from "./ThemeGrid";
import StyleGrid from "./StyleGrid";
import CombinationPreviewReview, {
  type PreviewReviewAction,
} from "./CombinationPreviewReview";
import StoryboardView, {
  type StoryboardAction,
} from "./StoryboardView";
import WordsEditor, { type WordsEditorState } from "./WordsEditor";
import CardPreviewView, { type CardPreviewAction } from "./CardPreviewView";
import CinematographyView, {
  type CinematographyAction,
} from "./CinematographyView";
import { type CinematographyFieldName } from "./CinematographyTable";
import VideoRenderProgress from "./VideoRenderProgress";
import AssemblyView, { type AssemblyAction } from "./AssemblyView";
import EulogyView, { type EulogyAction } from "./EulogyView";
import DeliveryReadyView, {
  type DeliveryArtifactItem,
} from "./DeliveryReadyView";

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

// `SessionPatch` is the shared wire contract — see `wire-types.ts#SessionPatchBody`.
// Both this file and the PATCH handler at `src/app/api/session/[id]/route.ts` import
// from that module so adding a field touches one place, not two.
type SessionPatch = SessionPatchBody;

async function patchSession(
  sessionId: string | null,
  patch: SessionPatch,
): Promise<void> {
  if (!sessionId) return;
  // Dev breadcrumb: this is the contract the backend sees. Snake_case wire format
  // (per `wire-types.ts#SessionPatchBody`) — the field names are type-checked.
  if (process.env.NODE_ENV !== "production") {
    console.log("[builder] PATCH /api/session/" + sessionId, patch);
  }
  try {
    const res = await fetch(`/api/session/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    // 404 is expected during local dev before the backend is wired. 400 with
    // `invalid-stage-transition` means our optimistic client-side reducer
    // disagreed with the server — log it; user-visible recovery is reload (Phase 1).
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
    const json = (await res.json()) as SessionCreateResponse;
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
  const [renderInFlight, setRenderInFlight] = useState(false);
  // Idempotency-Key dedupe: hold onto the key for ~5s so a double-tap on
  // "Start over" or "Redraw" within that window sends the SAME key — backend
  // short-circuits to the existing row instead of double-billing. Distinct
  // re-render intents (the user comes back later, picks new refinements,
  // and submits again) get a new key.
  const renderIdemRef = useRef<{ key: string; createdAt: number } | null>(null);
  const renderInFlightRef = useRef(false);
  // Same dedupe pattern for the Stage 3 preview render. Re-entries (StrictMode
  // double-invoke, transient state churn) reuse the key; deliberate user
  // actions ("Try a different style", "Start over") clear the ref so the next
  // call gets a fresh key.
  const previewIdemRef = useRef<{ key: string; createdAt: number } | null>(null);
  const previewInFlightRef = useRef(false);
  const [previewInFlight, setPreviewInFlight] = useState(false);
  // Stage 5 storyboard render — same dedupe pattern as Stage 2/3. Re-entries
  // within the window reuse the key; deliberate actions ("Start over") clear
  // the ref so the next call gets a fresh key.
  const storyboardIdemRef = useRef<{ key: string; createdAt: number } | null>(
    null,
  );
  const storyboardInFlightRef = useRef(false);
  const [storyboardInFlight, setStoryboardInFlight] = useState(false);
  // Stage 5.6 card-preview render — same dedupe pattern as Stage 2/3/5. We
  // re-use the key on transient re-entries within the dedupe window; deliberate
  // user actions ("Try different music" → re-render) clear the ref.
  const cardPreviewIdemRef = useRef<{ key: string; createdAt: number } | null>(
    null,
  );
  const cardPreviewInFlightRef = useRef(false);
  const [cardPreviewInFlight, setCardPreviewInFlight] = useState(false);
  // Per-frame reroll keys are scoped to a (beat_idx) — distinct beats can
  // get distinct keys if rerolled in quick succession. The map persists the
  // last key + timestamp per beat so a double-tap within the dedupe window
  // re-uses the prior key.
  const rerollIdemRef = useRef<
    Map<number, { key: string; createdAt: number }>
  >(new Map());
  const rerollInFlightRef = useRef(false);
  // Stage 5.7 cinematography — same dedupe pattern as the other expensive
  // routes. The derive call runs N vision-pass calls plus the engine pass,
  // so a stuck client double-firing is costly. We reuse the key on transient
  // re-entries; deliberate user actions ("Reapply", "Start over") clear it.
  const cinematographyIdemRef = useRef<{ key: string; createdAt: number } | null>(
    null,
  );
  const cinematographyInFlightRef = useRef(false);
  const [cinematographyInFlight, setCinematographyInFlight] = useState(false);
  // Stage 6 — video render kickoff + status polling.
  //
  // `videoRenderIdemRef` dedupes the POST /api/video/render call (the kickoff
  // is expensive — N Seedance jobs queued — so a transient re-mount must not
  // double-fire). `videoRenderStartedRef` is a per-session latch: once we've
  // fired the kickoff for this session in this tab, we don't fire it again
  // even across remounts; the user can still tap "Restart" elsewhere.
  // `videoPollInFlightRef` guards against overlapping status polls on slow
  // networks. `videoRerollInFlightRef` keyed by beat_idx so distinct reroll
  // attempts on different beats don't block each other.
  const videoRenderIdemRef = useRef<{ key: string; createdAt: number } | null>(
    null,
  );
  const videoRenderStartedRef = useRef(false);
  const videoRenderInFlightRef = useRef(false);
  const videoPollInFlightRef = useRef(false);
  const videoRerollInFlightRef = useRef<Set<number>>(new Set());
  const [videoRerollBeatIdx, setVideoRerollBeatIdx] = useState<number | null>(
    null,
  );
  // Stage 7 — assembly render kickoff.
  const assemblyIdemRef = useRef<{ key: string; createdAt: number } | null>(
    null,
  );
  const assemblyStartedRef = useRef(false);
  const assemblyInFlightRef = useRef(false);
  const [assemblyInFlight, setAssemblyInFlight] = useState(false);
  // Stage 8 — eulogy PDF render kickoff. Same dedupe pattern as assembly —
  // the eulogy render is templating-only on the backend (no vendor call),
  // but it's still slow enough that a double-fire on transient re-mount
  // would matter. We reuse the key inside the dedupe window.
  const eulogyIdemRef = useRef<{ key: string; createdAt: number } | null>(
    null,
  );
  const eulogyStartedRef = useRef(false);
  const eulogyInFlightRef = useRef(false);
  const [eulogyInFlight, setEulogyInFlight] = useState(false);
  // Phase 9 — delivery finalize kickoff. Idempotent on the backend (the slug
  // is generated once per session), so the dedupe pattern is light: a single
  // latch that prevents the auto-fire effect from re-firing on remount.
  const finalizeStartedRef = useRef(false);
  const finalizeInFlightRef = useRef(false);
  const [finalizeInFlight, setFinalizeInFlight] = useState(false);

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
    // Bug-5: one idempotency key per effect-fire. The server's unique index on
    // `renders(session_id, stage, idempotency_key)` short-circuits duplicate
    // vendor calls within the dedup window — so a re-render that re-runs this
    // effect (e.g. on transient state churn) won't double-bill us.
    const idempotencyKey = crypto.randomUUID();
    (async () => {
      if (cancelled) return;
      setVisionInFlight(true);
      try {
        const res = await fetch("/api/vision-pass", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({ session_id: state.data.session_id }),
        });
        const json = (await res.json().catch(() => null)) as VisionPassResponse | null;
        if (json && "ok" in json && json.ok === true) {
          if ("vision_failure" in json && json.vision_failure) {
            dispatch({ type: "vision_pass_failed" });
          } else if ("inferred_profile" in json) {
            dispatch({
              type: "vision_pass_complete",
              profile: json.inferred_profile as InferredProfile,
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

  // ---------------------------------------------------------------------------
  // Stage 2 — Character sheet render
  //
  // Idempotency-Key strategy:
  //   - On a fresh render intent (user just landed on character_sheet_render or
  //     deliberately tapped "Start over" / "Redraw with notes"), generate a new
  //     UUID v4 (browser-native crypto.randomUUID()) and hold it in a ref.
  //   - If the same effect re-fires within the 5-second dedupe window (e.g.
  //     React StrictMode double-invocation, transient state churn), reuse the
  //     key so the backend short-circuits to the existing row.
  //   - A fresh user action ("Start over" pressed a second time after the prior
  //     render already returned) gets a new key — the user means "do it again."
  // ---------------------------------------------------------------------------

  const DEDUPE_WINDOW_MS = 5_000;

  const getIdempotencyKey = useCallback((freshIntent: boolean): string => {
    const now = Date.now();
    const cur = renderIdemRef.current;
    if (!freshIntent && cur && now - cur.createdAt < DEDUPE_WINDOW_MS) {
      return cur.key;
    }
    const key = crypto.randomUUID();
    renderIdemRef.current = { key, createdAt: now };
    return key;
  }, []);

  const renderCharacterSheet = useCallback(
    async (refinements: string[], freshIntent: boolean) => {
      if (!state.data.session_id) return;
      if (renderInFlightRef.current) return; // 1-in-flight guard
      renderInFlightRef.current = true;
      setRenderInFlight(true);

      const idempotencyKey = getIdempotencyKey(freshIntent);

      // Convert refinement chip IDs into the imperative instructions the
      // backend's `build-character-sheet.ts` will append to the prompt.
      // The textarea contents (state.data.pending_refinement_notes) get
      // appended as-is, verbatim, after the chip-derived instructions.
      const chipInstructions = getRefinementInstructions(refinements);
      const notes = state.data.pending_refinement_notes;
      const allRefinements: string[] = notes
        ? [...chipInstructions, notes]
        : chipInstructions;

      const body: CharacterSheetRenderRequest = {
        session_id: state.data.session_id,
        refinements: allRefinements.length > 0 ? allRefinements : undefined,
      };

      if (process.env.NODE_ENV !== "production") {
        console.log("[builder] POST /api/character-sheet/render", body);
      }

      try {
        const res = await fetch("/api/character-sheet/render", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
        });
        const json = (await res
          .json()
          .catch(() => null)) as CharacterSheetRenderResponse | null;
        if (json && json.ok) {
          dispatch({
            type: "character_sheet_rendered",
            asset: { asset_id: json.asset_id, public_url: json.public_url },
          });
        } else if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] character-sheet/render failed", res.status, json);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] character-sheet/render network error", err);
        }
      } finally {
        renderInFlightRef.current = false;
        setRenderInFlight(false);
      }
    },
    [getIdempotencyKey, state.data.session_id, state.data.pending_refinement_notes],
  );

  const approveCharacterSheet = useCallback(async () => {
    const sessionId = state.data.session_id;
    const asset = state.data.character_sheet;
    if (!sessionId || !asset) return;

    setSubmitting(true);
    const body: CharacterSheetApproveRequest = {
      session_id: sessionId,
      asset_id: asset.asset_id,
    };

    if (process.env.NODE_ENV !== "production") {
      console.log("[builder] POST /api/character-sheet/approve", body);
    }

    try {
      const res = await fetch("/api/character-sheet/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res
        .json()
        .catch(() => null)) as CharacterSheetApproveResponse | null;
      if (json && json.ok) {
        dispatch({ type: "character_sheet_approved" });
      } else {
        // 404 (backend not up yet) — advance optimistically so the wizard can
        // still walk in local dev. Backend will overwrite on PATCH.
        if (res.status === 404) {
          dispatch({ type: "character_sheet_approved" });
        } else if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] character-sheet/approve failed", res.status, json);
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[builder] character-sheet/approve network error", err);
      }
      // Fall through — the user can retry. We don't auto-advance on network
      // failure since the gate is meant to be deliberate.
    } finally {
      setSubmitting(false);
    }
  }, [state.data.session_id, state.data.character_sheet]);

  // ---------------------------------------------------------------------------
  // Stage 3 — Combination preview render + approve
  //
  // The dedupe / idempotency strategy matches Stage 2: same key on transient
  // re-entries within DEDUPE_WINDOW_MS, fresh key on a deliberate "try a
  // different style/theme/format" or "start over" action.
  // ---------------------------------------------------------------------------

  const getPreviewIdempotencyKey = useCallback(
    (freshIntent: boolean): string => {
      const now = Date.now();
      const cur = previewIdemRef.current;
      if (!freshIntent && cur && now - cur.createdAt < DEDUPE_WINDOW_MS) {
        return cur.key;
      }
      const key = crypto.randomUUID();
      previewIdemRef.current = { key, createdAt: now };
      return key;
    },
    [],
  );

  const renderCombinationPreview = useCallback(
    async (freshIntent: boolean) => {
      if (!state.data.session_id) return;
      if (previewInFlightRef.current) return;
      previewInFlightRef.current = true;
      setPreviewInFlight(true);

      const idempotencyKey = getPreviewIdempotencyKey(freshIntent);
      const body: PreviewRenderRequest = {
        session_id: state.data.session_id,
      };

      if (process.env.NODE_ENV !== "production") {
        console.log("[builder] POST /api/preview/render", body);
      }

      try {
        const res = await fetch("/api/preview/render", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
        });
        const json = (await res
          .json()
          .catch(() => null)) as PreviewRenderResponse | null;
        if (json && json.ok) {
          dispatch({
            type: "preview_rendered",
            asset: { asset_id: json.asset_id, public_url: json.public_url },
          });
        } else if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] preview/render failed", res.status, json);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] preview/render network error", err);
        }
      } finally {
        previewInFlightRef.current = false;
        setPreviewInFlight(false);
      }
    },
    [getPreviewIdempotencyKey, state.data.session_id],
  );

  const approveCombinationPreview = useCallback(async () => {
    const sessionId = state.data.session_id;
    const asset = state.data.combination_preview;
    if (!sessionId || !asset) return;

    setSubmitting(true);
    const body: PreviewApproveRequest = {
      session_id: sessionId,
      asset_id: asset.asset_id,
    };

    if (process.env.NODE_ENV !== "production") {
      console.log("[builder] POST /api/preview/approve", body);
    }

    try {
      const res = await fetch("/api/preview/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res
        .json()
        .catch(() => null)) as PreviewApproveResponse | null;
      if (json && json.ok) {
        dispatch({ type: "preview_approved" });
      } else {
        // 404: backend not yet up in local dev — advance optimistically so the
        // wizard can still walk. Matches the character-sheet pattern.
        if (res.status === 404) {
          dispatch({ type: "preview_approved" });
        } else if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] preview/approve failed", res.status, json);
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[builder] preview/approve network error", err);
      }
    } finally {
      setSubmitting(false);
    }
  }, [state.data.session_id, state.data.combination_preview]);

  // ---------------------------------------------------------------------------
  // Stage 5 — Storyboard render / reroll / approve
  //
  // Render produces N frames in parallel (one per beat); reroll is per-beat;
  // approve locks the set and advances to `storyboard_complete`. Idempotency
  // strategy matches Stage 2/3: dedupe window + fresh key on deliberate intent.
  // ---------------------------------------------------------------------------

  const getStoryboardIdempotencyKey = useCallback(
    (freshIntent: boolean): string => {
      const now = Date.now();
      const cur = storyboardIdemRef.current;
      if (!freshIntent && cur && now - cur.createdAt < DEDUPE_WINDOW_MS) {
        return cur.key;
      }
      const key = crypto.randomUUID();
      storyboardIdemRef.current = { key, createdAt: now };
      return key;
    },
    [],
  );

  const renderStoryboard = useCallback(
    async (freshIntent: boolean) => {
      if (!state.data.session_id) return;
      if (storyboardInFlightRef.current) return;
      storyboardInFlightRef.current = true;
      setStoryboardInFlight(true);

      const idempotencyKey = getStoryboardIdempotencyKey(freshIntent);
      const body: StoryboardRenderRequest = {
        session_id: state.data.session_id,
      };

      if (process.env.NODE_ENV !== "production") {
        console.log("[builder] POST /api/storyboard/render", body);
      }

      try {
        const res = await fetch("/api/storyboard/render", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
        });
        const json = (await res
          .json()
          .catch(() => null)) as StoryboardRenderResponse | null;
        if (json && json.ok) {
          dispatch({
            type: "storyboard_rendered",
            frames: json.frames,
          });
        } else if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] storyboard/render failed", res.status, json);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] storyboard/render network error", err);
        }
      } finally {
        storyboardInFlightRef.current = false;
        setStoryboardInFlight(false);
      }
    },
    [getStoryboardIdempotencyKey, state.data.session_id],
  );

  const getRerollIdempotencyKey = useCallback(
    (beatIdx: number, freshIntent: boolean): string => {
      const now = Date.now();
      const cur = rerollIdemRef.current.get(beatIdx);
      if (!freshIntent && cur && now - cur.createdAt < DEDUPE_WINDOW_MS) {
        return cur.key;
      }
      const key = crypto.randomUUID();
      rerollIdemRef.current.set(beatIdx, { key, createdAt: now });
      return key;
    },
    [],
  );

  const rerollFrame = useCallback(
    async (beatIdx: number, refinements: string[], notes: string | null) => {
      if (!state.data.session_id) return;
      if (rerollInFlightRef.current) return;
      rerollInFlightRef.current = true;

      // Snap into the per-frame reroll stage so the card renders its own
      // loading panel and other cards stay visible.
      dispatch({ type: "storyboard_frame_reroll_started", beatIdx });

      const idempotencyKey = getRerollIdempotencyKey(beatIdx, true);

      // Resolve chip IDs to imperative instructions, append free-text notes
      // verbatim. Mirrors the character-sheet refinement pattern so the
      // backend's prompt builder sees a consistent shape.
      const chipInstructions = getRefinementInstructions(refinements);
      const allRefinements: string[] = notes
        ? [...chipInstructions, notes]
        : chipInstructions;

      const body: StoryboardRerollRequest = {
        session_id: state.data.session_id,
        beat_idx: beatIdx,
        refinements: allRefinements.length > 0 ? allRefinements : undefined,
      };

      if (process.env.NODE_ENV !== "production") {
        console.log("[builder] POST /api/storyboard/reroll", body);
      }

      try {
        const res = await fetch("/api/storyboard/reroll", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
        });
        const json = (await res
          .json()
          .catch(() => null)) as StoryboardRerollResponse | null;
        if (json && json.ok) {
          // The success envelope IS the frame (no nested `frame` field per
          // wire-types — StoryboardRerollResponse = ApiOk<StoryboardFrameWire>).
          const frame: StoryboardFrameWire = {
            beat_idx: json.beat_idx,
            asset_id: json.asset_id,
            public_url: json.public_url,
          };
          dispatch({ type: "storyboard_frame_rerolled", frame });
        } else {
          // Failure — bounce back to review without replacing the frame.
          dispatch({ type: "goto", stage: "storyboard_review" });
          if (process.env.NODE_ENV !== "production") {
            console.warn("[builder] storyboard/reroll failed", res.status, json);
          }
        }
      } catch (err) {
        dispatch({ type: "goto", stage: "storyboard_review" });
        if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] storyboard/reroll network error", err);
        }
      } finally {
        rerollInFlightRef.current = false;
      }
    },
    [getRerollIdempotencyKey, state.data.session_id],
  );

  const approveStoryboard = useCallback(async () => {
    const sessionId = state.data.session_id;
    if (!sessionId) return;

    setSubmitting(true);
    const body: StoryboardApproveRequest = { session_id: sessionId };

    if (process.env.NODE_ENV !== "production") {
      console.log("[builder] POST /api/storyboard/approve", body);
    }

    try {
      const res = await fetch("/api/storyboard/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res
        .json()
        .catch(() => null)) as StoryboardApproveResponse | null;
      if (json && json.ok) {
        dispatch({ type: "storyboard_approved" });
      } else {
        // 404 (backend not up yet) — advance optimistically so local dev
        // can still walk. Mirrors the character-sheet / preview pattern.
        if (res.status === 404) {
          dispatch({ type: "storyboard_approved" });
        } else if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] storyboard/approve failed", res.status, json);
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[builder] storyboard/approve network error", err);
      }
    } finally {
      setSubmitting(false);
    }
  }, [state.data.session_id]);

  // Fire the storyboard render whenever we land on storyboard_render with no
  // frames yet. Mirrors the auto-render pattern from Stage 2/3.
  useEffect(() => {
    if (state.stage !== "storyboard_render") return;
    if (state.data.storyboard_frames) return;
    if (storyboardInFlightRef.current) return;
    void renderStoryboard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage, state.data.storyboard_frames]);

  // ---------------------------------------------------------------------------
  // Stage 5.5 — The Words: PATCH /api/words on every field commit + approve.
  // ---------------------------------------------------------------------------

  const patchWords = useCallback(
    async (patch: Partial<WordsEditorState>) => {
      const sessionId = state.data.session_id;
      if (!sessionId) return;
      // Optimistic local update so the UI doesn't flicker if the network is slow.
      dispatch({ type: "words_updated", patch });

      const body: WordsUpdateRequest = {
        session_id: sessionId,
        ...patch,
      };
      if (process.env.NODE_ENV !== "production") {
        console.log("[builder] PATCH /api/words", body);
      }
      try {
        const res = await fetch("/api/words", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok && res.status !== 404) {
          const json = (await res
            .json()
            .catch(() => null)) as WordsUpdateResponse | null;
          if (process.env.NODE_ENV !== "production") {
            console.warn("[builder] /api/words PATCH failed", res.status, json);
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] /api/words PATCH network error", err);
        }
      }
    },
    [state.data.session_id],
  );

  const approveWords = useCallback(async () => {
    const sessionId = state.data.session_id;
    if (!sessionId) return;
    setSubmitting(true);
    const body: WordsApproveRequest = { session_id: sessionId };
    if (process.env.NODE_ENV !== "production") {
      console.log("[builder] POST /api/words/approve", body);
    }
    try {
      const res = await fetch("/api/words/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res
        .json()
        .catch(() => null)) as WordsApproveResponse | null;
      if (json && json.ok) {
        // Reducer goes from words_render → words_complete on words_approved.
        // We then synthesize the next stage transition (words_complete →
        // card_preview_render) so the user lands on the loading screen
        // without an extra interstitial.
        dispatch({ type: "words_approved" });
        dispatch({ type: "card_preview_render_started" });
        cardPreviewIdemRef.current = null;
      } else if (res.status === 404) {
        // Backend not up yet — advance optimistically.
        dispatch({ type: "words_approved" });
        dispatch({ type: "card_preview_render_started" });
        cardPreviewIdemRef.current = null;
      } else if (process.env.NODE_ENV !== "production") {
        console.warn("[builder] /api/words/approve failed", res.status, json);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[builder] /api/words/approve network error", err);
      }
    } finally {
      setSubmitting(false);
    }
  }, [state.data.session_id]);

  // ---------------------------------------------------------------------------
  // Stage 5.6 — Card preview render / approve.
  // ---------------------------------------------------------------------------

  const getCardPreviewIdempotencyKey = useCallback(
    (freshIntent: boolean): string => {
      const now = Date.now();
      const cur = cardPreviewIdemRef.current;
      if (!freshIntent && cur && now - cur.createdAt < DEDUPE_WINDOW_MS) {
        return cur.key;
      }
      const key = crypto.randomUUID();
      cardPreviewIdemRef.current = { key, createdAt: now };
      return key;
    },
    [],
  );

  const renderCardPreview = useCallback(
    async (freshIntent: boolean) => {
      if (!state.data.session_id) return;
      if (cardPreviewInFlightRef.current) return;
      cardPreviewInFlightRef.current = true;
      setCardPreviewInFlight(true);

      const idempotencyKey = getCardPreviewIdempotencyKey(freshIntent);
      const body: CardPreviewRenderRequest = {
        session_id: state.data.session_id,
      };
      if (process.env.NODE_ENV !== "production") {
        console.log("[builder] POST /api/card-preview/render", body);
      }
      try {
        const res = await fetch("/api/card-preview/render", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
        });
        const json = (await res
          .json()
          .catch(() => null)) as CardPreviewRenderResponse | null;
        if (json && json.ok) {
          dispatch({
            type: "card_preview_rendered",
            cards: json.cards as CardPreviewWire[],
          });
        } else if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[builder] /api/card-preview/render failed",
            res.status,
            json,
          );
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[builder] /api/card-preview/render network error",
            err,
          );
        }
      } finally {
        cardPreviewInFlightRef.current = false;
        setCardPreviewInFlight(false);
      }
    },
    [getCardPreviewIdempotencyKey, state.data.session_id],
  );

  const approveCardPreview = useCallback(async () => {
    const sessionId = state.data.session_id;
    if (!sessionId) return;
    setSubmitting(true);
    const body: CardPreviewApproveRequest = { session_id: sessionId };
    if (process.env.NODE_ENV !== "production") {
      console.log("[builder] POST /api/card-preview/approve", body);
    }
    try {
      const res = await fetch("/api/card-preview/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res
        .json()
        .catch(() => null)) as CardPreviewApproveResponse | null;
      if (json && json.ok) {
        // Two-step transition: card_preview_review → card_preview_complete
        // → cinematography_brief. The reducer handles both on the same
        // event name (card_preview_approved).
        dispatch({ type: "card_preview_approved" });
        dispatch({ type: "card_preview_approved" });
      } else if (res.status === 404) {
        dispatch({ type: "card_preview_approved" });
        dispatch({ type: "card_preview_approved" });
      } else if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[builder] /api/card-preview/approve failed",
          res.status,
          json,
        );
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[builder] /api/card-preview/approve network error",
          err,
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [state.data.session_id]);

  // ---------------------------------------------------------------------------
  // Stage 5.7 — Cinematography Engine: derive / patch / approve.
  // ---------------------------------------------------------------------------

  const getCinematographyIdempotencyKey = useCallback(
    (freshIntent: boolean): string => {
      const now = Date.now();
      const cur = cinematographyIdemRef.current;
      if (!freshIntent && cur && now - cur.createdAt < DEDUPE_WINDOW_MS) {
        return cur.key;
      }
      const key = crypto.randomUUID();
      cinematographyIdemRef.current = { key, createdAt: now };
      return key;
    },
    [],
  );

  const deriveCinematography = useCallback(
    async (overlay: DpStyleOverlayId, freshIntent: boolean) => {
      if (!state.data.session_id) return;
      if (cinematographyInFlightRef.current) return;
      cinematographyInFlightRef.current = true;
      setCinematographyInFlight(true);

      const idempotencyKey = getCinematographyIdempotencyKey(freshIntent);
      const body: CinematographyDeriveRequest = {
        session_id: state.data.session_id,
        dp_style_overlay: overlay,
      };
      if (process.env.NODE_ENV !== "production") {
        console.log("[builder] POST /api/cinematography/derive", body);
      }
      try {
        const res = await fetch("/api/cinematography/derive", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
        });
        const json = (await res
          .json()
          .catch(() => null)) as CinematographyDeriveResponse | null;
        if (json && json.ok) {
          dispatch({
            type: "cinematography_derived",
            frame_vision: json.frame_vision as FrameVisionWire[],
            briefs: json.briefs as MotionBriefWire[],
          });
        } else if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[builder] /api/cinematography/derive failed",
            res.status,
            json,
          );
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[builder] /api/cinematography/derive network error",
            err,
          );
        }
      } finally {
        cinematographyInFlightRef.current = false;
        setCinematographyInFlight(false);
      }
    },
    [getCinematographyIdempotencyKey, state.data.session_id],
  );

  const patchCinematographyField = useCallback(
    async (
      beatIdx: number,
      field: CinematographyFieldName,
      nextValue: string,
    ) => {
      const sessionId = state.data.session_id;
      if (!sessionId) return;

      // Optimistically update the local brief so the chip flips immediately;
      // the PATCH races the user's next tap.
      const briefs = state.data.cinematography_briefs ?? [];
      const current = briefs.find((b) => b.beat_idx === beatIdx);
      if (!current) return;
      const fieldValue: MotionBriefWire[keyof MotionBriefWire] =
        field === "lens_mm"
          ? (Number(nextValue) as MotionBriefWire["lens_mm"])
          : (nextValue as MotionBriefWire[keyof MotionBriefWire]);
      const nextBrief: MotionBriefWire = {
        ...current,
        [field]: fieldValue,
      } as MotionBriefWire;
      dispatch({
        type: "cinematography_field_edited",
        beatIdx,
        brief: nextBrief,
      });

      const body: CinematographyUpdateRequest = {
        session_id: sessionId,
        beat_idx: beatIdx,
        field_overrides: { [field]: fieldValue } as Partial<
          Omit<MotionBriefWire, "beat_idx">
        >,
      };
      if (process.env.NODE_ENV !== "production") {
        console.log("[builder] PATCH /api/cinematography", body);
      }
      try {
        const res = await fetch("/api/cinematography", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res
          .json()
          .catch(() => null)) as CinematographyUpdateResponse | null;
        if (!json || !json.ok) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              "[builder] /api/cinematography PATCH failed",
              res.status,
              json,
            );
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[builder] /api/cinematography PATCH network error",
            err,
          );
        }
      }
    },
    [state.data.session_id, state.data.cinematography_briefs],
  );

  const approveCinematography = useCallback(async () => {
    const sessionId = state.data.session_id;
    if (!sessionId) return;
    setSubmitting(true);
    const body: CinematographyApproveRequest = { session_id: sessionId };
    if (process.env.NODE_ENV !== "production") {
      console.log("[builder] POST /api/cinematography/approve", body);
    }
    try {
      const res = await fetch("/api/cinematography/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res
        .json()
        .catch(() => null)) as CinematographyApproveResponse | null;
      if (json && json.ok) {
        dispatch({ type: "cinematography_approved" });
      } else if (res.status === 404) {
        // Backend not up — advance optimistically.
        dispatch({ type: "cinematography_approved" });
      } else if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[builder] /api/cinematography/approve failed",
          res.status,
          json,
        );
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[builder] /api/cinematography/approve network error",
          err,
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [state.data.session_id]);

  // ---------------------------------------------------------------------------
  // Stage 6 — Video render: POST /api/video/render → poll /api/video/status
  // → reroll failed clips. The poll lives in a useEffect below; this section
  // owns the kickoff + reroll request helpers.
  //
  // Polling cadence: 5s while we're on `video_render` and `all_done === false`.
  // Stop conditions: (a) reducer sees `all_done === true` and transitions to
  // `assembly_render`, (b) the user leaves the stage (component unmount /
  // stage change cancels the interval), (c) the page hides (we don't pause
  // the poll on visibility-change — the server is doing the work either way;
  // the next tick on visible re-fires).
  // ---------------------------------------------------------------------------

  const getVideoRenderIdempotencyKey = useCallback(
    (freshIntent: boolean): string => {
      const now = Date.now();
      const cur = videoRenderIdemRef.current;
      if (!freshIntent && cur && now - cur.createdAt < DEDUPE_WINDOW_MS) {
        return cur.key;
      }
      const key = crypto.randomUUID();
      videoRenderIdemRef.current = { key, createdAt: now };
      return key;
    },
    [],
  );

  const renderVideoClips = useCallback(
    async (freshIntent: boolean) => {
      if (!state.data.session_id) return;
      if (videoRenderInFlightRef.current) return;
      videoRenderInFlightRef.current = true;

      const idempotencyKey = getVideoRenderIdempotencyKey(freshIntent);
      const body: VideoRenderRequest = {
        session_id: state.data.session_id,
      };
      if (process.env.NODE_ENV !== "production") {
        console.log("[builder] POST /api/video/render", body);
      }
      try {
        const res = await fetch("/api/video/render", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
        });
        const json = (await res
          .json()
          .catch(() => null)) as VideoRenderResponse | null;
        if (json && json.ok) {
          // Seed the local clip array from the kickoff response so the grid
          // doesn't read empty until the first poll lands.
          dispatch({
            type: "video_status_polled",
            clips: json.clips as VideoClipWire[],
          });
        } else if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] /api/video/render failed", res.status, json);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] /api/video/render network error", err);
        }
      } finally {
        videoRenderInFlightRef.current = false;
      }
    },
    [getVideoRenderIdempotencyKey, state.data.session_id],
  );

  const pollVideoStatus = useCallback(async () => {
    if (!state.data.session_id) return;
    if (videoPollInFlightRef.current) return;
    videoPollInFlightRef.current = true;
    try {
      const url = `/api/video/status?session_id=${encodeURIComponent(state.data.session_id)}`;
      const res = await fetch(url, { method: "GET" });
      const json = (await res
        .json()
        .catch(() => null)) as VideoStatusResponse | null;
      if (json && json.ok) {
        dispatch({
          type: "video_status_polled",
          clips: json.clips as VideoClipWire[],
        });
        if (json.all_done) {
          dispatch({ type: "all_clips_done" });
        }
      } else if (process.env.NODE_ENV !== "production") {
        console.warn("[builder] /api/video/status failed", res.status, json);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[builder] /api/video/status network error", err);
      }
    } finally {
      videoPollInFlightRef.current = false;
    }
  }, [state.data.session_id]);

  const rerollVideoClip = useCallback(
    async (beatIdx: number) => {
      const sessionId = state.data.session_id;
      if (!sessionId) return;
      if (videoRerollInFlightRef.current.has(beatIdx)) return;
      videoRerollInFlightRef.current.add(beatIdx);
      setVideoRerollBeatIdx(beatIdx);

      // Optimistic local update: flip the matching clip back to 'queued' so
      // the grid card shows the right state immediately. The next poll
      // overwrites this with the canonical server view.
      const clips = state.data.video_clips ?? [];
      const current = clips.find((c) => c.beat_idx === beatIdx);
      if (current) {
        const optimistic: VideoClipWire = {
          ...current,
          status: "queued",
          asset_id: null,
          public_url: null,
          error: undefined,
        };
        dispatch({ type: "video_clip_rerolled", clip: optimistic });
      }

      const body: VideoRerollRequest = {
        session_id: sessionId,
        beat_idx: beatIdx,
      };
      if (process.env.NODE_ENV !== "production") {
        console.log("[builder] POST /api/video/reroll", body);
      }
      try {
        const res = await fetch("/api/video/reroll", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify(body),
        });
        const json = (await res
          .json()
          .catch(() => null)) as VideoRerollResponse | null;
        if (json && json.ok) {
          dispatch({
            type: "video_clip_rerolled",
            clip: {
              beat_idx: json.beat_idx,
              status: json.status,
              asset_id: json.asset_id,
              public_url: json.public_url,
              error: json.error,
            },
          });
        } else if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] /api/video/reroll failed", res.status, json);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] /api/video/reroll network error", err);
        }
      } finally {
        videoRerollInFlightRef.current.delete(beatIdx);
        // Clear the visual rerolling indicator on this beat — the next poll
        // will flip it to rendering / done based on the server's view.
        setVideoRerollBeatIdx((prev) => (prev === beatIdx ? null : prev));
      }
    },
    [state.data.session_id, state.data.video_clips],
  );

  // Kick off the video render once, when we land on video_render and we
  // don't yet have a clip array. Latched per-session so a transient re-mount
  // doesn't refire the kickoff.
  useEffect(() => {
    if (state.stage !== "video_render") return;
    if (!state.data.session_id) return;
    if (videoRenderStartedRef.current) return;
    if (state.data.video_clips && state.data.video_clips.length > 0) {
      // Resume: backend already kicked off — no kickoff, just poll.
      videoRenderStartedRef.current = true;
      return;
    }
    videoRenderStartedRef.current = true;
    void renderVideoClips(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage, state.data.session_id]);

  // Poll /api/video/status every 5s while on video_render and not yet done.
  // Stops on stage transition or unmount. Doesn't poll on video_review (we
  // hit that stage only after all_done is true).
  useEffect(() => {
    if (state.stage !== "video_render") return;
    if (!state.data.session_id) return;
    const allDone =
      (state.data.video_clips ?? []).length > 0 &&
      (state.data.video_clips ?? []).every((c) => c.status === "done");
    if (allDone) return;

    // First poll fires immediately (no 5s wait before the user sees anything).
    void pollVideoStatus();
    const interval = window.setInterval(() => {
      void pollVideoStatus();
    }, 5_000);
    return () => {
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage, state.data.session_id, state.data.video_clips]);

  // ---------------------------------------------------------------------------
  // Stage 7 — Assembly render → review → approve.
  //
  // Assembly is a single long render (ffmpeg, server-side). We post once on
  // entry, then sit on a "stitching…" panel until the response lands with the
  // final MP4. No polling — assembly is one job, not N. On approve we POST
  // /api/assembly/approve and advance to `assembly_complete` (Phase 8 entry).
  // ---------------------------------------------------------------------------

  const getAssemblyIdempotencyKey = useCallback(
    (freshIntent: boolean): string => {
      const now = Date.now();
      const cur = assemblyIdemRef.current;
      if (!freshIntent && cur && now - cur.createdAt < DEDUPE_WINDOW_MS) {
        return cur.key;
      }
      const key = crypto.randomUUID();
      assemblyIdemRef.current = { key, createdAt: now };
      return key;
    },
    [],
  );

  const renderAssembly = useCallback(
    async (freshIntent: boolean) => {
      if (!state.data.session_id) return;
      if (assemblyInFlightRef.current) return;
      assemblyInFlightRef.current = true;
      setAssemblyInFlight(true);

      const idempotencyKey = getAssemblyIdempotencyKey(freshIntent);
      const body: AssemblyRenderRequest = {
        session_id: state.data.session_id,
      };
      if (process.env.NODE_ENV !== "production") {
        console.log("[builder] POST /api/assembly/render", body);
      }
      try {
        const res = await fetch("/api/assembly/render", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
        });
        const json = (await res
          .json()
          .catch(() => null)) as AssemblyRenderResponse | null;
        if (json && json.ok) {
          dispatch({
            type: "assembly_complete_event",
            assetId: json.asset_id,
            publicUrl: json.public_url,
          });
        } else if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] /api/assembly/render failed", res.status, json);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] /api/assembly/render network error", err);
        }
      } finally {
        assemblyInFlightRef.current = false;
        setAssemblyInFlight(false);
      }
    },
    [getAssemblyIdempotencyKey, state.data.session_id],
  );

  const approveAssembly = useCallback(async () => {
    const sessionId = state.data.session_id;
    if (!sessionId) return;
    setSubmitting(true);
    const body: AssemblyApproveRequest = { session_id: sessionId };
    if (process.env.NODE_ENV !== "production") {
      console.log("[builder] POST /api/assembly/approve", body);
    }
    try {
      const res = await fetch("/api/assembly/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res
        .json()
        .catch(() => null)) as AssemblyApproveResponse | null;
      if (json && json.ok) {
        dispatch({ type: "assembly_approved" });
      } else if (res.status === 404) {
        // Backend not up yet — advance optimistically.
        dispatch({ type: "assembly_approved" });
      } else if (process.env.NODE_ENV !== "production") {
        console.warn("[builder] /api/assembly/approve failed", res.status, json);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[builder] /api/assembly/approve network error", err);
      }
    } finally {
      setSubmitting(false);
    }
  }, [state.data.session_id]);

  // Auto-fire the assembly render when we land on assembly_render with no
  // result yet. Mirrors the auto-render pattern from earlier stages; the
  // latch ref guards against a transient re-mount double-firing.
  useEffect(() => {
    if (state.stage !== "assembly_render") return;
    if (!state.data.session_id) return;
    if (state.data.assembly_public_url) return;
    if (assemblyStartedRef.current) return;
    assemblyStartedRef.current = true;
    void renderAssembly(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage, state.data.session_id, state.data.assembly_public_url]);

  // Defensive snap-back: if the user deep-links to assembly_review with no
  // URL yet (e.g. session-GET hasn't hydrated), bounce them back to render.
  useEffect(() => {
    if (
      state.stage === "assembly_review" &&
      !state.data.assembly_public_url
    ) {
      dispatch({ type: "goto", stage: "assembly_render" });
    }
  }, [state.stage, state.data.assembly_public_url]);

  // ---------------------------------------------------------------------------
  // Stage 8 — Eulogy PDF render → review → approve.
  //
  // Backend templating is cheap (no vendor call) but the PDF upload to R2
  // is still ~5–10s end-to-end. We POST once on entry to eulogy_render,
  // sit on the loading panel until the response lands, then move the user
  // to eulogy_review with the PDF embedded inline.
  // ---------------------------------------------------------------------------

  const getEulogyIdempotencyKey = useCallback(
    (freshIntent: boolean): string => {
      const now = Date.now();
      const cur = eulogyIdemRef.current;
      if (!freshIntent && cur && now - cur.createdAt < DEDUPE_WINDOW_MS) {
        return cur.key;
      }
      const key = crypto.randomUUID();
      eulogyIdemRef.current = { key, createdAt: now };
      return key;
    },
    [],
  );

  const renderEulogy = useCallback(
    async (freshIntent: boolean) => {
      if (!state.data.session_id) return;
      if (eulogyInFlightRef.current) return;
      eulogyInFlightRef.current = true;
      setEulogyInFlight(true);

      const idempotencyKey = getEulogyIdempotencyKey(freshIntent);
      const body: EulogyRenderRequest = {
        session_id: state.data.session_id,
      };
      if (process.env.NODE_ENV !== "production") {
        console.log("[builder] POST /api/eulogy/render", body);
      }
      try {
        const res = await fetch("/api/eulogy/render", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
        });
        const json = (await res
          .json()
          .catch(() => null)) as EulogyRenderResponse | null;
        if (json && json.ok) {
          dispatch({
            type: "eulogy_rendered",
            assetId: json.asset_id,
            publicUrl: json.public_url,
          });
        } else if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] /api/eulogy/render failed", res.status, json);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[builder] /api/eulogy/render network error", err);
        }
      } finally {
        eulogyInFlightRef.current = false;
        setEulogyInFlight(false);
      }
    },
    [getEulogyIdempotencyKey, state.data.session_id],
  );

  const approveEulogy = useCallback(async () => {
    const sessionId = state.data.session_id;
    if (!sessionId) return;
    setSubmitting(true);
    const body: EulogyApproveRequest = { session_id: sessionId };
    if (process.env.NODE_ENV !== "production") {
      console.log("[builder] POST /api/eulogy/approve", body);
    }
    try {
      const res = await fetch("/api/eulogy/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res
        .json()
        .catch(() => null)) as EulogyApproveResponse | null;
      if (json && json.ok) {
        dispatch({ type: "eulogy_approved" });
      } else if (res.status === 404) {
        // Backend not up yet — advance optimistically.
        dispatch({ type: "eulogy_approved" });
      } else if (process.env.NODE_ENV !== "production") {
        console.warn("[builder] /api/eulogy/approve failed", res.status, json);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[builder] /api/eulogy/approve network error", err);
      }
    } finally {
      setSubmitting(false);
    }
  }, [state.data.session_id]);

  // Auto-fire the eulogy render when we land on eulogy_render with no PDF
  // yet. Latch ref guards against transient re-mount double-firing; the
  // "Re-render the PDF" gate pill clears `eulogy_pdf_url` AND resets the
  // latch (see the review action handler) so this effect picks it up again.
  useEffect(() => {
    if (state.stage !== "eulogy_render") return;
    if (!state.data.session_id) return;
    if (state.data.eulogy_pdf_url) return;
    if (eulogyStartedRef.current) return;
    eulogyStartedRef.current = true;
    void renderEulogy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage, state.data.session_id, state.data.eulogy_pdf_url]);

  // Defensive snap-back: if the user deep-links to eulogy_review with no PDF
  // (refresh before session-GET hydrates), bounce them back to render.
  useEffect(() => {
    if (
      state.stage === "eulogy_review" &&
      !state.data.eulogy_pdf_url
    ) {
      dispatch({ type: "goto", stage: "eulogy_render" });
    }
  }, [state.stage, state.data.eulogy_pdf_url]);

  // ---------------------------------------------------------------------------
  // Phase 9 — Final delivery: finalize + email.
  //
  // Finalize is idempotent on the backend (it generates a share slug once
  // per session, then re-uses it on subsequent calls). We auto-fire on
  // delivery_ready entry; the response lands the slug + absolute share URL
  // into local state.
  //
  // Email send is a separate, user-driven, non-blocking action — the
  // DeliveryReadyView form owns the in-flight UI; we just expose an
  // async helper.
  // ---------------------------------------------------------------------------

  const finalizeDelivery = useCallback(async () => {
    const sessionId = state.data.session_id;
    if (!sessionId) return;
    if (finalizeInFlightRef.current) return;
    finalizeInFlightRef.current = true;
    setFinalizeInFlight(true);

    const body: DeliveryFinalizeRequest = { session_id: sessionId };
    if (process.env.NODE_ENV !== "production") {
      console.log("[builder] POST /api/delivery/finalize", body);
    }
    try {
      const res = await fetch("/api/delivery/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res
        .json()
        .catch(() => null)) as DeliveryFinalizeResponse | null;
      if (json && json.ok) {
        dispatch({
          type: "delivery_finalized",
          shareSlug: json.share_slug,
          shareUrl: json.share_url,
        });
      } else if (process.env.NODE_ENV !== "production") {
        console.warn("[builder] /api/delivery/finalize failed", res.status, json);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[builder] /api/delivery/finalize network error", err);
      }
    } finally {
      finalizeInFlightRef.current = false;
      setFinalizeInFlight(false);
    }
  }, [state.data.session_id]);

  const sendDeliveryEmail = useCallback(
    async (email: string): Promise<void> => {
      const sessionId = state.data.session_id;
      if (!sessionId) throw new Error("no-session");
      const body: DeliveryEmailRequest = {
        session_id: sessionId,
        email,
      };
      if (process.env.NODE_ENV !== "production") {
        console.log("[builder] POST /api/delivery/email", body);
      }
      const res = await fetch("/api/delivery/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res
        .json()
        .catch(() => null)) as DeliveryEmailResponse | null;
      if (json && json.ok) {
        dispatch({
          type: "delivery_emailed_event",
          sentTo: json.sent_to,
        });
        return;
      }
      // 404 during dev is the same "backend not up yet" optimism we use
      // elsewhere — we treat it as success so the wizard remains usable
      // against an unfinished backend. In production any non-ok response
      // is surfaced as an error to the form.
      if (res.status === 404 && process.env.NODE_ENV !== "production") {
        dispatch({ type: "delivery_emailed_event", sentTo: email });
        return;
      }
      throw new Error("send_failed");
    },
    [state.data.session_id],
  );

  // Auto-fire the delivery finalize when we land on delivery_ready with no
  // share URL yet. Idempotent on the backend so a single-latch is enough;
  // the user may also re-enter from a refresh and we want the slug to come
  // back from the session-GET path on the server, which serializes
  // delivery_share_slug — that path bypasses this effect entirely.
  useEffect(() => {
    if (state.stage !== "delivery_ready") return;
    if (!state.data.session_id) return;
    if (state.data.delivery_share_url) return;
    if (finalizeStartedRef.current) return;
    finalizeStartedRef.current = true;
    void finalizeDelivery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage, state.data.session_id, state.data.delivery_share_url]);

  // Auto-fire derive whenever we land on cinematography_render with no
  // briefs yet. Same auto-render pattern as Stage 2/3/5/5.6.
  useEffect(() => {
    if (state.stage !== "cinematography_render") return;
    if (state.data.cinematography_briefs) return;
    if (cinematographyInFlightRef.current) return;
    const overlay = state.data.cinematography_dp_overlay ?? "none";
    void deriveCinematography(overlay, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.stage,
    state.data.cinematography_briefs,
    state.data.cinematography_dp_overlay,
  ]);

  // Defensive snap-back: if the user deep-links into cinematography_review
  // without briefs (refresh before session-GET hydrates), bounce them back to
  // the render stage so the auto-derive effect picks them up.
  useEffect(() => {
    if (
      state.stage === "cinematography_review" &&
      !state.data.cinematography_briefs
    ) {
      dispatch({ type: "goto", stage: "cinematography_render" });
    }
  }, [state.stage, state.data.cinematography_briefs]);

  // Auto-fire the card-preview render whenever we land on card_preview_render
  // with no cards yet. Mirrors the auto-render pattern from Stage 2/3/5.
  useEffect(() => {
    if (state.stage !== "card_preview_render") return;
    if (state.data.card_preview_cards) return;
    if (cardPreviewInFlightRef.current) return;
    void renderCardPreview(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage, state.data.card_preview_cards]);

  // If the user deep-links to card_preview_review without cards, snap back to
  // render so the auto-render effect picks them up. Same defensive pattern as
  // storyboard/character-sheet.
  useEffect(() => {
    if (
      state.stage === "card_preview_review" &&
      !state.data.card_preview_cards
    ) {
      dispatch({ type: "goto", stage: "card_preview_render" });
    }
  }, [state.stage, state.data.card_preview_cards]);

  // If the user deep-links to storyboard_review without frames, snap back to
  // render so the auto-render effect picks them up. Same defensive pattern
  // as character_sheet_review.
  useEffect(() => {
    if (state.stage === "storyboard_review" && !state.data.storyboard_frames) {
      dispatch({ type: "goto", stage: "storyboard_render" });
    }
  }, [state.stage, state.data.storyboard_frames]);

  // Fire the preview render whenever we land on combination_preview_render
  // with no asset yet. Mirrors the character-sheet auto-render pattern: any
  // transition into the render stage triggers a render call. The reducer
  // clears `combination_preview` on every "back" / "restart" event, so the
  // user gets a fresh frame after switching their picks.
  useEffect(() => {
    if (state.stage !== "combination_preview_render") return;
    if (state.data.combination_preview) return;
    if (previewInFlightRef.current) return;
    void renderCombinationPreview(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage, state.data.combination_preview]);

  // Fire a render automatically whenever we land on character_sheet_render
  // with no asset yet. This covers: initial entry from intake_complete,
  // re-entry from "Start over" or refinement-submitted in the reducer.
  //
  // If the user deep-links to character_sheet_review (or refinement) without
  // an asset in state (e.g. page refresh before session-GET-restore lands —
  // outside Phase 2 scope, Phase 1 doesn't restore the asset URL), snap back
  // to character_sheet_render so the auto-render effect picks them up.
  useEffect(() => {
    if (
      (state.stage === "character_sheet_review" ||
        state.stage === "character_sheet_refinement") &&
      !state.data.character_sheet
    ) {
      dispatch({ type: "goto", stage: "character_sheet_render" });
      return;
    }
    if (state.stage !== "character_sheet_render") return;
    if (state.data.character_sheet) return; // already have one, no need to fire
    if (renderInFlightRef.current) return;
    void renderCharacterSheet(state.data.pending_refinements, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage, state.data.character_sheet]);

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
            onStart={() => {
              void dispatchAndSave({ type: "character_sheet_render_started" });
            }}
          />
        );

      case "character_sheet_render":
        return (
          <CharacterSheetView
            petName={petName}
            mode="loading"
            onApprove={() => {}}
            onRequestRefinement={() => {}}
            onRestart={() => {}}
            disabled
          />
        );

      case "character_sheet_review":
      case "character_sheet_refinement": {
        const asset = state.data.character_sheet;
        if (!asset) {
          // Fallback — should not happen, but keep a calm loading state.
          return (
            <CharacterSheetView
              petName={petName}
              mode="loading"
              onApprove={() => {}}
              onRequestRefinement={() => {}}
              onRestart={() => {}}
              disabled
            />
          );
        }
        return (
          <CharacterSheetView
            petName={petName}
            mode="review"
            imageUrl={asset.public_url}
            initialRefinements={state.data.pending_refinements}
            initialNotes={state.data.pending_refinement_notes}
            disabled={submitting || renderInFlight}
            onApprove={() => {
              void approveCharacterSheet();
            }}
            onRequestRefinement={(refinements, notes) => {
              // Fresh intent — generate a new idempotency key for this render.
              renderIdemRef.current = null;
              dispatch({
                type: "character_sheet_refinement_requested",
                refinements,
                notes,
              });
              // The render effect will fire on the stage transition into
              // character_sheet_render; we don't need to call it directly.
            }}
            onRestart={() => {
              // Fresh intent — clear the idempotency key so the next render
              // is treated as a new request, not a double-tap.
              renderIdemRef.current = null;
              dispatch({ type: "character_sheet_restart" });
            }}
          />
        );
      }

      case "length_pick":
        return (
          <LengthPicker
            petName={petName}
            onChosen={(targetMinutes, beatCount) => {
              void dispatchAndSave(
                { type: "length_chosen", targetMinutes, beatCount },
                { target_minutes: targetMinutes, beat_count: beatCount },
              );
            }}
          />
        );

      case "aspect_pick":
        return (
          <AspectPicker
            petName={petName}
            onChosen={(ratio: AspectRatio) => {
              void dispatchAndSave(
                { type: "aspect_chosen", aspectRatio: ratio },
                { aspect_ratio: ratio },
              );
            }}
          />
        );

      case "curators_pick_or_manual":
        return (
          <CuratorPickGrid
            petName={petName}
            relationship={state.data.relationship}
            onPickCurator={(pick) => {
              void dispatchAndSave(
                {
                  type: "curator_pick_chosen",
                  curatorsPickId: pick.id,
                  formatId: pick.format_id,
                  themeId: pick.theme_id,
                  styleId: pick.style_id,
                },
                {
                  curators_pick_id: pick.id,
                  format_id: pick.format_id,
                  theme_id: pick.theme_id,
                  style_id: pick.style_id,
                },
              );
            }}
            onPickManual={() => {
              void dispatchAndSave({ type: "manual_path_chosen" });
            }}
          />
        );

      case "curator_style_confirm": {
        const currentStyleId = state.data.style_id;
        if (!currentStyleId) {
          // Defensive — shouldn't happen, but route back to the curator's pick
          // screen if the style somehow isn't set.
          dispatch({ type: "goto", stage: "curators_pick_or_manual" });
          return <Loading label="Loading…" />;
        }
        return (
          <CuratorStyleConfirm
            currentStyleId={currentStyleId}
            onKeep={() => {
              void dispatchAndSave({ type: "curator_style_kept" });
            }}
            onSwitch={(styleId) => {
              previewIdemRef.current = null; // fresh intent
              void dispatchAndSave(
                { type: "curator_style_switched", styleId },
                { style_id: styleId },
              );
            }}
          />
        );
      }

      case "format_pick":
        return (
          <FormatGrid
            petName={petName}
            onChosen={(formatId) => {
              void dispatchAndSave(
                { type: "format_chosen", formatId },
                { format_id: formatId },
              );
            }}
          />
        );

      case "theme_category_pick":
        return (
          <ThemeCategoryGrid
            relationship={state.data.relationship}
            onChosen={(categoryId) => {
              // Category is transient — store in reducer state only, no PATCH.
              void dispatchAndSave({
                type: "theme_category_chosen",
                categoryId,
              });
            }}
          />
        );

      case "theme_pick": {
        const categoryId = state.data.pending_theme_category;
        if (!categoryId) {
          // Re-entry without a category — snap back to the category picker.
          dispatch({ type: "goto", stage: "theme_category_pick" });
          return <Loading label="Loading…" />;
        }
        return (
          <ThemeGrid
            petName={petName}
            categoryId={categoryId}
            onChosen={(themeId) => {
              void dispatchAndSave(
                { type: "theme_chosen", themeId },
                { theme_id: themeId },
              );
            }}
            onBack={() => {
              dispatch({ type: "goto", stage: "theme_category_pick" });
            }}
          />
        );
      }

      case "style_pick":
        return (
          <StyleGrid
            petName={petName}
            relationship={state.data.relationship}
            onChosen={(styleId) => {
              previewIdemRef.current = null; // fresh intent
              void dispatchAndSave(
                { type: "style_chosen", styleId },
                { style_id: styleId },
              );
            }}
          />
        );

      case "combination_preview_render":
      case "combination_preview_review": {
        const asset = state.data.combination_preview;
        const formatLabel =
          (FORMATS as ReadonlyArray<FormatShape>).find(
            (f) => f.id === state.data.format_id,
          )?.label ?? null;
        const themeLabel =
          (THEMES as ReadonlyArray<ThemeShape>).find(
            (t) => t.id === state.data.theme_id,
          )?.label ?? null;
        const styleLabel =
          findArtStyle(state.data.style_id as ArtStyleId | null)?.label ?? null;
        const isLoading =
          state.stage === "combination_preview_render" || !asset;
        return (
          <CombinationPreviewReview
            petName={petName}
            mode={isLoading ? "loading" : "review"}
            imageUrl={asset?.public_url}
            formatLabel={formatLabel ? substitutePetName(formatLabel, petName) : null}
            themeLabel={themeLabel}
            styleLabel={styleLabel}
            aspectRatio={state.data.aspect_ratio}
            disabled={submitting || previewInFlight}
            onAction={(action: PreviewReviewAction) => {
              if (action === "approve") {
                void approveCombinationPreview();
                return;
              }
              previewIdemRef.current = null; // fresh intent on every step-back
              if (action === "restart_style") {
                void dispatchAndSave({ type: "preview_restart_style" });
                return;
              }
              if (action === "restart_theme") {
                // The reducer clears theme_id locally so the user re-picks;
                // the server keeps the prior value until a new theme_id is
                // PATCHed in on theme_chosen — that's fine, the next render
                // call requires it set and will reflect the new theme.
                void dispatchAndSave({ type: "preview_restart_theme" });
                return;
              }
              if (action === "restart_all") {
                // Same — local reducer clears the four ids; PATCH only writes
                // the new ids when the user re-picks them. The server's
                // combination_preview_asset_id stays unset until approve.
                void dispatchAndSave({ type: "preview_restart_all" });
                return;
              }
            }}
          />
        );
      }

      case "stage_3_complete":
        return <Stage3CompletePanel petName={petName} />;

      // ----------------------------------------------------------------------
      // Stage 4 — Beat Sheet (intentionally minimal in this commit).
      //
      // The full beat-sheet review UI lands in a separate commit; here we
      // only handle `beat_sheet_complete` so a user landing on Stage 5 from
      // an earlier session can advance into the storyboard render. The
      // BeatSheetView itself is intentionally not wired here.
      // ----------------------------------------------------------------------
      case "beat_sheet_complete":
        return (
          <BeatSheetCompletePanel
            petName={petName}
            onStart={() => {
              storyboardIdemRef.current = null; // fresh intent
              void dispatchAndSave({ type: "storyboard_render_started" });
            }}
          />
        );

      // ----------------------------------------------------------------------
      // Stage 5 — Storyboard
      // ----------------------------------------------------------------------
      case "storyboard_render":
        return (
          <StoryboardView
            petName={petName}
            mode="loading"
            disabled
            onAction={() => {}}
            onRerollFrame={() => {}}
          />
        );

      case "storyboard_review":
      case "storyboard_frame_reroll": {
        const frames = state.data.storyboard_frames;
        const beats = state.data.beat_sheet;
        if (!frames || !beats) {
          return (
            <StoryboardView
              petName={petName}
              mode="loading"
              disabled
              onAction={() => {}}
              onRerollFrame={() => {}}
            />
          );
        }
        return (
          <StoryboardView
            petName={petName}
            mode="review"
            frames={frames}
            beats={beats}
            aspectRatio={state.data.aspect_ratio}
            rerollBeatIdx={state.data.reroll_beat_idx}
            disabled={submitting || storyboardInFlight}
            onAction={(action: StoryboardAction) => {
              if (action === "approve") {
                void approveStoryboard();
                return;
              }
              if (action === "restart") {
                // "Start over" — bounce back to the beat-sheet hand-off; the
                // user can re-fire the storyboard render from there. Clear
                // the frames + idempotency key so the next call is fresh.
                // We use `session_loaded` because we need to mutate both
                // stage and data atomically; the reducer's other events
                // only handle one or the other.
                storyboardIdemRef.current = null;
                dispatch({
                  type: "session_loaded",
                  state: {
                    stage: "beat_sheet_complete",
                    data: {
                      ...state.data,
                      storyboard_frames: null,
                      reroll_beat_idx: null,
                    },
                  },
                });
              }
            }}
            onRerollFrame={(beatIdx, refinements, notes) => {
              void rerollFrame(beatIdx, refinements, notes);
            }}
          />
        );
      }

      case "storyboard_complete":
        return (
          <StoryboardCompletePanel
            petName={petName}
            onStart={() => {
              // Approve route was called when entering storyboard_complete;
              // this CTA just advances the reducer into Stage 5.5 (The Words).
              dispatch({ type: "storyboard_approved" });
            }}
            isComplete={false}
          />
        );

      // ----------------------------------------------------------------------
      // Stage 5.5 — The Words editor.
      //
      // `words_render` is the entry tag (from storyboard_approved); we treat
      // it as the editor's first paint. `words_editor` is the alias used on
      // deep-link / restart_words from Stage 5.6 — same screen, same handlers.
      // ----------------------------------------------------------------------
      case "words_render":
      case "words_editor": {
        const initial: WordsEditorState = {
          opening_title_card_text: state.data.opening_title_card_text,
          closing_card_text: state.data.closing_card_text,
          music_track_id: state.data.music_track_id,
          narration_voice_id: state.data.narration_voice_id,
          narration_text: state.data.narration_text,
        };
        return (
          <WordsEditor
            petName={petName}
            formatId={state.data.format_id}
            initial={initial}
            disabled={submitting}
            submitting={submitting}
            onChange={(patch) => {
              void patchWords(patch);
            }}
            onContinue={() => {
              void approveWords();
            }}
          />
        );
      }

      case "words_complete":
        return (
          <WordsCompletePanel
            petName={petName}
            onStart={() => {
              cardPreviewIdemRef.current = null;
              dispatch({ type: "card_preview_render_started" });
            }}
          />
        );

      // ----------------------------------------------------------------------
      // Stage 5.6 — Card preview render → review → approve.
      // ----------------------------------------------------------------------
      case "card_preview_render":
        return (
          <CardPreviewView
            petName={petName}
            mode="loading"
            aspectRatio={state.data.aspect_ratio}
            disabled
            onAction={() => {}}
          />
        );

      case "card_preview_review": {
        const cards = state.data.card_preview_cards;
        if (!cards || cards.length === 0) {
          return (
            <CardPreviewView
              petName={petName}
              mode="loading"
              aspectRatio={state.data.aspect_ratio}
              disabled
              onAction={() => {}}
            />
          );
        }
        return (
          <CardPreviewView
            petName={petName}
            mode="review"
            cards={cards}
            aspectRatio={state.data.aspect_ratio}
            disabled={submitting || cardPreviewInFlight}
            onAction={(action: CardPreviewAction) => {
              if (action === "approve") {
                void approveCardPreview();
                return;
              }
              if (action === "restart_words") {
                dispatch({ type: "card_preview_restart_words" });
                return;
              }
              if (action === "rerender") {
                // "Try different music" — bounce back to the editor so the
                // user can change the music pill, then continue forward
                // through the normal flow. The cards are cleared so the
                // next forward pass re-renders against the updated music.
                cardPreviewIdemRef.current = null;
                dispatch({ type: "card_preview_restart_words" });
                return;
              }
              if (action === "restart_all") {
                cardPreviewIdemRef.current = null;
                dispatch({ type: "card_preview_restart_all" });
                return;
              }
            }}
          />
        );
      }

      case "card_preview_complete":
        // Hand-off between Stage 5.6 approve and Stage 5.7 entry. Most users
        // won't see this — approveCardPreview dispatches twice so the reducer
        // ends up on cinematography_brief immediately. Kept for deep-links.
        return (
          <CinematographyHandoffPanel
            petName={petName}
            isComplete={false}
          />
        );

      // ----------------------------------------------------------------------
      // Stage 5.7 — Cinematography Engine: picker → loading → review.
      // ----------------------------------------------------------------------
      case "cinematography_brief":
        return (
          <CinematographyView
            petName={petName}
            mode="picker"
            defaultOverlay={state.data.cinematography_dp_overlay ?? "none"}
            disabled={submitting || cinematographyInFlight}
            onApplyOverlay={(overlay) => {
              cinematographyIdemRef.current = null; // fresh intent
              dispatch({
                type: "cinematography_derive_started",
                overlay,
              });
            }}
            onFieldChange={() => {}}
            onReviewAction={() => {}}
          />
        );

      case "cinematography_render":
        return (
          <CinematographyView
            petName={petName}
            mode="loading"
            disabled
            onApplyOverlay={() => {}}
            onFieldChange={() => {}}
            onReviewAction={() => {}}
          />
        );

      case "cinematography_review": {
        const briefs = state.data.cinematography_briefs;
        if (!briefs || briefs.length === 0) {
          return (
            <CinematographyView
              petName={petName}
              mode="loading"
              disabled
              onApplyOverlay={() => {}}
              onFieldChange={() => {}}
              onReviewAction={() => {}}
            />
          );
        }
        return (
          <CinematographyView
            petName={petName}
            mode="review"
            briefs={briefs}
            beats={state.data.beat_sheet}
            defaultOverlay={state.data.cinematography_dp_overlay ?? "none"}
            disabled={submitting || cinematographyInFlight}
            onApplyOverlay={() => {}}
            onFieldChange={(beatIdx, field, next) => {
              void patchCinematographyField(beatIdx, field, next);
            }}
            onReviewAction={(action: CinematographyAction) => {
              if (action === "approve") {
                void approveCinematography();
                return;
              }
              if (action === "regenerate") {
                // "Reapply derivation" — re-run the engine with the same
                // overlay. Fresh idempotency key so the backend treats this
                // as a deliberate retry rather than a stuck-client dupe.
                cinematographyIdemRef.current = null;
                const overlay =
                  state.data.cinematography_dp_overlay ?? "none";
                dispatch({
                  type: "cinematography_derive_started",
                  overlay,
                });
                return;
              }
              if (action === "restart") {
                // "Start over" — bounce back to the picker and clear overlay
                // + briefs so the user can pick a different DP look.
                cinematographyIdemRef.current = null;
                dispatch({ type: "cinematography_restart" });
                return;
              }
            }}
          />
        );
      }

      case "cinematography_complete":
        // Soft pause between Stage 5.7 and Stage 6 (video render). The CTA
        // fires `video_render_started`, which the reducer flips to
        // `video_render`, which the kickoff effect picks up and POSTs to
        // /api/video/render. Latch refs are cleared on every fresh-intent CTA.
        return (
          <CinematographyToVideoPanel
            petName={petName}
            onStart={() => {
              videoRenderIdemRef.current = null;
              videoRenderStartedRef.current = false;
              dispatch({ type: "video_render_started" });
            }}
          />
        );

      // ----------------------------------------------------------------------
      // Stage 6 — Video render progress.
      //
      // The grid renders one card per beat, reads from `state.data.video_clips`
      // (whole-array replace on every poll). Failed clips offer a "Try again"
      // pill which calls rerollVideoClip(beat_idx). The transition to
      // assembly_render is driven by the reducer on `all_clips_done`.
      // ----------------------------------------------------------------------
      case "video_render": {
        const beats = state.data.beat_sheet ?? [];
        return (
          <VideoRenderProgress
            petName={petName}
            clips={state.data.video_clips}
            beats={beats}
            storyboardFrames={state.data.storyboard_frames}
            aspectRatio={state.data.aspect_ratio}
            disabled={submitting}
            rerollBeatIdx={videoRerollBeatIdx}
            onRerollClip={(beatIdx) => {
              void rerollVideoClip(beatIdx);
            }}
          />
        );
      }

      // Reserved for a future "Review the clips before stitching" pause —
      // currently unused in the happy path (we transition directly to
      // assembly_render). Render the same grid as video_render so a deep-
      // link land here doesn't crash.
      case "video_review": {
        const beats = state.data.beat_sheet ?? [];
        return (
          <VideoRenderProgress
            petName={petName}
            clips={state.data.video_clips}
            beats={beats}
            storyboardFrames={state.data.storyboard_frames}
            aspectRatio={state.data.aspect_ratio}
            disabled={submitting}
            rerollBeatIdx={videoRerollBeatIdx}
            onRerollClip={(beatIdx) => {
              void rerollVideoClip(beatIdx);
            }}
          />
        );
      }

      // ----------------------------------------------------------------------
      // Stage 7 — Assembly render → review → approve.
      // ----------------------------------------------------------------------
      case "assembly_render":
        return (
          <AssemblyView
            petName={petName}
            mode="loading"
            aspectRatio={state.data.aspect_ratio}
            disabled
            onAction={() => {}}
          />
        );

      case "assembly_review": {
        const videoUrl = state.data.assembly_public_url;
        if (!videoUrl) {
          return (
            <AssemblyView
              petName={petName}
              mode="loading"
              aspectRatio={state.data.aspect_ratio}
              disabled
              onAction={() => {}}
            />
          );
        }
        return (
          <AssemblyView
            petName={petName}
            mode="review"
            videoUrl={videoUrl}
            aspectRatio={state.data.aspect_ratio}
            disabled={submitting || assemblyInFlight}
            onAction={(action: AssemblyAction) => {
              if (action === "approve") {
                void approveAssembly();
                return;
              }
              if (action === "restitch") {
                // "Re-stitch with changes" — bounce back to the Words editor
                // so the user can adjust opening/closing/music/narration,
                // then walk forward through the cinematography → video →
                // assembly chain. The previously approved cinematography
                // briefs and rendered clips stay in place; only the
                // assembly itself re-runs once the user advances back here.
                assemblyStartedRef.current = false;
                assemblyIdemRef.current = null;
                dispatch({
                  type: "session_loaded",
                  state: {
                    stage: "words_editor",
                    data: {
                      ...state.data,
                      assembly_asset_id: null,
                      assembly_public_url: null,
                    },
                  },
                });
                return;
              }
              if (action === "reroll_clips") {
                // "Re-render specific clips" — bounce back to the Stage 6
                // progress grid so the user can tap "Try again" on any clip
                // they want reworked. The latched flag stays true (we don't
                // re-fire /api/video/render); the user is opting in to
                // selective rerolls, not a full re-render.
                assemblyStartedRef.current = false;
                assemblyIdemRef.current = null;
                dispatch({
                  type: "session_loaded",
                  state: {
                    stage: "video_render",
                    data: {
                      ...state.data,
                      assembly_asset_id: null,
                      assembly_public_url: null,
                    },
                  },
                });
                return;
              }
            }}
          />
        );
      }

      case "assembly_complete":
        return (
          <AssemblyCompletePanel
            petName={petName}
            onStart={() => {
              // Stage 7 → 8 hand-off — kick the eulogy render and land the
              // user on the loading panel. The auto-fire effect handles the
              // POST /api/eulogy/render call.
              eulogyStartedRef.current = false;
              eulogyIdemRef.current = null;
              dispatch({ type: "eulogy_render_started" });
            }}
          />
        );

      // ----------------------------------------------------------------------
      // Stage 8 — Eulogy PDF render → review → approve.
      // ----------------------------------------------------------------------
      case "eulogy_render":
        return (
          <EulogyView
            petName={petName}
            mode="loading"
            disabled
            onAction={() => {}}
          />
        );

      case "eulogy_review": {
        const pdfUrl = state.data.eulogy_pdf_url;
        if (!pdfUrl) {
          return (
            <EulogyView
              petName={petName}
              mode="loading"
              disabled
              onAction={() => {}}
            />
          );
        }
        return (
          <EulogyView
            petName={petName}
            mode="review"
            pdfUrl={pdfUrl}
            disabled={submitting || eulogyInFlight}
            onAction={(action: EulogyAction) => {
              if (action === "approve") {
                void approveEulogy();
                return;
              }
              if (action === "rerender") {
                // "Re-render the PDF" — clear the cached PDF, reset the
                // latch + idempotency-key ref so the auto-fire effect
                // treats this as a fresh intent, and bounce back to the
                // render stage. The reducer handles the data clear via
                // the eulogy_render_started event.
                eulogyStartedRef.current = false;
                eulogyIdemRef.current = null;
                dispatch({ type: "eulogy_render_started" });
                return;
              }
              if (action === "restart_words") {
                // "Edit the words" — bounce back to the Words editor so
                // the user can adjust opening / closing / narration text.
                // The previously rendered assembly + storyboard stay; only
                // the eulogy re-renders on the second pass. We DO clear
                // the eulogy state here so the user sees a fresh
                // composition on re-entry.
                eulogyStartedRef.current = false;
                eulogyIdemRef.current = null;
                dispatch({
                  type: "session_loaded",
                  state: {
                    stage: "words_editor",
                    data: {
                      ...state.data,
                      eulogy_pdf_asset_id: null,
                      eulogy_pdf_url: null,
                    },
                  },
                });
                return;
              }
            }}
          />
        );
      }

      case "eulogy_complete":
        return (
          <EulogyCompletePanel
            petName={petName}
            onStart={() => {
              // Stage 8 → Phase 9 hand-off — advance into delivery_ready
              // and let the auto-finalize effect fire POST /api/delivery/finalize.
              finalizeStartedRef.current = false;
              dispatch({ type: "delivery_finalize_started" });
            }}
          />
        );

      // ----------------------------------------------------------------------
      // Phase 9 — Final delivery (added beyond spec).
      // ----------------------------------------------------------------------
      case "delivery_ready":
      case "delivery_emailed": {
        const artifacts = buildDeliveryArtifacts(state);
        return (
          <DeliveryReadyView
            petName={petName}
            finalizing={finalizeInFlight}
            shareUrl={state.data.delivery_share_url}
            artifacts={artifacts}
            eulogyPdfUrl={state.data.eulogy_pdf_url}
            onEmail={sendDeliveryEmail}
            emailedTo={state.data.delivery_emailed_to}
          />
        );
      }

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
  onStart,
}: {
  petName: string | null;
  traits: ReadonlyArray<string>;
  favorites: ReadonlyArray<string>;
  onStart: () => void;
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

  const headline = substitutePetName(STAGE_2_INTRO.headline, petName);
  const body = substitutePetName(STAGE_2_INTRO.body, petName);

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
        gap: 18,
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
      {fragments.length > 0 ? (
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
          {fragments.join(" ")}
        </p>
      ) : null}

      <hr
        aria-hidden="true"
        style={{
          margin: "8px auto",
          width: 64,
          border: "none",
          borderTop: "1px solid rgba(0,0,0,0.08)",
        }}
      />

      <p
        style={{
          margin: 0,
          fontSize: 18,
          lineHeight: 1.5,
          fontStyle: "italic",
        }}
      >
        {headline}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.6,
          opacity: 0.78,
          maxWidth: 540,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {body}
      </p>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
        <button
          type="button"
          onClick={onStart}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "12px 24px",
            borderRadius: 999,
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
            background: "#2A211B",
            color: "#F8F1E4",
          }}
        >
          {STAGE_2_INTRO.start_button}
        </button>
      </div>

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

// Beat-sheet-complete hand-off — Stage 4 → Stage 5 entry. Renders the
// "story locked" copy from BEAT_SHEET_COMPLETE and a CTA that fires
// `storyboard_render_started`. The beat-sheet review UI itself is shipped
// separately; this panel exists so a user already past Stage 4 can advance
// into the storyboard render.
function BeatSheetCompletePanel({
  petName,
  onStart,
}: {
  petName: string | null;
  onStart: () => void;
}) {
  const headline = BEAT_SHEET_COMPLETE.headline;
  const body = substitutePetName(BEAT_SHEET_COMPLETE.body, petName);
  return (
    <section
      aria-label="Beat sheet complete"
      style={handoffSection}
    >
      <p style={handoffHeadline}>{headline}</p>
      <p style={handoffBody}>{body}</p>
      <div style={handoffCtaRow}>
        <button type="button" onClick={onStart} style={handoffCtaButton}>
          {BEAT_SHEET_COMPLETE.start_button}
        </button>
      </div>
    </section>
  );
}

// Storyboard-complete hand-off — Stage 5 → Stage 5.5 entry. Approve has
// already been called by the time the user lands here; the CTA just advances
// the reducer (Stage 5.5 itself is a Phase 5 concern). When the user has
// already advanced past, `isComplete` swaps to a quiet "next up: the words"
// status panel.
function StoryboardCompletePanel({
  petName,
  onStart,
  isComplete,
}: {
  petName: string | null;
  onStart: () => void;
  isComplete: boolean;
}) {
  const headline = STORYBOARD_COMPLETE.headline;
  const body = substitutePetName(STORYBOARD_COMPLETE.body, petName);
  return (
    <section
      aria-label="Storyboard complete"
      style={handoffSection}
    >
      <p style={handoffHeadline}>{headline}</p>
      <p style={handoffBody}>{body}</p>
      {isComplete ? (
        <p style={handoffPending}>The Words is coming next.</p>
      ) : (
        <div style={handoffCtaRow}>
          <button type="button" onClick={onStart} style={handoffCtaButton}>
            {STORYBOARD_COMPLETE.start_button}
          </button>
        </div>
      )}
    </section>
  );
}

// Stage 5.5-complete hand-off — soft pause between words_complete and the
// card_preview_render screen. Most users will never see this: approveWords
// auto-fires the card_preview_render_started transition. The panel exists for
// deep-link / refresh scenarios.
function WordsCompletePanel({
  petName,
  onStart,
}: {
  petName: string | null;
  onStart: () => void;
}) {
  const headline = WORDS_COMPLETE.headline;
  const body = substitutePetName(WORDS_COMPLETE.body, petName);
  return (
    <section aria-label="Words complete" style={handoffSection}>
      <p style={handoffHeadline}>{headline}</p>
      <p style={handoffBody}>{body}</p>
      <div style={handoffCtaRow}>
        <button type="button" onClick={onStart} style={handoffCtaButton}>
          {WORDS_COMPLETE.start_button}
        </button>
      </div>
    </section>
  );
}

// Stage 5.6 → 5.7 hand-off and Stage 5.7 → 6 hand-off.
//
// `isComplete=false` is the card_preview_complete soft pause — "cards locked,
// cinematography next." Most users skip this screen because approveCardPreview
// dispatches twice and lands directly on `cinematography_brief`.
//
// `isComplete=true` is the cinematography_complete soft pause — "cinematography
// locked, video next." Phase 7 (video generation) is not yet wired so we
// render a calm "next up" line without a CTA.
function CinematographyHandoffPanel({
  petName,
  isComplete,
}: {
  petName: string | null;
  isComplete: boolean;
}) {
  const headline = isComplete
    ? "Cinematography locked in."
    : "Cards locked in.";
  const body = isComplete
    ? substitutePetName(
        "Every beat now has a lens, a camera move, lighting, and audio. Next, we'll render the video clips that bring [PET_NAME]'s tribute to life.",
        petName,
      )
    : substitutePetName(
        "Next, we'll plan the cinematography for every beat of [PET_NAME]'s tribute — the lens, the camera move, the lighting. We'll show you the full plan before any video renders.",
        petName,
      );
  return (
    <section
      aria-label={isComplete ? "Cinematography complete" : "Card preview complete"}
      style={handoffSection}
    >
      <p style={handoffHeadline}>{headline}</p>
      <p style={handoffBody}>{body}</p>
      {isComplete ? (
        <p style={handoffPending}>The video render is coming next.</p>
      ) : null}
    </section>
  );
}

// Stage 5.7 → Stage 6 hand-off. "Cinematography locked, video next" with a
// CTA that fires `video_render_started`. The kick-off effect picks that up
// and POSTs /api/video/render; the poller takes over from there.
function CinematographyToVideoPanel({
  petName,
  onStart,
}: {
  petName: string | null;
  onStart: () => void;
}) {
  const headline = CINEMATOGRAPHY_COMPLETE.headline;
  const body = substitutePetName(CINEMATOGRAPHY_COMPLETE.body, petName);
  return (
    <section
      aria-label="Cinematography complete"
      style={handoffSection}
    >
      <p style={handoffHeadline}>{headline}</p>
      <p style={handoffBody}>{body}</p>
      <div style={handoffCtaRow}>
        <button type="button" onClick={onStart} style={handoffCtaButton}>
          {CINEMATOGRAPHY_COMPLETE.start_button}
        </button>
      </div>
    </section>
  );
}

// Stage 7 → Stage 8 hand-off. "Tribute locked, eulogy next." CTA fires
// `eulogy_render_started` and lands the user on the loading panel; the
// BuilderClient's auto-fire effect handles the POST /api/eulogy/render call.
function AssemblyCompletePanel({
  petName,
  onStart,
}: {
  petName: string | null;
  onStart: () => void;
}) {
  const headline = substitutePetName(ASSEMBLY_COMPLETE.headline, petName);
  const body = substitutePetName(ASSEMBLY_COMPLETE.body, petName);
  return (
    <section aria-label="Assembly complete" style={handoffSection}>
      <p style={handoffHeadline}>{headline}</p>
      <p style={handoffBody}>{body}</p>
      <div style={handoffCtaRow}>
        <button type="button" onClick={onStart} style={handoffCtaButton}>
          {ASSEMBLY_COMPLETE.start_button}
        </button>
      </div>
    </section>
  );
}

// Stage 8 → Phase 9 hand-off. "Eulogy locked, delivery next." CTA fires
// `delivery_finalize_started` so the BuilderClient's auto-finalize effect
// POSTs /api/delivery/finalize and lands the slug into state.
function EulogyCompletePanel({
  petName,
  onStart,
}: {
  petName: string | null;
  onStart: () => void;
}) {
  const headline = substitutePetName(EULOGY_COMPLETE.headline, petName);
  const body = substitutePetName(EULOGY_COMPLETE.body, petName);
  const buttonLabel = substitutePetName(EULOGY_COMPLETE.start_button, petName);
  return (
    <section aria-label="Eulogy complete" style={handoffSection}>
      <p style={handoffHeadline}>{headline}</p>
      <p style={handoffBody}>{body}</p>
      <div style={handoffCtaRow}>
        <button type="button" onClick={onStart} style={handoffCtaButton}>
          {buttonLabel}
        </button>
      </div>
    </section>
  );
}

// Stage 3 complete — final hand-off panel between Stage 3 and Stage 4 (not yet
// wired). Calm "next step" copy; no Stage-4 CTA until Phase 4 lands.
function Stage3CompletePanel({ petName }: { petName: string | null }) {
  const headline = STAGE_3_COMPLETE.headline;
  const body = substitutePetName(STAGE_3_COMPLETE.body, petName);
  return (
    <section
      aria-label="Stage 3 complete"
      style={handoffSection}
    >
      <p style={handoffHeadline}>{headline}</p>
      <p style={handoffBody}>{body}</p>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Shared hand-off panel styles (Stage 3 / 4 / 5 complete screens).
// -----------------------------------------------------------------------------

const handoffSection = {
  background: "#FFFBF3",
  border: `1px solid rgba(0,0,0,0.06)`,
  borderRadius: 18,
  padding: "36px 24px",
  textAlign: "center" as const,
  display: "flex",
  flexDirection: "column" as const,
  gap: 14,
};

const handoffHeadline = {
  margin: 0,
  fontStyle: "italic" as const,
  fontSize: 22,
  lineHeight: 1.4,
};

const handoffBody = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.6,
  opacity: 0.78,
  maxWidth: 540,
  marginLeft: "auto",
  marginRight: "auto",
};

const handoffCtaRow = {
  display: "flex",
  justifyContent: "center" as const,
  marginTop: 6,
};

const handoffCtaButton = {
  display: "inline-flex",
  alignItems: "center" as const,
  padding: "12px 24px",
  borderRadius: 999,
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 500,
  border: "none",
  cursor: "pointer" as const,
  background: "#2A211B",
  color: "#F8F1E4",
};

const handoffPending = {
  margin: 0,
  fontSize: 13,
  opacity: 0.6,
};

// -----------------------------------------------------------------------------
// Delivery artifact assembly.
//
// Builds the grid of DeliveryArtifactItem cards rendered on the
// delivery_ready screen. We surface everything the user produced in this
// wizard session — the character sheet portrait, every storyboard frame,
// the opening + closing cards, and (as a download-badged card) the eulogy
// PDF. The final assembled video gets its own download-badged card too.
//
// Items are surfaced in deliberate order:
//   1. Character sheet (the likeness anchor)
//   2. Opening + closing + in-scene cards (the typography)
//   3. Storyboard frames (one per beat, in order)
//   4. Final video (downloadable)
//   5. Eulogy PDF (downloadable)
//
// All `href` values open in a new tab via the consumer's rel=noopener target;
// the consumer (DeliveryReadyView) handles the anchor wrapping.
// -----------------------------------------------------------------------------

function buildDeliveryArtifacts(state: WizardState): DeliveryArtifactItem[] {
  const items: DeliveryArtifactItem[] = [];
  const d = state.data;

  if (d.character_sheet?.public_url) {
    items.push({
      label: "Character sheet",
      thumbnailUrl: d.character_sheet.public_url,
      href: d.character_sheet.public_url,
      caption: "Four-view likeness",
    });
  }

  if (d.card_preview_cards) {
    for (const card of d.card_preview_cards) {
      const label =
        card.kind === "opening"
          ? "Opening card"
          : card.kind === "closing"
            ? "Closing card"
            : "In-scene caption";
      items.push({
        label,
        thumbnailUrl: card.public_url,
        href: card.public_url,
      });
    }
  }

  if (d.storyboard_frames) {
    const total = d.storyboard_frames.length;
    for (const frame of d.storyboard_frames) {
      items.push({
        label: `Scene ${frame.beat_idx + 1} of ${total}`,
        thumbnailUrl: frame.public_url,
        href: frame.public_url,
      });
    }
  }

  if (d.assembly_public_url) {
    items.push({
      label: "Final tribute",
      thumbnailUrl: null,
      href: d.assembly_public_url,
      caption: "MP4",
      downloadable: true,
    });
  }

  if (d.eulogy_pdf_url) {
    items.push({
      label: "Eulogy PDF",
      thumbnailUrl: null,
      href: d.eulogy_pdf_url,
      caption: "One-page printable",
      downloadable: true,
    });
  }

  return items;
}
