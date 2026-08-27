import type { MetadataRoute } from 'next';
import { LANDING, LEGAL_NOTICE, PRIVACY, TERMS, PUBLIC_PAGES } from '@/lib/public-pages';
import { siteUrl } from '@/lib/site';

/**
 * The pages worth finding: the landing, one page per search intent, and the
 * legal three — each at both of its addresses.
 *
 * Small on purpose, and it will stay small: everything else in this app is
 * somebody's private list. A sitemap is a statement about what is public, so
 * padding it with sign-in forms would be a claim that they matter.
 *
 * Both languages are listed, and each entry names the other as its alternate.
 * That is the second place hreflang is declared — the first being the link
 * tags on the page itself — and the two have to agree; they do, because both
 * are generated from PUBLIC_PAGES rather than written out twice.
 *
 * No lastModified: it would be the date of the deployment, not of the
 * content, and a date that moves every deploy teaches a crawler to ignore it.
 */
const LEGAL: readonly (typeof LANDING)[] = [LEGAL_NOTICE, PRIVACY, TERMS];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const absolute = (path: string) => (path === '/' ? base : `${base}${path}`);

  return PUBLIC_PAGES.flatMap((page) => {
    const isLegal = LEGAL.includes(page);
    const changeFrequency = isLegal ? ('yearly' as const) : ('monthly' as const);
    const priority = page === LANDING ? 1 : isLegal ? 0.3 : 0.7;
    const languages = { fr: absolute(page.fr), en: absolute(page.en) };

    return [page.fr, page.en].map((path) => ({
      url: absolute(path),
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  });
}
