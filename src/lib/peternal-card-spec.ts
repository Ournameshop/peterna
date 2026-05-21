// Pure TypeScript — NO React/JSX imports.
// Renders deterministic SVG strings for title/caption cards.
// Used server-side by /api/card/render to rasterize via @resvg/resvg-js.

export type ContainerId =
  | 'cinematic_lower_third'
  | 'watercolor_ribbon'
  | 'storybook_page'
  | 'parchment_scroll'
  | 'plasticine_banner'
  | 'paperclip_note'
  | 'pixel_sign'
  | 'voxel_sign'
  | 'engraved_stone_plaque'
  | 'polaroid_border'
  | 'postcard_back'
  | 'embroidered_sampler'
  | 'pressed_flower_bookmark';

export type ArtStyleId =
  | 'cinematic_realism'
  | 'watercolor'
  | 'storybook_illustration'
  | 'animated_3d'
  | 'claymation'
  | 'pencil_sketch'
  | 'pixel_art'
  | 'voxel_minecraft';

// Verbatim from CardArt.tsx
const CONTAINER_COLORS: Record<ContainerId, { bg: string; text: string; mode: string }> = {
  cinematic_lower_third: { bg: '#0E0E12CC', text: '#F4F1E8', mode: 'lower_third' },
  watercolor_ribbon:     { bg: '#F1E7D2',   text: '#6B4A2E', mode: 'ribbon' },
  storybook_page:        { bg: '#F3E9CF',   text: '#5A3E1F', mode: 'page' },
  parchment_scroll:      { bg: '#E8D9B5',   text: '#5A3E1F', mode: 'scroll' },
  plasticine_banner:     { bg: '#D9B98E',   text: '#3A2A1C', mode: 'banner' },
  paperclip_note:        { bg: '#EFE6D2',   text: '#3C3A36', mode: 'note' },
  pixel_sign:            { bg: '#8A5A33',   text: '#F2E4C4', mode: 'pixel' },
  voxel_sign:            { bg: '#9C6B3C',   text: '#2E2418', mode: 'voxel' },
  engraved_stone_plaque: { bg: '#8B8378',   text: '#F4F1E8', mode: 'stone' },
  polaroid_border:       { bg: '#F8F4EC',   text: '#2A3855', mode: 'polaroid' },
  postcard_back:         { bg: '#F0E5C8',   text: '#1F3A5C', mode: 'postcard' },
  embroidered_sampler:   { bg: '#F4EAD5',   text: '#C84A4A', mode: 'embroidery' },
  pressed_flower_bookmark: { bg: '#ECDFC5', text: '#5A3520', mode: 'bookmark' },
};

// Verbatim from CardArt.tsx
const STYLE_GRADIENTS: Record<ArtStyleId, string> = {
  cinematic_realism:      'linear-gradient(160deg, #2A1F15 0%, #5C3E28 50%, #3A2818 100%)',
  watercolor:             'linear-gradient(160deg, #F1E8DE 0%, #D4B8A0 50%, #BFA08A 100%)',
  storybook_illustration: 'linear-gradient(160deg, #C8DFC8 0%, #A8C4A8 50%, #7BA87B 100%)',
  animated_3d:            'linear-gradient(160deg, #E0D0C0 0%, #C8A890 50%, #9A7858 100%)',
  claymation:             'linear-gradient(160deg, #D4B090 0%, #B08060 50%, #8C5C38 100%)',
  pencil_sketch:          'linear-gradient(160deg, #EDE8E0 0%, #D4CCBE 50%, #B0A898 100%)',
  pixel_art:              'linear-gradient(160deg, #F0D080 0%, #C8A040 50%, #804010 100%)',
  voxel_minecraft:        'linear-gradient(160deg, #70A030 0%, #508020 50%, #306010 100%)',
};

// Maps a CSS linear-gradient string to two SVG linearGradient stop colors.
// Extracts the first and last color stops.
function gradientToStops(grad: string): { c1: string; c2: string } {
  const colors = grad.match(/#[0-9A-Fa-f]{6}/g) ?? ['#3A2818', '#5C3E28'];
  return { c1: colors[0], c2: colors[colors.length - 1] };
}

// Word-wrap: splits text into lines that fit within `maxCharsPerLine` characters.
// Operates on words; never splits mid-word.
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word.length > maxCharsPerLine ? word.slice(0, maxCharsPerLine - 1) + '…' : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface RenderCardSvgOpts {
  cardType: 'opening' | 'closing' | 'caption' | 'caption_overlay';
  text: string;
  containerId: ContainerId;
  artStyle: ArtStyleId;
  aspectRatio: '9:16' | '16:9' | '1:1';
  backgroundImageHref?: string;
}

// Frame pixel dimensions indexed by aspectRatio — used by the route.
export const FRAME_DIMS: Record<'9:16' | '16:9' | '1:1', { w: number; h: number }> = {
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
  '1:1':  { w: 1080, h: 1080 },
};

export function renderCardSvg(opts: RenderCardSvgOpts): string {
  const { cardType, text, containerId, artStyle, aspectRatio, backgroundImageHref } = opts;

  const containerStyle = CONTAINER_COLORS[containerId] ?? CONTAINER_COLORS['cinematic_lower_third'];
  const gradKey = (artStyle in STYLE_GRADIENTS) ? artStyle : 'cinematic_realism';
  const { c1, c2 } = gradientToStops(STYLE_GRADIENTS[gradKey]);
  const { mode } = containerStyle;
  const isPolaroid = mode === 'polaroid';
  const isPixelMono = mode === 'pixel' || mode === 'voxel';

  // SVG viewBox: 1000 × vbH (integer units for clean math)
  const vbW = 1000;
  const vbH = aspectRatio === '9:16' ? 1778 : aspectRatio === '16:9' ? 563 : 1000;

  // Panel geometry (matching CardArt.tsx proportional layout)
  const isCenter = cardType === 'opening' || cardType === 'closing';
  const panelX = 100;
  const panelW = 800;

  // Font sizing in SVG user units
  const fontSize = isCenter ? 38 : 32;
  const lineHeight = fontSize * 1.35;

  // Max chars per line — calibrated for panelW=800 at given font sizes
  // At 9:16 vertical the panel is 800/1000 = 80% of 1080px = 864px wide.
  // Inter/serif at ~38px: ~25 chars. At 32px: ~30 chars.
  const maxChars = isCenter ? 24 : 30;
  const rawLines = wrapText(text, maxChars);

  // Keep at most 6 lines to avoid overflow (same cap used by caption_overlay path)
  const lines = rawLines.slice(0, 6);

  const paddingV = 40;
  const textBlockH = lines.length * lineHeight;
  const panelH = textBlockH + paddingV * 2;

  // Clamp baseY so the panel always fits inside the frame with a 10-unit margin.
  const baseY = isCenter
    ? vbH * 0.38
    : Math.min(vbH * 0.72, vbH - panelH - 10);

  const panelY = baseY;

  // Font family strings for SVG attributes — double-quotes MUST be &quot; so the
  // font name doesn't break the surrounding XML attribute delimiter.
  const serifFamily = '&quot;Cormorant Garamond&quot;, Georgia, serif';
  const sansFamily = '&quot;Inter&quot;, sans-serif';
  const monoFamily = '&quot;JetBrains Mono&quot;, monospace';
  const textFontFamily = isPixelMono ? monoFamily : serifFamily;

  // Text Y: center the text block within the panel
  const textBlockTop = panelY + paddingV + fontSize * 0.8; // first baseline
  const rx = mode === 'ribbon' || mode === 'note' ? 30
    : mode === 'stone' ? 20
    : mode === 'banner' ? 40
    : 20;

  // Eyebrow label text
  const eyebrowText = cardType === 'opening' ? 'OPENING TITLE'
    : cardType === 'closing' ? 'CLOSING CARD'
    : cardType === 'caption_overlay' ? ''
    : 'CAPTION';

  // For caption_overlay: transparent canvas, only the panel + text, positioned lower-third
  if (cardType === 'caption_overlay') {
    const overlayLines = wrapText(text, 30).slice(0, 6);
    const overlayTextH = overlayLines.length * lineHeight;
    const overlayPanelH = overlayTextH + paddingV * 2;
    const overlayPanelY = Math.min(vbH * 0.72, vbH - overlayPanelH - 10);

    const tspans = overlayLines.map((line, i) => {
      const dy = i === 0 ? 0 : lineHeight;
      return `<tspan x="${panelX + panelW / 2}" dy="${dy}">${escXml(line)}</tspan>`;
    }).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
  <defs>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="8" flood-color="rgba(0,0,0,0.45)"/>
    </filter>
  </defs>
  <rect x="${panelX}" y="${overlayPanelY}" width="${panelW}" height="${overlayPanelH}"
    rx="${rx}" fill="${containerStyle.bg}"
    ${mode === 'lower_third' ? 'opacity="0.88"' : ''}
    filter="url(#sh)"/>
  ${scrollCurls(mode, panelX, overlayPanelY, panelW, overlayPanelH)}
  ${stoneBorder(mode, panelX, overlayPanelY, panelW, overlayPanelH, rx)}
  ${pixelBorder(mode, panelX, overlayPanelY, panelW, overlayPanelH)}
  <text
    x="${panelX + panelW / 2}"
    y="${overlayPanelY + paddingV + fontSize * 0.8}"
    text-anchor="middle"
    font-family="${textFontFamily}"
    ${!isPixelMono ? 'font-style="italic"' : ''}
    font-size="${fontSize}"
    fill="${containerStyle.text}"
    letter-spacing="${isPixelMono ? '2' : '1'}"
  >${tspans}</text>
</svg>`;
  }

  // Polaroid branch (mirrors CardArt.tsx polaroid)
  if (isPolaroid) {
    const photoH = vbH * 0.72;
    const polaroidLines = wrapText(text, 28).slice(0, 3);
    const polaroidTspans = polaroidLines.map((line, i) => {
      const dy = i === 0 ? 0 : lineHeight * 0.9;
      return `<tspan x="${vbW / 2}" dy="${dy}">${escXml(line)}</tspan>`;
    }).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
  <defs>
    <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="14" flood-color="rgba(0,0,0,0.25)"/>
    </filter>
    <clipPath id="photoClip">
      <rect x="80" y="80" width="${vbW - 160}" height="${photoH - 40}" rx="10"/>
    </clipPath>
  </defs>
  <!-- Polaroid white frame -->
  <rect x="40" y="40" width="${vbW - 80}" height="${vbH - 120}" rx="20" fill="#F8F4EC" filter="url(#sh)"/>
  <!-- Scene area -->
  ${backgroundImageHref
    ? `<image href="${backgroundImageHref}" x="80" y="80" width="${vbW - 160}" height="${photoH - 40}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>
  <rect x="80" y="80" width="${vbW - 160}" height="${photoH - 40}" rx="10" fill="rgba(0,0,0,0.30)"/>`
    : `<rect x="80" y="80" width="${vbW - 160}" height="${photoH - 40}" rx="10" fill="url(#sg)"/>`
  }
  <ellipse cx="${vbW / 2}" cy="${vbH * 0.3}" rx="280" ry="200" fill="rgba(255,240,200,0.1)"/>
  <!-- Caption in bottom white margin -->
  <text
    x="${vbW / 2}"
    y="${photoH + 60}"
    text-anchor="middle"
    font-family="${serifFamily}"
    font-style="italic"
    font-size="${fontSize}"
    fill="${containerStyle.text}"
    letter-spacing="1"
  >${polaroidTspans}</text>
</svg>`;
  }

  // Standard full-frame card
  const tspans = lines.map((line, i) => {
    const dy = i === 0 ? 0 : lineHeight;
    return `<tspan x="${panelX + panelW / 2}" dy="${dy}">${escXml(line)}</tspan>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
  <defs>
    <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="10" flood-color="rgba(0,0,0,0.25)"/>
    </filter>
  </defs>
  <!-- Scene background -->
  ${backgroundImageHref
    ? `<image href="${backgroundImageHref}" x="0" y="0" width="${vbW}" height="${vbH}" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="0" width="${vbW}" height="${vbH}" fill="rgba(0,0,0,0.30)"/>`
    : `<rect x="0" y="0" width="${vbW}" height="${vbH}" fill="url(#sg)"/>`
  }
  <!-- Bloom -->
  <ellipse cx="${vbW / 2}" cy="${vbH * 0.35}" rx="${vbW * 0.4}" ry="${vbH * 0.3}" fill="rgba(255,240,200,0.12)"/>
  <!-- Eyebrow -->
  ${eyebrowText ? `<text x="${vbW / 2}" y="${panelY - 22}" text-anchor="middle" font-family="${sansFamily}" font-size="22" fill="rgba(255,255,255,0.5)" letter-spacing="8">${eyebrowText}</text>` : ''}
  <!-- Container panel -->
  <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}"
    rx="${rx}" fill="${containerStyle.bg}"
    ${mode === 'lower_third' ? 'opacity="0.88"' : ''}
    filter="url(#sh)"/>
  ${scrollCurls(mode, panelX, panelY, panelW, panelH)}
  ${stoneBorder(mode, panelX, panelY, panelW, panelH, rx)}
  ${pixelBorder(mode, panelX, panelY, panelW, panelH)}
  <!-- Text -->
  <text
    x="${panelX + panelW / 2}"
    y="${textBlockTop}"
    text-anchor="middle"
    font-family="${textFontFamily}"
    ${!isPixelMono ? 'font-style="italic"' : ''}
    font-size="${fontSize}"
    fill="${containerStyle.text}"
    letter-spacing="${isPixelMono ? '2' : '1'}"
  >${tspans}</text>
</svg>`;
}

// Helpers for optional decorative elements

function scrollCurls(mode: string, px: number, py: number, pw: number, ph: number): string {
  if (mode !== 'scroll') return '';
  return `
  <ellipse cx="${px + 20}" cy="${py + ph / 2}" rx="20" ry="${ph / 2}" fill="#D4C098"/>
  <ellipse cx="${px + pw - 20}" cy="${py + ph / 2}" rx="20" ry="${ph / 2}" fill="#D4C098"/>`;
}

function stoneBorder(mode: string, px: number, py: number, pw: number, ph: number, rx: number): string {
  if (mode !== 'stone') return '';
  return `<rect x="${px + 8}" y="${py + 8}" width="${pw - 16}" height="${ph - 16}" rx="${rx}" fill="none" stroke="#6A6360" stroke-width="6"/>`;
}

function pixelBorder(mode: string, px: number, py: number, pw: number, ph: number): string {
  if (mode !== 'pixel') return '';
  return `<rect x="${px - 8}" y="${py - 8}" width="${pw + 16}" height="${ph + 16}" rx="0" fill="none" stroke="#5A3A1A" stroke-width="12"/>`;
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
