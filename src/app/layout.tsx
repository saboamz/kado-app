import type { Metadata, Viewport } from 'next';
import { Figtree, Roboto_Mono } from 'next/font/google';
import { getCurrentUser } from '@/lib/session';
import './globals.css';

// Self-hosted by next/font: no request to Google at runtime, no layout shift.
const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-figtree',
  display: 'swap',
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-roboto-mono',
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
    { media: '(prefers-color-scheme: light)', color: '#eceae7' },
    { media: '(prefers-color-scheme: dark)', color: '#08080a' },
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
      className={`${figtree.variable} ${robotoMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
