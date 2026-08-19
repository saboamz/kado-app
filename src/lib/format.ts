/**
 * Money is stored as integer cents and only ever becomes a decimal here.
 * Floats would accumulate rounding errors across pot contributions.
 */

import type { TFunction } from './i18n/t';

/**
 * How a number, a date or an amount is written.
 *
 * Defaulted to French rather than made a required argument: these are called
 * from a dozen places, and a default keeps the change to the ones that
 * actually have a locale to hand. Every call site inside the app passes one —
 * the default is for tests and for the odd server-side caller with no request.
 */
export type FormatLocale = 'fr' | 'en';

const BCP47: Record<FormatLocale, string> = { fr: 'fr-FR', en: 'en-GB' };

export function formatMoney(
  cents: number | null,
  currency = 'EUR',
  locale: FormatLocale = 'fr',
): string {
  if (cents === null) return '—';
  return new Intl.NumberFormat(BCP47[locale], {
    style: 'currency',
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Parses "1 599,90" or "1599.90" into cents. Returns null if unparseable. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[\s €]/g, '').replace(',', '.');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

const RELATIVE: Record<FormatLocale, Intl.RelativeTimeFormat> = {
  fr: new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' }),
  en: new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' }),
};
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelative(
  date: Date | string,
  locale: FormatLocale = 'fr',
  t?: TFunction,
): string {
  const then = typeof date === 'string' ? new Date(date) : date;
  const diff = then.getTime() - Date.now();
  const abs = Math.abs(diff);
  const relative = RELATIVE[locale];

  // Intl has no unit below a minute, so this one phrase comes from the
  // dictionary. Without a translator it stays French, which is the default
  // this function has always had.
  if (abs < MINUTE) return t ? t('time.justNow') : 'à l’instant';
  if (abs < HOUR) return relative.format(Math.round(diff / MINUTE), 'minute');
  if (abs < DAY) return relative.format(Math.round(diff / HOUR), 'hour');
  if (abs < 30 * DAY) return relative.format(Math.round(diff / DAY), 'day');
  return new Intl.DateTimeFormat(BCP47[locale], {
    day: 'numeric',
    month: 'long',
  }).format(then);
}

/**
 * Days until the next occurrence of a day-and-month, ignoring the year.
 * Returns 0 on the day itself.
 *
 * Takes the two numbers rather than a Date because that is how an event is
 * stored: there is no year to carry, and inventing one only to throw it away
 * is how a 29 February quietly becomes 1 March.
 */
export function daysUntilDate(
  day: number,
  month: number,
  from = new Date(),
): number {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  /*
   * A 29 February in a common year is not a date: new Date(2026, 1, 29)
   * silently becomes 1 March, which would have this return 0 on 1 March every
   * year rather than counting to the next real 29th. Rejecting the roll-over
   * and trying the following year is what finds it.
   */
  for (let year = today.getFullYear(); year <= today.getFullYear() + 8; year++) {
    // month is 1-12 in the database and 0-11 in a Date.
    const candidate = new Date(year, month - 1, day);
    if (candidate.getMonth() !== month - 1) continue;
    if (candidate < today) continue;
    return Math.round((candidate.getTime() - today.getTime()) / DAY);
  }

  // Unreachable for any day/month the schema accepts: a leap day is at most
  // eight years out, and every other date occurs annually.
  return 0;
}

export function formatDateCountdown(days: number, t: TFunction): string {
  if (days === 0) return t('time.today');
  if (days === 1) return t('time.tomorrow');
  if (days < 31) return t('time.inDays', { count: days });
  const months = Math.round(days / 30);
  return months <= 1 ? t('time.inOneMonth') : t('time.inMonths', { count: months });
}

/** Initials for the avatar fallback. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

/**
 * The hue an avatar takes, derived from the name.
 *
 * The design pairs a light tint with dark text of the same hue — legible at
 * 26px, and never fighting the two colours that carry meaning (turquoise for
 * actions, ochre for the secret). The stored `avatarColor` could not be used
 * for that: those are saturated hexes from the previous palette, one of them
 * near-black, and a solid fill of an arbitrary hex is exactly what the design
 * replaces.
 *
 * Derived rather than stored, so it needs no migration and stays stable for a
 * given person: the same name always yields the same hue.
 */
export function avatarHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}

/** Background and foreground for an avatar, as the design specifies them. */
export function avatarTint(name: string): { bg: string; fg: string } {
  const hue = avatarHue(name);
  return {
    bg: `oklch(0.88 0.07 ${hue})`,
    fg: `oklch(0.34 0.11 ${hue})`,
  };
}

/**
 * Priority labels, in the design's wording.
 *
 * Written from the wisher's side — "I'd love it" rather than a rank — because
 * the person reading them is choosing what to buy for someone they like, not
 * sorting a backlog.
 *
 * Takes the translator rather than reading a module-level array: that array
 * was evaluated at import, so it could only ever hold one language.
 */
export function priorityLabel(priority: number, t: TFunction): string {
  if (priority === 1) return t('priority.1');
  if (priority === 2) return t('priority.2');
  if (priority === 3) return t('priority.3');
  return '';
}

/**
 * The occasion, unless it is just the list's name again.
 *
 * Most lists are named after their occasion — "Anniversaire", "Noël" — and
 * printing both rendered the same word twice, one line under the other. It
 * earns its line only when it says something the name does not.
 *
 * Shared by the list index and the list detail so the two cannot disagree
 * about when a list looks like it has an occasion.
 */
export function distinctOccasion(
  name: string,
  occasion: string | null | undefined,
): string | null {
  if (!occasion) return null;
  const same = occasion.trim().toLowerCase() === name.trim().toLowerCase();
  return same ? null : occasion;
}
