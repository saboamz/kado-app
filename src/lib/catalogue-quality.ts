/**
 * Whether an extraction is good enough to recommend.
 *
 * ── The problem ────────────────────────────────────────────────────────────
 *
 * A row entered the catalogue on one condition: it had a title. The `<title>`
 * fallback always produces one, so a captcha page, a 404 and a bot check all
 * became products — `active`, and therefore recommendable. Production held two
 * rows and one of them was called "Captcha".
 *
 * ── Why two separate judgements ────────────────────────────────────────────
 *
 * The obvious fix — refuse anything that came from the `<title>` fallback with
 * no price and no image — is not precise enough. Run the extractor over a real
 * spread of pages and a legitimate gift on a small association's site produces
 * exactly the same signature as the captcha page: title only, no price, no
 * image. That filter does not separate junk from products; it separates sites
 * that publish structured metadata from sites that do not, which is a
 * different question and not the one being asked.
 *
 * So there are two judgements, and they carry different confidence:
 *
 *   1. Some titles are NEVER products. "Captcha", "404 Not Found", "Just a
 *      moment…" are page states. Certain enough to refuse the row outright.
 *
 *   2. A thin extraction MIGHT be a product — the association's membership
 *      fee is a real gift. Not certain enough to refuse, so the row is
 *      created and held back from recommendation instead, in `stale`. A later
 *      read that finds more promotes it.
 *
 * The second is what `Product.status` was declared for. Until now nothing ever
 * wrote anything but 'active' to it, so the filter every recommender tier
 * applies faithfully — `status: 'active'` — filtered nothing at all.
 */

import type { Extracted } from './extract';

/**
 * Titles that describe the state of a page rather than a thing for sale.
 *
 * Anchored and matched against the folded title, so "404" alone is caught but
 * "Objectif 404 pages" is not. Kept deliberately short: every entry here is a
 * claim that no product on earth is called this, and a wrong entry silently
 * drops real gifts. Anything less certain belongs in quarantine, not here.
 */
const NON_PRODUCT_TITLES: RegExp[] = [
  /^captcha$/,
  /^just a moment/,
  /^(?:un )?(?:instant|moment)(?:\.{3}|…)?$/,
  /^attention required/,
  /^are you (?:a )?human/,
  /^(?:veuillez )?v[eé]rifi(?:er|cation)/,
  /^checking your browser/,
  /^\d{3} (?:not found|forbidden|error|service unavailable|bad gateway)$/,
  /^(?:page )?(?:not found|non trouv[eé]e|introuvable)$/,
  /^(?:error|erreur)(?: \d{3})?$/,
  /^(?:access|acc[eè]s) (?:denied|refus[eé])$/,
  /^forbidden$/,
  /^unauthorized$/,
  /^service unavailable$/,
  /^robot|^bot detection/,
  /^security check/,
  /^one more step$/,
  /^site (?:maintenance|en maintenance)$/,
  /^maintenance$/,
];

/** Case, accents and surrounding noise removed, for matching. */
function fold(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    // A merchant's name is often appended: "404 Not Found | Shop".
    .replace(/\s*[|·—–-]\s*[^|·—–-]{1,40}$/, '')
    .trim();
}

/**
 * True when the page told us what it is, and it is not a product.
 *
 * Only consulted for weak extractions: a page carrying real json-ld product
 * data is a product whatever its `<title>` says, and second-guessing that
 * would throw away the most reliable signal there is.
 */
export function isNonProductTitle(title: string): boolean {
  const folded = fold(title);
  if (!folded) return true;
  return NON_PRODUCT_TITLES.some((pattern) => pattern.test(folded));
}

export type Verdict =
  /** Nothing identifiable. No row at all. */
  | { kind: 'reject'; reason: 'no-title' | 'non-product-title' }
  /** Good enough to recommend. */
  | { kind: 'active' }
  /** Might be a product; held back until a better read arrives. */
  | { kind: 'quarantine'; reason: 'thin' };

/**
 * What to do with an extraction.
 *
 * Returned as a value rather than applied here so the decision can be tested
 * on its own and read in one place, instead of being spread across conditions
 * at the call site.
 */
export function judge(extracted: Extracted): Verdict {
  if (!extracted.title?.trim()) return { kind: 'reject', reason: 'no-title' };

  /*
   * Structured data outranks the title.
   *
   * json-ld, Open Graph and microdata are markup a merchant wrote ON PURPOSE
   * to describe a product. A page that carries it is a product page, and its
   * <title> is then just decoration. Only the fallbacks — where the title is
   * ALL we have — get second-guessed.
   *
   * 'reader' belongs here with 'title'. It carries a name and nothing else by
   * design, so the same two questions apply: is this a page state rather than
   * a product, and is one bare string enough to put in front of somebody as a
   * suggestion. Left out, a proxy rendering of a captcha page would sail in
   * as active — which is the exact failure this file was written to end.
   */
  const weak =
    extracted.extractedBy === 'title' ||
    extracted.extractedBy === 'reader' ||
    extracted.extractedBy === null;

  if (weak && isNonProductTitle(extracted.title)) {
    return { kind: 'reject', reason: 'non-product-title' };
  }

  /*
   * A price or an image is the line.
   *
   * Either one means the page described the thing, not just named it. Neither
   * means we have a string and nothing else — which is a real gift often
   * enough to keep, and too thin to put in front of somebody as a suggestion.
   */
  const described = extracted.priceCents != null || Boolean(extracted.imageUrl);
  if (weak && !described) return { kind: 'quarantine', reason: 'thin' };

  return { kind: 'active' };
}
