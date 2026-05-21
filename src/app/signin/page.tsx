"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail } from "lucide-react";
import Pill from "@/components/Pill";
import { GoldBtn } from "@/components/Buttons";
import QuietLine from "@/components/QuietLine";
import { AUTH } from "@/lib/library/copy";
import type {
  MagicLinkRequestRequest,
  MagicLinkRequestResponse,
} from "@/lib/builder/wire-types";
import {
  C,
  FONT_DISPLAY,
  FONT_SANS,
  sectionMaxStyle,
} from "@/lib/peterna-tokens";

// Phase 10 — passwordless sign-in entry.
//
// Hits POST /api/auth/magic-link/request with { email }. The endpoint always
// returns ok=true regardless of whether the email is registered (no
// enumeration), so the UI here treats any non-network response as success.
// Tone matches Stage 1.0 — calm, opt-in, no urgency.

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent"; email: string }
  | { kind: "network_error" };

export default function PageSignin() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });

  const fieldStyle = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid rgba(42,33,27,0.2)`,
    padding: "10px 0",
    fontSize: 18,
    color: C.ink,
    fontFamily: FONT_SANS,
    outline: "none",
  } as const;

  const labelStyle = {
    fontSize: 11,
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    marginBottom: 8,
    color: C.inkSofter,
    fontFamily: FONT_SANS,
    display: "block" as const,
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setState({ kind: "submitting" });

    const body: MagicLinkRequestRequest = { email: trimmed };
    try {
      const res = await fetch("/api/auth/magic-link/request", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      // Per spec: success is opaque (no enumeration). Treat any HTTP response
      // — ok or not — as "we attempted to send." Only a thrown network error
      // is surfaced to the user (so they can retry).
      await res.json().catch(() => null as MagicLinkRequestResponse | null);
      setState({ kind: "sent", email: trimmed });
    } catch {
      setState({ kind: "network_error" });
    }
  };

  if (state.kind === "sent") {
    return <SuccessPanel email={state.email} onReset={() => {
      setEmail("");
      setState({ kind: "idle" });
    }} />;
  }

  return (
    <main>
      <section
        style={{
          padding: "112px 0 160px",
          background: C.cream,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 70% 60% at 80% -10%, rgba(201,169,97,0.15), transparent 60%)",
          }}
          aria-hidden="true"
        />

        <div style={{ ...sectionMaxStyle, position: "relative" }}>
          <div style={{ maxWidth: 640 }}>
            <Pill tone="gold">{AUTH.signin.pill}</Pill>
            <h1
              style={{
                marginTop: 24,
                fontFamily: FONT_DISPLAY,
                fontWeight: 400,
                fontSize: "clamp(36px, 5.5vw, 72px)",
                lineHeight: 1.0,
                letterSpacing: "-0.015em",
                color: C.ink,
              }}
            >
              {AUTH.signin.headline_lead}{" "}
              <em style={{ color: C.goldDeep }}>{AUTH.signin.headline_em}</em>
            </h1>
            <p
              style={{
                marginTop: 32,
                maxWidth: 540,
                fontSize: 18,
                lineHeight: 1.65,
                color: C.inkSoft,
                fontFamily: FONT_SANS,
              }}
            >
              {AUTH.signin.body}
            </p>

            <form
              onSubmit={handleSubmit}
              style={{
                marginTop: 48,
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 28,
                maxWidth: 520,
              }}
              noValidate
            >
              <label>
                <span style={labelStyle}>{AUTH.signin.email_label}</span>
                <input
                  style={fieldStyle}
                  type="email"
                  name="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={AUTH.signin.email_placeholder}
                  disabled={state.kind === "submitting"}
                  aria-describedby="signin-privacy"
                />
              </label>

              <div style={{ marginTop: 8 }}>
                <GoldBtn type="submit">
                  {state.kind === "submitting"
                    ? "Sending…"
                    : AUTH.signin.submit}
                </GoldBtn>
              </div>

              {state.kind === "network_error" && (
                <p
                  role="alert"
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: C.inkSoft,
                    fontFamily: FONT_SANS,
                    lineHeight: 1.5,
                  }}
                >
                  We couldn&rsquo;t reach the server just now. Check your
                  connection and try again.
                </p>
              )}

              <p
                id="signin-privacy"
                style={{
                  fontSize: 13,
                  color: C.inkSofter,
                  fontFamily: FONT_SANS,
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {AUTH.signin.privacy}
              </p>
            </form>

            {/* Anonymous escape hatch — the unauthenticated user is never
                blocked from building. Sign-in is opt-in, always. */}
            <div
              style={{
                marginTop: 48,
                paddingTop: 32,
                borderTop: `1px solid ${C.line}`,
                maxWidth: 520,
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  color: C.inkSoft,
                  fontFamily: FONT_SANS,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {AUTH.signin.anonymous_hint}
              </p>
              <Link
                href="/builder"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 16,
                  fontSize: 14,
                  fontWeight: 500,
                  color: C.ink,
                  paddingBottom: 4,
                  borderBottom: `1px solid ${C.ink}`,
                  fontFamily: FONT_SANS,
                  textDecoration: "none",
                }}
              >
                {AUTH.signin.anonymous_cta} →
              </Link>
            </div>

            <div style={{ marginTop: 80 }}>
              <QuietLine label="Sign-in is optional · Always opt-in" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SuccessPanel({ email, onReset }: { email: string; onReset: () => void }) {
  return (
    <main>
      <motion.section
        style={{
          padding: "160px 0",
          background: C.cream,
          position: "relative",
          overflow: "hidden",
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 60% 70% at 50% 30%, rgba(201,169,97,0.18), transparent 65%)",
          }}
          aria-hidden="true"
        />

        <div
          style={{
            maxWidth: 600,
            margin: "0 auto",
            padding: "0 40px",
            textAlign: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              margin: "0 auto 32px",
              borderRadius: "50%",
              background: C.blush,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Mail size={32} color={C.goldDeep} aria-hidden="true" />
          </div>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: "clamp(36px, 5vw, 64px)",
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: C.ink,
              margin: 0,
            }}
          >
            {AUTH.signin_success.headline}
          </h1>
          <p
            aria-live="polite"
            style={{
              marginTop: 24,
              fontSize: 18,
              lineHeight: 1.65,
              color: C.inkSoft,
              fontFamily: FONT_SANS,
            }}
          >
            {AUTH.signin_success.body}
          </p>
          <p
            style={{
              marginTop: 16,
              fontSize: 14,
              color: C.inkSofter,
              fontFamily: FONT_SANS,
              fontStyle: "italic",
            }}
          >
            Sent to <span style={{ color: C.ink, fontStyle: "normal" }}>{email}</span>
          </p>
          <p
            style={{
              marginTop: 32,
              fontSize: 14,
              color: C.inkSofter,
              fontFamily: FONT_SANS,
              lineHeight: 1.6,
            }}
          >
            {AUTH.signin_success.footer}
          </p>
          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              onClick={onReset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 500,
                color: C.ink,
                paddingBottom: 4,
                background: "none",
                border: "none",
                borderBottom: `1px solid ${C.ink}`,
                cursor: "pointer",
                fontFamily: FONT_SANS,
              }}
            >
              {AUTH.signin_success.try_again}
            </button>
          </div>
        </div>
      </motion.section>
    </main>
  );
}
