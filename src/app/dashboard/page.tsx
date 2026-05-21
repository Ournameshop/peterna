import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import Pill from "@/components/Pill";
import { GoldBtn } from "@/components/Buttons";
import QuietLine from "@/components/QuietLine";
import { AUTH } from "@/lib/library/copy";
import type { AuthMeResponse, UserWire } from "@/lib/builder/wire-types";
import {
  C,
  FONT_DISPLAY,
  FONT_SANS,
  sectionMaxStyle,
} from "@/lib/peterna-tokens";

// Phase 10 — dashboard placeholder.
//
// Server Component. Auth gate is a single cookie check; if the auth_user
// cookie isn't present, we bounce to /signin. If it IS present, we hit
// /api/auth/me to read the canonical user record (the cookie alone isn't
// authoritative — a tampered cookie still won't pass /api/auth/me, and we'd
// rather render anonymous fallback than trust the client).
//
// The actual tribute-list rendering is Phase 11. This page is intentionally
// minimal but real: a header that reads the user's email + a primary CTA
// back into the builder.

export const metadata: Metadata = {
  title: "Your tributes — Peterna",
  description:
    "Every tribute you've made with Peterna, gathered in one place.",
};

const AUTH_COOKIE_NAME = "auth_user";

async function fetchCurrentUser(): Promise<UserWire | null> {
  // Build an absolute URL — Next 16 RSC fetches don't resolve relative paths.
  // Same pattern as src/app/builder/r/[token]/page.tsx.
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const protocol = hdrs.get("x-forwarded-proto") ?? "http";
  const base = `${protocol}://${host}`;

  // Forward the request cookies so /api/auth/me can read auth_user.
  const cookieHeader = hdrs.get("cookie") ?? "";

  try {
    const res = await fetch(`${base}/api/auth/me`, {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as AuthMeResponse | null;
    if (!json || json.ok !== true) return null;
    return json.user ?? null;
  } catch {
    return null;
  }
}

export default async function PageDashboard() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME);

  // Cheap gate first — no cookie, no auth, bounce immediately. This avoids
  // a wasted /api/auth/me round-trip for the very common unauthenticated
  // visitor case (e.g. someone landing here via a stale bookmark).
  if (!authCookie || !authCookie.value) {
    redirect("/signin");
  }

  // Cookie present — verify with the canonical source. If verification fails
  // (expired session, server cleared the row, etc.), still bounce to signin.
  const user = await fetchCurrentUser();
  if (!user) {
    redirect("/signin");
  }

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
          <div style={{ maxWidth: 760 }}>
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
              <em style={{ color: C.goldDeep }}>{AUTH.dashboard.headline_em}</em>
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

            {/* Phase 10 ships the auth gate + entry point only. The tribute
                list itself is Phase 11 — until then we render an empty-state
                that frames the page clearly and points back into the builder. */}
            <div
              style={{
                marginTop: 56,
                padding: "48px 32px",
                borderRadius: 16,
                background: "rgba(248,241,228,0.6)",
                border: `1px solid ${C.line}`,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 17,
                  lineHeight: 1.65,
                  color: C.inkSoft,
                  fontFamily: FONT_SANS,
                  maxWidth: 560,
                }}
              >
                {AUTH.dashboard.empty_body}
              </p>
              <div
                style={{
                  marginTop: 32,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 20,
                }}
              >
                <GoldBtn href="/builder">{AUTH.dashboard.build_cta}</GoldBtn>
                <Link
                  href="/family-channel"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    color: C.ink,
                    paddingBottom: 4,
                    borderBottom: `1px solid ${C.ink}`,
                    fontFamily: FONT_SANS,
                    textDecoration: "none",
                  }}
                >
                  Learn about the Family Channel →
                </Link>
              </div>
            </div>

            <div style={{ marginTop: 80 }}>
              <QuietLine label="Every pet · Every memory · Kept" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
