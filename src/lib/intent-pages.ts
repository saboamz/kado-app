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
 * English slug is English for exactly the same reason — "liste de mariage"
 * is not what an English speaker types, so translating the page but not its
 * address would answer a query nobody makes.
 */
export const INTENT_PAGES = [
  { slug: '/liste-de-souhaits', en: '/wishlist', key: 'wishlist' },
  { slug: '/liste-de-naissance', en: '/baby-registry', key: 'birth' },
  { slug: '/liste-de-mariage', en: '/wedding-registry', key: 'wedding' },
  { slug: '/cadeau-commun', en: '/group-gift', key: 'group' },
] as const;

export type IntentKey = (typeof INTENT_PAGES)[number]['key'];
