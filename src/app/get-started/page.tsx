"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import Pill from "@/components/Pill";
import { GoldBtn } from "@/components/Buttons";
import QuietLine from "@/components/QuietLine";
import {
  C,
  FONT_DISPLAY,
  FONT_SANS,
  sectionMaxStyle,
} from "@/lib/peterna-tokens";

export default function PageGetStarted() {
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
              <Pill tone="gold">Join the Peterna waitlist</Pill>
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
                We&rsquo;ll let you know{" "}
                <em style={{ color: C.goldDeep }}>when we open.</em>
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
                Peterna isn&rsquo;t open yet. Leave your email and we&rsquo;ll write to you
                the week we launch — once, quietly, with no marketing in between. Waitlist
                members will get early access and a small thank-you for helping us build this
                carefully.
              </p>

              <form
                onSubmit={handleSubmit}
                style={{
                  marginTop: 56,
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 32,
                  maxWidth: 560,
                }}
              >
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
                  <div style={labelStyle}>Anything you want us to know? (optional)</div>
                  <textarea
                    style={{ ...fieldStyle, resize: "none" }}
                    rows={3}
                    name="note"
                    placeholder="A pet you're remembering, a clinic you work with, or just hello…"
                  />
                </label>
                <div style={{ marginTop: 8 }}>
                  <GoldBtn type="submit">Join the waitlist</GoldBtn>
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
              <Heart size={32} color={C.goldDeep} />
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
              You&rsquo;re on the list.
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
              Thank you. We&rsquo;ll write to you the week Peterna opens — once, quietly.
              Until then, you won&rsquo;t hear from us.
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
