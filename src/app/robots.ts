import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * What a crawler may read.
 *
 * ── Why this was Disallow: / until now ─────────────────────────────────────
 *
 * Wish lists are private and sit behind a session, but a profile can be made
 * public in Réglages — and "public" there means "anybody with the link", not
 * "in Google". Somebody ticking that box is sharing with the people they send
 * it to, and would not expect their name and photo in a search result. So the
 * whole site was closed, which was right by default and wrong in the end: it
 * also hid the one page that exists to explain what Kado is.
 *
 * ── What is open, and what stays shut ──────────────────────────────────────
 *
 * Open: the landing page and the three legal pages. That is everything this
 * app has to say to a stranger.
 *
 * Shut, deliberately and by prefix rather than by page, so a route added
 * later under any of them is closed on the day it is written:
 *
 *   /u/         a person's profile — name, photo, interests
 *   /lists/     a list, which may be visible to anybody with the link
 *   /gifts/     a wish, same
 *   /i/         an invitation code, which is a credential
 *   /profile    and /settings, /friends, /notifications: signed-in only
 *   /uploads/   the files people upload
 *   /api/
 *
 * /login and /signup are reachable without a session and carry nothing worth
 * finding: an empty form in a search result helps nobody, and it competes
 * with the landing page for the same query.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/u/',
        '/lists/',
        '/gifts/',
        '/i/',
        '/profile',
        '/settings',
        '/friends',
        '/notifications',
        '/search',
        '/events',
        '/app',
        '/uploads/',
        '/api/',
        '/login',
        '/signup',
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
