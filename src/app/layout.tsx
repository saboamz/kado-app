import type { Metadata, Viewport } from 'next';
import { Libre_Franklin, Lora } from 'next/font/google';
import { getCurrentUser } from '@/lib/session';
import './globals.css';

// Self-hosted by next/font: no request to Google at runtime, no layout shift.
//
// The pairing comes from the design system: Lora sets the name of anything —
// a screen title, a list, a gift, a price — and Libre Franklin carries
// everything else. Monospace is not loaded as a webfont at all: the design
// reserves it for relative dates and technical markers, where the platform
// stack is indistinguishable at 10–11px and cheaper.
const libreFranklin = Libre_Franklin({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-libre-franklin',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
  display: 'swap',
});

const DESCRIPTION =
  'Ajoutez ce qui vous ferait plaisir. Vos proches réservent en secret — vous ne voyez jamais qui a pris quoi.';

export const metadata: Metadata = {
  /*
   * metadataBase makes the relative OG image below resolve to an absolute
   * URL, which is the only kind a scraper can fetch. Without it Next warns
   * and the preview silently loses its image.
   *
   * VERCEL_PROJECT_PRODUCTION_URL is the stable production hostname, unlike
   * VERCEL_URL which changes on every deployment — a preview card pointing at
   * a superseded deployment breaks as soon as the next one ships.
   */
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'http://localhost:3000'),
  ),
  title: { default: 'Kado', template: '%s · Kado' },
  description: DESCRIPTION,
  applicationName: 'Kado',
  /*
   * What a pasted link looks like in a group chat.
   *
   * This app spreads by somebody sharing a link with their family, so the
   * card that appears there is not decoration — it is the first thing anyone
   * sees of Kado, and a bare URL converts far worse than a title and an
   * image.
   */
  openGraph: {
    type: 'website',
    siteName: 'Kado',
    locale: 'fr_FR',
    title: 'Kado — des listes de souhaits que vos proches remplissent en secret',
    description: DESCRIPTION,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Kado' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kado — des listes de souhaits que vos proches remplissent en secret',
    description: DESCRIPTION,
    images: ['/opengraph-image'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    // Matches --canvas in globals.css for each theme.
    { media: '(prefers-color-scheme: light)', color: '#eeeae5' },
    { media: '(prefers-color-scheme: dark)', color: '#211f1d' },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A signed-in choice wins over the device setting; SYSTEM leaves the
  // attribute off so the prefers-color-scheme media query applies.
  const user = await getCurrentUser();
  const theme = user?.theme === 'SYSTEM' ? undefined : user?.theme.toLowerCase();

  return (
    <html
      lang="fr"
      data-theme={theme}
      className={`${libreFranklin.variable} ${lora.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
