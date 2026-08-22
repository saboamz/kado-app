/**
 * The public pages that each answer one thing somebody searches for.
 *
 * One entry is one search intent — "liste de naissance", "cadeau commun" —
 * with its URL and the i18n prefix its copy lives under (`seo.<key>.*`).
 * Declared once and read from three places that must agree: the pages
 * themselves, the sitemap, and the links that make them discoverable.
 *
 * The slugs are French because the queries are: these pages exist for what
 * people type into a search box, and the audience types it in French. The
 * page itself still follows the reader's language, like every other page.
 */
export const INTENT_PAGES = [
  { slug: '/liste-de-souhaits', key: 'wishlist' },
  { slug: '/liste-de-naissance', key: 'birth' },
  { slug: '/liste-de-mariage', key: 'wedding' },
  { slug: '/cadeau-commun', key: 'group' },
] as const;

export type IntentKey = (typeof INTENT_PAGES)[number]['key'];
