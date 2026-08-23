import type { Metadata, Viewport } from 'next';
import { Libre_Franklin, Lora } from 'next/font/google';
import { I18nProvider } from '@/lib/i18n/client';
import { en } from '@/lib/i18n/en';
import { fr } from '@/lib/i18n/fr';
import { getLocale } from '@/lib/i18n/server';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { getCurrentUser } from '@/lib/session';
import { siteUrl } from '@/lib/site';
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

/*
 * What a pasted link says in a group chat.
 *
 * Rewritten with the landing page it advertises: the old wording said the
 * friends "remplissent" the list, which is backwards — you fill it, they
 * claim from it — and a card is the one place there is no room to recover
 * from a sentence read the wrong way.
 */
const DESCRIPTION =
  'Kadlio est une liste de cadeaux en ligne, gratuite et sans publicité. Vos proches y réservent en secret — vous ne voyez jamais qui a pris quoi.';

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
  metadataBase: new URL(siteUrl()),
  /*
   * The title is what a search result reads.
   *
   * "Kadlio" alone said nothing: somebody who has been told about this app and
   * types "kadlio liste cadeaux" saw a one-word result that could be anything.
   * The words after the name are the ones people actually type, and they are
   * a description of the product rather than a keyword list — a title that
   * reads as stuffing is worth less than a plain one.
   *
   * The template keeps inner pages short: "Réglages · Kadlio".
   */
  title: {
    default: 'Kadlio — liste de cadeaux en ligne, entre proches',
    template: '%s · Kadlio',
  },
  description: DESCRIPTION,
  applicationName: 'Kadlio',
  /*
   * What a pasted link looks like in a group chat.
   *
   * This app spreads by somebody sharing a link with their family, so the
   * card that appears there is not decoration — it is the first thing anyone
   * sees of Kadlio, and a bare URL converts far worse than a title and an
   * image.
   */
  openGraph: {
    type: 'website',
    siteName: 'Kadlio',
    locale: 'fr_FR',
    title: 'Kadlio — dites ce qui vous ferait plaisir, vos proches s’organisent',
    description: DESCRIPTION,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Kadlio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kadlio — dites ce qui vous ferait plaisir, vos proches s’organisent',
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
  const locale = await getLocale();

  return (
    <html
      /* Follows the reader, not the app's origin: a screen reader uses this
         to choose a voice, and English read with French pronunciation is
         close to unintelligible. */
      lang={locale}
      data-theme={theme}
      className={`${libreFranklin.variable} ${lora.variable}`}
    >
      <body>
        <I18nProvider locale={locale} dict={locale === 'en' ? en : fr}>
          {children}
        </I18nProvider>
        {/*
          Two measurements, and they are not the same kind of thing.

          SpeedInsights reports how long pages took to render on real devices
          — durations only, no identifier, nothing that follows somebody from
          one page to the next. It is the only way to know whether this app is
          slow for the people using it rather than on this machine.

          Analytics counts page views. Vercel sets no cookie and stores no raw
          IP, but it does derive a visitor hash from IP, user-agent and the
          day, which is tracking under the GDPR however short-lived. That is
          why the privacy policy now says so plainly instead of claiming there
          is no audience measurement at all.
        */}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
