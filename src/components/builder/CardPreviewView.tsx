"use client";

import Image from "next/image";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import { CARD_PREVIEW, substitutePetName } from "@/lib/library/copy";
import type { CardPreviewWire } from "@/lib/builder/wire-types";
import GateReview, { type GateAction } from "./GateReview";

// Stage 5.6 — Card preview review (GATE: v2.3 card preview).
//
// Body slot for <GateReview>. On `card_preview_render` we show a soft
// loading panel ("Rendering [PET_NAME]'s opening, closing, and a caption
// frame…"). On `card_preview_review` we show the three returned stills in
// a vertical stack — opening, closing, in_scene_caption — each with a small
// label above so the user knows which card they're looking at. The pill row
// is owned by <GateReview>:
//
//   - "Looks beautiful"      → POST /api/card-preview/approve, advance to
//                              cinematography_brief.
//   - "Edit the words"       → back to Stage 5.5 (words_editor).
//   - "Try different music"  → back to Stage 5.5 (words_editor) so the user
//                              can change the music + re-render. Mapped to
//                              `restart_words` for state-machine simplicity;
//                              the editor surfaces music as a section so
//                              the affordance is one tap inside the editor.
//   - "Start over"           → back to storyboard_complete.

export type CardPreviewMode = "loading" | "review";

export type CardPreviewAction =
  | "approve"
  | "restart_words"
  | "rerender"
  | "restart_all";

type Props = {
  petName: string | null;
  mode: CardPreviewMode;
  cards?: CardPreviewWire[];
  aspectRatio?: string | null;
  disabled?: boolean;
  onAction: (action: CardPreviewAction) => void;
};

export default function CardPreviewView({
  petName,
  mode,
  cards,
  aspectRatio,
  disabled = false,
  onAction,
}: Props) {
  if (mode === "loading" || !cards || cards.length === 0) {
    return <CardPreviewLoadingPanel petName={petName} />;
  }

  const headline = CARD_PREVIEW.headline;
  const subhead = substitutePetName(CARD_PREVIEW.subhead, petName);

  const actions: GateAction[] = [
    {
      id: "approve",
      label: CARD_PREVIEW.pills.approve,
      variant: "primary",
    },
    {
      id: "restart_words",
      label: CARD_PREVIEW.pills.restart_words,
      variant: "danger",
    },
    {
      id: "rerender",
      label: CARD_PREVIEW.pills.rerender,
      variant: "danger",
    },
    {
      id: "restart_all",
      label: CARD_PREVIEW.pills.restart,
      variant: "quiet",
    },
  ];

  // Order the cards consistently regardless of backend response order.
  const ordered = orderCards(cards);

  return (
    <GateReview
      headline={headline}
      subhead={subhead}
      actions={actions}
      onAction={(actionId) => onAction(actionId as CardPreviewAction)}
      pillsHint={CARD_PREVIEW.pills_hint}
      disabled={disabled}
      ariaLabel="Stage 5.6 — Card preview review"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
          width: "100%",
          maxWidth: 520,
        }}
      >
        {ordered.map((card) => (
          <CardPreviewFrame
            key={card.kind}
            card={card}
            petName={petName}
            aspectRatio={aspectRatio}
          />
        ))}
      </div>
    </GateReview>
  );
}

// -----------------------------------------------------------------------------
// Per-card frame: small label + the rendered still.
// -----------------------------------------------------------------------------

function CardPreviewFrame({
  card,
  petName,
  aspectRatio,
}: {
  card: CardPreviewWire;
  petName: string | null;
  aspectRatio: string | null | undefined;
}) {
  const label = CARD_PREVIEW.labels[card.kind];
  const alt = substitutePetName(
    `Preview of the ${labelFor(card.kind).toLowerCase()} for [PET_NAME]'s tribute`,
    petName,
  );
  const css = (aspectRatio ?? "9:16").replace(":", " / ");

  return (
    <figure
      style={{
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
      }}
    >
      <figcaption
        style={{
          fontFamily: FONT_SANS,
          fontSize: 12,
          fontWeight: 600,
          color: C.inkSofter,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </figcaption>
      <div
        style={{
          width: "100%",
          aspectRatio: css,
          position: "relative",
          borderRadius: 18,
          overflow: "hidden",
          background: "#FFFBF3",
          border: `1px solid ${C.line}`,
          boxShadow: "0 2px 16px rgba(42, 33, 27, 0.08)",
        }}
      >
        <Image
          src={card.public_url}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 520px"
          loading="lazy"
          priority={false}
          style={{ objectFit: "contain" }}
          unoptimized
        />
      </div>
    </figure>
  );
}

function labelFor(kind: CardPreviewWire["kind"]): string {
  return CARD_PREVIEW.labels[kind];
}

const ORDER: Record<CardPreviewWire["kind"], number> = {
  opening: 0,
  in_scene_caption: 1,
  closing: 2,
};

function orderCards(cards: CardPreviewWire[]): CardPreviewWire[] {
  return [...cards].sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
}

// -----------------------------------------------------------------------------
// Loading panel — verbatim spec copy: "Rendering [PET_NAME]'s opening,
// closing, and a caption frame…".
// -----------------------------------------------------------------------------

function CardPreviewLoadingPanel({ petName }: { petName: string | null }) {
  const line = substitutePetName(CARD_PREVIEW.loading, petName);
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: "64px 16px",
        minHeight: 320,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "2px solid rgba(0,0,0,0.08)",
          borderTopColor: C.goldDeep,
          animation: "peternaSpin 900ms linear infinite",
        }}
      />
      <p
        style={{
          margin: 0,
          fontFamily: FONT_DISPLAY,
          fontStyle: "italic",
          fontSize: 24,
          lineHeight: 1.4,
          color: C.ink,
          textAlign: "center",
        }}
      >
        {line}
      </p>
      <p
        style={{
          margin: 0,
          fontFamily: FONT_SANS,
          fontSize: 13,
          color: C.inkSofter,
          lineHeight: 1.55,
          textAlign: "center",
          maxWidth: 380,
        }}
      >
        {CARD_PREVIEW.loading_hint}
      </p>
      <style>{`@keyframes peternaSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
