"use client";

// /partners — dedicated partner inquiry form for veterinary clinics and
// pet emergency hospitals. Built 2026-05-13 at Andre's request after he
// asked whether to consolidate "Become a partner" into the existing
// /get-started waitlist form. We chose two separate forms because the
// audiences and field needs are fundamentally different:
//   - /get-started: grieving family, 2 fields, emotional tone
//   - /partners:    business evaluator, ~9 fields, professional tone
//
// Mirrors /get-started's structural pattern (form section / submitted
// success section, same field/label tokens) so it feels like part of the
// same site, just with the right fields for a practice owner / vet /
// practice manager filling it out during business hours.
//
// Submit is currently client-side only (same as /get-started today). When
// we wire a real backend, this is where we'll POST to e.g. /api/partners.

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";
import Pill from "@/components/Pill";
import { GoldBtn } from "@/components/Buttons";
import QuietLine from "@/components/QuietLine";
import {
  C,
  FONT_DISPLAY,
  FONT_SANS,
  sectionMaxStyle,
} from "@/lib/peterna-tokens";

const ROLES = [
  "Owner",
  "Veterinarian",
  "Practice manager",
  "Other",
] as const;

const LOCATIONS = [
  "1",
  "2–5",
  "6–20",
  "20+",
] as const;

const MODELS = [
  { id: "recommend", label: "Recommend Peterna to grieving families" },
  { id: "cobrand", label: "Co-brand a memorial program with us" },
  { id: "refer", label: "Refer-out only (no in-clinic involvement)" },
  { id: "unsure", label: "Not sure yet — want to learn more" },
] as const;

export default function PagePartners() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    practice: "",
    name: "",
    role: "" as (typeof ROLES)[number] | "",
    email: "",
    phone: "",
    locations: "" as (typeof LOCATIONS)[number] | "",
    cases: "",
    models: [] as string[],
    note: "",
  });

  const toggleModel = (id: string) => {
    setForm((f) => ({
      ...f,
      models: f.models.includes(id)
        ? f.models.filter((m) => m !== id)
        : [...f.models, id],
    }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.practice.trim() && form.name.trim() && form.email.trim() && form.role) {
      setSubmitted(true);
    }
  };

  const fieldStyle = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid rgba(42,33,27,0.2)`,
    padding: "10px 0",
    fontSize: 17,
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
              <Pill tone="gold">Become a Peterna partner</Pill>
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
                Tell us about your practice.{" "}
                <em style={{ color: C.goldDeep }}>We&rsquo;ll send a brief.</em>
              </h1>
              <p
                style={{
                  marginTop: 32,
                  maxWidth: 620,
                  fontSize: 18,
                  lineHeight: 1.65,
                  color: C.inkSoft,
                  fontFamily: FONT_SANS,
                }}
              >
                We work with veterinary clinics and pet emergency hospitals to introduce
                Peterna to families at the moment of loss — gently, never as a sales pitch.
                Fill this out and we&rsquo;ll send a one-page partner brief and book a
                quiet 20-minute conversation within two business days.
              </p>

              <form
                onSubmit={handleSubmit}
                style={{
                  marginTop: 56,
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 32,
                  maxWidth: 620,
                }}
              >
                {/* Two-column on wider viewports */}
                <div className="peterna-partner-row">
                  <label>
                    <div style={labelStyle}>Practice / hospital name *</div>
                    <input
                      style={fieldStyle}
                      type="text"
                      name="practice"
                      required
                      value={form.practice}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, practice: e.target.value }))
                      }
                      placeholder="e.g. Riverside Animal Hospital"
                    />
                  </label>
                  <label>
                    <div style={labelStyle}>Your name *</div>
                    <input
                      style={fieldStyle}
                      type="text"
                      name="name"
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="Dr. Jane Doe"
                    />
                  </label>
                </div>

                <fieldset
                  style={{ border: "none", padding: 0, margin: 0 }}
                  aria-required="true"
                >
                  <legend style={labelStyle}>Your role *</legend>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      marginTop: 4,
                    }}
                  >
                    {ROLES.map((r) => {
                      const active = form.role === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, role: r }))}
                          aria-pressed={active}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 999,
                            border: active
                              ? `1px solid ${C.goldDeep}`
                              : `1px solid rgba(42,33,27,0.2)`,
                            background: active
                              ? "rgba(201,169,97,0.14)"
                              : "transparent",
                            color: active ? C.goldDeep : C.inkSoft,
                            fontFamily: FONT_SANS,
                            fontSize: 14,
                            cursor: "pointer",
                            transition:
                              "background 0.2s ease, border-color 0.2s ease, color 0.2s ease",
                          }}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="peterna-partner-row">
                  <label>
                    <div style={labelStyle}>Email *</div>
                    <input
                      style={fieldStyle}
                      type="email"
                      name="email"
                      required
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                      placeholder="you@practice.com"
                    />
                  </label>
                  <label>
                    <div style={labelStyle}>Phone (optional)</div>
                    <input
                      style={fieldStyle}
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      placeholder="+1 555 555 5555"
                    />
                  </label>
                </div>

                <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                  <legend style={labelStyle}>Number of locations</legend>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      marginTop: 4,
                    }}
                  >
                    {LOCATIONS.map((l) => {
                      const active = form.locations === l;
                      return (
                        <button
                          key={l}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({ ...f, locations: l }))
                          }
                          aria-pressed={active}
                          style={{
                            padding: "8px 18px",
                            borderRadius: 999,
                            border: active
                              ? `1px solid ${C.goldDeep}`
                              : `1px solid rgba(42,33,27,0.2)`,
                            background: active
                              ? "rgba(201,169,97,0.14)"
                              : "transparent",
                            color: active ? C.goldDeep : C.inkSoft,
                            fontFamily: FONT_SANS,
                            fontSize: 14,
                            cursor: "pointer",
                            transition:
                              "background 0.2s ease, border-color 0.2s ease, color 0.2s ease",
                          }}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <label>
                  <div style={labelStyle}>
                    Approx. losses per month (optional, rough range is fine)
                  </div>
                  <input
                    style={fieldStyle}
                    type="text"
                    name="cases"
                    value={form.cases}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cases: e.target.value }))
                    }
                    placeholder="e.g. ~12, or 'not sure'"
                  />
                </label>

                <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                  <legend style={labelStyle}>
                    Which partner models interest you? (select any)
                  </legend>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    {MODELS.map((m) => {
                      const active = form.models.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 14px",
                            borderRadius: 10,
                            border: active
                              ? `1px solid ${C.goldDeep}`
                              : `1px solid rgba(42,33,27,0.15)`,
                            background: active
                              ? "rgba(201,169,97,0.08)"
                              : "transparent",
                            cursor: "pointer",
                            transition:
                              "background 0.2s ease, border-color 0.2s ease",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleModel(m.id)}
                            style={{ accentColor: C.goldDeep }}
                          />
                          <span
                            style={{
                              fontFamily: FONT_SANS,
                              fontSize: 15,
                              color: active ? C.ink : C.inkSoft,
                              lineHeight: 1.4,
                            }}
                          >
                            {m.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <label>
                  <div style={labelStyle}>
                    Anything else you want us to know? (optional)
                  </div>
                  <textarea
                    style={{ ...fieldStyle, resize: "none" }}
                    rows={4}
                    name="note"
                    value={form.note}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, note: e.target.value }))
                    }
                    placeholder="A clinic you've worked with, a model you've tried before, or just hello…"
                  />
                </label>

                <div style={{ marginTop: 8 }}>
                  <GoldBtn type="submit">Send partner inquiry</GoldBtn>
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
                  We use this only to send your partner brief and book a conversation.
                  No newsletter, no marketing list, no sharing.
                </p>
              </form>

              <div style={{ marginTop: 80 }}>
                <QuietLine label="Veterinary partnerships · Launching 2026" />
              </div>
            </div>
          </div>

          <style>{`
            .peterna-partner-row {
              display: grid;
              grid-template-columns: 1fr;
              gap: 32px;
            }
            @media (min-width: 720px) {
              .peterna-partner-row {
                grid-template-columns: 1fr 1fr;
                gap: 32px;
              }
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
              <Building2 size={32} color={C.goldDeep} />
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
              Thank you. We&rsquo;ll be in touch.
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
              We&rsquo;ll send your one-page partner brief and a couple of
              suggested times for a 20-minute conversation within two
              business days. Replies come from a real person on our team.
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
              From everyone at Peterna — thank you for considering us.
            </p>
          </div>
        </motion.section>
      )}
    </main>
  );
}
