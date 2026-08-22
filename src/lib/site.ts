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
 * Every entry points at the same path: the language follows the account
 * preference and Accept-Language, not the URL, so there is no /fr or /en to
 * name. Saying so explicitly stops a crawler treating the two renderings of
 * one address as duplicate content.
 *
 * Declared per page, never in a layout: a canonical set in a layout is
 * inherited by every page under it, and each of them would then claim to be
 * a copy of that one URL — which reads as "do not index me".
 */
export function pageAlternates(path: string) {
  return {
    canonical: path,
    languages: { fr: path, en: path, 'x-default': path },
  };
}
