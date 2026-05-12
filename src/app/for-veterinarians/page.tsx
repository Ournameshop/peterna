"use client";

import { Heart, Stethoscope, TrendingUp, Shield, Users } from "lucide-react";
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

export default function PageForVets() {
  const benefits = [
    {
      icon: Heart,
      t: "Beautiful family-facing materials",
      d: "Sympathy cards, a tasteful introduction script for staff, branded handout cards. Designed in Peterna's care-first register, never sales-y.",
    },
    {
      icon: TrendingUp,
      t: "Referral revenue on every tribute",
      d: "Per-tribute referral fees, with a wholesale model also available. Modeled annual revenue at typical case volumes is shown in the economics section below — illustrative only.",
    },
    {
      icon: Shield,
      t: "Recurring revenue on subscriptions",
      d: "10% of every Family Channel subscription generated through your practice. Compounds year over year. Grows as the program grows.",
    },
    {
      icon: Users,
      t: "Zero workflow change",
      d: "Your team mentions Peterna at the end-of-life visit. That's the entire workflow. We handle uploads, support, billing, hosting, everything.",
    },
    {
      icon: Stethoscope,
      t: "Co-branded or white-label",
      d: "Clinic-branded landing page if preferred, with your name and logo prominently displayed. Or refer to the Peterna brand directly. Your choice.",
    },
    {
      icon: Heart,
      t: "Genuine aftercare extension",
      d: "This isn't a referral kickback. It's an actual product your families need. The revenue is incidental to the care. That's why it works.",
    },
  ];
  const scenarios = [
    {
      name: "Scenario A · Referral",
      price: "$195",
      detail:
        "Standard retail. Clinic earns $75 referral fee per tribute. Modeled at a 20% attach rate.",
      annual: "$18,400/yr",
      note: "modeled at 100 eligible cases/mo",
      accent: false,
      badge: undefined as string | undefined,
    },
    {
      name: "Scenario B · Premium Referral",
      price: "$295",
      detail:
        "Premium retail. Clinic earns $100 per tribute. Modeled at a 30% attach rate at this tier.",
      annual: "$36,600/yr",
      note: "modeled at 100 eligible cases/mo",
      accent: false,
      badge: undefined as string | undefined,
    },
    {
      name: "Scenario C · Wholesale Markup",
      price: "$75 wholesale",
      detail:
        "Clinic pays $75 wholesale. Clinic sets retail ($195–295) and keeps the markup. Most control, highest modeled margin.",
      annual: "$36,000–67,000/yr",
      note: "modeled at 100 eligible cases/mo",
      accent: true,
      badge: "Planned recommendation",
    },
  ];
  const onboarding = [
    {
      n: "01",
      t: "Pilot",
      d: "30-day trial period. We onboard your team in one short call. No fees, no commitments, no system integrations required.",
    },
    {
      n: "02",
      t: "Proof",
      d: "We measure attach rate, family feedback, and sub conversion. Most pilots hit 20–25% attach in the first 60 days.",
    },
    {
      n: "03",
      t: "Standardize",
      d: "We tune the introduction script, materials, and timing to your practice's specific workflow. Different specialties, different cadences.",
    },
    {
      n: "04",
      t: "Scale",
      d: "After proof, we expand into your full case load. Optional integration with practice management systems for hands-free attribution.",
    },
  ];
  return (
    <main>
      <section style={{ padding: "112px 0", background: C.cream }}>
        <div style={sectionMaxStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <Stethoscope size={16} color={C.goldDeep} aria-hidden="true" />
            <Pill tone="gold">Partner Program</Pill>
          </div>
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
            The aftercare your families <em style={{ color: C.goldDeep }}>deserve.</em>
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
            Peterna lets veterinary clinics and pet emergency hospitals offer a beautiful
            remembrance experience to grieving families — without lifting a finger on
            production. Your team introduces. We do everything else.
          </p>
          <div style={{ marginTop: 40, display: "flex", flexWrap: "wrap", gap: 12 }}>
            <GoldBtn href="/partners">Become a partner</GoldBtn>
            <GhostBtn href="#vet-economics">See the numbers</GhostBtn>
          </div>
          <div style={{ marginTop: 48 }}>
            <QuietLine
              animated
              label="Zero practice work · New non-medical revenue · Real care"
            />
          </div>
        </div>
      </section>

      <section style={{ padding: "128px 0", background: C.cream }}>
        <div
          style={{
            ...sectionMaxStyle,
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 40,
          }}
          className="peterna-vets-pitch"
        >
          <div>
            <Pill>Why this matters</Pill>
            <h2
              style={{
                marginTop: 24,
                fontFamily: FONT_DISPLAY,
                fontWeight: 400,
                fontSize: "clamp(32px, 4.5vw, 56px)",
                lineHeight: 1.05,
                color: C.ink,
              }}
            >
              Today, your aftercare offering ends at the urn.
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
              Cremation is handled. A clay paw print, maybe. A sympathy card if your team has
              the bandwidth. Then the family goes home — and the relationship with your
              practice goes quiet for a year, or forever.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              fontSize: 17,
              lineHeight: 1.65,
              color: C.inkSoft,
              fontFamily: FONT_SANS,
            }}
          >
            <p>
              Peterna is the missing layer between the urn and the empty house. A cinematic
              tribute, a beautiful memorial page, and a Family Channel for every pet
              they&rsquo;ve loved — introduced by you, delivered by us, paid for by the
              family directly.
            </p>
            <p>
              The clinic does no production. No software training. No content review. No
              customer support. You hand the family a card or a link at the moment of loss;
              we take it from there. You earn referral revenue on every tribute and a share
              of every subscription, in perpetuity.
            </p>
            <p style={{ color: C.ink, fontStyle: "italic", fontFamily: FONT_DISPLAY }}>
              It&rsquo;s the aftercare your families already wish you offered. Now you can.
            </p>
          </div>
        </div>
        <style>{`@media (min-width: 1024px) { .peterna-vets-pitch { grid-template-columns: 5fr 6fr !important; gap: 64px !important; } }`}</style>
      </section>

      <section style={{ padding: "128px 0", background: C.blush }}>
        <div style={sectionMaxStyle}>
          <div style={{ marginBottom: 56, maxWidth: 640 }}>
            <Pill tone="gold">What partner clinics get</Pill>
            <h2
              style={{
                marginTop: 24,
                fontFamily: FONT_DISPLAY,
                fontWeight: 400,
                fontSize: "clamp(32px, 4.5vw, 56px)",
                lineHeight: 1.05,
                color: C.ink,
              }}
            >
              An aftercare program in a box.
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 24,
            }}
          >
            {benefits.map((b, i) => (
              <div
                key={i}
                style={{
                  background: C.cream,
                  borderRadius: 16,
                  border: `1px solid ${C.line}`,
                  padding: 28,
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
                    marginBottom: 20,
                  }}
                >
                  <b.icon size={20} color={C.goldDeep} aria-hidden="true" />
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
                  {b.t}
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
                  {b.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="vet-economics"
        style={{
          padding: "128px 0",
          background: C.ink,
          color: C.cream,
          scrollMarginTop: 80,
        }}
      >
        <div style={sectionMaxStyle}>
          <div
            style={{
              marginBottom: 48,
              padding: "20px 24px",
              borderRadius: 12,
              border: "1px solid rgba(201,169,97,0.4)",
              background: "rgba(201,169,97,0.08)",
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(201,169,97,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Shield size={16} color={C.gold} aria-hidden="true" />
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: C.gold,
                  fontFamily: FONT_SANS,
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                Illustrative modeling — actual results vary
              </div>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "rgba(248,241,228,0.85)",
                  fontFamily: FONT_SANS,
                  margin: 0,
                }}
              >
                The dollar figures below are pre-launch projections based on
                industry-comparable pet aftercare programs. Peterna has not yet launched and
                has no operational attach-rate data of its own. Real results will depend on
                your practice&rsquo;s case volume, how the program is introduced, and other
                factors we&rsquo;ll work through together. Use these numbers to understand
                the model — not as a forecast.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: 56, maxWidth: 640 }}>
            <Pill tone="gold">The economics</Pill>
            <h2
              style={{
                marginTop: 24,
                fontFamily: FONT_DISPLAY,
                fontWeight: 400,
                fontSize: "clamp(36px, 5vw, 64px)",
                lineHeight: 1.0,
              }}
            >
              Three partner models. <em style={{ color: C.gold }}>Pick what fits.</em>
            </h2>
            <p
              style={{
                marginTop: 24,
                fontSize: 18,
                lineHeight: 1.65,
                color: "rgba(248,241,228,0.8)",
                fontFamily: FONT_SANS,
              }}
            >
              Every model is designed to be no-work-for-the-clinic. The difference is how
              much margin your practice keeps versus how simple the structure is. Scenario C
              is what we plan to recommend for most partners at launch.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 24,
            }}
          >
            {scenarios.map((s, i) => (
              <div
                key={i}
                style={{
                  padding: 32,
                  borderRadius: 16,
                  border: `2px solid ${s.accent ? C.gold : "rgba(248,241,228,0.15)"}`,
                  background: s.accent ? "rgba(248,241,228,0.03)" : "rgba(248,241,228,0.02)",
                }}
              >
                {s.badge && (
                  <span
                    style={{
                      display: "inline-block",
                      marginBottom: 16,
                      fontSize: 10,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: C.gold,
                      border: "1px solid rgba(201,169,97,0.4)",
                      borderRadius: 999,
                      padding: "4px 12px",
                      fontFamily: FONT_SANS,
                    }}
                  >
                    {s.badge}
                  </span>
                )}
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(248,241,228,0.6)",
                    fontFamily: FONT_SANS,
                  }}
                >
                  {s.name}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontFamily: FONT_DISPLAY,
                    fontSize: 44,
                    lineHeight: 1,
                    fontWeight: 400,
                    color: C.cream,
                  }}
                >
                  {s.price}
                </div>
                <p
                  style={{
                    marginTop: 16,
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: "rgba(248,241,228,0.75)",
                    fontFamily: FONT_SANS,
                  }}
                >
                  {s.detail}
                </p>
                <div
                  style={{
                    marginTop: 32,
                    paddingTop: 24,
                    borderTop: "1px solid rgba(248,241,228,0.15)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: C.gold,
                      marginBottom: 8,
                      fontFamily: FONT_SANS,
                    }}
                  >
                    Modeled annual revenue
                  </div>
                  <div
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontSize: 32,
                      lineHeight: 1.1,
                      fontWeight: 400,
                      color: C.cream,
                    }}
                  >
                    {s.annual}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: "rgba(248,241,228,0.6)",
                      fontFamily: FONT_SANS,
                    }}
                  >
                    {s.note}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p
            style={{
              marginTop: 40,
              fontSize: 13,
              fontStyle: "italic",
              color: "rgba(248,241,228,0.6)",
              maxWidth: 800,
              fontFamily: FONT_DISPLAY,
            }}
          >
            Numbers are illustrative, based on 25–30% attach rate and modeled from comparable
            pet aftercare programs. Actual results depend on practice case volume,
            end-of-life visit frequency, and how naturally the program is introduced. We
            share full modeling in the partner conversation.
          </p>
        </div>
      </section>

      <section style={{ padding: "128px 0", background: C.cream }}>
        <div style={sectionMaxStyle}>
          <div style={{ marginBottom: 56, maxWidth: 640 }}>
            <Pill>Onboarding</Pill>
            <h2
              style={{
                marginTop: 24,
                fontFamily: FONT_DISPLAY,
                fontWeight: 400,
                fontSize: "clamp(32px, 4.5vw, 56px)",
                lineHeight: 1.05,
                color: C.ink,
              }}
            >
              Pilot first. Scale only what works.
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 1,
              background: C.line,
            }}
          >
            {onboarding.map((s, i) => (
              <div key={i} style={{ padding: 32, background: C.cream }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    color: C.goldDeep,
                    fontFamily: FONT_DISPLAY,
                    fontStyle: "italic",
                  }}
                >
                  Step {s.n}
                </div>
                <h3
                  style={{
                    marginTop: 12,
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 400,
                    fontSize: 24,
                    lineHeight: 1.15,
                    color: C.ink,
                    margin: "12px 0 0",
                  }}
                >
                  {s.t}
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
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "128px 0", background: C.blush, textAlign: "center" }}>
        <div style={NARROW_MAX}>
          <Pill tone="gold">Become a partner</Pill>
          <h2
            style={{
              marginTop: 24,
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: "clamp(36px, 5vw, 64px)",
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: C.ink,
            }}
          >
            A short conversation, a clear pilot.
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
            Tell us about your practice. We&rsquo;ll send a one-page partner brief and book a
            30-minute call to walk through the pilot structure. No pressure, no pitch deck.
          </p>
          <div style={{ marginTop: 40 }}>
            <GoldBtn href="/partners">Tell us about your practice</GoldBtn>
          </div>
          <p
            style={{
              marginTop: 24,
              fontSize: 14,
              fontStyle: "italic",
              color: C.inkSofter,
              fontFamily: FONT_DISPLAY,
            }}
          >
            We read every partner inquiry. We&rsquo;re a small team — replies come from a
            real person, on real-person timing.
          </p>
        </div>
      </section>
    </main>
  );
}
