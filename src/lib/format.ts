/**
 * Money is stored as integer cents and only ever becomes a decimal here.
 * Floats would accumulate rounding errors across pot contributions.
 */
export function formatMoney(cents: number | null, currency = 'EUR'): string {
  if (cents === null) return '—';
  return new Intl.NumberFormat('fr-FR', {
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

const RELATIVE = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelative(date: Date | string): string {
  const then = typeof date === 'string' ? new Date(date) : date;
  const diff = then.getTime() - Date.now();
  const abs = Math.abs(diff);

  if (abs < MINUTE) return "à l'instant";
  if (abs < HOUR) return RELATIVE.format(Math.round(diff / MINUTE), 'minute');
  if (abs < DAY) return RELATIVE.format(Math.round(diff / HOUR), 'hour');
  if (abs < 30 * DAY) return RELATIVE.format(Math.round(diff / DAY), 'day');
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
  }).format(then);
}

/**
 * Days until the next occurrence of a birthday, ignoring the year.
 * Returns 0 on the day itself.
 */
export function daysUntilBirthday(
  birthday: Date | string,
  from = new Date(),
): number {
  const b = typeof birthday === 'string' ? new Date(birthday) : birthday;
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
  return Math.round((next.getTime() - today.getTime()) / DAY);
}

export function formatBirthdayCountdown(days: number): string {
  if (days === 0) return "c'est aujourd'hui";
  if (days === 1) return 'demain';
  if (days < 31) return `dans ${days} jours`;
  const months = Math.round(days / 30);
  return months <= 1 ? 'dans un mois' : `dans ${months} mois`;
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
 * Written from the wisher's side — "Ça me ferait très plaisir" rather than a
 * rank — because the person reading them is choosing what to buy for someone
 * they like, not sorting a backlog.
 */
export const PRIORITY_LABELS = [
  '',
  'Une idée, sans plus',
  "J'aimerais bien",
  'Ça me ferait très plaisir',
] as const;

export function priorityLabel(priority: number): string {
  return PRIORITY_LABELS[priority] ?? '';
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
