"use client";

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

export default function PageAbout() {
  return (
    <main>
      <section style={{ padding: "112px 0", background: C.cream }}>
        <div style={sectionMaxStyle}>
          <Pill>About Peterna</Pill>
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
            We make remembrance, <em style={{ color: C.goldDeep }}>beautifully.</em>
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
            Peterna is a remembrance media product built by the team at Eterna — a company
            designing how families honor the lives they&rsquo;ve lost. We started with a
            simple belief: that the pets who shape our families deserve the same cinematic,
            lasting tribute that humans get. And that the technology to do it well finally
            exists.
          </p>
          <div style={{ marginTop: 48 }}>
            <QuietLine animated label="A product of Eterna · Built for families" />
          </div>
        </div>
      </section>

      <section style={{ padding: "96px 0", background: C.cream }}>
        <div style={NARROW_MAX}>
          <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
            {[
              {
                h: "Why we built this.",
                body: [
                  "When a person dies, an industry exists to remember them — funerals, memorial services, obituaries, headstones. When a pet dies, almost nothing exists. A clay paw print, a sympathy card, a generic urn. The family goes home, and the love they had for that animal becomes a hard drive full of phone photos that nobody will ever organize.",
                  "Pets are family now in a way they weren't a generation ago. Fifty-one percent of American pet owners say their pets are as much family as their siblings. The aftercare hasn't caught up to the love.",
                  "Peterna is the layer that's missing. Not a slideshow tool. Not a memorial page generator. A real production process — AI-restored, human-guided, cinematically composed — that gives the pet you loved the tribute they actually deserve.",
                ],
              },
              {
                h: "Our parent company.",
                body: [
                  "Peterna is a product of Eterna — a remembrance media and legacy infrastructure company building the first dedicated platform for life tributes across television, streaming, and digital memorial pages. Eterna was founded on the belief that remembrance has not kept up with modern life, and that families everywhere deserve better tools to honor the lives they've loved.",
                  "Peterna applies the same craft, the same production discipline, and the same care promise — to the animals who shaped our families. Same team. Same standards. Different audience.",
                ],
              },
              {
                h: "How we work.",
                body: [
                  "We are a small senior team. Producers, designers, AI engineers, veterinary advisors, and grief specialists working in close collaboration. Every tribute is touched by a human; every page is checked before it ships. We don't run a sweatshop of low-cost editors hidden behind a chatbot — and we are not interested in becoming one.",
                  "We work with families directly through Peterna.com, and through a growing network of partner veterinary clinics and pet emergency hospitals who introduce us at the moment of loss.",
                ],
              },
            ].map((s, i) => (
              <div key={i}>
                <h2
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 400,
                    fontSize: "clamp(28px, 3.5vw, 44px)",
                    lineHeight: 1.1,
                    color: C.ink,
                  }}
                >
                  {s.h}
                </h2>
                <div
                  style={{
                    marginTop: 24,
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                    fontSize: 17,
                    lineHeight: 1.65,
                    color: C.inkSoft,
                    fontFamily: FONT_SANS,
                  }}
                >
                  {s.body.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <h2
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 400,
                  fontSize: "clamp(28px, 3.5vw, 44px)",
                  lineHeight: 1.1,
                  color: C.ink,
                }}
              >
                How to reach us.
              </h2>
              <div
                style={{
                  marginTop: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                  fontSize: 17,
                  lineHeight: 1.65,
                  color: C.inkSoft,
                  fontFamily: FONT_SANS,
                }}
              >
                <p>The fastest way to reach a real person is via email.</p>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <li>
                    <strong style={{ color: C.ink, fontWeight: 500 }}>
                      Families & general:
                    </strong>{" "}
                    <a
                      href="mailto:hello@peterna.com"
                      style={{
                        color: C.goldDeep,
                        textDecoration: "none",
                        borderBottom: `1px solid ${C.line}`,
                      }}
                    >
                      hello@peterna.com
                    </a>
                  </li>
                  <li>
                    <strong style={{ color: C.ink, fontWeight: 500 }}>
                      Veterinary partners:
                    </strong>{" "}
                    <a
                      href="mailto:partners@peterna.com"
                      style={{
                        color: C.goldDeep,
                        textDecoration: "none",
                        borderBottom: `1px solid ${C.line}`,
                      }}
                    >
                      partners@peterna.com
                    </a>
                  </li>
                  <li>
                    <strong style={{ color: C.ink, fontWeight: 500 }}>
                      Press & media:
                    </strong>{" "}
                    <a
                      href="mailto:press@peterna.com"
                      style={{
                        color: C.goldDeep,
                        textDecoration: "none",
                        borderBottom: `1px solid ${C.line}`,
                      }}
                    >
                      press@peterna.com
                    </a>
                  </li>
                </ul>
                <p>
                  Peterna isn&rsquo;t open to families yet. If you have a question, the
                  fastest reply is via email — we read everything that comes in, but
                  we&rsquo;re a small team building carefully and we&rsquo;d rather respond
                  honestly when we have something useful to say than rush a reply.
                </p>
              </div>
            </div>

            <div style={{ paddingTop: 24 }}>
              <GoldBtn href="/get-started">Join the waitlist</GoldBtn>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
