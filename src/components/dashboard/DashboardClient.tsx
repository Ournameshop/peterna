"use client";

import { useCallback, useEffect, useState } from "react";
import Pill from "@/components/Pill";
import { GoldBtn } from "@/components/Buttons";
import QuietLine from "@/components/QuietLine";
import TributeCard from "@/components/dashboard/TributeCard";
import { AUTH } from "@/lib/library/copy";
import type {
  DashboardListResponse,
  TributeClaimResponse,
  TributeListItem,
  UserWire,
} from "@/lib/builder/wire-types";
import {
  C,
  FONT_DISPLAY,
  FONT_SANS,
  sectionMaxStyle,
} from "@/lib/peterna-tokens";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; tributes: TributeListItem[] };

/**
 * DashboardClient
 *
 * On mount:
 *   1. POST /api/dashboard/tributes/claim — attaches any in-progress anonymous
 *      session to the signed-in user. Silent; we don't care if there's nothing
 *      to claim. We await it before fetching the list so newly-claimed
 *      tributes show up on the first render.
 *   2. GET /api/dashboard/tributes — fetches the canonical list.
 *
 * State changes after mount (rename / delete) are reflected locally without
 * a refetch — the response shapes are designed for that (rename returns the
 * updated TributeListItem; delete returns ok/error only).
 */
export default function DashboardClient({ user }: { user: UserWire }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const loadTributes = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/dashboard/tributes", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      if (!res.ok) {
        // 401 -> server has invalidated the session between page-render and
        // this fetch. Treat as empty + leave the page; the next nav will
        // bounce through the server gate.
        setState({
          status: "error",
          message:
            "We couldn't load your tributes just now. Refresh in a moment and we'll try again.",
        });
        return;
      }
      const json = (await res.json().catch(() => null)) as
        | DashboardListResponse
        | null;
      if (!json || json.ok !== true) {
        setState({
          status: "error",
          message:
            "We couldn't load your tributes just now. Refresh in a moment and we'll try again.",
        });
        return;
      }
      setState({ status: "ready", tributes: json.tributes });
    } catch (e) {
      // AbortError happens on unmount — ignore it.
      if ((e as Error).name === "AbortError") return;
      setState({
        status: "error",
        message:
          "We couldn't load your tributes just now. Refresh in a moment and we'll try again.",
      });
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      // Silent claim — best-effort. We don't show a spinner or surface
      // failure; if there's nothing to claim the backend just returns
      // ok=false with 'nothing-to-claim' and we move on.
      try {
        await fetch("/api/dashboard/tributes/claim", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          signal: ac.signal,
        })
          .then((r) => r.json().catch(() => null))
          .then((_json: TributeClaimResponse | null) => _json);
      } catch {
        // Swallow — claim is opportunistic.
      }
      await loadTributes(ac.signal);
    })();
    return () => ac.abort();
  }, [loadTributes]);

  /** Local state mutation — rename swaps a card without a refetch. */
  const handleRenamed = useCallback((updated: TributeListItem) => {
    setState((prev) => {
      if (prev.status !== "ready") return prev;
      return {
        status: "ready",
        tributes: prev.tributes.map((t) =>
          t.session_id === updated.session_id ? updated : t,
        ),
      };
    });
  }, []);

  /** Local state mutation — delete removes the card. */
  const handleDeleted = useCallback((sessionId: string) => {
    setState((prev) => {
      if (prev.status !== "ready") return prev;
      return {
        status: "ready",
        tributes: prev.tributes.filter((t) => t.session_id !== sessionId),
      };
    });
  }, []);

  return (
    <main>
      <section
        style={{
          padding: "112px 0 160px",
          background: C.cream,
          position: "relative",
          overflow: "hidden",
          minHeight: "70vh",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 70% 60% at 80% -10%, rgba(201,169,97,0.13), transparent 60%)",
          }}
          aria-hidden="true"
        />
        <div style={{ ...sectionMaxStyle, position: "relative" }}>
          <Header user={user} />

          <div style={{ marginTop: 56 }}>
            {state.status === "loading" ? (
              <LoadingState />
            ) : state.status === "error" ? (
              <ErrorState message={state.message} />
            ) : state.tributes.length === 0 ? (
              <EmptyState />
            ) : (
              <TributeGrid
                tributes={state.tributes}
                onRenamed={handleRenamed}
                onDeleted={handleDeleted}
              />
            )}
          </div>

          <div style={{ marginTop: 96 }}>
            <QuietLine label="Every pet · Every memory · Kept" />
          </div>
        </div>
      </section>
    </main>
  );
}

function Header({ user }: { user: UserWire }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 24,
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}
    >
      <div style={{ maxWidth: 720 }}>
        <Pill tone="gold">{AUTH.dashboard.eyebrow}</Pill>
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
          {AUTH.dashboard.headline_lead}{" "}
          <em style={{ color: C.goldDeep }}>
            {AUTH.dashboard.headline_em}
          </em>
        </h1>
        <p
          style={{
            marginTop: 16,
            fontSize: 14,
            color: C.inkSofter,
            fontFamily: FONT_SANS,
            letterSpacing: "0.04em",
          }}
        >
          Signed in as{" "}
          <span style={{ color: C.ink }}>{user.email}</span>
        </p>
      </div>
      <div style={{ flexShrink: 0 }}>
        <GoldBtn href="/builder">{AUTH.dashboard.build_cta}</GoldBtn>
      </div>
    </div>
  );
}

function TributeGrid({
  tributes,
  onRenamed,
  onDeleted,
}: {
  tributes: TributeListItem[];
  onRenamed: (t: TributeListItem) => void;
  onDeleted: (sessionId: string) => void;
}) {
  return (
    <div className="peterna-dashboard-grid">
      {tributes.map((t) => (
        <TributeCard
          key={t.session_id}
          tribute={t}
          onRenamed={onRenamed}
          onDeleted={onDeleted}
        />
      ))}
      <style>{`
        .peterna-dashboard-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }
        @media (min-width: 720px) {
          .peterna-dashboard-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1100px) {
          .peterna-dashboard-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}

function LoadingState() {
  // Soft skeletons mirroring the card grid — three placeholders so the layout
  // doesn't pop when content arrives.
  return (
    <div className="peterna-dashboard-grid" aria-busy="true" aria-live="polite">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: "rgba(248,241,228,0.6)",
            border: `1px solid ${C.line}`,
            borderRadius: 16,
            overflow: "hidden",
            minHeight: 320,
          }}
        >
          <div
            style={{
              aspectRatio: "4 / 3",
              background:
                "linear-gradient(135deg, rgba(229,219,201,0.4), rgba(229,219,201,0.1))",
            }}
          />
          <div style={{ padding: 24 }}>
            <div
              style={{
                width: "60%",
                height: 18,
                borderRadius: 6,
                background: "rgba(229,219,201,0.6)",
              }}
            />
            <div
              style={{
                marginTop: 12,
                width: "40%",
                height: 12,
                borderRadius: 6,
                background: "rgba(229,219,201,0.4)",
              }}
            />
          </div>
        </div>
      ))}
      <style>{`
        .peterna-dashboard-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }
        @media (min-width: 720px) {
          .peterna-dashboard-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1100px) {
          .peterna-dashboard-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        padding: "32px 28px",
        borderRadius: 16,
        border: `1px solid ${C.line}`,
        background: "rgba(248,241,228,0.6)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: FONT_SANS,
          fontSize: 15,
          color: C.inkSoft,
          lineHeight: 1.6,
        }}
      >
        {message}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "72px 32px",
        borderRadius: 20,
        background: "rgba(248,241,228,0.55)",
        border: `1px solid ${C.line}`,
        textAlign: "center",
      }}
    >
      <p
        style={{
          margin: "0 auto",
          maxWidth: 520,
          fontSize: 19,
          lineHeight: 1.55,
          color: C.inkSoft,
          fontFamily: FONT_DISPLAY,
          fontStyle: "italic",
        }}
      >
        You haven&apos;t built a tribute yet. When you&apos;re ready,
        we&apos;ll be here.
      </p>
      <div
        style={{
          marginTop: 32,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <GoldBtn href="/builder">Build a tribute</GoldBtn>
      </div>
    </div>
  );
}
