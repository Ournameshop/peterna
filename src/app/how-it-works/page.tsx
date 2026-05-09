"use client";

import { Upload, Sparkles, Music, Film, Share2, Users, Clock, Heart } from "lucide-react";
import Pill from "@/components/Pill";
import { GoldBtn } from "@/components/Buttons";
import QuietLine from "@/components/QuietLine";
import {
  C,
  FONT_DISPLAY,
  FONT_SANS,
  sectionMaxStyle,
  NARROW_MAX,
} from "@/lib/peterna-tokens";

export default function PageHowItWorks() {
  const steps = [
    {
      n: "01",
      icon: Upload,
      title: "Upload what you have.",
      body: "Photos, short videos, voice memos. As few as five photos is enough; more is wonderful. Any quality is fine — our restoration does the heavy lifting. Family members can each contribute their own files through a private link.",
      detail: "Average upload takes 4–7 minutes. No app required.",
    },
    {
      n: "02",
      icon: Sparkles,
      title: "AI restores. AI animates. Human producer guides.",
      body: "Our AI gently restores faded prints, sharpens phone snapshots, and brings stills to life with subtle motion — a head turn, a tail wag, a soft blink. A human producer reviews every frame to make sure your pet looks like your pet, never a generated approximation.",
      detail: "AI-assisted, human-guided. No automated-looking output.",
    },
    {
      n: "03",
      icon: Music,
      title: "Music, pacing, and voice.",
      body: "Each tribute is scored from a curated, fully-licensed music library — no royalty traps, no algorithmic stock loops. You can add a written tribute or recorded voice memo from family. Length, pacing, and rhythm are tuned by hand.",
      detail: "Choose from 200+ licensed tracks. Voice optional.",
    },
    {
      n: "04",
      icon: Film,
      title: "Final review. Final delivery.",
      body: "Before your tribute ships, a producer watches it end-to-end. Color, audio mix, story arc, captions — checked. We're aiming for delivery within 24 hours of upload, with rush options for memorial services scheduled within 48 hours of loss.",
      detail: "Designed for same-day delivery. Rush options planned.",
    },
    {
      n: "05",
      icon: Share2,
      title: "A home for your tribute.",
      body: "Your finished film lives on a permanent memorial page — beautifully designed, hosted forever, shareable by link or QR code. Print the QR for the memorial card. Send the link to family. Embed it on social media. The page is yours, kept.",
      detail: "Forever-hosted. Yours to share. Yours to keep.",
    },
    {
      n: "06",
      icon: Users,
      title: "Add to your Family Channel.",
      body: "Optional. With a Family Channel subscription, every pet you've ever loved lives in one private space. Anniversary reminders. New tributes for new losses. A living archive across generations of your family.",
      detail: "$9.95/mo · cancel anytime · pages stay forever.",
    },
  ];
  const cards = [
    {
      icon: Clock,
      t: "Designed for 24-hour delivery",
      d: "Rush options planned for memorial services within 48 hours of loss.",
    },
    {
      icon: Heart,
      t: "Reviewed by humans",
      d: "No tribute ships without a human producer watching it end-to-end first.",
    },
    {
      icon: Sparkles,
      t: "Yours forever",
      d: "Memorial pages stay live even if you cancel. Your tribute is yours.",
    },
  ];
  return (
    <main>
      <section style={{ padding: "112px 0", background: C.cream }}>
        <div style={sectionMaxStyle}>
          <Pill>How it works</Pill>
          <h1
            style={{
              marginTop: 24,
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: "clamp(44px, 7vw, 96px)",
              lineHeight: 1.0,
              letterSpacing: "-0.015em",
              color: C.ink,
              maxWidth: 1100,
            }}
          >
            From your first photo to a finished tribute, designed for{" "}
            <em style={{ color: C.goldDeep }}>24 hours.</em>
          </h1>
          <p
            style={{
              marginTop: 32,
              maxWidth: 640,
              fontSize: 18,
              lineHeight: 1.65,
              color: C.inkSoft,
              fontFamily: FONT_SANS,
            }}
          >
            Most pet memorial services are slideshow tools or stock-template generators.
            Peterna is something different — a real production process, powered by AI,
            finished by hand. Here&rsquo;s exactly what happens between your upload and your
            tribute.
          </p>
          <div style={{ marginTop: 48 }}>
            <QuietLine animated label="Six steps · One day · One care promise" />
          </div>
        </div>
      </section>

      <section style={{ padding: "80px 0 128px", background: C.cream }}>
        <div style={sectionMaxStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: C.line }}>
            {steps.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 24,
                  padding: "56px 8px",
                  background: C.cream,
                }}
                className="peterna-three-row"
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: C.blush,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <s.icon size={20} color={C.goldDeep} aria-hidden="true" />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: C.goldDeep,
                        fontFamily: FONT_DISPLAY,
                        fontStyle: "italic",
                      }}
                    >
                      Step {s.n}
                    </div>
                  </div>
                </div>
                <div>
                  <h2
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 400,
                      fontSize: "clamp(28px, 3.4vw, 44px)",
                      lineHeight: 1.15,
                      color: C.ink,
                      margin: 0,
                    }}
                  >
                    {s.title}
                  </h2>
                  <p
                    style={{
                      marginTop: 20,
                      fontSize: 17,
                      lineHeight: 1.65,
                      color: C.inkSoft,
                      fontFamily: FONT_SANS,
                      maxWidth: 640,
                    }}
                  >
                    {s.body}
                  </p>
                  <p
                    style={{
                      marginTop: 16,
                      fontSize: 14,
                      fontStyle: "italic",
                      color: C.goldDeep,
                      fontFamily: FONT_DISPLAY,
                    }}
                  >
                    {s.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <style>{`@media (min-width: 1024px) { .peterna-three-row { grid-template-columns: 3fr 9fr !important; gap: 40px !important; } }`}</style>
      </section>

      <section style={{ padding: "128px 0", background: C.blush }}>
        <div
          style={{
            ...sectionMaxStyle,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 32,
          }}
        >
          {cards.map((c, i) => (
            <div
              key={i}
              style={{
                background: C.cream,
                borderRadius: 16,
                border: `1px solid ${C.line}`,
                padding: 32,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: C.blush,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 24,
                }}
              >
                <c.icon size={20} color={C.goldDeep} aria-hidden="true" />
              </div>
              <h3
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 400,
                  fontSize: 24,
                  lineHeight: 1.2,
                  color: C.ink,
                  margin: 0,
                }}
              >
                {c.t}
              </h3>
              <p
                style={{
                  marginTop: 12,
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: C.inkSoft,
                  fontFamily: FONT_SANS,
                }}
              >
                {c.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "128px 0", background: C.cream, textAlign: "center" }}>
        <div style={NARROW_MAX}>
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
            Ready when you are.
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
            Join the waitlist now or learn more about pricing and the Family Channel.
          </p>
          <div
            style={{
              marginTop: 40,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
            }}
          >
            <GoldBtn href="/get-started">Join the waitlist</GoldBtn>
          </div>
        </div>
      </section>
    </main>
  );
}
