import { type CSSProperties } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import { DELIVERY, substitutePetName } from "@/lib/library/copy";
import type {
  DeliveryArtifactsWire,
  DeliveryFetchResponse,
} from "@/lib/builder/wire-types";
import DeliveryPage from "@/components/delivery/DeliveryPage";

// Public /tribute/[slug] page.
//
// Server Component — pre-renders the entire tribute for fast first paint
// + crawlable open-graph metadata. The slug IS the auth (no cookie, no
// login wall); a malformed slug or a deleted session returns a friendly
// 404-styled message rather than the Next default error chrome.
//
// Per AGENTS.md (Next 16): params is a Promise in async Server Components.
//
// Open-graph strategy: the share preview card uses the character sheet URL
// as the image (the most identifiable likeness anchor — pet face in 4 views).
// Falls back to opening title card if character sheet isn't set. The title
// + description carry the pet's name so unfurled previews read like a
// memorial card, not "View on Peterna".
//
// Caching: `cache: "no-store"` on the API fetch. The tribute is built
// asynchronously; we don't want a stale snapshot. The page itself is
// dynamically rendered (no static params).

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

// -----------------------------------------------------------------------------
// Server-side fetch helper. Shared by `page` + `generateMetadata`.
// -----------------------------------------------------------------------------

async function fetchArtifacts(
  slug: string,
): Promise<DeliveryArtifactsWire | null> {
  if (!slug || slug.length < 4) return null;

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const protocol = hdrs.get("x-forwarded-proto") ?? "http";
  const base = `${protocol}://${host}`;

  try {
    const res = await fetch(
      `${base}/api/delivery/${encodeURIComponent(slug)}`,
      {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as
      | DeliveryFetchResponse
      | null;
    if (json && json.ok) return json.artifacts;
    return null;
  } catch {
    // Backend not up yet — return null so we render the not-found UI.
    return null;
  }
}

// -----------------------------------------------------------------------------
// generateMetadata — open-graph + Twitter card.
//
// We resolve the pet's name + portrait URL by reaching the same API as the
// page itself; Next deduplicates the fetch under `cache: "no-store"` per
// request, so this isn't a second round-trip in practice.
// -----------------------------------------------------------------------------

export async function generateMetadata(
  { params }: PageProps,
): Promise<Metadata> {
  const { slug } = await params;
  const artifacts = await fetchArtifacts(slug);

  if (!artifacts) {
    return {
      title: "Tribute not found — Peterna",
      robots: { index: false, follow: false },
    };
  }

  const petName = artifacts.pet_name;
  const title = substitutePetName(
    DELIVERY.public.page_title_template,
    petName,
  );
  const description = substitutePetName(
    DELIVERY.public.page_description_template,
    petName,
  );
  // OG image fallback chain: character sheet > opening card > closing card.
  // The opening card matches the asset shape in card_preview_urls[0]; if the
  // wire delivers a shorter array we just skip.
  const ogImage =
    artifacts.character_sheet_url ||
    artifacts.card_preview_urls[0] ||
    artifacts.card_preview_urls[1] ||
    undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: ogImage ? [{ url: ogImage, alt: `Portrait of ${petName}` }] : [],
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
    // Tributes are personal — don't let search engines index them by default.
    // The slug is shareable but not crawlable.
    robots: { index: false, follow: false },
  };
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default async function TributeSharePage({ params }: PageProps) {
  const { slug } = await params;
  const artifacts = await fetchArtifacts(slug);

  if (!artifacts) {
    // We render an in-page not-found rather than calling Next's default
    // notFound() so the visual is on-brand. (If you want the platform's
    // 404 instead, swap this branch for `notFound()`.)
    void notFound; // keep the import referenced for future use
    return <NotFoundPanel />;
  }

  return <DeliveryPage artifacts={artifacts} />;
}

// -----------------------------------------------------------------------------
// On-brand not-found panel.
// -----------------------------------------------------------------------------

function NotFoundPanel() {
  return (
    <section
      role="status"
      aria-label="Tribute not found"
      style={notFoundWrap}
    >
      <h1 style={notFoundHeadline}>
        {DELIVERY.public.not_found_headline}
      </h1>
      <p style={notFoundBody}>{DELIVERY.public.not_found_body}</p>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const notFoundWrap: CSSProperties = {
  maxWidth: 560,
  margin: "0 auto",
  padding: "120px 24px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: 14,
  background: C.cream,
  color: C.ink,
};

const notFoundHeadline: CSSProperties = {
  margin: 0,
  fontFamily: FONT_DISPLAY,
  fontStyle: "italic",
  fontSize: 32,
  lineHeight: 1.25,
  color: C.ink,
  fontWeight: 400,
};

const notFoundBody: CSSProperties = {
  margin: 0,
  fontFamily: FONT_SANS,
  fontSize: 14,
  color: C.inkSofter,
  lineHeight: 1.55,
};
