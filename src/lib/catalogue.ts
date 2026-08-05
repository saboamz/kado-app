import { createHash } from 'node:crypto';

/**
 * Resolving a free-text link to a canonical product row.
 *
 * Two people wanting the same thing is only a signal if both wishes resolve to
 * the same row. Everything here exists to make that resolution deterministic:
 * if it fragments, the co-occurrence matrix is empty and the recommender looks
 * like a bad model when the real fault is that `?utm_source=` survived.
 */

/**
 * Query parameters that identify the *referrer*, not the product.
 *
 * The two halves are deliberately separate, and the split is the whole point.
 * A single prefix pattern like /^(utm_|gclid|ref|source)/ also eats
 * `?refresh=`, `?reference=`, `?refurbished=` — real product parameters. A
 * refurbished unit is a different item at a different price; merging it with
 * the new one puts the wrong article on somebody's list.
 *
 * So: families that genuinely have a prefix are matched as prefixes, and
 * everything else is matched as an exact name, anchored with $.
 */
const TRACKING =
  /^(?:utm_|mc_|_branch|pk_|piwik_|matomo_|hsa_|epik|ttclid)|^(?:gclid|dclid|gbraid|wbraid|fbclid|msclkid|yclid|ref|referrer|referer|source|igshid|srsltid|th|psc|cmpid|campaign|affiliate_id|aff|tag|linkCode|creative|creativeASIN|ascsubtag|smid|spm|scm|_ga|_gl|si|feature|trk|trkid|cid|sid_|ir_|irclickid)$/;

/** Hosts whose path already carries the identity; extra params are noise. */
const PORT_FOR = new Map([
  ['http:', '80'],
  ['https:', '443'],
]);

/**
 * Canonical form of a product URL.
 *
 * Drops scheme, `www.`, fragment, trailing slash, default port and tracking
 * parameters, then sorts what remains — `?a=1&b=2` and `?b=2&a=1` are one page,
 * and a stable order is what makes the hash of them equal.
 *
 * Returns null for anything that is not an http(s) URL, so callers never hash
 * a `javascript:` or `mailto:` string into the catalogue.
 */
export function normalizeUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!host) return null;

  // An explicit :443 and an implicit one are the same page.
  const port = url.port && url.port !== PORT_FOR.get(url.protocol) ? `:${url.port}` : '';

  // Case is significant in a path on most servers, so it is preserved — but a
  // trailing slash never distinguishes a product page from itself.
  const path = url.pathname.replace(/\/+$/, '');

  const params = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING.test(key))
    // Sort on key *and* value: ?size=M&size=L is one page whichever order the
    // merchant emitted the repeats in.
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

  const query = params.length
    ? '?' + params.map(([k, v]) => `${k}=${v}`).join('&')
    : '';

  return `${host}${port}${path}${query}`;
}

/** SHA-256 of the normalised URL: the primary deduplication key. */
export function urlHash(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Secondary dedup key for when there is no shared URL.
 *
 * Case-folded, de-accented, punctuation-stripped, whitespace-collapsed, so
 * "Théière en Fonte 1,2L" and "theiere en fonte 1.2l" meet. Scoped per
 * merchant in the schema, because the same title at two merchants is two
 * listings and only a GTIN can prove they are one product.
 */
export function titleKey(title: string): string | null {
  const key = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return key || null;
}

/** Price bands, for "in the right range" filtering without exposing a price. */
export function priceBand(cents: number | null): number | null {
  if (cents === null || cents < 0) return null;
  const euros = cents / 100;
  if (euros < 15) return 1;
  if (euros < 30) return 2;
  if (euros < 60) return 3;
  if (euros < 120) return 4;
  if (euros < 250) return 5;
  if (euros < 500) return 6;
  return 7;
}

/**
 * Parses a displayed price into integer cents, or null when it is ambiguous.
 *
 * The factor-of-100 error: '1.299' is 1,29 € under one convention and 1 299 €
 * under the other. Guessing wrong puts a 1 299 € item in a 13 € band and it
 * silently poisons every price-filtered recommendation.
 *
 * Rule: the last separator wins, EXCEPT when it is followed by exactly three
 * digits and there is no other separator — that is a thousands group. Four or
 * more decimals is not a price at all. Refuse rather than guess.
 */
export function parsePrice(input: string): number | null {
  if (!input) return null;

  // French prices carry non-breaking spaces ( ) and narrow ones
  // ( ) as thousands separators; they arrive invisible from scraped HTML.
  const cleaned = input
    .replace(/[   \s]/g, '')
    .replace(/[^\d.,-]/g, '');

  if (!cleaned || !/\d/.test(cleaned)) return null;
  if (cleaned.startsWith('-')) return null; // a negative price is not a price

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const lastSep = Math.max(lastComma, lastDot);

  if (lastSep === -1) {
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }

  const after = cleaned.slice(lastSep + 1);
  if (!/^\d+$/.test(after)) return null;

  // Four+ trailing digits is not a decimal fraction of a price.
  if (after.length >= 4) return null;

  const before = cleaned.slice(0, lastSep);
  const otherSeps = (before.match(/[.,]/g) ?? []).length;

  let whole: string;
  let frac: string;

  if (after.length === 3) {
    // Exactly three: thousands group unless an earlier separator already
    // played that role (1.234,567 → the comma is decimal, and 567 is
    // three decimals, which is not a price either).
    if (otherSeps > 0) return null;
    whole = before + after;
    frac = '';
  } else {
    whole = before.replace(/[.,]/g, '');
    frac = after;
  }

  if (!/^\d*$/.test(whole)) return null;
  const cents = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0').slice(0, 2) || '0');
  return Number.isFinite(cents) ? cents : null;
}
