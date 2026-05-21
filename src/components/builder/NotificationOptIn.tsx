"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { motion } from "framer-motion";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import { NOTIFICATIONS, substitutePetName } from "@/lib/library/copy";
import {
  enablePushNotifications,
  getPermissionState,
  isPushSupported,
  PUSH_ASKED_FLAG,
} from "@/lib/push/client";

// Phase 12 — Web Push opt-in prompt.
//
// Rendered at the top of VideoRenderProgress when:
//   - Push API is available (else iOS Safari / older browsers → silent skip)
//   - Permission state is 'default' (never asked, or browser-dismissed)
//   - This browser hasn't been asked in this localStorage session
//
// One-shot. On Yes: register SW → permission → subscribe → POST. On No: write
// the localStorage flag and disappear. Both outcomes also flip the flag so we
// don't pester on reload.
//
// All side effects are client-only. The component is `null` on the server.

type Tone = "default" | "compact";

type Props = {
  petName: string | null;
  /** Session id is forwarded to the backend so an anonymous subscription
   *  can be scoped before any auth_user is attached. */
  sessionId: string | null;
  /** "compact" surface (used inside DeliveryReadyView) trims padding and
   *  re-uses the delivery_prompt copy. Default uses the larger render-time copy. */
  tone?: Tone;
};

type LocalState =
  | { kind: "hidden" }       // not supported, already answered, or already granted
  | { kind: "prompt" }       // ready to ask
  | { kind: "working" }      // subscribe in flight
  | { kind: "granted" }      // success — keep the success line visible briefly
  | { kind: "denied" }       // user clicked No, or browser said no
  | { kind: "unsupported" }; // iOS Safari w/o PWA, no Push API

export default function NotificationOptIn({
  petName,
  sessionId,
  tone = "default",
}: Props) {
  const [state, setState] = useState<LocalState>({ kind: "hidden" });

  // Decide what to show on mount. Effect (not useMemo) because we read
  // localStorage + Notification.permission.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isPushSupported()) {
      setState({ kind: "unsupported" });
      return;
    }
    const perm = getPermissionState();
    if (perm === "granted") {
      // Already subscribed in a previous session — stay quiet.
      setState({ kind: "hidden" });
      return;
    }
    if (perm === "denied") {
      // Permission is sticky — never re-prompt.
      setState({ kind: "hidden" });
      return;
    }
    // perm === 'default' — gate on the localStorage flag so we don't ask twice.
    try {
      const asked = window.localStorage.getItem(PUSH_ASKED_FLAG);
      if (asked) {
        setState({ kind: "hidden" });
        return;
      }
    } catch {
      // localStorage can throw in private mode — fall through and show the prompt.
    }
    setState({ kind: "prompt" });
  }, []);

  const markAsked = useCallback(() => {
    try {
      window.localStorage.setItem(PUSH_ASKED_FLAG, String(Date.now()));
    } catch {
      // private mode — ignore
    }
  }, []);

  const onAccept = useCallback(async () => {
    setState({ kind: "working" });
    try {
      const result = await enablePushNotifications(sessionId);
      markAsked();
      if (result === "granted") {
        setState({ kind: "granted" });
      } else {
        setState({ kind: "denied" });
      }
    } catch {
      markAsked();
      setState({ kind: "denied" });
    }
  }, [markAsked, sessionId]);

  const onDecline = useCallback(() => {
    markAsked();
    setState({ kind: "hidden" });
  }, [markAsked]);

  const copy = useMemo(() => {
    const useDeliveryCopy = tone === "compact";
    const headline = useDeliveryCopy
      ? NOTIFICATIONS.delivery_prompt.headline
      : substitutePetName(NOTIFICATIONS.prompt.headline_template, petName);
    const body = useDeliveryCopy
      ? NOTIFICATIONS.delivery_prompt.body
      : NOTIFICATIONS.prompt.body;
    const accept = useDeliveryCopy
      ? NOTIFICATIONS.delivery_prompt.accept
      : NOTIFICATIONS.prompt.accept;
    const decline = useDeliveryCopy
      ? NOTIFICATIONS.delivery_prompt.decline
      : NOTIFICATIONS.prompt.decline;
    return { headline, body, accept, decline };
  }, [petName, tone]);

  if (state.kind === "hidden") return null;

  // Quiet fallback line — never show a pill, never block.
  if (state.kind === "unsupported") {
    return (
      <aside style={wrapStyle(tone)} aria-live="polite">
        <p style={lineStyle}>{NOTIFICATIONS.unsupported.body}</p>
      </aside>
    );
  }

  if (state.kind === "granted") {
    const successLine = substitutePetName(
      NOTIFICATIONS.success.headline_template,
      petName,
    );
    return (
      <aside style={wrapStyle(tone)} aria-live="polite" role="status">
        <p style={successHeadlineStyle}>{successLine}</p>
        <p style={lineStyle}>{NOTIFICATIONS.success.body}</p>
      </aside>
    );
  }

  if (state.kind === "denied") {
    return (
      <aside style={wrapStyle(tone)} aria-live="polite">
        <p style={lineStyle}>{NOTIFICATIONS.denied.body}</p>
      </aside>
    );
  }

  // 'prompt' | 'working'
  const isWorking = state.kind === "working";
  return (
    <aside style={wrapStyle(tone)} aria-label="Browser notification opt-in">
      <p style={headlineStyle(tone)}>{copy.headline}</p>
      <p style={lineStyle}>{copy.body}</p>
      <div style={pillRow}>
        <motion.button
          type="button"
          onClick={() => {
            void onAccept();
          }}
          disabled={isWorking}
          whileHover={!isWorking ? { scale: 1.02 } : undefined}
          whileTap={!isWorking ? { scale: 0.98 } : undefined}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={primaryPill(isWorking)}
        >
          {isWorking ? "One moment…" : copy.accept}
        </motion.button>
        <motion.button
          type="button"
          onClick={onDecline}
          disabled={isWorking}
          whileHover={!isWorking ? { scale: 1.02 } : undefined}
          whileTap={!isWorking ? { scale: 0.98 } : undefined}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={secondaryPill(isWorking)}
        >
          {copy.decline}
        </motion.button>
      </div>
    </aside>
  );
}

// -----------------------------------------------------------------------------
// Styles — inline + tokens. Matches the calm prompt aesthetic used elsewhere.
// -----------------------------------------------------------------------------

function wrapStyle(tone: Tone): CSSProperties {
  const compact = tone === "compact";
  return {
    display: "flex",
    flexDirection: "column",
    gap: compact ? 6 : 8,
    width: "100%",
    maxWidth: 620,
    marginLeft: "auto",
    marginRight: "auto",
    padding: compact ? "12px 16px" : "16px 18px",
    background: "#FFFBF3",
    border: `1px solid ${C.line}`,
    borderRadius: 14,
    textAlign: "center",
  };
}

function headlineStyle(tone: Tone): CSSProperties {
  return {
    margin: 0,
    fontFamily: FONT_DISPLAY,
    fontStyle: "italic",
    fontSize: tone === "compact" ? 16 : 18,
    lineHeight: 1.35,
    color: C.ink,
    fontWeight: 400,
    letterSpacing: "-0.005em",
  };
}

const successHeadlineStyle: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 16,
  lineHeight: 1.35,
  color: C.ink,
  fontWeight: 400,
};

const lineStyle: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 13,
  color: C.inkSofter,
  lineHeight: 1.55,
};

const pillRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 8,
  marginTop: 4,
};

function primaryPill(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 16px",
    borderRadius: 999,
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: 500,
    border: "none",
    background: C.ink,
    color: C.cream,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    letterSpacing: "0.01em",
  };
}

function secondaryPill(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 16px",
    borderRadius: 999,
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: 500,
    border: `1px solid ${C.line}`,
    background: "transparent",
    color: C.inkSoft,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    letterSpacing: "0.01em",
  };
}
