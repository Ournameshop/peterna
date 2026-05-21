"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import { GoldBtn } from "@/components/Buttons";
import { AUTH } from "@/lib/library/copy";
import type { MagicLinkConsumeResponse } from "@/lib/builder/wire-types";
import {
  C,
  FONT_DISPLAY,
  FONT_SANS,
  sectionMaxStyle,
} from "@/lib/peterna-tokens";

// Phase 10 — magic-link landing.
//
// Reads ?token=... from the URL, GETs /api/auth/magic-link/consume?token=...
// via fetch (so we can read the JSON envelope), and on success follows the
// `redirect_to` the server returns. On failure: a calm "this link no longer
// works" with a button to request a new one.
//
// useSearchParams() requires a Suspense boundary in the App Router.

type CallbackState = "pending" | "failure";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  // Initial state is derived from the token's presence — no token, fail
  // immediately. Avoids a setState-in-effect lint violation for that branch.
  const [state, setState] = useState<CallbackState>(token ? "pending" : "failure");

  useEffect(() => {
    if (!token) return;

    const ac = new AbortController();
    (async () => {
      try {
        // GET with the token in the query string; the server sets the
        // auth_user cookie via Set-Cookie on the response.
        const res = await fetch(
          `/api/auth/magic-link/consume?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal: ac.signal,
          },
        );
        const json = (await res
          .json()
          .catch(() => null)) as MagicLinkConsumeResponse | null;

        if (json && json.ok === true) {
          // Trust the server's redirect target (it'll point to /dashboard
          // for returning users, /builder for first-timers). Fall back to
          // /dashboard if for some reason the field is empty.
          const target =
            typeof json.redirect_to === "string" && json.redirect_to.startsWith("/")
              ? json.redirect_to
              : "/dashboard";
          router.replace(target);
          return;
        }

        setState("failure");
      } catch {
        if (!ac.signal.aborted) setState("failure");
      }
    })();

    return () => ac.abort();
  }, [router, token]);

  if (state === "pending") {
    return <PendingPanel />;
  }
  // Missing token and consume failure render the same panel — both mean
  // "this link didn't work, request a new one."
  return <FailurePanel />;
}

function PendingPanel() {
  return (
    <main>
      <section
        style={{
          padding: "160px 0",
          background: C.cream,
          position: "relative",
          overflow: "hidden",
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 60% 70% at 50% 30%, rgba(201,169,97,0.15), transparent 65%)",
          }}
          aria-hidden="true"
        />
        <div
          style={{
            ...sectionMaxStyle,
            position: "relative",
            textAlign: "center",
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: C.blush,
              marginBottom: 32,
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-hidden="true"
            >
              <Loader2 size={28} color={C.goldDeep} />
            </motion.div>
          </motion.div>
          <h1
            aria-live="polite"
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: "clamp(32px, 4.5vw, 56px)",
              lineHeight: 1.1,
              color: C.ink,
              margin: 0,
            }}
          >
            {AUTH.callback.pending_headline}
          </h1>
          <p
            style={{
              marginTop: 20,
              fontSize: 16,
              color: C.inkSoft,
              fontFamily: FONT_SANS,
            }}
          >
            {AUTH.callback.pending_body}
          </p>
        </div>
      </section>
    </main>
  );
}

function FailurePanel() {
  return (
    <main>
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          padding: "160px 0",
          background: C.cream,
          position: "relative",
          overflow: "hidden",
          minHeight: "60vh",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 60% 70% at 50% 30%, rgba(201,169,97,0.12), transparent 65%)",
          }}
          aria-hidden="true"
        />
        <div
          style={{
            maxWidth: 620,
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
            <AlertCircle size={32} color={C.goldDeep} aria-hidden="true" />
          </div>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: "clamp(32px, 5vw, 56px)",
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              color: C.ink,
              margin: 0,
            }}
          >
            {AUTH.callback.failure_headline}
          </h1>
          <p
            style={{
              marginTop: 24,
              fontSize: 17,
              lineHeight: 1.65,
              color: C.inkSoft,
              fontFamily: FONT_SANS,
            }}
          >
            {AUTH.callback.failure_body}
          </p>
          <div
            style={{
              marginTop: 40,
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <GoldBtn href="/signin">{AUTH.callback.failure_cta}</GoldBtn>
            <Link
              href="/builder"
              style={{
                fontSize: 14,
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
        </div>
      </motion.section>
    </main>
  );
}

export default function PageAuthCallback() {
  return (
    <Suspense fallback={<PendingPanel />}>
      <CallbackInner />
    </Suspense>
  );
}
