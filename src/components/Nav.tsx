"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { C, FONT_DISPLAY, FONT_SANS, sectionMaxStyle } from "@/lib/peterna-tokens";
import { GoldBtn } from "./Buttons";

const NAV_ITEMS = [
  { route: "/how-it-works", label: "How it works" },
  { route: "/pricing", label: "Pricing" },
  { route: "/family-channel", label: "Family Channel" },
  { route: "/gallery", label: "Examples" },
  { route: "/for-veterinarians", label: "For Veterinarians" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="peterna-cta-desktop" style={{ display: "none" }}>
            <GoldBtn href="/get-started">Join the waitlist</GoldBtn>
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
                href="/get-started"
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
                Join the waitlist →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (min-width: 1024px) {
          .peterna-nav-desktop { display: flex !important; }
          .peterna-cta-desktop { display: inline-flex !important; }
          .peterna-menu-btn { display: none !important; }
        }
      `}</style>
    </header>
  );
}
