import { INTENT_PAGES, type IntentKey } from './intent-pages';
import type { Locale } from './i18n/locales';

/**
 * The pages a stranger can read, and their address in each language.
 *
 * ── Why these have a language in the URL and the rest of the app does not ──
 *
 * Everything behind a session keeps the model described in i18n/locales.ts:
 * language is a fact about the reader, carried by their account, and a list
 * opens in the language of whoever opens it. That is right for pages that
 * are private to a handful of friends, and it is what keeps every invitation
 * link already sent working — none of those addresses move.
 *
 * These eight are the exception, because they are the only pages written for
 * somebody who is not a reader yet. A search engine cannot choose a language
 * with an Accept-Language header it does not send, so one address answering
 * in two languages is one address it can index in one of them: the English
 * copy of these pages existed, was complete, and was unreachable. Giving it
 * an address is the whole of the fix.
 *
 * French keeps the bare path so that nothing that exists today moves.
 */
export const EN_PREFIX = '/en';

/**
 * Set by middleware, because a server component cannot ask which URL it is
 * rendering and the <html lang> attribute is decided in the root layout,
 * above every segment that knows the answer.
 */
export const PATHNAME_HEADER = 'x-kadlio-pathname';

export type PublicPage = { readonly fr: string; readonly en: string };

export const LANDING: PublicPage = { fr: '/', en: EN_PREFIX };
export const SECRET: PublicPage = { fr: '/le-secret', en: `${EN_PREFIX}/how-the-secret-works` };
export const LEGAL_NOTICE: PublicPage = { fr: '/mentions-legales', en: `${EN_PREFIX}/legal-notice` };
export const PRIVACY: PublicPage = { fr: '/confidentialite', en: `${EN_PREFIX}/privacy` };
export const TERMS: PublicPage = { fr: '/conditions', en: `${EN_PREFIX}/terms` };

/** The two addresses of one intent page, from the one place they are declared. */
export function intentPage(key: IntentKey): PublicPage {
  const entry = INTENT_PAGES.find((page) => page.key === key);
  // Unreachable: IntentKey is derived from INTENT_PAGES itself.
  if (!entry) throw new Error(`unknown intent page: ${key}`);
  return { fr: entry.slug, en: `${EN_PREFIX}${entry.en}` };
}

/** Everything a stranger can read, in the order a sitemap should list it. */
export const PUBLIC_PAGES: readonly PublicPage[] = [
  LANDING,
  ...INTENT_PAGES.map((entry) => intentPage(entry.key)),
  SECRET,
  LEGAL_NOTICE,
  PRIVACY,
  TERMS,
];

/**
 * The language this URL is, for the pages whose URL decides it.
 *
 * Returns null for everything else — the app, the auth forms, an invitation —
 * which is the signal to fall back to the account preference. A trailing
 * slash is tolerated because a crawler will try one.
 */
export function localeForPathname(pathname: string | null | undefined): Locale | null {
  if (!pathname) return null;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  for (const page of PUBLIC_PAGES) {
    if (path === page.en) return 'en';
    if (path === page.fr) return 'fr';
  }
  return null;
}

/** Which of a page's two addresses to link to, from a page in this language. */
export function pathFor(page: PublicPage, locale: Locale): string {
  return locale === 'en' ? page.en : page.fr;
}

/** The same page in the other language, for the link that offers it. */
export function counterpart(pathname: string | null | undefined): PublicPage | null {
  if (!pathname) return null;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PUBLIC_PAGES.find((page) => page.fr === path || page.en === path) ?? null;
}
