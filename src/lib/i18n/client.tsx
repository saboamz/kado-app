'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from './locales';
import {
  translateError,
  translator,
  type Dictionary,
  type TFunction,
} from './t';

/**
 * Translation inside client components.
 *
 * ── Why a context rather than props ────────────────────────────────────────
 *
 * A client component cannot read the request's locale, so the text has to
 * arrive from a server component either way. Passing labels as props works,
 * and it is what AppShell and OnboardingCard do — they are rendered in one
 * place each, so it costs one prop.
 *
 * PersonCard is rendered from search, friends, and a profile; GiftForm from
 * two routes. Threading a labels object through every caller means every new
 * string touches every caller, and one of them eventually gets missed. The
 * dictionary is small enough (a few kilobytes, gzipped inside the RSC
 * payload) that handing the whole thing over once is the cheaper trade.
 *
 * The provider sits in the app layout, so anything under it can call useT().
 */
const TContext = createContext<{
  t: TFunction;
  dict: Dictionary;
  locale: Locale;
} | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}) {
  // Built once per mount rather than per render: `translator` closes over the
  // locale's plural rules, and rebuilding it every render would drop that
  // cache on the floor.
  return (
    <TContext.Provider value={{ t: translator(locale, dict), dict, locale }}>
      {children}
    </TContext.Provider>
  );
}

/**
 * The translator, inside a client component.
 *
 * Throws when used outside the provider — a blank label is the kind of bug
 * that reaches production, and a loud failure at the first render does not.
 */
export function useT(): TFunction {
  const value = useContext(TContext);
  if (!value) throw new Error('useT() used outside <I18nProvider>');
  return value.t;
}

/** The active language, for Intl formatting inside a client component. */
export function useLocale(): Locale {
  const value = useContext(TContext);
  if (!value) throw new Error('useLocale() used outside <I18nProvider>');
  return value.locale;
}

/**
 * Turns an error key from a server action into a sentence.
 *
 * Returns a function rather than a string so a component can call it on
 * whichever of its several fields actually failed.
 */
export function useErrorText(): (value: string | undefined) => string | undefined {
  const value = useContext(TContext);
  if (!value) throw new Error('useErrorText() used outside <I18nProvider>');
  return (text) => translateError(value.t, value.dict, text);
}
