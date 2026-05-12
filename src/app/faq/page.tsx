"use client";

import Pill from "@/components/Pill";
import { GoldBtn } from "@/components/Buttons";
import {
  C,
  FONT_DISPLAY,
  FONT_SANS,
  sectionMaxStyle,
  NARROW_MAX,
} from "@/lib/peterna-tokens";

export default function PageFAQ() {
  const groups = [
    {
      title: "Getting started",
      items: [
        {
          q: "How many photos do I need?",
          a: "As few as five is enough for a beautiful tribute. Most families upload between fifteen and forty. More is wonderful but never required, and quantity matters less than the moments you choose. Faded prints, screenshots, phone snapshots — all are welcome.",
        },
        {
          q: "What file types do you accept?",
          a: "Photos in any common format (JPEG, HEIC, PNG, RAW), short videos up to two minutes each (MP4, MOV), and voice memos in any audio format. We handle the conversions. If you have physical prints, you can photograph them with your phone — our restoration handles the rest.",
        },
        {
          q: "Can multiple family members contribute photos?",
          a: "Yes. With Premium and Elite tiers, you'll get a private upload link you can share with up to five (Premium) or ten (Elite) family members. Each person uploads from their own device. We collect everything and weave it into one tribute.",
        },
        {
          q: "How long will it take?",
          a: "Depends on the tier. Peterna Instant ($99) is AI-finalized in literal minutes — no waiting, no review queue. Concierge tiers ($149+) add a human producer who reviews every frame before it ships, usually within hours of upload. Priority producer review is planned for Elite and for any tier when a memorial service is scheduled within 48 hours of loss. These targets will be confirmed once we open.",
        },
      ],
    },
    {
      title: "About the tribute itself",
      items: [
        {
          q: "Will my pet look like a cartoon, or a deepfake, or 'AI-y'?",
          a: "No. Our AI restoration sharpens, color-corrects, and gently animates real photographs — it does not generate, fabricate, or replace anything. A human producer reviews every frame before delivery to make sure your pet looks like your pet, never an algorithmic approximation.",
        },
        {
          q: "Where does the music come from?",
          a: "From a curated library of fully-licensed music, hand-selected for tribute use. No royalty traps, no algorithmic stock loops. You'll be offered three to six music suggestions tuned to your tribute's tone, and you choose. Elite tier includes optional custom-licensed signature music.",
        },
        {
          q: "Can I add narration or a written tribute?",
          a: "Yes — Premium and Elite tiers include this. You can record a voice memo on your phone, type out a written tribute, or both. Family members can each contribute their own narration if you'd like a chorus of voices.",
        },
        {
          q: "What if I don't like the first version?",
          a: "Every tribute includes one round of revisions on Essential, two rounds on Premium, and unlimited revisions on Elite. We'd rather get it right than ship it fast — and most revisions are tiny (a photo placement, a music timing, a caption tweak).",
        },
      ],
    },
    {
      title: "After the tribute is delivered",
      items: [
        {
          q: "Where does my tribute live after it's done?",
          a: "On a permanent memorial page on peterna.com — beautifully designed, hosted forever, accessible via a private link or QR code. You can share publicly, share by link only, or password-protect. The page is yours to keep regardless of any subscription.",
        },
        {
          q: "What happens if I cancel my Family Channel subscription?",
          a: "Your memorial pages and tributes stay live. Permanently. The Family Channel adds anniversary reminders, family upload features, and the ability to add new pets — but cancellation never takes anything away. Pages built for you stay up.",
        },
        {
          q: "Can I download my tribute?",
          a: "Yes. Every tribute can be downloaded in MP4 format from your account, plus a high-resolution version suitable for screening at memorial services. Memorial pages can also be exported to PDF for printing.",
        },
        {
          q: "Can I add new pets to my Family Channel later?",
          a: "Yes — that's the entire point of the channel. Add as many pets as you'd like, in any order, with new tributes commissioned for each. Your channel grows with your family.",
        },
      ],
    },
    {
      title: "Privacy & care",
      items: [
        {
          q: "Are my photos used to train AI models?",
          a: "No. Your photos and tributes are never used for AI training, never licensed to third parties, never shared. They belong to you. Our AI restoration uses pre-trained models that we operate ourselves; nothing you upload feeds back into anything.",
        },
        {
          q: "Who can see my pet's memorial page?",
          a: "By default, only people with the link. You can choose to make it public, link-only, or password-protected. Family Channels are always private to invited members.",
        },
        {
          q: "What if I need to take a memorial down?",
          a: "Send us a message and we'll honor it the same day. Your data is yours. We never put a memorial up without explicit permission, and we never refuse to take one down when asked.",
        },
      ],
    },
    {
      title: "When the moment is hard",
      items: [
        {
          q: "I just lost my pet today. Can you help quickly?",
          a: "Peterna isn't open to families yet — we're in pre-launch. If you've just lost a pet and you're reading this, please email hello@peterna.com and tell us your situation. We can't ship a tribute today, but we can listen, point you to other resources for the immediate moment, and reserve a spot for you the moment we open.",
        },
        {
          q: "I'm not ready yet. Can I be notified when you launch?",
          a: "Yes. Join the waitlist and we'll write to you the week we open — once, quietly, with no marketing in between. There's no urgency from us. When you're ready, the service will be there.",
        },
      ],
    },
  ];
  return (
    <main>
      <section style={{ padding: "112px 0", background: C.cream }}>
        <div style={sectionMaxStyle}>
          <Pill>Frequently asked questions</Pill>
          <h1
            style={{
              marginTop: 24,
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: "clamp(44px, 7vw, 88px)",
              lineHeight: 1.0,
              letterSpacing: "-0.015em",
              color: C.ink,
              maxWidth: 1100,
            }}
          >
            Answers, written by <em style={{ color: C.goldDeep }}>people.</em>
          </h1>
          <p
            style={{
              marginTop: 32,
              maxWidth: 640,
              fontSize: 18,
              lineHeight: 1.65,
              color: C.inkSoft,
              fontFamily: FONT_SANS,
            }}
          >
            We tried to write these the way we&rsquo;d actually answer them on a phone call.
            If we missed something, email hello@peterna.com — we&rsquo;ll add it.
          </p>
        </div>
      </section>

      <section style={{ padding: "80px 0", background: C.cream }}>
        <div style={NARROW_MAX}>
          <div style={{ display: "flex", flexDirection: "column", gap: 64 }}>
            {groups.map((g, gi) => (
              <div key={gi}>
                <h2
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 400,
                    fontSize: "clamp(24px, 3vw, 36px)",
                    lineHeight: 1.1,
                    color: C.ink,
                    marginBottom: 32,
                    paddingBottom: 12,
                    borderBottom: `1px solid ${C.line}`,
                  }}
                >
                  {g.title}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                  {g.items.map((it, i) => (
                    <div key={i}>
                      <h3
                        style={{
                          fontFamily: FONT_DISPLAY,
                          fontWeight: 400,
                          fontSize: 22,
                          lineHeight: 1.25,
                          color: C.ink,
                          margin: 0,
                        }}
                      >
                        {it.q}
                      </h3>
                      <p
                        style={{
                          marginTop: 12,
                          fontSize: 17,
                          lineHeight: 1.65,
                          color: C.inkSoft,
                          fontFamily: FONT_SANS,
                          margin: "12px 0 0",
                        }}
                      >
                        {it.a}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "128px 0", background: C.blush, textAlign: "center" }}>
        <div style={NARROW_MAX}>
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: "clamp(32px, 4.5vw, 56px)",
              lineHeight: 1.05,
              color: C.ink,
            }}
          >
            Still have questions?
          </h2>
          <p
            style={{
              marginTop: 24,
              fontSize: 18,
              color: C.inkSoft,
              fontFamily: FONT_SANS,
            }}
          >
            We read every email. Replies come from a real person, on real-person timing —
            sometimes hours, sometimes a day or two.
          </p>
          <div style={{ marginTop: 40 }}>
            <GoldBtn href="mailto:hello@peterna.com">Email hello@peterna.com</GoldBtn>
          </div>
        </div>
      </section>
    </main>
  );
}
