import type { Metadata } from 'next';
import { getLocale } from './i18n/server';
import type { Locale } from './i18n/locales';
import type { PublicPage } from './public-pages';

/**
 * Where this app lives, as an absolute URL.
 *
 * Needed by anything a crawler reads: a sitemap, a canonical link and an
 * hreflang all have to be absolute, and a relative one is silently ignored.
 *
 * VERCEL_PROJECT_PRODUCTION_URL is the stable production hostname, unlike
 * VERCEL_URL which changes with every deployment — a sitemap pointing at a
 * superseded deployment is worse than none.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}

/**
 * The canonical and hreflang for one public page.
 *
 * Each of the eight public pages has two addresses, and this is where they
 * are declared to be the same page in two languages. The canonical is the one
 * being rendered; the alternates name both, which is the only form Google
 * reads — an annotation set where fr and en are the same URL says the page is
 * its own translation, and is discarded.
 *
 * x-default is French: it is the language of the audience these pages were
 * written for, so it is the right answer for a reader whose own language is
 * neither.
 *
 * Declared per page, never in a layout: a canonical set in a layout is
 * inherited by every page under it, and each of them would then claim to be
 * a copy of that one URL — which reads as "do not index me".
 */
export function pageAlternates(page: PublicPage, locale: Locale) {
  return {
    canonical: locale === 'en' ? page.en : page.fr,
    languages: { fr: page.fr, en: page.en, 'x-default': page.fr },
  };
}

/**
 * Title, description and share card for one public page.
 *
 * The share card has to be repeated here rather than inherited. Next merges
 * metadata shallowly, and `openGraph` is one whole value: a page that declares
 * it replaces the root layout's entire object rather than adding to it. Set
 * only a title and a description and the card silently loses its image, which
 * is the half of it anybody actually sees in a group chat.
 *
 * `twitter` is the same object and the same trap, so it travels with it — a
 * page whose OG card says one thing and whose Twitter card says another is
 * worse than either alone.
 *
 * The locale is read rather than passed because it cannot then disagree with
 * the language the page actually renders in: both come from the URL, through
 * the same function.
 *
 * shareTitle exists because a search result and a group chat are not the same
 * room. A title has to survive being one line among ten competing for a
 * click; a share card is already being handed over by somebody trusted, and
 * can afford to say what the thing does instead. Where a page has nothing
 * different to say it passes neither, and they are the same sentence.
 */
export async function pageMetadata(
  page: PublicPage,
  title: string,
  description: string,
  shareTitle: string = title,
): Promise<Metadata> {
  const locale = await getLocale();
  const card = { title, description };
  const share = { title: shareTitle, description };

  return {
    ...card,
    alternates: pageAlternates(page, locale),
    openGraph: {
      ...share,
      type: 'website',
      siteName: 'Kadlio',
      locale: locale === 'en' ? 'en_US' : 'fr_FR',
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: shareTitle }],
    },
    twitter: { ...share, card: 'summary_large_image', images: ['/opengraph-image'] },
  };
}
