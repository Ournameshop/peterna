import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import TributeVideo from './TributeVideo';

interface TributeRow {
  id: string;
  pet_name: string;
  video_url: string;
  opening_text: string | null;
  closing_text: string | null;
  years: string | null;
  creator_name: string | null;
  created_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PALETTE = {
  bone: '#F8F1E4',
  boneSoft: '#FBF6EC',
  parchmentLight: '#E5DBC9',
  espresso: '#2A211B',
  espressoSoft: '#4A3F36',
  mute: '#7A6F66',
  brass: '#C9A961',
};

export default async function TributePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    notFound();
  }

  let tribute: TributeRow | null = null;
  try {
    const result = await query<TributeRow>(
      'SELECT * FROM tributes WHERE id = $1',
      [id],
    );
    tribute = result.rows[0] ?? null;
  } catch {
    // DB unavailable — render graceful error rather than crashing
  }

  if (!tribute) {
    notFound();
  }

  const petName = tribute.pet_name;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: PALETTE.bone,
        color: PALETTE.espresso,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <main
        style={{
          maxWidth: 680,
          margin: '0 auto',
          padding: 'clamp(32px, 8vw, 80px) 24px 64px',
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: PALETTE.brass,
            fontWeight: 500,
            marginBottom: 18,
          }}
        >
          Memorial · Tribute
        </div>

        {/* Heading */}
        <h1
          style={{
            fontFamily: '"Cormorant Garamond", Garamond, Georgia, serif',
            fontWeight: 400,
            fontStyle: 'italic',
            fontSize: 'clamp(40px, 7vw, 64px)',
            lineHeight: 1.05,
            letterSpacing: '-0.01em',
            margin: '0 0 12px',
            color: PALETTE.espresso,
          }}
        >
          For {petName}.
        </h1>

        {/* Opening text */}
        {tribute.opening_text && (
          <p
            style={{
              fontFamily: '"Cormorant Garamond", Garamond, Georgia, serif',
              fontSize: 19,
              fontStyle: 'italic',
              color: PALETTE.mute,
              lineHeight: 1.6,
              margin: '0 0 36px',
              maxWidth: 560,
            }}
          >
            {tribute.opening_text}
          </p>
        )}

        {/* Video — sized to its own aspect ratio (16:9 / 9:16 / 1:1), no crop. */}
        <TributeVideo src={tribute.video_url} bg={PALETTE.espressoSoft} />

        {/* Closing text */}
        {tribute.closing_text && (
          <p
            style={{
              fontFamily: '"Cormorant Garamond", Garamond, Georgia, serif',
              fontSize: 20,
              fontStyle: 'italic',
              color: PALETTE.espressoSoft,
              lineHeight: 1.65,
              margin: '0 0 28px',
              maxWidth: 560,
            }}
          >
            {tribute.closing_text}
          </p>
        )}

        {/* Divider */}
        <div
          style={{
            width: 48,
            height: 1,
            background: PALETTE.parchmentLight,
            margin: '32px 0',
          }}
        />

        {/* Years + creator */}
        {(tribute.years || tribute.creator_name) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tribute.years && (
              <div
                style={{
                  fontFamily: '"Cormorant Garamond", Garamond, Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: 16,
                  color: PALETTE.mute,
                  letterSpacing: '0.02em',
                }}
              >
                {petName} · {tribute.years}
              </div>
            )}
            {tribute.creator_name && (
              <div
                style={{
                  fontSize: 12,
                  color: PALETTE.mute,
                  letterSpacing: '0.08em',
                }}
              >
                Created by {tribute.creator_name}
              </div>
            )}
          </div>
        )}

        {/* Footer mark */}
        <div
          style={{
            marginTop: 64,
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: PALETTE.parchmentLight,
          }}
        >
          Peterna
        </div>
      </main>
    </div>
  );
}
