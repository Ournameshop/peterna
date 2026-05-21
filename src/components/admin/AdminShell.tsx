import Link from "next/link";
import type { ReactNode } from "react";

import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import type { UserWire } from "@/lib/builder/wire-types";

// Phase 14 — admin page chrome.
//
// Server component. Renders a top bar with:
//   - "Peterna · Admin" wordmark
//   - tabs: Overview / Sessions / Users / Renders (each is a Next <Link>)
//   - signed-in-as email on the right
// Then a cream page body with the section maxWidth applied.
//
// Inline-styled. Active tab is detected by passing the canonical key from
// each page (no usePathname so this stays a server component).

export type AdminTabKey = "overview" | "sessions" | "users" | "renders";

const TABS: ReadonlyArray<{ key: AdminTabKey; label: string; href: string }> = [
  { key: "overview", label: "Overview", href: "/admin" },
  { key: "sessions", label: "Sessions", href: "/admin/sessions" },
  { key: "users", label: "Users", href: "/admin/users" },
  { key: "renders", label: "Renders", href: "/admin/renders" },
];

type Props = {
  active: AdminTabKey;
  user: UserWire;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export default function AdminShell({
  active,
  user,
  title,
  subtitle,
  actions,
  children,
}: Props) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.cream,
        fontFamily: FONT_SANS,
        color: C.ink,
      }}
    >
      <TopBar active={active} user={user} />
      <main
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "40px 40px 96px",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 24,
            flexWrap: "wrap",
            marginBottom: 40,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: FONT_DISPLAY,
                fontWeight: 400,
                fontSize: "clamp(32px, 4vw, 48px)",
                lineHeight: 1.05,
                letterSpacing: "-0.015em",
                color: C.ink,
              }}
            >
              {title}
            </h1>
            {subtitle ? (
              <p
                style={{
                  marginTop: 8,
                  marginBottom: 0,
                  fontSize: 14,
                  color: C.inkSofter,
                  letterSpacing: "0.02em",
                }}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </header>
        {children}
      </main>
    </div>
  );
}

function TopBar({ active, user }: { active: AdminTabKey; user: UserWire }) {
  return (
    <div
      style={{
        borderBottom: `1px solid ${C.line}`,
        background: "rgba(248,241,228,0.85)",
        backdropFilter: "blur(8px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "16px 40px",
          display: "flex",
          alignItems: "center",
          gap: 32,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/admin"
          style={{
            textDecoration: "none",
            color: C.ink,
            fontFamily: FONT_DISPLAY,
            fontSize: 20,
            letterSpacing: "-0.01em",
          }}
        >
          Peterna <span style={{ color: C.goldDeep }}>·</span>{" "}
          <span style={{ color: C.inkSofter, fontSize: 14, letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: FONT_SANS }}>
            Admin
          </span>
        </Link>
        <nav
          aria-label="Admin sections"
          style={{
            display: "flex",
            gap: 4,
            flex: 1,
            minWidth: 320,
          }}
        >
          {TABS.map((tab) => {
            const isActive = tab.key === active;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontFamily: FONT_SANS,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  color: isActive ? C.ink : C.inkSofter,
                  background: isActive ? "rgba(143,166,142,0.18)" : "transparent",
                  border: `1px solid ${isActive ? "rgba(143,166,142,0.35)" : "transparent"}`,
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <div
          style={{
            fontSize: 12,
            color: C.inkSofter,
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
          }}
        >
          Signed in as{" "}
          <span style={{ color: C.ink }}>{user.email}</span>
        </div>
      </div>
    </div>
  );
}
