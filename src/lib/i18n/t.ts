/**
 * Looking a phrase up, and filling in its blanks.
 *
 * ── Why a missing key cannot happen ────────────────────────────────────────
 *
 * The English dictionary is typed as `Dictionary`, which is derived from the
 * French one. Forget a key and `tsc` fails; add a key to French only and
 * `tsc` fails. There is no runtime fallback because a fallback is how half a
 * page silently stays in the wrong language for months — the compiler is a
 * better place to find out.
 *
 * ── Why the strings are flat, not nested ───────────────────────────────────
 *
 * `nav.home` reads no worse than `{ nav: { home } }` and keeps the type a
 * plain record, so the "English must match French exactly" check above is one
 * line rather than a recursive mapped type. It also makes a missing key
 * greppable by its literal name.
 */

import { fr } from './fr';

/** The shape every language must fill: exactly the keys French defines. */
export type Dictionary = typeof fr;
export type MessageKey = keyof Dictionary;

/**
 * A phrase that changes with a number.
 *
 * French and English disagree at zero — "0 envie" is singular, "0 items" is
 * plural — so a `> 1 ? 's' : ''` written into a component cannot be right in
 * both. Intl.PluralRules knows each language's own rule; the dictionary
 * supplies the forms and nothing in a component has to think about it.
 */
export type Plural = { one: string; other: string };

export type Values = Record<string, string | number>;

const PLURAL_RULES: Record<string, Intl.PluralRules> = {};

function pluralRules(locale: string): Intl.PluralRules {
  return (PLURAL_RULES[locale] ??= new Intl.PluralRules(locale));
}

/**
 * Substitutes `{name}` placeholders.
 *
 * Left as literal text when a value is missing, so a broken phrase shows
 * which blank was not filled instead of the word "undefined".
 */
function fill(template: string, values?: Values): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

/**
 * Builds the lookup function for one language.
 *
 * Returned rather than exported directly so a caller resolves the locale
 * once — per request on the server, once per mount on the client — instead of
 * every phrase re-reading it.
 */
export function translator(locale: string, dict: Dictionary) {
  return function t(key: MessageKey, values?: Values): string {
    const entry = dict[key];

    if (typeof entry === 'string') return fill(entry, values);

    // A plural phrase needs a number to choose its form.
    const count = Number(values?.count ?? 0);
    const form = pluralRules(locale).select(count) === 'one' ? entry.one : entry.other;
    return fill(form, values);
  };
}

export type TFunction = ReturnType<typeof translator>;

/**
 * Translates an error coming back from a server action.
 *
 * Actions return KEYS rather than sentences, because their validation schemas
 * are built at import time and cannot know the reader's language. This turns
 * one back into text.
 *
 * A value that is not a known key is passed through unchanged: some errors
 * carry text from elsewhere, and showing that is better than showing nothing.
 */
export function translateError(
  t: TFunction,
  dict: Dictionary,
  value: string | undefined,
): string | undefined {
  if (!value) return value;
  return value in dict ? t(value as MessageKey) : value;
}
