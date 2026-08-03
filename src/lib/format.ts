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

export const PRIORITY_LABELS = [
  '',
  'Ce serait sympa',
  "J'en ai vraiment envie",
  'Coup de cœur',
] as const;

export function priorityLabel(priority: number): string {
  return PRIORITY_LABELS[priority] ?? '';
}
