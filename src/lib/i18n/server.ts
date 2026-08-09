import { cache } from 'react';
import { headers } from 'next/headers';
import { getCurrentUser } from '../session';
import { en } from './en';
import { fr } from './fr';
import { isLocale, localeFromHeader, type Locale } from './locales';
import { translator, type Dictionary, type TFunction } from './t';

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

/**
 * Which language to answer this request in.
 *
 * The signed-in person's saved choice wins. Nobody signed in — the landing,
 * login and signup pages, and an invitation opened from a group chat — falls
 * back to what the browser asks for, so a first impression is not
 * automatically in the wrong language.
 *
 * Built on getCurrentUser() rather than its own session query: that function
 * is already `cache`d per request and already handles the account-deleted
 * race. A second copy of that lookup here is how the two drift apart.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const user = await getCurrentUser();
  if (user && isLocale(user.locale)) return user.locale;

  return localeFromHeader((await headers()).get('accept-language'));
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
