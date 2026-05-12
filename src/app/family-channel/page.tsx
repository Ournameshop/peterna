"use client";

import { Users, Bell, Heart, Clock, Lock } from "lucide-react";
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

export default function PageFamilyChannel() {
  const features = [
    {
      icon: Users,
      title: "One private space for every pet.",
      body: "Add as many pets as you've loved — past and present. Each has its own page, its own tribute, its own story. Your family channel ties them together.",
    },
    {
      icon: Bell,
      title: "Anniversary reminders, gentle and never intrusive.",
      body: "On the anniversary of your pet's passing — and on their birthday, if you'd like — we send a quiet email with a link to their page. A moment to pause, not a notification you'd swipe past.",
    },
    {
      icon: Heart,
      title: "Family contributions, all in one place.",
      body: "Adult children, grandparents, siblings, cousins — anyone you invite can add photos, memories, voice notes. New tributes can be commissioned for new losses without starting over.",
    },
    {
      icon: Clock,
      title: "A living archive that grows with you.",
      body: "Loss is not the end of the family channel. New pets join the archive. New tributes get added. The space keeps expanding, beautifully, the way a family does.",
    },
    {
      icon: Lock,
      title: "Private by default. Yours by design.",
      body: "Channels are private to your family unless you choose to share. Memorial pages can be public, link-only, or password-protected. You set the boundaries.",
    },
  ];
  return (
    <main>
      <section
        style={{
          padding: "112px 0",
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
            backgroundImage: "url(/hero/slides/05-couch-sunbeam-dog.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            opacity: 0.55,
            filter: "saturate(0.9) contrast(1.05)",
          }}
          aria-hidden="true"
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(90deg, rgba(20,18,16,0.85) 0%, rgba(20,18,16,0.55) 55%, rgba(20,18,16,0.35) 100%), linear-gradient(180deg, rgba(20,18,16,0.25) 0%, rgba(20,18,16,0.55) 70%, rgba(20,18,16,0.85) 100%)",
          }}
          aria-hidden="true"
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 70% 60% at 90% 0%, rgba(201,169,97,0.22), transparent 65%)",
          }}
          aria-hidden="true"
        />
        <div style={{ ...sectionMaxStyle, position: "relative" }}>
          <Pill tone="gold">The Peterna Family Channel</Pill>
          <h1
            style={{
              marginTop: 24,
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: "clamp(44px, 7vw, 104px)",
              lineHeight: 1.0,
              letterSpacing: "-0.015em",
              maxWidth: 1100,
            }}
          >
            Every animal who shaped your family —{" "}
            <em style={{ color: C.gold }}>together.</em>
          </h1>
          <p
            style={{
              marginTop: 32,
              maxWidth: 640,
              fontSize: 18,
              lineHeight: 1.65,
              color: "rgba(248,241,228,0.8)",
              fontFamily: FONT_SANS,
            }}
          >
            Most families have loved more than one pet. The cat from your twenties. The dog
            who raised your kids. The rabbit your daughter still talks about. Peterna&rsquo;s
            Family Channel is a private, beautiful space for every animal who&rsquo;s been
            part of your family — past, present, and the ones still ahead.
          </p>
          <div style={{ marginTop: 40, display: "flex", flexWrap: "wrap", gap: 12 }}>
            <GoldBtn href="/get-started">Join the waitlist</GoldBtn>
            <GhostBtn href="/pricing" light>
              See pricing
            </GhostBtn>
          </div>
          <div style={{ marginTop: 48 }}>
            <QuietLine animated label="Multi-pet · Multi-generation · Always there" />
          </div>
        </div>
      </section>

      <section style={{ padding: "128px 0", background: C.cream }}>
        <div style={sectionMaxStyle}>
          <div style={{ marginBottom: 56, maxWidth: 640 }}>
            <Pill>What&rsquo;s included</Pill>
            <h2
              style={{
                marginTop: 24,
                fontFamily: FONT_DISPLAY,
                fontWeight: 400,
                fontSize: "clamp(36px, 5vw, 64px)",
                lineHeight: 1.05,
                color: C.ink,
              }}
            >
              Built around how families actually grieve, and remember.
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: C.line }}>
            {features.map((f, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 24,
                  padding: "48px 8px",
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
                    <f.icon size={20} color={C.goldDeep} aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <h3
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 400,
                      fontSize: "clamp(24px, 3vw, 38px)",
                      lineHeight: 1.15,
                      color: C.ink,
                      margin: 0,
                    }}
                  >
                    {f.title}
                  </h3>
                  <p
                    style={{
                      marginTop: 16,
                      fontSize: 17,
                      lineHeight: 1.65,
                      color: C.inkSoft,
                      fontFamily: FONT_SANS,
                      maxWidth: 640,
                    }}
                  >
                    {f.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <style>{`@media (min-width: 1024px) { .peterna-three-row { grid-template-columns: 3fr 9fr !important; gap: 40px !important; } }`}</style>
      </section>

      <section style={{ padding: "128px 0", background: C.blush }}>
        <div style={NARROW_MAX}>
          <Pill tone="gold">Why families choose this</Pill>
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
            One memorial is a tribute. A channel is a story.
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
            <p>
              You can absolutely use Peterna for a single tribute, with a single memorial
              page, kept forever. That&rsquo;s enough for some families, and we&rsquo;ll
              never push you toward more than you want.
            </p>
            <p>
              But for many families, the loss of one pet brings up every pet they&rsquo;ve
              loved before. The terrier from childhood. The cat who knew them best. The horse
              a parent had as a kid. The Family Channel is the place where those stories live
              together, told in one shape, by the people who knew them best.
            </p>
            <p>
              It&rsquo;s not a pricing plan. It&rsquo;s a posture: your family&rsquo;s
              history with animals deserves to be kept somewhere good.
            </p>
          </div>
          <div style={{ marginTop: 40 }}>
            <GoldBtn href="/get-started">Join the waitlist</GoldBtn>
          </div>
        </div>
      </section>
    </main>
  );
}
