"use client";

import { Check } from "lucide-react";
import Pill from "@/components/Pill";
import { GoldBtn, GhostBtn } from "@/components/Buttons";
import QuietLine from "@/components/QuietLine";
import {
  C,
  FONT_DISPLAY,
  FONT_SANS,
  sectionMaxStyle,
  NARROW_MAX,
} from "@/lib/peterna-tokens";

export default function PagePricing() {
  const tiers = [
    {
      name: "Essential",
      price: "$149",
      tagline: "A beautiful starting point.",
      features: [
        "Cinematic tribute video, up to 90 seconds",
        "AI photo restoration, up to 20 images",
        "Permanent memorial page, hosted forever",
        "Curated music from licensed library",
        "Shareable link + QR code",
        "Designed for 24-hour delivery",
      ],
      cta: "Join the waitlist",
      accent: false,
      badge: undefined as string | undefined,
    },
    {
      name: "Premium",
      price: "$295",
      tagline: "The middle tier.",
      features: [
        "Cinematic tribute video, up to 3 minutes",
        "AI photo restoration + animation, up to 50 images",
        "Premium memorial page with extended layout",
        "Family voice memo or written tribute included",
        "Multi-track curated soundtrack",
        "Family upload — up to 5 contributors",
        "Designed for 24-hour delivery",
      ],
      cta: "Join the waitlist",
      accent: true,
      badge: "Planned launch tier",
    },
    {
      name: "Elite",
      price: "$595",
      tagline: "The complete legacy.",
      features: [
        "Cinematic tribute video, up to 5 minutes",
        "AI photo restoration + animation, unlimited images",
        "Custom memorial page design",
        "Voice memos from up to 10 family members",
        "Custom-licensed signature music option",
        "First year of Family Channel included",
        "Priority delivery (planned within 12 hours)",
        "Dedicated producer",
      ],
      cta: "Join the waitlist",
      accent: false,
      badge: undefined as string | undefined,
    },
  ];
  const channelTiers = [
    {
      name: "Monthly",
      price: "$9.95",
      per: "per month",
      note: "Cancel anytime. Memorial pages stay forever.",
      featured: false,
    },
    {
      name: "Annual",
      price: "$89",
      per: "per year",
      note: "Save $30. Best value.",
      featured: true,
    },
    {
      name: "Lifetime",
      price: "$249",
      per: "one time",
      note: "One payment. Yours forever.",
      featured: false,
    },
  ];
  const honest = [
    {
      b: "No hidden upgrade fees.",
      t: "The price you see is the price you pay. Restoration, music, hosting, and delivery are included.",
    },
    {
      b: "No file-type surcharges.",
      t: "Phone photos, scanned prints, faded snapshots, short videos, voice memos — all included regardless of format.",
    },
    {
      b: "No subscription pressure.",
      t: "The Family Channel is optional. Tributes ordered without it still get a permanent memorial page, hosted forever.",
    },
    {
      b: "No data resale.",
      t: "Your photos and tributes are not shared, sold, or used to train AI models. They belong to you.",
    },
  ];

  return (
    <main>
      <section style={{ padding: "112px 0", background: C.cream }}>
        <div style={sectionMaxStyle}>
          <Pill>Planned pricing · Subject to change</Pill>
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
            Three tiers. <em style={{ color: C.goldDeep }}>One care promise.</em>
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
            Below is what we&rsquo;re planning to offer at launch. Final pricing and tier
            features may change between now and the public release. Every tribute will be
            reviewed by a human producer before delivery; memorial pages will be hosted
            permanently. There are no recurring charges unless you add the Family Channel.
          </p>
          <div style={{ marginTop: 48 }}>
            <QuietLine animated label="One-time tributes · Optional family channel" />
          </div>
        </div>
      </section>

      <section style={{ padding: "80px 0", background: C.cream }}>
        <div style={sectionMaxStyle}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 24,
            }}
          >
            {tiers.map((t, i) => (
              <div
                key={i}
                style={{
                  position: "relative",
                  padding: 40,
                  borderRadius: 16,
                  border: `2px solid ${t.accent ? C.gold : C.line}`,
                  background: C.cream,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {t.badge && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <span
                      style={{
                        padding: "4px 16px",
                        borderRadius: 999,
                        background: C.gold,
                        color: C.ink,
                        fontSize: 10,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        fontWeight: 500,
                        fontFamily: FONT_SANS,
                      }}
                    >
                      {t.badge}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: C.inkSofter,
                    fontFamily: FONT_SANS,
                  }}
                >
                  {t.name}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontFamily: FONT_DISPLAY,
                    fontSize: "clamp(48px, 5vw, 64px)",
                    lineHeight: 1,
                    fontWeight: 400,
                    color: C.ink,
                  }}
                >
                  {t.price}
                </div>
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 16,
                    fontStyle: "italic",
                    color: C.goldDeep,
                    fontFamily: FONT_DISPLAY,
                  }}
                >
                  {t.tagline}
                </p>
                <ul
                  style={{
                    marginTop: 32,
                    listStyle: "none",
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    flex: 1,
                  }}
                >
                  {t.features.map((f, j) => (
                    <li
                      key={j}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: C.ink,
                        fontFamily: FONT_SANS,
                      }}
                    >
                      <Check
                        size={16}
                        color={C.goldDeep}
                        style={{ marginTop: 2, flexShrink: 0 }}
                        aria-hidden="true"
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 40 }}>
                  {t.accent ? (
                    <GoldBtn href="/get-started" full>
                      {t.cta}
                    </GoldBtn>
                  ) : (
                    <GhostBtn href="/get-started" full>
                      {t.cta}
                    </GhostBtn>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          padding: "128px 0",
          background: C.ink,
          color: C.cream,
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
              "radial-gradient(ellipse 60% 80% at 50% 0%, rgba(201,169,97,0.18), transparent 65%)",
          }}
          aria-hidden="true"
        />
        <div
          style={{
            ...sectionMaxStyle,
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 40,
            alignItems: "center",
            position: "relative",
          }}
          className="peterna-fc-grid"
        >
          <div>
            <Pill tone="gold">The Family Channel · separately</Pill>
            <h2
              style={{
                marginTop: 24,
                fontFamily: FONT_DISPLAY,
                fontWeight: 400,
                fontSize: "clamp(40px, 5.5vw, 80px)",
                lineHeight: 1.0,
                letterSpacing: "-0.01em",
              }}
            >
              Every pet you&rsquo;ve loved, kept together.
            </h2>
            <p
              style={{
                marginTop: 32,
                maxWidth: 560,
                fontSize: 18,
                lineHeight: 1.65,
                color: "rgba(248,241,228,0.8)",
                fontFamily: FONT_SANS,
              }}
            >
              Add the Family Channel to any tribute, or start one separately. Hold every
              pet&rsquo;s memorial in one place. Anniversary reminders, family uploads, and a
              living archive that grows with your family.
            </p>
            <div style={{ marginTop: 40 }}>
              <GoldBtn href="/family-channel">About the Family Channel</GoldBtn>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {channelTiers.map((p, i) => (
              <div
                key={i}
                style={{
                  padding: 20,
                  borderRadius: 12,
                  border: `1px solid ${p.featured ? C.gold : "rgba(248,241,228,0.15)"}`,
                  background: p.featured ? "rgba(248,241,228,0.05)" : "rgba(248,241,228,0.02)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: "rgba(248,241,228,0.6)",
                        fontFamily: FONT_SANS,
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontFamily: FONT_DISPLAY,
                        fontSize: 32,
                        lineHeight: 1,
                        fontWeight: 400,
                        color: C.cream,
                      }}
                    >
                      {p.price}{" "}
                      <span
                        style={{
                          fontSize: 14,
                          color: "rgba(248,241,228,0.6)",
                          fontFamily: FONT_SANS,
                        }}
                      >
                        {p.per}
                      </span>
                    </div>
                  </div>
                  {p.featured && (
                    <span
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: C.gold,
                        fontFamily: FONT_SANS,
                      }}
                    >
                      Best value
                    </span>
                  )}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "rgba(248,241,228,0.6)",
                    fontFamily: FONT_SANS,
                  }}
                >
                  {p.note}
                </div>
              </div>
            ))}
          </div>
        </div>
        <style>{`@media (min-width: 1024px) { .peterna-fc-grid { grid-template-columns: 7fr 5fr !important; gap: 64px !important; } }`}</style>
      </section>

      <section style={{ padding: "80px 0", background: C.cream }}>
        <div style={NARROW_MAX}>
          <Pill>Honest pricing</Pill>
          <h2
            style={{
              marginTop: 24,
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: "clamp(28px, 3.4vw, 40px)",
              lineHeight: 1.1,
              color: C.ink,
            }}
          >
            What&rsquo;s not on this page.
          </h2>
          <div
            style={{
              marginTop: 32,
              display: "flex",
              flexDirection: "column",
              gap: 20,
              fontSize: 17,
              lineHeight: 1.65,
              color: C.inkSoft,
              fontFamily: FONT_SANS,
            }}
          >
            {honest.map((h, i) => (
              <p key={i}>
                <strong style={{ color: C.ink, fontWeight: 500 }}>{h.b}</strong> {h.t}
              </p>
            ))}
          </div>
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
              color: C.ink,
            }}
          >
            Be the first to know.
          </h2>
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
            <GhostBtn href="/faq">Read the FAQ</GhostBtn>
          </div>
        </div>
      </section>
    </main>
  );
}
