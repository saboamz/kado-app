import type { Metadata, Viewport } from 'next';
import { Figtree, Roboto_Mono } from 'next/font/google';
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${figtree.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
