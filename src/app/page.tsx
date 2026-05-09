"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Heart,
  Stethoscope,
  Film,
  Bookmark,
  Tv,
  Upload,
  Sparkles,
  Share2,
  Check,
  Play,
} from "lucide-react";
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

function HomeHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const visualY = useTransform(scrollYProgress, [0, 1], [0, -40]);

  const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
  };
  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const } },
  };

  return (
    <section
      ref={ref}
      style={{ position: "relative", background: "#1A1410", overflow: "hidden", isolation: "isolate" }}
    >
      {/* Ambient hero video — muted, looping, autoplays. Reduced-motion users see the poster image. */}
      <video
        className="peterna-hero-video"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/hero/peterna-hero-poster.jpg"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: -2,
          pointerEvents: "none",
        }}
      >
        <source src="/hero/peterna-hero.webm" type="video/webm" />
        <source src="/hero/peterna-hero.mp4" type="video/mp4" />
      </video>
      {/* Reduced-motion fallback: show poster only */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="peterna-hero-poster-fallback"
        src="/hero/peterna-hero-poster.jpg"
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: -2,
          pointerEvents: "none",
          display: "none",
        }}
      />
      {/* Dark warm overlay for text legibility */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: -1,
          background:
            "linear-gradient(180deg, rgba(20,15,10,0.62) 0%, rgba(20,15,10,0.55) 40%, rgba(20,15,10,0.72) 100%)",
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: -1,
          background:
            "radial-gradient(ellipse 90% 70% at 80% -10%, rgba(201,169,97,0.18), transparent 65%)",
        }}
        aria-hidden="true"
      />
      <div style={{ ...sectionMaxStyle, padding: "96px 40px 128px", position: "relative" }}>
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          style={{ display: "grid", gridTemplateColumns: "1fr", gap: 64, alignItems: "center" }}
          className="peterna-hero-grid"
        >
          <div>
            <motion.div variants={item}>
              <Pill tone="gold">A beautiful tribute · for the pet you loved</Pill>
            </motion.div>
            <motion.h1
              variants={item}
              style={{
                marginTop: 24,
                fontFamily: FONT_DISPLAY,
                fontWeight: 400,
                fontSize: "clamp(48px, 7vw, 96px)",
                lineHeight: 1.0,
                letterSpacing: "-0.015em",
                color: C.cream,
                textShadow: "0 2px 30px rgba(0,0,0,0.35)",
              }}
            >
              The ones we loved <em style={{ color: C.gold }}>deserve</em> to be
              remembered beautifully.
            </motion.h1>
            <motion.p
              variants={item}
              style={{
                marginTop: 32,
                maxWidth: 560,
                fontSize: 18,
                lineHeight: 1.65,
                color: "rgba(248,241,228,0.85)",
                fontFamily: FONT_SANS,
                textShadow: "0 1px 20px rgba(0,0,0,0.3)",
              }}
            >
              Peterna turns your photos and memories into a cinematic tribute film, a
              permanent memorial page, and a family channel for every pet you&rsquo;ve
              ever loved. Built by people who understand the weight of the moment.
              Launching soon — join the waitlist.
            </motion.p>
            <motion.div
              variants={item}
              style={{ marginTop: 40, display: "flex", flexWrap: "wrap", gap: 12 }}
            >
              <GoldBtn href="/get-started">Join the waitlist</GoldBtn>
              <GhostBtn href="/how-it-works">How it works</GhostBtn>
            </motion.div>
            <motion.div
              variants={item}
              style={{
                marginTop: 56,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                columnGap: 24,
                rowGap: 12,
                fontSize: 11,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "rgba(248,241,228,0.6)",
                fontFamily: FONT_SANS,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Heart size={14} color={C.gold} aria-hidden="true" /> Designed for
                24-hour delivery
              </div>
              <div
                style={{ width: 1, height: 16, background: "rgba(248,241,228,0.2)" }}
                aria-hidden="true"
              />
              <div>Multi-pet families welcome</div>
              <div
                style={{ width: 1, height: 16, background: "rgba(248,241,228,0.2)" }}
                aria-hidden="true"
              />
              <div>Launching 2026</div>
            </motion.div>
          </div>
          <motion.div variants={item} style={{ y: visualY }}>
            <div
              style={{
                position: "relative",
                aspectRatio: "4/5",
                borderRadius: 16,
                overflow: "hidden",
                background: "rgba(233,213,195,0.1)",
                border: "1px solid rgba(248,241,228,0.18)",
                maxWidth: 460,
                marginLeft: "auto",
                boxShadow: "0 30px 80px -20px rgba(0,0,0,0.5)",
              }}
            >
              {/* TODO: replace with Gemini-generated image — see prompt in artifact PageHome HomeHero */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1558788353-f76d92427f16?w=900&q=80"
                alt="A senior yellow Labrador Retriever in warm afternoon light"
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
                    "linear-gradient(to bottom, transparent 60%, rgba(42,33,27,0.25) 100%)",
                }}
                aria-hidden="true"
              />
            </div>
            <p
              style={{
                marginTop: 12,
                textAlign: "center",
                fontSize: 14,
                fontStyle: "italic",
                color: "rgba(248,241,228,0.7)",
                fontFamily: FONT_DISPLAY,
              }}
            >
              &ldquo;Some loves never leave the house.&rdquo;
            </p>
          </motion.div>
        </motion.div>
        <div style={{ marginTop: 96 }}>
          <QuietLine animated label="Tribute · Memorial · Family Channel" tone="light" />
        </div>
      </div>
      <style>{`
        @media (min-width: 1024px) { .peterna-hero-grid { grid-template-columns: 7fr 5fr !important; } }
        @media (prefers-reduced-motion: reduce) {
          .peterna-hero-video { display: none !important; }
          .peterna-hero-poster-fallback { display: block !important; }
        }
      `}</style>
    </section>
  );
}

function HomeThreeThings() {
  const things = [
    {
      icon: Film,
      eyebrow: "First",
      title: "A cinematic tribute film.",
      body: "You upload the photos and the memories. Our team — guided by AI, never automated — restores, animates, and scores them into a beautiful tribute film, designed to be ready within 24 hours.",
      detail: "AI-restored. Human-guided. Broadcast quality.",
    },
    {
      icon: Bookmark,
      eyebrow: "Then",
      title: "A permanent memorial page.",
      body: "Every tribute lives on its own page — beautifully designed, hosted forever, shareable by link or QR code. A place for family to gather, share photos, and leave their own messages.",
      detail: "Yours to keep. Yours to share. Yours forever.",
    },
    {
      icon: Tv,
      eyebrow: "Always",
      title: "A family channel for every pet you've loved.",
      body: "Add every pet, past and present, into one private family channel. Anniversary reminders. New tributes for new losses. A living archive of the animals who shaped your family — for $9.95 a month, or one-time forever.",
      detail: "Multi-pet. Multi-generation. Always there.",
    },
  ];
  return (
    <section style={{ padding: "160px 0", background: C.cream }}>
      <div style={sectionMaxStyle}>
        <motion.div
          style={{ maxWidth: 720, marginBottom: 80 }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
        >
          <Pill>What Peterna is</Pill>
          <h2
            style={{
              marginTop: 24,
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: "clamp(40px, 5.5vw, 80px)",
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: C.ink,
            }}
          >
            Three things, made with care.
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
            Most pet memorials are a slideshow on a hard drive. Peterna is something
            different. A real tribute, a real memorial, and a real place for the family
            you&rsquo;ve built together — pets included.
          </p>
        </motion.div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: C.line }}>
          {things.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
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
                  <t.icon size={20} color={C.goldDeep} aria-hidden="true" />
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
                    {t.eyebrow}
                  </div>
                </div>
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 400,
                    fontSize: "clamp(28px, 3.4vw, 48px)",
                    lineHeight: 1.15,
                    letterSpacing: "-0.005em",
                    color: C.ink,
                    margin: 0,
                  }}
                >
                  {t.title}
                </h3>
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
                  {t.body}
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
                  {t.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
        <div style={{ marginTop: 56, textAlign: "center" }}>
          <Link
            href="/how-it-works"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 500,
              color: C.ink,
              paddingBottom: 4,
              background: "none",
              border: "none",
              borderBottom: `1px solid ${C.ink}`,
              cursor: "pointer",
              fontFamily: FONT_SANS,
              textDecoration: "none",
            }}
          >
            See how a tribute is made →
          </Link>
        </div>
      </div>
      <style>{`@media (min-width: 1024px) { .peterna-three-row { grid-template-columns: 3fr 9fr !important; gap: 40px !important; } }`}</style>
    </section>
  );
}

function HomeSampleTribute() {
  return (
    <section
      style={{ padding: "160px 0", background: C.blush, position: "relative", overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(201,169,97,0.18), transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div style={{ ...sectionMaxStyle, position: "relative" }}>
        <motion.div
          style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 56px" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
        >
          <Pill>A tribute, not a slideshow</Pill>
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
            See what a Peterna tribute looks like.
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
            Real photos, gently restored. Stills brought to life. Cinematic pacing,
            curated music, and a quiet care that no automated slideshow can match.
          </p>
        </motion.div>
        <motion.div
          style={{ maxWidth: 960, margin: "0 auto" }}
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link
            href="/get-started"
            aria-label="Join the waitlist"
            style={{
              display: "block",
              position: "relative",
              aspectRatio: "16/9",
              borderRadius: 16,
              overflow: "hidden",
              background: C.ink,
              cursor: "pointer",
              boxShadow: "0 24px 80px -20px rgba(42,33,27,0.3)",
              textDecoration: "none",
            }}
          >
            {/* TODO: replace with Gemini-generated image — see prompt in artifact PageHome HomeSampleTribute (Charlie) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=1400&q=85"
              alt="A frame from a Peterna tribute film"
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
                  "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
              }}
              aria-hidden="true"
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <motion.div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "rgba(248,241,228,0.95)",
                  backdropFilter: "blur(4px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
                }}
                whileHover={{ scale: 1.08 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <Play size={28} color={C.ink} fill={C.ink} style={{ marginLeft: 4 }} />
              </motion.div>
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 32 }}>
              <div
                style={{
                  color: "rgba(248,241,228,0.9)",
                  fontFamily: FONT_DISPLAY,
                  fontStyle: "italic",
                  fontSize: "clamp(16px, 1.6vw, 22px)",
                }}
              >
                &ldquo;For Charlie. 2007 — 2024. The best dog we ever knew.&rdquo;
              </div>
            </div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function HomeProcess() {
  const steps = [
    {
      n: "01",
      icon: Upload,
      title: "Share what you have.",
      body: "Upload photos, short videos, voice memos, anything that tells the story. As few as five photos is enough. Family members can each add their own.",
    },
    {
      n: "02",
      icon: Sparkles,
      title: "We restore. We compose.",
      body: "Our AI gently restores faded photos, animates stills into living moments, and matches your tribute with curated, fully-licensed music.",
    },
    {
      n: "03",
      icon: Film,
      title: "A tribute, designed for 24-hour delivery.",
      body: "A human producer reviews every tribute before it ships. The result is broadcast-quality, cinematic, and ready to play at the memorial or share with family.",
    },
    {
      n: "04",
      icon: Share2,
      title: "A home for the memory.",
      body: "Your tribute lives on a permanent memorial page, with a QR code for the service and a private link for family. Add to your family channel for every pet you've loved.",
    },
  ];
  return (
    <section style={{ padding: "160px 0", background: C.cream }}>
      <div style={sectionMaxStyle}>
        <motion.div
          style={{ display: "grid", gridTemplateColumns: "1fr", gap: 40, marginBottom: 64 }}
          className="peterna-process-header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
        >
          <div>
            <Pill>How it works</Pill>
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
              Four steps. Designed for 24 hours.
            </h2>
          </div>
          <div>
            <p
              style={{
                fontSize: 18,
                lineHeight: 1.65,
                color: C.inkSoft,
                fontFamily: FONT_SANS,
                maxWidth: 480,
              }}
            >
              No software to learn. No editing skills required. From your first upload to a
              finished, beautifully composed tribute — most families have a film ready to
              watch by this time tomorrow.
            </p>
          </div>
        </motion.div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 1,
            background: C.line,
          }}
        >
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              style={{ padding: 40, background: C.cream }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 32,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: C.blush,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <s.icon size={16} color={C.goldDeep} aria-hidden="true" />
                </div>
                <span
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    color: C.goldDeep,
                    fontFamily: FONT_DISPLAY,
                    fontStyle: "italic",
                  }}
                >
                  Step {s.n}
                </span>
              </div>
              <h3
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 400,
                  fontSize: "clamp(22px, 2.4vw, 30px)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.005em",
                  color: C.ink,
                  margin: 0,
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  marginTop: 16,
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: C.inkSoft,
                  fontFamily: FONT_SANS,
                }}
              >
                {s.body}
              </p>
            </motion.div>
          ))}
        </div>
        <div style={{ marginTop: 64 }}>
          <QuietLine animated label="Designed for same-day delivery" />
        </div>
        <div style={{ marginTop: 40, textAlign: "center" }}>
          <Link
            href="/how-it-works"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 500,
              color: C.ink,
              paddingBottom: 4,
              background: "none",
              border: "none",
              borderBottom: `1px solid ${C.ink}`,
              cursor: "pointer",
              fontFamily: FONT_SANS,
              textDecoration: "none",
            }}
          >
            See the full process →
          </Link>
        </div>
      </div>
      <style>{`@media (min-width: 1024px) { .peterna-process-header { grid-template-columns: 6fr 6fr !important; } }`}</style>
    </section>
  );
}

function HomeFamilyChannelTease() {
  const pets = [
    { name: "Charlie", years: "2007 — 2024", role: "The good boy.", live: true },
    { name: "Mango", years: "2014 — 2023", role: "The sunlight tabby." },
    { name: "Pepper", years: "1998 — 2011", role: "The first family dog." },
    { name: "Toby", years: "1989 — 2003", role: "Mom's heart dog." },
  ];
  return (
    <section
      style={{
        padding: "160px 0",
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
            "radial-gradient(ellipse 70% 60% at 90% 0%, rgba(201,169,97,0.18), transparent 60%)",
        }}
        aria-hidden="true"
      />
      <div style={{ ...sectionMaxStyle, position: "relative" }}>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr", gap: 40, alignItems: "center" }}
          className="peterna-fc-grid"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
          >
            <Pill tone="gold">The Family Channel</Pill>
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
              Every pet. Every loss.{" "}
              <em style={{ color: C.gold }}>One family channel.</em>
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
              Most families have loved more than one pet. Peterna&rsquo;s Family Channel is
              a private space for every animal who&rsquo;s been part of your family — the
              cat from your twenties, the dog who raised your kids, the rabbit your daughter
              still talks about. Every tribute, every memorial, kept together. Anniversary
              reminders, gentle and never intrusive. Add new pets as the years go on.
            </p>
            <div
              style={{
                marginTop: 40,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 24,
              }}
            >
              <GoldBtn href="/family-channel">Learn about the Family Channel</GoldBtn>
              <div
                style={{
                  fontSize: 14,
                  color: "rgba(248,241,228,0.7)",
                  fontFamily: FONT_SANS,
                }}
              >
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 24, color: C.gold }}>
                  $9.95
                </span>
                <span style={{ marginLeft: 8 }}>a month · cancel anytime</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, delay: 0.1 }}
          >
            <div
              style={{
                background: "rgba(248,241,228,0.05)",
                borderRadius: 16,
                border: "1px solid rgba(248,241,228,0.1)",
                backdropFilter: "blur(4px)",
                padding: 32,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(201,169,97,0.8)",
                    fontFamily: FONT_SANS,
                  }}
                >
                  The Greene family channel
                </div>
              </div>

              {/* TODO: AVATAR PROMPTS — see artifact HomeFamilyChannelTease for Gemini prompts. Currently rendered as initial-letter monograms. */}
              {pets.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 0",
                    borderBottom: i < 3 ? "1px solid rgba(248,241,228,0.1)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "rgba(233,213,195,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: FONT_DISPLAY,
                          fontStyle: "italic",
                          color: "rgba(248,241,228,0.7)",
                          fontSize: 14,
                        }}
                      >
                        {p.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div
                        style={{
                          fontFamily: FONT_DISPLAY,
                          color: C.cream,
                          fontSize: 18,
                          lineHeight: 1.2,
                        }}
                      >
                        {p.name}{" "}
                        <span
                          style={{
                            color: "rgba(248,241,228,0.5)",
                            fontSize: 13,
                            fontFamily: FONT_SANS,
                            letterSpacing: "0.02em",
                          }}
                        >
                          {p.years}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(248,241,228,0.6)",
                          fontStyle: "italic",
                          fontFamily: FONT_DISPLAY,
                        }}
                      >
                        {p.role}
                      </div>
                    </div>
                  </div>
                  {p.live && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 10,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: C.gold,
                        fontFamily: FONT_SANS,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: C.gold,
                        }}
                      />
                      Anniv. soon
                    </div>
                  )}
                </div>
              ))}

              <div
                style={{
                  marginTop: 20,
                  paddingTop: 20,
                  borderTop: "1px solid rgba(248,241,228,0.1)",
                  fontSize: 12,
                  color: "rgba(248,241,228,0.6)",
                  fontStyle: "italic",
                  fontFamily: FONT_DISPLAY,
                }}
              >
                Every animal who shaped your family — gathered, remembered, kept.
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      <style>{`@media (min-width: 1024px) { .peterna-fc-grid { grid-template-columns: 7fr 5fr !important; gap: 64px !important; } }`}</style>
    </section>
  );
}

function HomeCarePromise() {
  const promises = [
    {
      t: "We will not auto-generate your tribute.",
      d: "Every Peterna film is reviewed by a human producer before it's delivered. AI does the heavy lifting; people make sure it's right.",
    },
    {
      t: "We will not use stock images you didn't approve.",
      d: "Only the photos you upload appear in your tribute. No clipart. No generic backdrops. No 'enhanced' faces that aren't really your pet.",
    },
    {
      t: "We will not cancel your memorial.",
      d: "Memorial pages we build for you are hosted permanently — even if you cancel a Family Channel subscription. The page is yours, kept.",
    },
    {
      t: "We will not sell your photos, memories, or grief.",
      d: "Your uploads are not used to train models. Not shared. Not licensed. Not sold. They belong to you and your family.",
    },
  ];
  return (
    <section style={{ padding: "160px 0", background: C.cream }}>
      <div style={sectionMaxStyle}>
        <motion.div
          style={{ display: "grid", gridTemplateColumns: "1fr", gap: 40, marginBottom: 56 }}
          className="peterna-care-header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
        >
          <div>
            <Pill>Our care promise</Pill>
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
              What Peterna will <em style={{ color: C.goldDeep }}>never</em> do.
            </h2>
          </div>
          <div>
            <p
              style={{
                fontSize: 18,
                lineHeight: 1.65,
                color: C.inkSoft,
                fontFamily: FONT_SANS,
                maxWidth: 480,
              }}
            >
              In a category where most products are slideshows wrapped in marketing, we want
              to be clear about the lines we won&rsquo;t cross. Trust isn&rsquo;t a feature.
              It&rsquo;s the whole product.
            </p>
          </div>
        </motion.div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: C.line }}>
          {promises.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.06 }}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 24,
                padding: "32px 8px",
                background: C.cream,
              }}
              className="peterna-promise-row"
            >
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: C.gold,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Check size={16} color={C.ink} strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 400,
                    fontSize: "clamp(22px, 2.4vw, 30px)",
                    lineHeight: 1.2,
                    color: C.ink,
                    margin: 0,
                  }}
                >
                  {p.t}
                </h3>
              </div>
              <div>
                <p
                  style={{
                    fontSize: 16,
                    lineHeight: 1.65,
                    color: C.inkSoft,
                    fontFamily: FONT_SANS,
                    margin: 0,
                  }}
                >
                  {p.d}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <style>{`@media (min-width: 1024px) {
        .peterna-care-header { grid-template-columns: 6fr 6fr !important; }
        .peterna-promise-row { grid-template-columns: 1fr 5fr 6fr !important; gap: 24px !important; }
      }`}</style>
    </section>
  );
}

function HomeForVetsTease() {
  return (
    <section style={{ padding: "160px 0", background: C.blush }}>
      <div style={sectionMaxStyle}>
        <motion.div
          style={{ display: "grid", gridTemplateColumns: "1fr", gap: 40, alignItems: "center" }}
          className="peterna-vets-grid"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <Stethoscope size={16} color={C.goldDeep} aria-hidden="true" />
              <Pill tone="gold">For Veterinarians & Pet ERs</Pill>
            </div>
            <h2
              style={{
                marginTop: 24,
                fontFamily: FONT_DISPLAY,
                fontWeight: 400,
                fontSize: "clamp(36px, 5.5vw, 72px)",
                lineHeight: 1.0,
                letterSpacing: "-0.01em",
                color: C.ink,
              }}
            >
              The aftercare your families deserve. The revenue your practice earned.
            </h2>
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
              Peterna lets veterinary clinics and pet ERs offer a beautiful remembrance
              experience to grieving families — without lifting a finger on production. You
              introduce. We deliver. Your practice earns referral revenue on every tribute
              and a share of every Family Channel subscription.
            </p>
            <div
              style={{
                marginTop: 40,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 24,
              }}
            >
              <GhostBtn href="/for-veterinarians">See partner economics</GhostBtn>
              <Link
                href="/for-veterinarians"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  color: C.ink,
                  paddingBottom: 4,
                  background: "none",
                  border: "none",
                  borderBottom: `1px solid ${C.ink}`,
                  cursor: "pointer",
                  fontFamily: FONT_SANS,
                  textDecoration: "none",
                }}
              >
                Become a partner →
              </Link>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, delay: 0.1 }}
          >
            <div
              style={{
                background: C.cream,
                borderRadius: 16,
                border: `1px solid ${C.line}`,
                padding: 32,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: C.goldDeep,
                  marginBottom: 20,
                  fontFamily: FONT_SANS,
                }}
              >
                Modeled partner economics · Pre-launch
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, color: C.inkSofter, fontFamily: FONT_SANS }}>
                    100 eligible cases / month
                  </div>
                  <div
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontSize: 36,
                      color: C.ink,
                      marginTop: 4,
                      lineHeight: 1,
                      fontWeight: 400,
                    }}
                  >
                    $36,000+
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: C.inkSofter,
                      marginTop: 4,
                      fontFamily: FONT_SANS,
                    }}
                  >
                    Modeled annual referral revenue · zero practice work
                  </div>
                </div>
                <div style={{ paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 13, color: C.inkSofter, fontFamily: FONT_SANS }}>
                    + Family Channel rev share
                  </div>
                  <div
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontSize: 24,
                      color: C.ink,
                      marginTop: 4,
                      lineHeight: 1,
                      fontWeight: 400,
                    }}
                  >
                    ~$2,500/yr
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: C.inkSofter,
                      marginTop: 4,
                      fontFamily: FONT_SANS,
                    }}
                  >
                    Modeled recurring, growing year over year
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
                <p
                  style={{
                    fontSize: 12,
                    fontStyle: "italic",
                    color: C.inkSofter,
                    fontFamily: FONT_DISPLAY,
                    margin: 0,
                  }}
                >
                  Illustrative modeling — actual results vary. See partner page for full
                  disclaimers.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
        <div style={{ marginTop: 80 }}>
          <QuietLine label="Two doors · One company" />
        </div>
      </div>
      <style>{`@media (min-width: 1024px) { .peterna-vets-grid { grid-template-columns: 7fr 5fr !important; gap: 64px !important; } }`}</style>
    </section>
  );
}

function HomeClosing() {
  return (
    <section
      style={{ padding: "160px 0", background: C.cream, position: "relative", overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 50% 70% at 50% 100%, rgba(201,169,97,0.12), transparent 70%)",
        }}
        aria-hidden="true"
      />
      <motion.div
        style={{ ...NARROW_MAX, textAlign: "center", position: "relative" }}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
      >
        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 400,
            fontSize: "clamp(40px, 6.5vw, 96px)",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            color: C.ink,
          }}
        >
          The story doesn&rsquo;t end. Let&rsquo;s tell it{" "}
          <em style={{ color: C.goldDeep }}>beautifully.</em>
        </h2>
        <p
          style={{
            marginTop: 32,
            fontSize: 18,
            lineHeight: 1.65,
            color: C.inkSoft,
            fontFamily: FONT_SANS,
          }}
        >
          A tribute, designed for 24-hour delivery. A memorial page, kept forever. A family
          channel for every animal you&rsquo;ve loved, and the ones still ahead. Launching
          soon.
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
        <p
          style={{
            marginTop: 40,
            fontSize: 14,
            fontStyle: "italic",
            color: C.inkSofter,
            fontFamily: FONT_DISPLAY,
          }}
        >
          From everyone at Peterna — when the moment comes, we&rsquo;ll take it from there.
        </p>
      </motion.div>
    </section>
  );
}

export default function PageHome() {
  return (
    <main>
      <HomeHero />
      <HomeThreeThings />
      <HomeSampleTribute />
      <HomeProcess />
      <HomeFamilyChannelTease />
      <HomeCarePromise />
      <HomeForVetsTease />
      <HomeClosing />
    </main>
  );
}
