"use client";

import { Play } from "lucide-react";
import Pill from "@/components/Pill";
import { GoldBtn } from "@/components/Buttons";
import {
  C,
  FONT_DISPLAY,
  FONT_SANS,
  sectionMaxStyle,
  NARROW_MAX,
} from "@/lib/peterna-tokens";

/*
  GALLERY IMAGE PIPELINE — see /tmp/peterna/artifact.jsx PageGallery for full
  Gemini Nano Banana prompts per pet. Each <img> below is a TODO placeholder.
*/

export default function PageGallery() {
  const samples = [
    {
      name: "Charlie",
      years: "2007 — 2024",
      breed: "Yellow Lab · 17 years",
      excerpt:
        "The good boy. The first dog of a young marriage. The dog the kids grew up with.",
      img: "1583337130417-3346a1be7dee",
    },
    {
      name: "Mango",
      years: "2014 — 2023",
      breed: "Tabby cat · 9 years",
      excerpt:
        "The sunlight tabby. Slept on every laptop. Owned every windowsill in the house.",
      img: "1574144611937-0df059b5ef3e",
    },
    {
      name: "Pepper",
      years: "1998 — 2011",
      breed: "Border Collie mix · 13 years",
      excerpt: "The first family dog. Outsmarted everyone. Loved deeply, loved long.",
      img: "1592194996308-7b43878e84a6",
    },
    {
      name: "Toby",
      years: "1989 — 2003",
      breed: "Beagle · 14 years",
      excerpt:
        "Mom's heart dog. The dog she still talks about. The one who started everything.",
      img: "1586671267731-da2cf3ceeb80",
    },
  ];
  return (
    <main>
      <section style={{ padding: "112px 0", background: C.cream }}>
        <div style={sectionMaxStyle}>
          <Pill>Examples</Pill>
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
            What a Peterna tribute <em style={{ color: C.goldDeep }}>looks like.</em>
          </h1>
          <p
            style={{
              marginTop: 32,
              maxWidth: 720,
              fontSize: 18,
              lineHeight: 1.65,
              color: C.inkSoft,
              fontFamily: FONT_SANS,
            }}
          >
            Below are four illustrative examples in our production style — gentle
            restoration, cinematic pacing, music and rhythm matched to the story being told.
            They&rsquo;re sample pets, not real Peterna families yet (we haven&rsquo;t
            launched). They show what the production process is designed to produce.
          </p>
        </div>
      </section>

      <section style={{ padding: "80px 0", background: C.cream }}>
        <div style={sectionMaxStyle}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
              gap: 32,
            }}
          >
            {samples.map((s, i) => (
              <div key={i} style={{ cursor: "pointer" }}>
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "16/9",
                    borderRadius: 16,
                    overflow: "hidden",
                    background: C.ink,
                    boxShadow: "0 16px 50px -16px rgba(42,33,27,0.25)",
                  }}
                >
                  {/* TODO: replace with Gemini-generated image — see prompt in artifact PageGallery for {s.name} */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      s.img.startsWith("http")
                        ? s.img
                        : `https://images.unsplash.com/photo-${s.img}?w=1200&q=85`
                    }
                    alt={`Sample tribute thumbnail for ${s.name}`}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      background:
                        "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)",
                    }}
                    aria-hidden="true"
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      left: 16,
                      fontSize: 9,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: "rgba(248,241,228,0.95)",
                      background: "rgba(42,33,27,0.55)",
                      backdropFilter: "blur(4px)",
                      border: "1px solid rgba(248,241,228,0.25)",
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontFamily: FONT_SANS,
                      fontWeight: 500,
                    }}
                  >
                    Sample · Illustrative
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: "50%",
                        background: "rgba(248,241,228,0.95)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
                      }}
                    >
                      <Play
                        size={24}
                        color={C.ink}
                        fill={C.ink}
                        style={{ marginLeft: 2 }}
                      />
                    </div>
                  </div>
                  <div
                    style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}
                  >
                    <div
                      style={{
                        color: "rgba(248,241,228,0.95)",
                        fontSize: 18,
                        fontFamily: FONT_DISPLAY,
                        fontStyle: "italic",
                        lineHeight: 1.3,
                      }}
                    >
                      &ldquo;{s.excerpt}&rdquo;
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 20 }}>
                  <div
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontSize: 24,
                      color: C.ink,
                      lineHeight: 1.2,
                      fontWeight: 400,
                    }}
                  >
                    {s.name}{" "}
                    <span
                      style={{
                        color: C.inkSofter,
                        fontSize: 16,
                        fontFamily: FONT_SANS,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {s.years}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: C.inkSofter,
                      fontFamily: FONT_SANS,
                    }}
                  >
                    {s.breed}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "80px 0", background: C.blush }}>
        <div style={NARROW_MAX}>
          <Pill>A note on these examples</Pill>
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
            What we&rsquo;ll publish here, and what we won&rsquo;t.
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
            <p>
              The four shown above are illustrative samples in our production style — sample
              pets with sample names. They&rsquo;re here to show how a Peterna tribute is
              composed: the pacing, the framing, the way the photography sits with the music.
            </p>
            <p>
              They are not testimonials. They are not customer work. We won&rsquo;t publish
              anything as a testimonial unless it&rsquo;s a real family who chose to share
              their tribute publicly with documented consent. As real tributes start coming
              in, we&rsquo;ll add them here — slowly, deliberately, family by family — and
              the four samples above will move out.
            </p>
            <p>
              Every tribute Peterna creates will belong to the family that commissioned it.
              The examples library will always grow honestly.
            </p>
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
            Ready to make one for the pet you loved?
          </h2>
          <div style={{ marginTop: 40 }}>
            <GoldBtn href="/get-started">Join the waitlist</GoldBtn>
          </div>
        </div>
      </section>
    </main>
  );
}
