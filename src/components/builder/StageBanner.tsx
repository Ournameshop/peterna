"use client";

import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import { STAGE_BANNERS, substitutePetName } from "@/lib/library/copy";
import { bannerKeyForStage, type StageTag } from "@/lib/builder/state";

// Stage banner — single banner per top-level stage entry. Emoji + headline.
// Locked text comes from copy.ts (STAGE_BANNERS table); [PET_NAME] is
// substituted with the captured name (or "your pet" before capture).

type Props = {
  stage: StageTag;
  petName: string | null;
};

export default function StageBanner({ stage, petName }: Props) {
  const key = bannerKeyForStage(stage);
  const banner = STAGE_BANNERS[key];
  const headline = substitutePetName(banner.headline, petName);

  return (
    <div
      role="banner"
      aria-label={headline}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 18px",
        borderRadius: 14,
        background: "rgba(233, 213, 195, 0.45)",
        border: `1px solid ${C.line}`,
        marginBottom: 28,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: 22,
          lineHeight: 1,
          fontFamily: FONT_SANS,
          filter: "saturate(0.95)",
        }}
      >
        {banner.emoji}
      </span>
      <span
        style={{
          fontFamily: FONT_DISPLAY,
          fontStyle: "italic",
          fontSize: 18,
          lineHeight: 1.35,
          color: C.inkSoft,
          letterSpacing: "-0.005em",
          fontWeight: 400,
        }}
      >
        {headline}
      </span>
    </div>
  );
}
