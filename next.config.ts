import type { NextConfig } from 'next';
import { PUBLIC_PAGES } from './src/lib/public-pages';

/*
 * Security headers.
 *
 * The project shipped none: no CSP, no HSTS, no frame-ancestors, no
 * Referrer-Policy. The last one matters here beyond the usual, because a gift
 * URL is the secret surface — /gifts/<id> is a page a friend is not supposed
 * to be able to hand to the list's owner, and outbound links to merchants are
 * exactly where a referrer would carry it.
 *
 * The CSP is deliberately readable rather than clever:
 *
 *  - 'unsafe-inline' stays in script-src because Next's hydration bootstrap is
 *    an inline script. Removing it needs a nonce, which needs middleware on
 *    every request; that is worth doing and is not worth doing blind, so it is
 *    written down here rather than half-done.
 *  - style-src likewise: CSS modules are extracted, but Next still inlines
 *    critical style on first paint.
 *  - img-src carries Giphy (profile decorations) and Vercel Blob (uploads,
 *    when a token is configured). data: is for the initials avatars.
 *  - frame-ancestors 'none' is the clickjacking answer, and covers what
 *    X-Frame-Options used to; the older header is kept for old browsers.
 */
/*
 * `next dev` runs the client through a runtime that eval()s modules —
 * react-refresh and the dev bundler need it. Under the production CSP the
 * browser refuses, React never hydrates, and every client-side handler in
 * the app is silently dead in dev while plain form posts keep working: the
 * kind of half-broken that reads as "the feature does nothing". The
 * production policy is untouched — no eval ships.
 */
const dev = process.env.NODE_ENV === 'development';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.giphy.com https://*.public.blob.vercel-storage.com",
  "font-src 'self'",
  "connect-src 'self' https://vitals.vercel-insights.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  /*
   * same-origin, not the browser default — and not no-referrer.
   *
   * The default leaks the origin cross-site, which is harmless. What is not
   * harmless is a gift page's URL travelling anywhere at all, and the app
   * sends people out to merchants from exactly those pages. same-origin sends
   * nothing at all cross-site, which is that guarantee; the merchant links in
   * OutboundLink carry rel="noreferrer" on top of it.
   *
   * This WAS no-referrer, which promises nothing more — same-origin referrers
   * never leave the site — and broke something real: under no-referrer the
   * Fetch spec serialises the Origin header of every same-origin POST as
   * "null" (whatwg/fetch #1030), and Next's dev server parses that header
   * with new URL(), so every form in the app answered 500 under `next dev`.
   */
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /*
   * `standalone` emits .next/standalone with a server.js and only the
   * dependencies actually reached, which is what the Dockerfile copies into
   * its runtime image.
   *
   * Vercel builds its own output format and does not want it, so the option
   * is switched off there. VERCEL is set by the platform on every build.
   * Leaving it on would have Next produce a server entrypoint nothing runs,
   * for a deployment that never reads it.
   */
  output: process.env.VERCEL ? undefined : 'standalone',

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },

  /*
   * The English address of each public page.
   *
   * A rewrite rather than a second copy of every route: the pages are already
   * language-agnostic — they read their words through getT(), which takes the
   * language from the URL — so the French route rendered at the English
   * address IS the English page. Duplicating eight route files to change
   * nothing but the folder they sit in would be eight files to keep in step.
   *
   * Middleware runs before this and sees the address the reader asked for,
   * which is what makes it work: /en/wedding-registry reaches the
   * /liste-de-mariage route with the pathname still saying English.
   *
   * The list is PUBLIC_PAGES itself, so an address cannot be added to the
   * sitemap and forgotten here.
   */
  async rewrites() {
    return PUBLIC_PAGES.map((page) => ({ source: page.en, destination: page.fr }));
  },
};

export default nextConfig;
