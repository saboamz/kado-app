import { ImageResponse } from 'next/og';

/**
 * The card a pasted Kado link shows in a group chat.
 *
 * Generated rather than a checked-in PNG: the wording lives in one place with
 * the rest of the copy, and a design change does not mean re-exporting an
 * asset somebody will forget.
 *
 * Deliberately plain. next/og runs a small subset of CSS — no external fonts
 * unless they are fetched and passed in, no CSS variables — so this restates
 * the palette literally instead of pretending to share the stylesheet.
 */
export const runtime = 'edge';
export const alt = 'Kado — dites ce qui vous ferait plaisir, vos proches s’organisent';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The light-theme tokens from globals.css, written out: the OG renderer has
// no access to CSS variables, and a card is always shown on its own ground
// rather than the viewer's theme.
const CANVAS = '#eeeae5';
const CARD = '#fffdfa';
const INK = '#3a322c';
const INK2 = '#6f645b';
const ACCENT = '#00707d';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: CANVAS,
          padding: 72,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: ACCENT,
              color: CARD,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 38,
              fontWeight: 700,
            }}
          >
            K
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: INK }}>Kado</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              fontSize: 62,
              fontWeight: 700,
              lineHeight: 1.1,
              color: INK,
              letterSpacing: -1.5,
              maxWidth: 950,
            }}
          >
            Dites ce qui vous ferait plaisir. Vos proches s’organisent.
          </div>
          <div style={{ fontSize: 30, color: INK2, maxWidth: 900, lineHeight: 1.4 }}>
            Une liste de cadeaux où vos proches réservent en secret — vous ne
            voyez jamais qui a pris quoi.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
