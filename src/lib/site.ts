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
