"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Menu, X } from "lucide-react";
import { C, FONT_DISPLAY, FONT_SANS, sectionMaxStyle } from "@/lib/peterna-tokens";
import type { AuthMeResponse, AuthSignoutResponse, UserWire } from "@/lib/builder/wire-types";
import { AUTH } from "@/lib/library/copy";
import { GoldBtn } from "./Buttons";

const NAV_ITEMS = [
  { route: "/how-it-works", label: "How it works" },
  { route: "/pricing", label: "Pricing" },
  { route: "/family-channel", label: "Family Channel" },
  { route: "/gallery", label: "Examples" },
  { route: "/for-veterinarians", label: "For Veterinarians" },
];

/** Truncate an email address for the desktop nav chip. Keeps the local part
 * tight so the nav doesn't shift width on long emails. */
function truncateEmail(email: string, max = 22): string {
  if (email.length <= max) return email;
  const at = email.indexOf("@");
  if (at <= 0) return email.slice(0, max - 1) + "…";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  // Reserve at least 6 chars of domain so it stays recognizable.
  const localBudget = Math.max(3, max - domain.length - 1);
  if (local.length <= localBudget) return email;
  return `${local.slice(0, localBudget)}…${domain}`;
}

/** Result of the `/api/auth/me` probe. `loading` is the initial state so we
 * don't flash "Sign in" before we know the truth. */
type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "signed_in"; user: UserWire };

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // Probe /api/auth/me on mount. AbortController guards against a stale
  // response if the component unmounts before the fetch resolves.
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "same-origin",
          signal: ac.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          setAuth({ status: "anonymous" });
          return;
        }
        const json = (await res.json().catch(() => null)) as AuthMeResponse | null;
        if (!json || json.ok !== true) {
          setAuth({ status: "anonymous" });
          return;
        }
        if (json.user) {
          setAuth({ status: "signed_in", user: json.user });
        } else {
          setAuth({ status: "anonymous" });
        }
      } catch {
        // Network error or aborted — treat as anonymous; the page still
        // renders, the user can still build, sign-in stays an option.
        if (!ac.signal.aborted) setAuth({ status: "anonymous" });
      }
    })();
    return () => ac.abort();
  }, [pathname]);

  // Close the user-menu popover on outside click or escape.
  useEffect(() => {
    if (!userMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  const handleSignout = async () => {
    setUserMenuOpen(false);
    try {
      const res = await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "same-origin",
      });
      // Treat any response as success from the UI's POV; the cookie should
      // be cleared either way.
      await res.json().catch(() => null as AuthSignoutResponse | null);
    } catch {
      // Ignore — we'll flip to anonymous regardless.
    }
    setAuth({ status: "anonymous" });
    router.refresh();
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(248,241,228,0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <div
        style={{
          ...sectionMaxStyle,
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          aria-label="Peterna home"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            textDecoration: "none",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ width: 24, height: 2, background: C.gold, borderRadius: 999 }} />
            <div style={{ width: 20, height: 2, background: C.gold, borderRadius: 999 }} />
            <div style={{ width: 12, height: 2, background: C.gold, borderRadius: 999 }} />
          </div>
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 24,
              lineHeight: 1,
              letterSpacing: "-0.01em",
              color: C.ink,
              fontWeight: 400,
            }}
          >
            Peterna
          </span>
        </Link>

        <nav
          className="peterna-nav-desktop"
          style={{ display: "none", alignItems: "center", gap: 32 }}
        >
          {NAV_ITEMS.map((it) => (
            <Link
              key={it.route}
              href={it.route}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                color: pathname === it.route ? C.goldDeep : C.ink,
                fontFamily: FONT_SANS,
                padding: "4px 6px",
                textDecoration: "none",
              }}
            >
              {it.label}
            </Link>
          ))}
          {/* "Build" link — sits to the right of the marketing links, before
              auth controls. Phase 10 entry point into the actual product. */}
          <Link
            href="/builder"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
              color: pathname?.startsWith("/builder") ? C.goldDeep : C.ink,
              fontFamily: FONT_SANS,
              padding: "4px 6px",
              textDecoration: "none",
            }}
          >
            {AUTH.nav.build_link}
          </Link>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Desktop auth area — Sign in (anonymous) or email + chevron menu
              (signed in). Hidden on mobile; mobile uses the drawer below. */}
          <div className="peterna-auth-desktop" style={{ display: "none", alignItems: "center", gap: 16 }}>
            {auth.status === "signed_in" ? (
              <div ref={userMenuRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label={`Account menu for ${auth.user.email}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: FONT_SANS,
                    fontSize: 13,
                    color: C.ink,
                    padding: "6px 8px",
                  }}
                >
                  <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {truncateEmail(auth.user.email)}
                  </span>
                  <ChevronDown
                    size={14}
                    style={{
                      transition: "transform 0.18s ease",
                      transform: userMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </button>
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      role="menu"
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
                        minWidth: 200,
                        background: C.cream,
                        border: `1px solid ${C.line}`,
                        borderRadius: 12,
                        boxShadow: "0 12px 32px -8px rgba(42,33,27,0.18)",
                        padding: 6,
                        zIndex: 60,
                      }}
                    >
                      <Link
                        href="/dashboard"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        style={{
                          display: "block",
                          padding: "10px 12px",
                          borderRadius: 8,
                          fontFamily: FONT_SANS,
                          fontSize: 14,
                          color: C.ink,
                          textDecoration: "none",
                        }}
                      >
                        {AUTH.nav.dashboard_link}
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleSignout}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: FONT_SANS,
                          fontSize: 14,
                          color: C.inkSoft,
                        }}
                      >
                        {AUTH.signout.button}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : auth.status === "anonymous" ? (
              <Link
                href="/signin"
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 14,
                  color: C.ink,
                  textDecoration: "none",
                  padding: "4px 6px",
                }}
              >
                {AUTH.nav.signin_link}
              </Link>
            ) : (
              // Loading: reserve space so the layout doesn't shift when the
              // probe resolves. Empty span at the same width as "Sign in".
              <span aria-hidden="true" style={{ display: "inline-block", width: 56, height: 18 }} />
            )}
          </div>

          <span className="peterna-cta-desktop" style={{ display: "none" }}>
            <GoldBtn href="/signin">Sign up</GoldBtn>
          </span>
          <button
            onClick={() => setOpen(!open)}
            className="peterna-menu-btn"
            aria-label={open ? "Close menu" : "Open menu"}
            style={{
              display: "inline-flex",
              padding: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.ink,
            }}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden", borderTop: `1px solid ${C.line}` }}
          >
            <div style={{ padding: "16px 40px", display: "flex", flexDirection: "column", gap: 4 }}>
              {NAV_ITEMS.map((it) => (
                <Link
                  key={it.route}
                  href={it.route}
                  onClick={() => setOpen(false)}
                  style={{
                    textAlign: "left",
                    padding: "10px 0",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: FONT_SANS,
                    fontSize: 14,
                    color: C.ink,
                    textDecoration: "none",
                  }}
                >
                  {it.label}
                </Link>
              ))}
              <Link
                href="/builder"
                onClick={() => setOpen(false)}
                style={{
                  textAlign: "left",
                  padding: "10px 0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: FONT_SANS,
                  fontSize: 14,
                  color: C.ink,
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                {AUTH.nav.build_link} a tribute →
              </Link>
              <div
                style={{
                  marginTop: 8,
                  paddingTop: 12,
                  borderTop: `1px solid ${C.line}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {auth.status === "signed_in" ? (
                  <>
                    <div
                      style={{
                        padding: "8px 0",
                        fontFamily: FONT_SANS,
                        fontSize: 12,
                        color: C.inkSofter,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {truncateEmail(auth.user.email, 32)}
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setOpen(false)}
                      style={{
                        textAlign: "left",
                        padding: "10px 0",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: FONT_SANS,
                        fontSize: 14,
                        color: C.ink,
                        textDecoration: "none",
                      }}
                    >
                      {AUTH.nav.dashboard_link}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        void handleSignout();
                      }}
                      style={{
                        textAlign: "left",
                        padding: "10px 0",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: FONT_SANS,
                        fontSize: 14,
                        color: C.inkSoft,
                      }}
                    >
                      {AUTH.signout.button}
                    </button>
                  </>
                ) : (
                  <Link
                    href="/signin"
                    onClick={() => setOpen(false)}
                    style={{
                      textAlign: "left",
                      padding: "10px 0",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: FONT_SANS,
                      fontSize: 14,
                      color: C.ink,
                      textDecoration: "none",
                    }}
                  >
                    {AUTH.nav.signin_link}
                  </Link>
                )}
              </div>
              <Link
                href="/signin"
                onClick={() => setOpen(false)}
                style={{
                  textAlign: "left",
                  padding: "10px 0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: FONT_SANS,
                  fontSize: 14,
                  color: C.goldDeep,
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                Sign up →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (min-width: 1024px) {
          .peterna-nav-desktop { display: flex !important; }
          .peterna-cta-desktop { display: inline-flex !important; }
          .peterna-auth-desktop { display: inline-flex !important; }
          .peterna-menu-btn { display: none !important; }
        }
      `}</style>
    </header>
  );
}
