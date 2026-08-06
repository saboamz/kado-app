import type { Metadata, Viewport } from 'next';
import { Figtree, Fraunces } from 'next/font/google';
import { getCurrentUser } from '@/lib/session';
import './globals.css';

// Self-hosted by next/font: no request to Google at runtime, no layout shift.
const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-figtree',
  display: 'swap',
});

/**
 * The display face, for headings and the names of things.
 *
 * It replaces the monospace that used to set counts and section labels.
 * Numbers in a mono face read as telemetry — "5 envies" looked like a metric
 * rather than like five presents somebody hopes for — and that single choice
 * did most of the work of making the app feel like a dashboard.
 *
 * Fraunces is a variable serif with a soft, slightly quirky axis; the optical
 * size setting keeps it from looking brittle at heading sizes.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  // Variable font: the weight axis is continuous, so no fixed list. `axes`
  // and an explicit `weight` are mutually exclusive in next/font.
  axes: ['SOFT', 'WONK', 'opsz'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Kado', template: '%s · Kado' },
  description: 'Des listes de souhaits que vos proches remplissent en secret.',
  applicationName: 'Kado',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f1e9' },
    { media: '(prefers-color-scheme: dark)', color: '#191512' },
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
      className={`${figtree.variable} ${fraunces.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
