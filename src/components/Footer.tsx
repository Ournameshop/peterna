import Link from "next/link";
import { C, FONT_DISPLAY, FONT_SANS, sectionMaxStyle } from "@/lib/peterna-tokens";

type Item = { label: string; route: string };

function Col({ title, items }: { title: string; items: Item[] }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          marginBottom: 16,
          color: C.inkSofter,
          fontFamily: FONT_SANS,
        }}
      >
        {title}
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {items.map((it, i) => (
          <li key={i}>
            <Link
              href={it.route}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: FONT_SANS,
                fontSize: 14,
                color: C.ink,
                padding: 0,
                textDecoration: "none",
              }}
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer style={{ background: C.cream, borderTop: `1px solid ${C.line}` }}>
      <div style={{ ...sectionMaxStyle, padding: "64px 40px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 40,
          }}
        >
          <div style={{ gridColumn: "1 / -1", maxWidth: 380 }} className="peterna-footer-brand">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ width: 24, height: 2, background: C.gold, borderRadius: 999 }} />
                <div style={{ width: 20, height: 2, background: C.gold, borderRadius: 999 }} />
                <div style={{ width: 12, height: 2, background: C.gold, borderRadius: 999 }} />
              </div>
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 28,
                  lineHeight: 1,
                  color: C.ink,
                  fontWeight: 400,
                }}
              >
                Peterna
              </span>
            </div>
            <p
              style={{
                marginTop: 20,
                fontSize: 14,
                lineHeight: 1.6,
                color: C.inkSoft,
                fontFamily: FONT_SANS,
              }}
            >
              A beautiful, lasting tribute for every pet you&rsquo;ve loved. Built by the team
              behind Eterna — a remembrance media company.
            </p>
            <p
              style={{
                marginTop: 12,
                fontSize: 13,
                fontStyle: "italic",
                color: C.inkSofter,
                fontFamily: FONT_DISPLAY,
              }}
            >
              &ldquo;Grief doesn&rsquo;t end. Neither does Peterna.&rdquo;
            </p>
          </div>
          <Col
            title="Product"
            items={[
              { label: "How it works", route: "/how-it-works" },
              { label: "Pricing", route: "/pricing" },
              { label: "Family Channel", route: "/family-channel" },
              { label: "Examples", route: "/gallery" },
              { label: "Join the waitlist", route: "/get-started" },
            ]}
          />
          <Col
            title="Partners"
            items={[
              { label: "For Veterinarians", route: "/for-veterinarians" },
              { label: "Become a partner", route: "/for-veterinarians" },
            ]}
          />
          <Col
            title="Company"
            items={[
              { label: "About Peterna", route: "/about" },
              { label: "FAQ", route: "/faq" },
              { label: "Privacy", route: "/privacy" },
            ]}
          />
        </div>
        <div
          style={{
            marginTop: 56,
            paddingTop: 24,
            borderTop: `1px solid ${C.line}`,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 12,
            color: C.inkSofter,
            fontFamily: FONT_SANS,
          }}
        >
          <div>© 2026 Peterna · A product of Eterna Inc. Built with care.</div>
          <div>Coming soon · Join the waitlist</div>
        </div>
      </div>
    </footer>
  );
}
