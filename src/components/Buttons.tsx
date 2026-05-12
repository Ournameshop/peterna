"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { C, FONT_SANS } from "@/lib/peterna-tokens";

const btnBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "14px 28px",
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: "0.01em",
  border: "none",
  cursor: "pointer",
  fontFamily: FONT_SANS,
  textDecoration: "none",
};

type CommonProps = {
  children: ReactNode;
  onClick?: () => void;
  full?: boolean;
  href?: string;
  type?: "button" | "submit" | "reset";
  ariaLabel?: string;
};

function isInternalRoute(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

function ButtonInner({
  style,
  children,
  onClick,
  href,
  type,
  ariaLabel,
}: {
  style: CSSProperties;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit" | "reset";
  ariaLabel?: string;
}) {
  const inner = (
    <>
      {children}
      <ArrowRight size={16} />
    </>
  );

  if (href) {
    if (isInternalRoute(href)) {
      // Use next/link for internal navigation, with motion via wrapper.
      return (
        <Link href={href} aria-label={ariaLabel} style={{ textDecoration: "none" }}>
          <motion.span
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={style}
          >
            {inner}
          </motion.span>
        </Link>
      );
    }
    return (
      <motion.a
        href={href}
        aria-label={ariaLabel}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        style={style}
      >
        {inner}
      </motion.a>
    );
  }
  return (
    <motion.button
      type={type || "button"}
      aria-label={ariaLabel}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
      style={style}
    >
      {inner}
    </motion.button>
  );
}

export function PrimaryBtn(props: CommonProps) {
  const style: CSSProperties = {
    ...btnBase,
    background: C.ink,
    color: C.cream,
    justifyContent: props.full ? "center" : "flex-start",
    width: props.full ? "100%" : "auto",
  };
  return <ButtonInner {...props} style={style} />;
}

export function GoldBtn(props: CommonProps) {
  const style: CSSProperties = {
    ...btnBase,
    background: C.gold,
    color: C.ink,
    justifyContent: props.full ? "center" : "flex-start",
    width: props.full ? "100%" : "auto",
  };
  return <ButtonInner {...props} style={style} />;
}

export function GhostBtn(
  props: CommonProps & { light?: boolean },
) {
  const style: CSSProperties = {
    ...btnBase,
    background: "transparent",
    color: props.light ? C.cream : C.ink,
    border: `1px solid ${props.light ? C.cream : C.ink}`,
    justifyContent: props.full ? "center" : "flex-start",
    width: props.full ? "100%" : "auto",
  };
  return <ButtonInner {...props} style={style} />;
}
