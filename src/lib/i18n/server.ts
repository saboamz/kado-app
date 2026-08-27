import { cache } from 'react';
import { headers } from 'next/headers';
import { getCurrentUser } from '../session';
import { en } from './en';
import { fr } from './fr';
import { isLocale, localeFromHeader, type Locale } from './locales';
import { PATHNAME_HEADER, localeForPathname } from '../public-pages';
import { translator, type Dictionary, type TFunction } from './t';

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

/**
 * Which language to answer this request in.
 *
 * The URL wins where there is one to read: the eight public pages each have
 * a French and an English address, and the address is the answer.
 *
 * Everywhere else the signed-in person's saved choice wins, and nobody signed
 * in — login and signup, an invitation opened from a group chat — falls back
 * to what the browser asks for, so a first impression is not automatically in
 * the wrong language.
 *
 * Built on getCurrentUser() rather than its own session query: that function
 * is already `cache`d per request and already handles the account-deleted
 * race. A second copy of that lookup here is how the two drift apart.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const requestHeaders = await headers();

  /*
   * A public page is whatever language its URL says, and nothing overrides
   * it — not the account, not the browser. That is the point of giving it an
   * address: /liste-de-mariage is the French page, and it has to still be the
   * French page when Googlebot, or a signed-in English speaker, asks for it.
   * Anyone who wants the other one has a link to it and a URL they can keep.
   */
  const fromUrl = localeForPathname(requestHeaders.get(PATHNAME_HEADER));
  if (fromUrl) return fromUrl;

  const user = await getCurrentUser();
  if (user && isLocale(user.locale)) return user.locale;

  return localeFromHeader(requestHeaders.get('accept-language'));
});

/**
 * The translator for this request.
 *
 * `const t = await getT()` at the top of a server component, then `t('key')`
 * everywhere below it.
 */
export const getT = cache(async (): Promise<TFunction> => {
  const locale = await getLocale();
  return translator(locale, DICTIONARIES[locale]);
});

/** The translator for a locale already known — used where there is no request
    to read from, such as a background job addressing one person. */
export function translatorFor(locale: Locale): TFunction {
  return translator(locale, DICTIONARIES[locale]);
}
