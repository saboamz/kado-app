import type { NextConfig } from 'next';

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
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
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
   * no-referrer, not the browser default.
   *
   * The default leaks the origin cross-site, which is harmless. What is not
   * harmless is a gift page's URL travelling anywhere at all, and the app
   * sends people out to merchants from exactly those pages.
   */
  { key: 'Referrer-Policy', value: 'no-referrer' },
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
};

export default nextConfig;
