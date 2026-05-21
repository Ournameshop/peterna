import 'server-only';

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';
import React from 'react';

import { logRender } from '@/lib/ai/observability';

import { favoriteLabels, joinList, traitLabels } from './compose';

/**
 * Pure PDF renderer for the Stage 8 Eulogy. Two pages, US Letter portrait,
 * print-ready (300dpi where it matters — fonts and vector text scale freely;
 * the character sheet image is embedded as the bytes we already have on S3
 * from Stage 2, which renders at 2K nominal and is fine for the ~4-inch
 * vignette here).
 *
 * Layout matches the task brief:
 *   - Page 1: pet name (large serif), years label, opening title card text,
 *     centered character sheet vignette, creator line at the bottom.
 *   - Page 2: memory line (if present), personality traits, favorite things,
 *     closing card text, and a small Peterna mark at the bottom corner.
 *
 * Content-only by design. We never embed user photos or vendor-rendered
 * frames here — only the character sheet (the spec's named single source
 * of pet likeness) and typography.
 */
export type EulogySessionInput = {
  pet_name: string;
  years_label: string | null;
  creator_name: string | null;
  memory_prompt_answer: string | null;
  personality_traits: readonly string[] | null;
  favorite_things: readonly string[] | null;
};

const PAGE_PADDING = 72; // 1in margins on US Letter

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_PADDING,
    paddingBottom: PAGE_PADDING,
    paddingHorizontal: PAGE_PADDING,
    fontFamily: 'Times-Roman',
    color: '#1a1a1a',
    backgroundColor: '#fdfcf8',
  },
  petNameLine: {
    fontFamily: 'Times-Bold',
    fontSize: 52,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  yearsLine: {
    fontFamily: 'Times-Italic',
    fontSize: 16,
    textAlign: 'center',
    color: '#5b5b5b',
    marginBottom: 28,
  },
  openingCard: {
    fontFamily: 'Times-Italic',
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 1.45,
    marginBottom: 32,
    color: '#2a2a2a',
  },
  characterSheetWrap: {
    alignItems: 'center',
    marginVertical: 16,
  },
  characterSheet: {
    width: '60%',
    objectFit: 'contain',
  },
  creatorLine: {
    fontFamily: 'Times-Italic',
    fontSize: 12,
    textAlign: 'center',
    color: '#6a6a6a',
    marginTop: 32,
  },
  sectionLabel: {
    fontFamily: 'Times-Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#8a7a4a',
    marginTop: 18,
    marginBottom: 6,
  },
  bodyText: {
    fontFamily: 'Times-Roman',
    fontSize: 13,
    lineHeight: 1.55,
    color: '#1a1a1a',
  },
  memoryQuote: {
    fontFamily: 'Times-Italic',
    fontSize: 14,
    lineHeight: 1.5,
    color: '#2a2a2a',
    paddingLeft: 14,
    borderLeftWidth: 1,
    borderLeftColor: '#c9b97a',
    marginBottom: 10,
  },
  closingCard: {
    fontFamily: 'Times-Italic',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 1.5,
    marginTop: 36,
    color: '#2a2a2a',
  },
  peternaMark: {
    position: 'absolute',
    bottom: 36,
    right: 72,
    fontFamily: 'Times-Italic',
    fontSize: 9,
    color: '#a0998a',
    letterSpacing: 1.4,
  },
});

function PageOne(props: {
  session: EulogySessionInput;
  characterSheet: { data: Buffer; format: 'png' | 'jpg' } | null;
  openingText: string | null;
}): React.ReactElement {
  const { session, characterSheet, openingText } = props;
  return React.createElement(
    Page,
    { size: 'LETTER', style: styles.page },
    openingText
      ? React.createElement(Text, { style: styles.openingCard }, openingText)
      : null,
    React.createElement(Text, { style: styles.petNameLine }, session.pet_name),
    session.years_label
      ? React.createElement(Text, { style: styles.yearsLine }, session.years_label)
      : null,
    characterSheet
      ? React.createElement(
          View,
          { style: styles.characterSheetWrap },
          React.createElement(Image, {
            src: characterSheet,
            style: styles.characterSheet,
          }),
        )
      : null,
    session.creator_name
      ? React.createElement(
          Text,
          { style: styles.creatorLine },
          `with love, ${session.creator_name}`,
        )
      : null,
  );
}

function PageTwo(props: {
  session: EulogySessionInput;
  closingText: string | null;
}): React.ReactElement {
  const { session, closingText } = props;
  const traits = traitLabels(session.personality_traits ?? null);
  const favorites = favoriteLabels(session.favorite_things ?? null);
  const memory = session.memory_prompt_answer?.trim() || null;

  return React.createElement(
    Page,
    { size: 'LETTER', style: styles.page },
    memory
      ? React.createElement(
          React.Fragment,
          null,
          React.createElement(Text, { style: styles.sectionLabel }, 'A memory'),
          React.createElement(Text, { style: styles.memoryQuote }, `"${memory}"`),
        )
      : null,
    traits.length > 0
      ? React.createElement(
          React.Fragment,
          null,
          React.createElement(Text, { style: styles.sectionLabel }, `Who ${session.pet_name} was`),
          React.createElement(
            Text,
            { style: styles.bodyText },
            joinList(traits) + '.',
          ),
        )
      : null,
    favorites.length > 0
      ? React.createElement(
          React.Fragment,
          null,
          React.createElement(Text, { style: styles.sectionLabel }, `What ${session.pet_name} loved`),
          React.createElement(
            Text,
            { style: styles.bodyText },
            joinList(favorites) + '.',
          ),
        )
      : null,
    closingText
      ? React.createElement(Text, { style: styles.closingCard }, closingText)
      : null,
    React.createElement(Text, { style: styles.peternaMark }, 'PETERNA'),
  );
}

/**
 * Render the eulogy PDF and return the bytes as a Buffer. No vendor calls; no
 * filesystem writes. Caller owns where the bytes land (S3 in the route).
 *
 * `characterSheetBytes` is optional — if S3 fetch fails or the asset row is
 * missing, the renderer still produces a valid PDF (just without the vignette).
 * That tradeoff is intentional: a usable PDF beats a broken delivery.
 */
export async function renderEulogyPdf(input: {
  session: EulogySessionInput;
  characterSheetBytes: Buffer | null;
  characterSheetMime: string | null;
  openingText: string | null;
  closingText: string | null;
  /**
   * Phase 14 — observability. When supplied, a `renders` row is written with
   * `stage='eulogy_pdf'`, `capability='eulogy_pdf'`, `vendor_served='react_pdf'`,
   * `cost_usd_est=0`. Optional for test paths that call the renderer directly.
   */
  sessionId?: string;
  idempotencyKey?: string;
}): Promise<Buffer> {
  const { session, characterSheetBytes, characterSheetMime, openingText, closingText } = input;

  const characterSheet =
    characterSheetBytes && characterSheetBytes.length > 0
      ? {
          data: characterSheetBytes,
          format: imageFormatFromMime(characterSheetMime),
        }
      : null;

  const doc = React.createElement(
    Document,
    {
      title: `${session.pet_name} — eulogy`,
      author: session.creator_name ?? 'Peterna',
      creator: 'Peterna',
      producer: 'Peterna',
    },
    React.createElement(PageOne, {
      session,
      characterSheet,
      openingText,
    }),
    React.createElement(PageTwo, {
      session,
      closingText,
    }),
  );

  const t0 = performance.now();
  try {
    const bytes = await renderToBuffer(doc);
    await maybeLogEulogyRender(input, Math.round(performance.now() - t0), bytes.length, null);
    return bytes;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await maybeLogEulogyRender(input, Math.round(performance.now() - t0), 0, message);
    throw err;
  }
}

/**
 * Write a single `renders` row describing the react-pdf render. Best-effort:
 * observability failures don't bring down a successful PDF generation.
 */
async function maybeLogEulogyRender(
  input: {
    session: EulogySessionInput;
    characterSheetBytes: Buffer | null;
    openingText: string | null;
    closingText: string | null;
    sessionId?: string;
    idempotencyKey?: string;
  },
  durationMs: number,
  byteCount: number,
  error: string | null,
): Promise<void> {
  if (!input.sessionId || !input.idempotencyKey) return;
  try {
    await logRender({
      sessionId: input.sessionId,
      stage: 'eulogy_pdf',
      capability: 'eulogy_pdf',
      vendorAttempted: ['react_pdf'],
      vendorServed: error ? null : 'react_pdf',
      model: 'react-pdf',
      requestBody: {
        has_character_sheet: Boolean(input.characterSheetBytes),
        has_opening_text: Boolean(input.openingText),
        has_closing_text: Boolean(input.closingText),
        bytes: byteCount,
      },
      costUsdEst: 0,
      durationMs,
      idempotencyKey: input.idempotencyKey,
      error,
    });
  } catch (err) {
    console.warn('[eulogy.render] renders log failed', {
      session_id: input.sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function imageFormatFromMime(mime: string | null): 'png' | 'jpg' {
  if (mime && mime.toLowerCase().includes('jpeg')) return 'jpg';
  if (mime && mime.toLowerCase().includes('jpg')) return 'jpg';
  return 'png';
}
