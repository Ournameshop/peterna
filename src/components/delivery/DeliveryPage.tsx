import { type CSSProperties } from "react";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import { DELIVERY, substitutePetName } from "@/lib/library/copy";
import type { DeliveryArtifactsWire } from "@/lib/builder/wire-types";
import StoryboardLightbox from "./StoryboardLightbox";

// Public /tribute/<slug> page.
//
// Read-only — no edit affordances, no wizard controls. The customer
// (and anyone they shared the link with) lands here to view + download
// what was made. Server-rendered for fast first paint + open-graph
// metadata; the storyboard grid is a small client component because
// the lightbox-on-click interaction needs state.
//
// Visual structure:
//   - Hero (Cormorant Garamond pet name, years label, subtitle)
//   - Final assembled video (controls, playsInline, preload="metadata")
//   - Memorial section:
//       - Character sheet rendered as a portrait
//       - Storyboard frame grid (clickable to enlarge)
//   - Eulogy section with prominent "Download the eulogy" CTA
//   - Footer: small Peterna mark + "Made with care for [PET_NAME]."
//
// Mobile: single-column stack; the video is 100% width with native aspect
// preserved by the browser. Desktop: max-width centered; portrait + frame
// grid sit side-by-side at ≥900px.
//
// No login wall. No tracking. No edit affordances. Anyone with the URL
// can view; the slug IS the auth.

type Props = {
  artifacts: DeliveryArtifactsWire;
};

export default function DeliveryPage({ artifacts }: Props) {
  const petName = artifacts.pet_name;
  const subtitle =
    artifacts.opening_title_card_text?.trim() ||
    DELIVERY.public.subtitle_default;
  const closing = artifacts.closing_card_text?.trim() ?? null;
  const footer = substitutePetName(DELIVERY.public.footer_template, petName);

  return (
    <article style={pageWrap} aria-label={`Tribute for ${petName}`}>
      <Hero
        petName={petName}
        yearsLabel={artifacts.years_label}
        subtitle={subtitle}
      />

      {artifacts.assembled_video_url ? (
        <section aria-label="Final tribute video" style={videoSection}>
          <div style={videoFrame}>
            {/*
              Native controls + playsInline so mobile Safari doesn't
              full-screen on play. preload="metadata" gets us a poster
              without spending bandwidth fetching the whole MP4.
            */}
            <video
              src={artifacts.assembled_video_url}
              controls
              playsInline
              preload="metadata"
              style={videoEl}
              aria-label={`Final tribute for ${petName}`}
            />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="memorial-heading" style={memorialSection}>
        <h2 id="memorial-heading" style={sectionHeading}>
          {DELIVERY.public.memorial_heading}
        </h2>

        <div style={memorialRow}>
          {artifacts.character_sheet_url ? (
            <div style={portraitWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={artifacts.character_sheet_url}
                alt={`Character sheet for ${petName}`}
                style={portraitImg}
              />
            </div>
          ) : null}

          {artifacts.storyboard_frame_urls.length > 0 ? (
            <div style={storyboardWrap}>
              <h3 style={subsectionHeading}>
                {DELIVERY.public.storyboard_heading}
              </h3>
              <StoryboardLightbox
                petName={petName}
                frameUrls={artifacts.storyboard_frame_urls}
              />
            </div>
          ) : null}
        </div>

        {closing ? <p style={closingLine}>&ldquo;{closing}&rdquo;</p> : null}
      </section>

      {artifacts.eulogy_pdf_url ? (
        <section aria-labelledby="eulogy-heading" style={eulogySection}>
          <h2 id="eulogy-heading" style={sectionHeading}>
            {DELIVERY.public.eulogy_heading}
          </h2>
          <p style={eulogyBody}>
            A one-page letter to keep — printable, framable.
          </p>
          <a
            href={artifacts.eulogy_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            style={downloadButton}
          >
            {DELIVERY.public.download_eulogy}
          </a>
        </section>
      ) : null}

      <footer style={footerWrap}>
        <span style={peternaMark} aria-hidden="true">
          Peterna
        </span>
        <p style={footerLine}>{footer}</p>
      </footer>
    </article>
  );
}

// -----------------------------------------------------------------------------
// Hero
// -----------------------------------------------------------------------------

function Hero({
  petName,
  yearsLabel,
  subtitle,
}: {
  petName: string;
  yearsLabel: string | null;
  subtitle: string;
}) {
  return (
    <header style={heroSection}>
      <h1 style={heroName}>{petName}</h1>
      {yearsLabel ? <p style={heroYears}>{yearsLabel}</p> : null}
      <p style={heroSubtitle}>{subtitle}</p>
    </header>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const pageWrap: CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: "56px 24px 80px",
  display: "flex",
  flexDirection: "column",
  gap: 48,
  background: C.cream,
  color: C.ink,
};

const heroSection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: 8,
};

const heroName: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 64,
  lineHeight: 1.05,
  color: C.ink,
  fontWeight: 400,
  letterSpacing: "-0.01em",
};

const heroYears: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 14,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: C.inkSofter,
};

const heroSubtitle: CSSProperties = {
  margin: "10px 0 0",
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 22,
  lineHeight: 1.4,
  color: C.inkSoft,
  fontWeight: 400,
  maxWidth: 640,
};

const videoSection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const videoFrame: CSSProperties = {
  width: "100%",
  maxWidth: 880,
  borderRadius: 14,
  overflow: "hidden",
  background: "#0F0E0C",
  border: `1px solid ${C.line}`,
};

const videoEl: CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
  background: "#0F0E0C",
};

const memorialSection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const sectionHeading: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 30,
  lineHeight: 1.25,
  color: C.ink,
  fontWeight: 400,
  textAlign: "center",
};

const subsectionHeading: CSSProperties = {
  margin: "0 0 12px",
  fontFamily: FONT_SANS,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: C.inkSofter,
};

const memorialRow: CSSProperties = {
  display: "grid",
  // Mobile: single column. Desktop (>=900px): portrait on the left, grid on
  // the right. We use `auto-fit minmax` so the layout adapts without an
  // explicit media query.
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 28,
  alignItems: "start",
};

const portraitWrap: CSSProperties = {
  width: "100%",
  borderRadius: 14,
  overflow: "hidden",
  border: `1px solid ${C.line}`,
  background: "#FFFBF3",
};

const portraitImg: CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
  objectFit: "cover",
};

const storyboardWrap: CSSProperties = {
  width: "100%",
};

const closingLine: CSSProperties = {
  margin: "24px auto 0",
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 22,
  lineHeight: 1.4,
  color: C.inkSoft,
  textAlign: "center",
  maxWidth: 640,
};

const eulogySection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
  padding: "40px 24px",
  background: "#FFFBF3",
  border: `1px solid ${C.line}`,
  borderRadius: 18,
};

const eulogyBody: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 14,
  color: C.inkSofter,
  lineHeight: 1.55,
  textAlign: "center",
};

const downloadButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  marginTop: 6,
  padding: "14px 28px",
  borderRadius: 999,
  fontFamily: FONT_SANS,
  fontSize: 14,
  fontWeight: 500,
  background: C.ink,
  color: C.cream,
  textDecoration: "none",
  letterSpacing: "0.01em",
};

const footerWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  marginTop: 18,
  paddingTop: 28,
  borderTop: `1px solid ${C.line}`,
};

const peternaMark: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 18,
  color: C.gold,
  letterSpacing: "0.04em",
};

const footerLine: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: C.inkSofter,
  letterSpacing: "0.02em",
};
