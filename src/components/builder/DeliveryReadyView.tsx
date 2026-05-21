"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { motion } from "framer-motion";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import { DELIVERY, substitutePetName } from "@/lib/library/copy";
import { completion } from "@/lib/builder/haptic";
import { DURATION, EASE } from "@/lib/builder/motion-tokens";
import NotificationOptIn from "./NotificationOptIn";

// Phase 9 — Final wizard stage. The screen the user lands on after the
// eulogy is locked. Responsibilities:
//
//   - Show "Your tribute for [PET_NAME] is ready" hero
//   - Show the share URL in a copy-to-clipboard field
//   - "View tribute" button that opens the public delivery page in a new tab
//   - Email-me-the-link form (non-blocking)
//   - Small grid of artifacts (character sheet thumbnail, storyboard
//     thumbnails, eulogy PDF download link)
//
// The wizard does NOT auto-advance from this screen. The user can stay here
// indefinitely — sending to multiple emails, copying the link multiple times,
// browsing the artifact grid — and only leaves by closing the tab or visiting
// the public delivery URL.

export type DeliveryArtifactItem = {
  /** Display label — "Character sheet", "Storyboard frame 3", etc. */
  label: string;
  /** Thumbnail URL — null for PDF / download-only artifacts. */
  thumbnailUrl: string | null;
  /** Click-through URL — opens in a new tab. PDF URLs go through
   *  rel="noopener noreferrer" so the browser's PDF viewer takes over. */
  href: string;
  /** Optional small caption under the label. */
  caption?: string;
  /** True if the artifact is downloadable (e.g. PDF, MP4). Surfaces a
   *  small "Download" badge on the card. */
  downloadable?: boolean;
};

type Props = {
  petName: string | null;
  /** Loading state while POST /api/delivery/finalize is in flight. */
  finalizing: boolean;
  /** The share URL — null until finalize returns. */
  shareUrl: string | null;
  /** Snapshot of artifacts to grid. */
  artifacts: ReadonlyArray<DeliveryArtifactItem>;
  /** The eulogy PDF URL — surfaced as a top-level "Download" CTA. */
  eulogyPdfUrl: string | null;
  /** Hook for email send. Returns a Promise that resolves on success and
   *  rejects on failure. Callers should also push success/failure into
   *  state for the announcement under the form. */
  onEmail: (email: string) => Promise<void>;
  /** Last-sent recipient — drives the "Sent to <addr>" confirmation line. */
  emailedTo: string | null;
  /** Session id — forwarded to the optional push opt-in offered when the user
   *  didn't subscribe earlier (Phase 12). Omit to skip the prompt. */
  sessionId?: string | null;
};

export default function DeliveryReadyView({
  petName,
  finalizing,
  shareUrl,
  artifacts,
  eulogyPdfUrl,
  onEmail,
  emailedTo,
  sessionId = null,
}: Props) {
  const headline = substitutePetName(DELIVERY.ready.headline, petName);
  const subhead = DELIVERY.ready.subhead;

  // Phase 13 — fire the completion haptic the first time the share URL
  // lands (the "your tribute is ready" moment). We guard with a ref so a
  // re-render after e.g. an email send doesn't re-vibrate.
  const hapticFiredRef = useRef(false);
  useEffect(() => {
    if (!finalizing && shareUrl && !hapticFiredRef.current) {
      hapticFiredRef.current = true;
      completion();
    }
  }, [finalizing, shareUrl]);

  if (finalizing || !shareUrl) {
    return <FinalizingPanel petName={petName} />;
  }

  return (
    <motion.section
      aria-label={`Final tribute for ${petName ?? "your pet"} — ready to share`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE.reveal }}
      style={pageWrap}
    >
      <header style={heroWrap}>
        <h2 style={heroHeadline}>{headline}</h2>
        <p style={heroSubhead}>{subhead}</p>
      </header>

      <ShareBlock shareUrl={shareUrl} />

      {eulogyPdfUrl ? (
        <div style={downloadRow}>
          <DownloadButton href={eulogyPdfUrl}>
            {DELIVERY.ready.download_eulogy}
          </DownloadButton>
        </div>
      ) : null}

      <EmailForm
        petName={petName}
        onSubmit={onEmail}
        emailedTo={emailedTo}
      />

      {/* Phase 12 — subtle second-chance push opt-in. The component self-gates
          on the localStorage flag + Notification.permission so users who said
          no (or yes) earlier never see it again. */}
      {sessionId ? (
        <NotificationOptIn
          petName={petName}
          sessionId={sessionId}
          tone="compact"
        />
      ) : null}

      {artifacts.length > 0 ? (
        <ArtifactsGrid
          petName={petName}
          items={artifacts}
        />
      ) : null}
    </motion.section>
  );
}

// -----------------------------------------------------------------------------
// Share URL + copy-to-clipboard
// -----------------------------------------------------------------------------

function ShareBlock({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const fallbackTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Clear any pending "copied" flag on unmount.
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Older-browser fallback: select-and-copy via a hidden textarea. We
        // own the textarea ref so we can `select()` synchronously inside a
        // user-gesture-driven handler (a requirement for execCommand-copy
        // in some older Safari builds).
        const ta = fallbackTextareaRef.current;
        if (ta) {
          ta.value = shareUrl;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          ta.focus();
          ta.select();
          document.execCommand?.("copy");
        }
      }
      setCopied(true);
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Surface a quiet visual; the user can still select-and-copy manually.
      setCopied(false);
    }
  }, [shareUrl]);

  return (
    <div style={shareBlockWrap}>
      <label htmlFor="delivery-share-url" style={shareLabel}>
        {DELIVERY.ready.share_label}
      </label>
      <div style={shareInputRow}>
        <input
          id="delivery-share-url"
          type="text"
          value={shareUrl}
          readOnly
          // Select-all-on-focus for users on browsers without clipboard
          // permissions — a quick keyboard shortcut path.
          onFocus={(e) => e.currentTarget.select()}
          style={shareInput}
          aria-label={DELIVERY.ready.share_label}
        />
        <motion.button
          type="button"
          onClick={handleCopy}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={copied ? copyButtonCopied : copyButton}
          aria-label="Copy share link to clipboard"
        >
          {copied ? DELIVERY.ready.copy_button_copied : DELIVERY.ready.copy_button}
        </motion.button>
        <motion.a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={viewButton}
        >
          {DELIVERY.ready.view_button}
        </motion.a>
      </div>
      <p style={shareHint}>{DELIVERY.ready.share_hint}</p>
      {/* Hidden fallback textarea for older-browser select-and-copy path. */}
      <textarea
        ref={fallbackTextareaRef}
        aria-hidden="true"
        tabIndex={-1}
        readOnly
        style={hiddenTextarea}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Email form
// -----------------------------------------------------------------------------

function EmailForm({
  petName,
  onSubmit,
  emailedTo,
}: {
  petName: string | null;
  onSubmit: (email: string) => Promise<void>;
  emailedTo: string | null;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local override for the success line — set after a successful submit
  // from this tab. Defaults to null so the `emailedTo` prop (sourced from
  // the session row on resume) is the canonical "Sent to <addr>" source.
  const [localSubmittedAddr, setLocalSubmittedAddr] = useState<string | null>(
    null,
  );

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) return;
      setSubmitting(true);
      setError(null);
      try {
        await onSubmit(trimmed);
        setLocalSubmittedAddr(trimmed);
        setValue("");
      } catch {
        setError(DELIVERY.ready.email_error);
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmit, value],
  );

  // The local submit wins (the user just sent to that address in this tab);
  // otherwise, fall back to the session-row recipient on resume.
  const announcedAddr = localSubmittedAddr ?? emailedTo;
  const successLine = announcedAddr
    ? DELIVERY.ready.email_success_template.replace("[EMAIL]", announcedAddr)
    : null;

  return (
    <form onSubmit={handleSubmit} style={emailFormWrap} noValidate>
      <label htmlFor="delivery-email" style={shareLabel}>
        {substitutePetName(DELIVERY.ready.email_label, petName)}
      </label>
      <div style={emailRow}>
        <input
          id="delivery-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={DELIVERY.ready.email_placeholder}
          style={emailInput}
          disabled={submitting}
          // `aria-describedby` ties the hint + status line to the input for
          // screen readers.
          aria-describedby="delivery-email-hint delivery-email-status"
          required
        />
        <motion.button
          type="submit"
          disabled={submitting || value.trim().length === 0}
          whileHover={!submitting ? { scale: 1.02 } : {}}
          whileTap={!submitting ? { scale: 0.98 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={
            submitting || value.trim().length === 0
              ? emailSubmitDisabled
              : emailSubmit
          }
        >
          {submitting ? DELIVERY.ready.email_submitting : DELIVERY.ready.email_submit}
        </motion.button>
      </div>
      <p id="delivery-email-hint" style={shareHint}>
        {DELIVERY.ready.email_hint}
      </p>
      <p
        id="delivery-email-status"
        role="status"
        aria-live="polite"
        style={successLine ? emailSuccess : emailErrorLine}
      >
        {error ?? successLine ?? ""}
      </p>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Artifacts grid
// -----------------------------------------------------------------------------

function ArtifactsGrid({
  petName,
  items,
}: {
  petName: string | null;
  items: ReadonlyArray<DeliveryArtifactItem>;
}) {
  return (
    <section aria-labelledby="delivery-artifacts-heading" style={artifactsWrap}>
      <h3 id="delivery-artifacts-heading" style={artifactsHeading}>
        {substitutePetName(DELIVERY.ready.artifacts_heading, petName)}
      </h3>
      <ul style={artifactsGrid}>
        {items.map((item, idx) => (
          <li key={`${item.label}-${idx}`} style={{ listStyle: "none" }}>
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              style={artifactCard}
              aria-label={`${item.label} — opens in new tab`}
            >
              <div style={artifactThumbWrap}>
                {item.thumbnailUrl ? (
                  // The grid is small (cards at ~140px wide) so a bare
                  // <img> is fine here; the URLs come from our R2 bucket.
                  // We use loading="lazy" so the grid doesn't bottleneck
                  // the rest of the page.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    style={artifactThumb}
                    loading="lazy"
                  />
                ) : (
                  <div aria-hidden="true" style={artifactPlaceholder}>
                    <span style={artifactPlaceholderLetter}>PDF</span>
                  </div>
                )}
                {item.downloadable ? (
                  <span style={artifactDownloadBadge}>Download</span>
                ) : null}
              </div>
              <p style={artifactLabel}>{item.label}</p>
              {item.caption ? (
                <p style={artifactCaption}>{item.caption}</p>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Loading state — finalize in flight
// -----------------------------------------------------------------------------

function FinalizingPanel({ petName }: { petName: string | null }) {
  const line = substitutePetName(DELIVERY.loading, petName);
  return (
    <div role="status" aria-live="polite" style={loadingWrap}>
      <div aria-hidden="true" style={spinnerStyle} />
      <p style={loadingHeadline}>{line}</p>
      <p style={loadingHint}>{DELIVERY.loading_hint}</p>
      <style>{`@keyframes peternaSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Inline download button helper
// -----------------------------------------------------------------------------

function DownloadButton({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      style={downloadButton}
    >
      {children}
    </motion.a>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const pageWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 36,
};

const heroWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: 8,
};

const heroHeadline: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 34,
  lineHeight: 1.25,
  color: C.ink,
  fontWeight: 400,
  letterSpacing: "-0.005em",
  maxWidth: 640,
};

const heroSubhead: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 14,
  color: C.inkSofter,
  lineHeight: 1.6,
  maxWidth: 560,
};

const shareBlockWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  background: "#FFFBF3",
  border: `1px solid ${C.line}`,
  borderRadius: 16,
  padding: "22px 22px 20px",
  maxWidth: 720,
  margin: "0 auto",
  width: "100%",
};

const shareLabel: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: C.inkSofter,
};

const shareInputRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
};

const shareInput: CSSProperties = {
  flex: "1 1 240px",
  minWidth: 0,
  fontFamily: FONT_SANS,
  fontSize: 14,
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${C.line}`,
  background: C.cream,
  color: C.ink,
};

const copyButton: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 13,
  fontWeight: 500,
  padding: "12px 18px",
  borderRadius: 999,
  background: C.ink,
  color: C.cream,
  border: "none",
  cursor: "pointer",
};

const copyButtonCopied: CSSProperties = {
  ...copyButton,
  background: C.sage,
};

const viewButton: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 13,
  fontWeight: 500,
  padding: "12px 18px",
  borderRadius: 999,
  background: "transparent",
  color: C.inkSoft,
  border: `1px solid ${C.line}`,
  textDecoration: "none",
  cursor: "pointer",
};

const shareHint: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: C.inkSofter,
  lineHeight: 1.55,
};

const hiddenTextarea: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const downloadRow: CSSProperties = {
  display: "flex",
  justifyContent: "center",
};

const downloadButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontFamily: FONT_SANS,
  fontSize: 13,
  fontWeight: 500,
  padding: "12px 22px",
  borderRadius: 999,
  background: C.gold,
  color: C.ink,
  border: "none",
  textDecoration: "none",
  cursor: "pointer",
  letterSpacing: "0.01em",
};

const emailFormWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  background: "#FFFBF3",
  border: `1px solid ${C.line}`,
  borderRadius: 16,
  padding: "22px 22px 20px",
  maxWidth: 720,
  margin: "0 auto",
  width: "100%",
};

const emailRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
};

const emailInput: CSSProperties = {
  flex: "1 1 240px",
  minWidth: 0,
  fontFamily: FONT_SANS,
  fontSize: 14,
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${C.line}`,
  background: C.cream,
  color: C.ink,
};

const emailSubmit: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 13,
  fontWeight: 500,
  padding: "12px 22px",
  borderRadius: 999,
  background: C.ink,
  color: C.cream,
  border: "none",
  cursor: "pointer",
};

const emailSubmitDisabled: CSSProperties = {
  ...emailSubmit,
  opacity: 0.55,
  cursor: "not-allowed",
};

const emailSuccess: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: C.sage,
  lineHeight: 1.55,
  minHeight: 18,
};

const emailErrorLine: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: "#a05a3c",
  lineHeight: 1.55,
  minHeight: 18,
};

const artifactsWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  maxWidth: 880,
  margin: "0 auto",
  width: "100%",
};

const artifactsHeading: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 22,
  lineHeight: 1.3,
  color: C.ink,
  fontWeight: 400,
  textAlign: "center",
};

const artifactsGrid: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 14,
};

const artifactCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: 8,
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  background: "transparent",
};

const artifactThumbWrap: CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: "1 / 1",
  borderRadius: 8,
  overflow: "hidden",
  background: "#FFFBF3",
  border: `1px solid ${C.line}`,
};

const artifactThumb: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const artifactPlaceholder: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: C.cream,
};

const artifactPlaceholderLetter: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 22,
  color: C.inkSofter,
};

const artifactDownloadBadge: CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  background: "rgba(42,33,27,0.85)",
  color: C.cream,
  fontFamily: FONT_SANS,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  padding: "3px 7px",
  borderRadius: 999,
};

const artifactLabel: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 12,
  fontWeight: 500,
  color: C.ink,
  textAlign: "center",
  lineHeight: 1.4,
};

const artifactCaption: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 11,
  color: C.inkSofter,
  textAlign: "center",
  lineHeight: 1.4,
};

const loadingWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 18,
  padding: "64px 16px",
  minHeight: 360,
};

const spinnerStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "2px solid rgba(0,0,0,0.08)",
  borderTopColor: C.goldDeep,
  animation: "peternaSpin 900ms linear infinite",
};

const loadingHeadline: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 26,
  lineHeight: 1.35,
  color: C.ink,
  textAlign: "center",
  maxWidth: 540,
};

const loadingHint: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 13,
  color: C.inkSofter,
  lineHeight: 1.6,
  textAlign: "center",
  maxWidth: 480,
};
