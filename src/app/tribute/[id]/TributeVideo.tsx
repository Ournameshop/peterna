"use client";

import React, { useState } from 'react';

// Renders the tribute video at its OWN aspect ratio. The share page is a server
// component and the tributes table doesn't store the aspect, so we read the
// video's intrinsic dimensions on metadata load and size the frame to match —
// 16:9 stays landscape, 9:16 stays portrait, 1:1 stays square. No cropping.
export default function TributeVideo({ src, bg }: { src: string; bg: string }) {
  // width / height ratio; null until the video reports its dimensions.
  const [ratio, setRatio] = useState<number | null>(null);
  const isPortrait = ratio !== null && ratio < 0.95;
  // Portrait gets a narrower cap so it isn't absurdly tall; landscape/square wider.
  const maxWidth = ratio === null ? 560 : isPortrait ? 380 : 680;

  return (
    <div
      style={{
        width: '100%',
        maxWidth,
        margin: '0 0 36px',
        borderRadius: 4,
        overflow: 'hidden',
        background: bg,
        aspectRatio: ratio ? String(ratio) : '16 / 9',
      }}
    >
      <video
        controls
        playsInline
        src={src}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth > 0 && v.videoHeight > 0) setRatio(v.videoWidth / v.videoHeight);
        }}
        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
      />
    </div>
  );
}
