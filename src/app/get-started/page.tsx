"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Heart, Zap } from "lucide-react";
import Pill from "@/components/Pill";
import { GoldBtn } from "@/components/Buttons";
import QuietLine from "@/components/QuietLine";
import {
  C,
  FONT_DISPLAY,
  FONT_SANS,
  sectionMaxStyle,
} from "@/lib/peterna-tokens";

// Two-track form added 2026-05-13 when Peterna Instant ($99 self-serve)
// was introduced alongside the concierge waitlist. Reads ?interest=instant
// from the URL so /pricing#instant → "Notify me at launch" can pre-select
// the right track. useSearchParams() requires a Suspense boundary in the
// App Router; <PageGetStarted> wraps <GetStartedInner> in one.

type Interest = "waitlist" | "instant";

function GetStartedInner() {
  const searchParams = useSearchParams();
  const initialInterest: Interest =
    searchParams.get("interest") === "instant" ? "instant" : "waitlist";

  const [interest, setInterest] = useState<Interest>(initialInterest);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email.trim()) setSubmitted(true);
  };

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

  // Track-specific copy so the page reads correctly whichever track the
  // visitor lands on. Pill, h1, body, button label and success state all
  // swap together so there's never a mixed message.
  const copy = {
    waitlist: {
      pill: "Join the Peterna waitlist",
      h1Lead: "We\u2019ll let you know",
      h1Em: "when we open.",
      body: "Peterna isn\u2019t open yet. Leave your email and we\u2019ll write to you the week we launch \u2014 once, quietly, with no marketing in between. Waitlist members will get early access and a small thank-you for helping us build this carefully.",
      button: "Join the waitlist",
      successTitle: "You\u2019re on the list.",
      successBody:
        "Thank you. We\u2019ll write to you the week Peterna opens \u2014 once, quietly. Until then, you won\u2019t hear from us.",
      successIcon: Heart,
    },
    instant: {
      pill: "Peterna Instant \u00b7 $99",
      h1Lead: "We\u2019ll notify you",
      h1Em: "the minute Instant goes live.",
      body: "Peterna Instant isn\u2019t open yet. It\u2019s our self-serve tier \u2014 a cinematic tribute, finalized by AI in minutes, no waiting. Leave your email and we\u2019ll write to you the day it ships. No newsletter in between.",
      button: "Notify me at launch",
      successTitle: "We\u2019ll let you know.",
      successBody:
        "Thank you. We\u2019ll write to you the day Peterna Instant opens \u2014 once, quietly. Until then, you won\u2019t hear from us.",
      successIcon: Zap,
    },
  } as const;

  const c = copy[interest];
  const SuccessIcon = c.successIcon;

  return (
    <main>
      {!submitted ? (
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
            <div style={{ maxWidth: 760 }}>
              <Pill tone="gold">{c.pill}</Pill>
              <h1
                style={{
                  marginTop: 24,
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 400,
                  fontSize: "clamp(40px, 6vw, 84px)",
                  lineHeight: 1.0,
                  letterSpacing: "-0.015em",
                  color: C.ink,
                }}
              >
                {c.h1Lead}{" "}
                <em style={{ color: C.goldDeep }}>{c.h1Em}</em>
              </h1>
              <p
                style={{
                  marginTop: 32,
                  maxWidth: 600,
                  fontSize: 18,
                  lineHeight: 1.65,
                  color: C.inkSoft,
                  fontFamily: FONT_SANS,
                }}
              >
                {c.body}
              </p>

              {/* Track selector \u2014 lets visitors switch between the two waitlists
                  without leaving the page. Pre-selected from ?interest=. */}
              <fieldset
                style={{
                  border: "none",
                  padding: 0,
                  margin: "40px 0 0",
                }}
              >
                <legend style={labelStyle}>I&rsquo;m interested in *</legend>
                <div
                  className="peterna-interest-row"
                  style={{ marginTop: 8 }}
                >
                  {([
                    {
                      id: "waitlist" as const,
                      label: "The full Peterna waitlist",
                      sub: "Premium concierge tiers \u00b7 producer-finished",
                    },
                    {
                      id: "instant" as const,
                      label: "Peterna Instant",
                      sub: "$99 \u00b7 AI-finalized in minutes",
                    },
                  ]).map((opt) => {
                    const active = interest === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setInterest(opt.id)}
                        aria-pressed={active}
                        style={{
                          textAlign: "left",
                          padding: "16px 20px",
                          borderRadius: 12,
                          border: active
                            ? `1px solid ${C.goldDeep}`
                            : `1px solid rgba(42,33,27,0.15)`,
                          background: active
                            ? "rgba(201,169,97,0.10)"
                            : "transparent",
                          cursor: "pointer",
                          fontFamily: FONT_SANS,
                          transition:
                            "background 0.2s ease, border-color 0.2s ease",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 500,
                            color: active ? C.ink : C.inkSoft,
                          }}
                        >
                          {opt.label}
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 13,
                            color: C.inkSofter,
                          }}
                        >
                          {opt.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <form
                onSubmit={handleSubmit}
                style={{
                  marginTop: 40,
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 32,
                  maxWidth: 560,
                }}
              >
                {/* Hidden field captures the chosen track for whatever backend
                    we wire up later. */}
                <input type="hidden" name="interest" value={interest} />
                <label>
                  <div style={labelStyle}>Email *</div>
                  <input
                    style={fieldStyle}
                    type="email"
                    name="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                <label>
                  <div style={labelStyle}>
                    Anything you want us to know? (optional)
                  </div>
                  <textarea
                    style={{ ...fieldStyle, resize: "none" }}
                    rows={3}
                    name="note"
                    placeholder="A pet you're remembering, a clinic you work with, or just hello…"
                  />
                </label>
                <div style={{ marginTop: 8 }}>
                  <GoldBtn type="submit">{c.button}</GoldBtn>
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: C.inkSofter,
                    fontFamily: FONT_SANS,
                    margin: 0,
                    lineHeight: 1.6,
                  }}
                >
                  We use your email only to tell you when Peterna opens. No newsletter, no
                  marketing list, no sharing. You can ask us to delete it any time.
                </p>
              </form>

              <div style={{ marginTop: 80 }}>
                <QuietLine label="Built carefully · Launching 2026" />
              </div>
            </div>
          </div>

          <style>{`
            .peterna-interest-row {
              display: grid;
              grid-template-columns: 1fr;
              gap: 12px;
              max-width: 560px;
            }
            @media (min-width: 640px) {
              .peterna-interest-row { grid-template-columns: 1fr 1fr; }
            }
          `}</style>
        </section>
      ) : (
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
              maxWidth: 640,
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
              <SuccessIcon size={32} color={C.goldDeep} />
            </div>
            <h2
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 400,
                fontSize: "clamp(36px, 5vw, 64px)",
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
                color: C.ink,
              }}
            >
              {c.successTitle}
            </h2>
            <p
              style={{
                marginTop: 24,
                fontSize: 18,
                lineHeight: 1.65,
                color: C.inkSoft,
                fontFamily: FONT_SANS,
              }}
            >
              {c.successBody}
            </p>
            <p
              style={{
                marginTop: 40,
                fontSize: 14,
                fontStyle: "italic",
                color: C.inkSofter,
                fontFamily: FONT_DISPLAY,
              }}
            >
              From everyone at Peterna — thank you for being early.
            </p>
          </div>
        </motion.section>
      )}
    </main>
  );
}

export default function PageGetStarted() {
  return (
    <Suspense fallback={null}>
      <GetStartedInner />
    </Suspense>
  );
}
