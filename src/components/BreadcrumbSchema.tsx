import { getLocale } from '@/lib/i18n/server';
import { LANDING, pathFor, type PublicPage } from '@/lib/public-pages';
import { siteUrl } from '@/lib/site';

/**
 * The trail from the landing page to this one, in the form a result reads.
 *
 * Every public page already draws this trail on screen — the "← back to the
 * home page" link at the top is a breadcrumb in everything but markup. This
 * says the same thing in the one place a search engine looks, and it is one
 * of the few rich results Google still shows broadly.
 *
 * Two levels because there are two: this site has no section between the
 * landing and a page. Inventing a middle one to make the trail look deeper
 * would describe a structure that does not exist.
 */
export async function BreadcrumbSchema({ page, name }: { page: PublicPage; name: string }) {
  const locale = await getLocale();
  const base = siteUrl();
  const absolute = (path: string) => (path === '/' ? base : `${base}${path}`);

  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Kadlio',
        item: absolute(pathFor(LANDING, locale)),
      },
      { '@type': 'ListItem', position: 2, name, item: absolute(pathFor(page, locale)) },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Built from our own dictionary strings and PUBLIC_PAGES; no user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
