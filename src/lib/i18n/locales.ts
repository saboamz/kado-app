/**
 * The languages the app speaks, and how a request decides which one.
 *
 * ── Why a preference and not a /fr /en URL ─────────────────────────────────
 *
 * Theme and currency are already account preferences, and language belongs
 * with them: it is a fact about the reader, not about the page. A URL prefix
 * would move every route, meaning every invitation link already sent would
 * need a redirect to keep working — a real cost paid by people who have
 * already shared something.
 *
 * The trade is honest and worth stating: a shared list renders in the
 * language of whoever OPENS it, not whoever sent it, and search engines see
 * one version. For an app whose pages are private to friends, neither is
 * load-bearing.
 */

export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

/** What each language calls itself — never translated. */
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks a starting language from the browser's Accept-Language header.
 *
 * Only used at signup, to choose a sensible default. It is a guess, so it
 * never overrides a choice already made — once somebody sets a language in
 * Settings, that is the answer forever.
 *
 * Quality values are honoured because a header like `en;q=0.4, fr;q=0.9` is
 * ordered by preference, not by position.
 */
export function localeFromHeader(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='))
        ?.slice(2);
      const quality = q === undefined ? 1 : Number.parseFloat(q);
      return {
        // `fr-CA` and `fr` are the same language for our purposes.
        base: (tag ?? '').trim().toLowerCase().split('-')[0] ?? '',
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((entry) => entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const entry of ranked) {
    if (isLocale(entry.base)) return entry.base;
  }
  return DEFAULT_LOCALE;
}
