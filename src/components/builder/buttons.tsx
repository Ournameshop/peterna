"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { C, FONT_SANS } from "@/lib/peterna-tokens";
import { DURATION, EASE } from "@/lib/builder/motion-tokens";
import { tap, confirm } from "@/lib/builder/haptic";

// Three semantic builder buttons. Lives separately from the marketing-page
// `src/components/Buttons.tsx` primitives — the builder uses different
// sizing and a different ergonomic model (no auto-arrow icon, haptics on
// activation, gold-keyed affirmation for the *one* primary action per gate).
//
// Per audit CC-2: every wizard CTA was visually undifferentiated ink-on-cream
// pills. That meant approve / submit / continue / copy all read the same.
// These three give the user a clear visual hierarchy across the 20-stage
// flow:
//
//   AffirmBtn   — the gold-keyed primary affirmation. Used for the *one*
//                 "Looks great" / "Approve" / "It's beautiful" action per
//                 gate. Fires the confirm() haptic.
//   ProgressBtn — ink-on-cream secondary continuation. Used for "Continue"
//                 form submits and non-affirmative "Next" actions. Fires
//                 the tap() haptic.
//   QuietBtn    — underlined link-style tertiary. Used for skip / start-over
//                 / cancel. No haptic — these are not affirmations.
//
// All three accept `href` for navigation (renders <Link> for internal,
// <a> for external) or `onClick` for in-place actions. The motion system
// is the same scale-on-hover/tap that the rest of the wizard uses.

type CommonProps = {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  /** Optional — render at full container width (used for narrow column flows). */
  full?: boolean;
};

const baseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "12px 24px",
  borderRadius: 999,
  fontFamily: FONT_SANS,
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: "0.01em",
  border: "none",
  cursor: "pointer",
  textDecoration: "none",
};

function isInternalRoute(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

type RenderOpts = {
  style: CSSProperties;
  disabledStyle: CSSProperties;
  onActivate: () => void;
};

function ButtonInner(props: CommonProps & RenderOpts) {
  const {
    children,
    href,
    type,
    disabled = false,
    loading = false,
    ariaLabel,
    style,
    disabledStyle,
    onActivate,
  } = props;
  const isInactive = disabled || loading;
  const composed: CSSProperties = isInactive
    ? { ...style, ...disabledStyle }
    : style;

  // Hover/tap motion only fires when the button is interactive.
  const motionProps = isInactive
    ? {}
    : {
        whileHover: { scale: 1.02 },
        whileTap: { scale: 0.98 },
        transition: {
          type: "spring" as const,
          stiffness: 400,
          damping: 25,
          duration: DURATION.quick,
          ease: EASE.crisp,
        },
      };

  if (href && !isInactive) {
    const linkInner = (
      <motion.span
        {...motionProps}
        style={composed}
        aria-disabled={isInactive ? true : undefined}
      >
        {children}
      </motion.span>
    );
    if (isInternalRoute(href)) {
      return (
        <Link
          href={href}
          aria-label={ariaLabel}
          style={{ textDecoration: "none" }}
          onClick={onActivate}
        >
          {linkInner}
        </Link>
      );
    }
    return (
      <motion.a
        href={href}
        aria-label={ariaLabel}
        {...motionProps}
        onClick={onActivate}
        style={composed}
      >
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button
      type={type ?? "button"}
      aria-label={ariaLabel}
      aria-disabled={isInactive ? true : undefined}
      disabled={isInactive}
      {...motionProps}
      onClick={isInactive ? undefined : onActivate}
      style={composed}
    >
      {children}
    </motion.button>
  );
}

// -----------------------------------------------------------------------------
// AffirmBtn — gold-keyed primary affirmation. One per gate, maximum.
// -----------------------------------------------------------------------------

export function AffirmBtn(props: CommonProps) {
  const style: CSSProperties = {
    ...baseStyle,
    background: C.gold,
    color: C.ink,
    width: props.full ? "100%" : "auto",
  };
  const disabledStyle: CSSProperties = {
    opacity: 0.55,
    cursor: "not-allowed",
  };
  return (
    <ButtonInner
      {...props}
      style={style}
      disabledStyle={disabledStyle}
      onActivate={() => {
        confirm();
        props.onClick?.();
      }}
    />
  );
}

// -----------------------------------------------------------------------------
// ProgressBtn — ink-on-cream secondary continuation. Used for form submits.
// -----------------------------------------------------------------------------

export function ProgressBtn(props: CommonProps) {
  const style: CSSProperties = {
    ...baseStyle,
    background: C.ink,
    color: C.cream,
    width: props.full ? "100%" : "auto",
  };
  const disabledStyle: CSSProperties = {
    background: C.line,
    color: C.inkSofter,
    cursor: "not-allowed",
    opacity: 0.85,
  };
  return (
    <ButtonInner
      {...props}
      style={style}
      disabledStyle={disabledStyle}
      onActivate={() => {
        tap();
        props.onClick?.();
      }}
    />
  );
}

// -----------------------------------------------------------------------------
// QuietBtn — underlined link-style tertiary. Skip / start over / cancel.
// -----------------------------------------------------------------------------

export function QuietBtn(props: CommonProps) {
  const style: CSSProperties = {
    ...baseStyle,
    background: "transparent",
    color: C.inkSofter,
    padding: "12px 16px",
    fontSize: 13,
    textDecoration: "underline",
    textUnderlineOffset: 3,
    width: props.full ? "100%" : "auto",
  };
  const disabledStyle: CSSProperties = {
    opacity: 0.5,
    cursor: "not-allowed",
  };
  return (
    <ButtonInner
      {...props}
      style={style}
      disabledStyle={disabledStyle}
      onActivate={() => {
        props.onClick?.();
      }}
    />
  );
}
