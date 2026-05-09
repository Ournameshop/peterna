import Pill from "@/components/Pill";
import {
  C,
  FONT_DISPLAY,
  FONT_SANS,
  NARROW_MAX,
} from "@/lib/peterna-tokens";

export default function PagePrivacy() {
  const sections = [
    {
      h: "Who we are",
      b: 'Peterna ("Peterna," "we," "us," or "our") is a remembrance media product operated by Eterna Inc. This Privacy Policy explains how we collect, use, and protect information you submit through this website and our service.',
    },
    {
      h: "What we collect",
      b: "We collect information you provide directly when you create an account, upload photos and videos to create a tribute, contact us, or make a purchase. This typically includes your name, email address, payment information (handled by our payment processor and never stored by us), the photos and media you choose to share with us, and the details about your pet that you provide.\n\nWe also collect a limited amount of technical information automatically — browser type, device, approximate location based on IP, and basic usage analytics — for the purpose of operating and improving the service.",
    },
    {
      h: "How we use your information",
      b: "We use the information you provide to produce your tribute, host your memorial page, manage your account and any subscriptions, respond to your inquiries, and operate the service. We do not use your photos, videos, or tribute content to train machine learning models. We do not sell, rent, or share your contact information for marketing purposes.",
    },
    {
      h: "Your photos and tribute media",
      b: "The photos and media you upload to create a tribute are treated as your private information. We use them only to produce the tribute and memorial page you've requested, and to host them on the page you control. We will not display them publicly without your explicit consent (and our default page setting is private link only). We will not license them to anyone.\n\nYou can request deletion of any uploaded media at any time. Memorial pages can be taken down on request within 24 hours.",
    },
    {
      h: "How we protect your information",
      b: "We implement reasonable technical and organizational safeguards to protect your information, including encryption in transit and at rest, access controls, and routine security review. No system is perfect; we cannot guarantee absolute security.",
    },
    {
      h: "How long we retain your information",
      b: "Memorial pages are retained for as long as you keep your account, and even after you cancel any active subscription — pages do not get taken down on cancellation. You may request deletion of any tribute, page, or account at any time.",
    },
    {
      h: "Children",
      b: "Peterna is intended for adults. We do not knowingly collect information from children under 13. If you believe a child has provided us with information, please contact us and we will remove it.",
    },
    {
      h: "Contact us",
      b: "Questions about this policy can be sent to:\n\nPeterna\nprivacy@peterna.com",
    },
  ];
  return (
    <main style={{ background: C.cream }}>
      <section style={{ padding: "112px 0" }}>
        <div style={NARROW_MAX}>
          <Pill>Privacy</Pill>
          <h1
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
            Privacy Policy
          </h1>
          <p
            style={{
              marginTop: 16,
              fontSize: 14,
              fontStyle: "italic",
              color: C.inkSofter,
              fontFamily: FONT_DISPLAY,
            }}
          >
            Last updated: [DATE — UPDATE BEFORE LAUNCH]
          </p>
          <div
            style={{
              marginTop: 40,
              display: "flex",
              flexDirection: "column",
              gap: 32,
            }}
          >
            {sections.map((s, i) => (
              <div key={i}>
                <h2
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 400,
                    fontSize: 24,
                    color: C.ink,
                    marginBottom: 12,
                  }}
                >
                  {s.h}
                </h2>
                {s.b.split("\n\n").map((p, j) => (
                  <p
                    key={j}
                    style={{
                      fontSize: 17,
                      lineHeight: 1.65,
                      color: C.inkSoft,
                      fontFamily: FONT_SANS,
                      marginTop: j > 0 ? 16 : 0,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
