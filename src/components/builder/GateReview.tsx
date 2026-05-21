"use client";

import { type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import {
  fadeUp,
  staggerChildren,
} from "@/lib/builder/motion-tokens";
import { tap, confirm } from "@/lib/builder/haptic";

// Pattern E — Gate Review.
//
// Read-only artifact preview (children) + a row of approval pills + an optional
// caption / hint. Designed for the Stage 2 character sheet gate (GATE 1) and
// reusable for Stage 3 combination preview (GATE 2), Stage 5 storyboard
// frames (GATE 4+), etc.
//
// Convention notes:
//   - The artifact slot (children) gets full visual room. The pill row sits
//     below in a quiet, deliberately small footprint. The artifact is the
//     emotional moment; the pills are the choice.
//   - No cost-pressure language; pill labels are caller-defined and the
//     copy lives in `lib/library/copy.ts`. This primitive is just shape.
//   - Action callback is single-arg `(actionId)`; refinement chips + textarea
//     are NOT owned by this component — the caller (CharacterSheetView,
//     CombinationPreviewReview, etc.) renders them in the children slot or
//     as an `extraBody` slot conditional on the user picking "refine."

export type GateAction = {
  id: string;
  label: string;
  // Optional visual modifier — `primary` keeps the slot's default ink-on-cream
  // look; `quiet` is borderless underlined; `danger` is for destructive
  // "Start over" affordances. The visual difference is small and intentional —
  // the gate should not feel like a high-stakes UI moment.
  variant?: "primary" | "quiet" | "danger";
};

type Props = {
  /** Optional headline above the artifact ("Here's [PET_NAME].") */
  headline?: string;
  /** Optional subhead below the headline. */
  subhead?: string;
  /** The artifact — character sheet image, combination preview, storyboard, etc. */
  children: ReactNode;
  /** Pill row spec — typically "Looks great" / "Needs tweaks" / "Start over". */
  actions: ReadonlyArray<GateAction>;
  /** Called with the picked action's id. */
  onAction: (actionId: string) => void;
  /** Optional helper line rendered next to/under the pill row. */
  pillsHint?: string;
  /** Disabled state while a side-effect is in flight (e.g. PATCH on approve). */
  disabled?: boolean;
  /** Optional slot below the pills — refinement chip group, etc. */
  extraBody?: ReactNode;
  /** Accessibility label fallback for the wrapper section. */
  ariaLabel?: string;
  /**
   * When true, the pill row mounts via a staggered fadeUp cascade. Used by
   * the choreographed reveal moments (character sheet, combination preview,
   * final cut, eulogy). The artifact slot owns its own reveal motion in
   * the caller. Default: false (pills appear instantly with the gate).
   */
  staggerPills?: boolean;
  /**
   * Id treated as the "approve" / affirmation action — fires the
   * `confirm()` haptic pattern (vs the default `tap()` for everything else).
   * Default: "approve" — matches our id convention across all gates.
   */
  approveId?: string;
};

const baseActionStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "12px 22px",
  borderRadius: 999,
  fontFamily: FONT_SANS,
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  border: `1px solid ${C.line}`,
  letterSpacing: "0.01em",
};

function styleFor(variant: GateAction["variant"], disabled: boolean): CSSProperties {
  if (variant === "quiet") {
    return {
      background: "transparent",
      color: C.inkSofter,
      border: "none",
      fontFamily: FONT_SANS,
      fontSize: 13,
      fontWeight: 500,
      cursor: disabled ? "not-allowed" : "pointer",
      padding: "12px 16px",
      textDecoration: "underline",
      textUnderlineOffset: 3,
      opacity: disabled ? 0.5 : 1,
    };
  }
  if (variant === "danger") {
    return {
      ...baseActionStyle,
      background: "transparent",
      color: C.inkSoft,
      border: `1px solid ${C.line}`,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
    };
  }
  // primary (default)
  return {
    ...baseActionStyle,
    background: C.ink,
    color: C.cream,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

export default function GateReview({
  headline,
  subhead,
  children,
  actions,
  onAction,
  pillsHint,
  disabled = false,
  extraBody,
  ariaLabel,
  staggerPills = false,
  approveId = "approve",
}: Props) {
  const pillItemVariants = fadeUp(8);
  const pillRowVariants = staggerChildren(0.06, 0.04);
  function handleAction(action: GateAction) {
    if (disabled) return;
    if (action.id === approveId) {
      confirm();
    } else {
      tap();
    }
    onAction(action.id);
  }
  return (
    <section
      aria-label={ariaLabel ?? headline ?? "Review"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      {headline ? (
        <header
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            textAlign: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: FONT_DISPLAY,
              fontStyle: "italic",
              fontSize: 30,
              lineHeight: 1.3,
              color: C.ink,
              fontWeight: 400,
              letterSpacing: "-0.005em",
            }}
          >
            {headline}
          </h2>
          {subhead ? (
            <p
              style={{
                margin: 0,
                fontFamily: FONT_SANS,
                fontSize: 14,
                color: C.inkSofter,
                lineHeight: 1.55,
              }}
            >
              {subhead}
            </p>
          ) : null}
        </header>
      ) : null}

      {/* Artifact slot — caller decides how to render. We give it air. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {children}
      </div>

      {/* Pill row. Small, deliberately quiet, never crowds the artifact. */}
      <motion.div
        role="group"
        aria-label="Choose how to continue"
        variants={staggerPills ? pillRowVariants : undefined}
        initial={staggerPills ? "hidden" : false}
        animate={staggerPills ? "visible" : undefined}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "center",
          marginTop: 4,
        }}
      >
        {actions.map((action) => (
          <motion.button
            key={action.id}
            type="button"
            onClick={() => handleAction(action)}
            disabled={disabled}
            variants={staggerPills ? pillItemVariants : undefined}
            whileHover={!disabled ? { scale: 1.02 } : {}}
            whileTap={!disabled ? { scale: 0.98 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={styleFor(action.variant, disabled)}
          >
            {action.label}
          </motion.button>
        ))}
      </motion.div>

      {pillsHint ? (
        <p
          style={{
            margin: 0,
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: C.inkSofter,
            lineHeight: 1.55,
            textAlign: "center",
            maxWidth: 480,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {pillsHint}
        </p>
      ) : null}

      {/* Slot below pills (e.g. refinement chip group + textarea on "tweaks") */}
      {extraBody ? <div>{extraBody}</div> : null}
    </section>
  );
}
