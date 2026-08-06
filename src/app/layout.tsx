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
