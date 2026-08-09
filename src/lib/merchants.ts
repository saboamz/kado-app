import { db } from './db';

/**
 * Naming a shop from the address its products come from.
 *
 * ── Why the table was empty, and why that mattered ─────────────────────────
 *
 * merchantForHost() looked a merchant up and created none, and nothing else
 * ever wrote to the table. So `Product.merchantId` was null on every row, and
 * two mechanisms that read it did nothing at all:
 *
 *   1. The `(merchantId, titleKey)` unique index — the second deduplication
 *      key. With a null merchant the composite never forms, so the same
 *      product reached by two different URLs at the same shop stayed two rows.
 *   2. applyDiversity's "at most 2 per merchant". Every row belonged to no
 *      merchant, so the cap could never bind and one shop could fill a whole
 *      list of suggestions.
 *
 * ── Why derived rather than curated ────────────────────────────────────────
 *
 * A hand-maintained list of shops is a permanent chore that is always one
 * merchant behind reality, and the value here is not the shop's real name —
 * it is having a STABLE IDENTIFIER shared by every product from the same
 * place. A domain already is one. The display name is derived from it and can
 * be corrected later without touching a single product row.
 */

/**
 * Suffixes where the registrable name is one label further left.
 *
 * `amazon.co.uk` must group as one shop, not as `co.uk`. This list is the
 * common cases rather than the full public suffix list: getting it wrong
 * splits one merchant into several, which costs a missed deduplication — not
 * a wrong merge, which would put another person's article on a wish list.
 */
const MULTI_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk',
  'com.au', 'net.au', 'org.au', 'com.br', 'com.mx', 'com.ar',
  'co.jp', 'ne.jp', 'or.jp', 'co.nz', 'co.za', 'co.in', 'com.tr',
  'com.cn', 'com.hk', 'com.sg', 'com.es', 'com.pl',
]);

/**
 * Subdomains that are the same shop wearing a hat.
 *
 * `shop.acme.com` and `acme.com` are one merchant; `marketplace.acme.com`
 * might genuinely not be, so only the obvious storefront prefixes are folded
 * in. Anything else keeps its own identity, which errs towards two merchants
 * rather than a wrong merge.
 */
const STOREFRONT_PREFIXES = new Set(['shop', 'store', 'boutique', 'www', 'm', 'fr', 'en']);

/**
 * The registrable domain a shop is identified by.
 *
 * Returns null for anything that is not a hostname, so callers never key a
 * merchant on a path fragment.
 */
export function merchantDomain(host: string): string | null {
  const clean = host.trim().toLowerCase().split(':')[0];
  if (!clean || !clean.includes('.')) return null;

  const labels = clean.split('.').filter(Boolean);
  if (labels.length < 2) return null;

  const lastTwo = labels.slice(-2).join('.');
  // Keep three labels for co.uk and friends, two otherwise.
  const keep = MULTI_PART_TLDS.has(lastTwo) ? 3 : 2;
  if (labels.length <= keep) return labels.join('.');

  const extra = labels.slice(0, labels.length - keep);
  const registrable = labels.slice(-keep).join('.');

  // A storefront prefix folds into the parent; anything else is its own shop.
  const allFolded = extra.every((label) => STOREFRONT_PREFIXES.has(label));
  return allFolded ? registrable : clean;
}

/**
 * A display name for a shop, from its domain.
 *
 * "suuupply.com" becomes "Suuupply", "la-brulerie.fr" becomes "La Brulerie".
 * A guess, and a correctable one: the name is what a person reads, while the
 * domain is what the data is keyed on, so fixing a name later moves nothing.
 */
export function merchantName(domain: string): string {
  const stem = domain.split('.')[0] ?? domain;
  return stem
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** The unique key a merchant row is created under. */
export function merchantSlug(domain: string): string {
  return domain.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Attaches merchants to rows written before merchants existed.
 *
 * Every product created up to now carries `merchantId: null`, because nothing
 * ever created a merchant to attach. findOrCreateProduct only resolves one on
 * the CREATE path — an existing row is never revisited — so those rows would
 * keep their null for as long as they live, and the two mechanisms that read
 * the column would go on doing nothing for them.
 *
 * Deliberately its own pass rather than a migration: it needs normalizeUrl
 * and the domain rules, which are TypeScript. Idempotent, so running it twice
 * is free, and bounded so it cannot become the longest thing in the night.
 */
export async function backfillMerchants(
  limit = 200,
): Promise<{ attempted: number; attached: number }> {
  const rows = await db.product.findMany({
    where: { merchantId: null, urlNorm: { not: null } },
    select: { id: true, urlNorm: true },
    take: limit,
  });

  let attached = 0;
  for (const row of rows) {
    const host = row.urlNorm?.split('/')[0]?.split(':')[0];
    const domain = host ? merchantDomain(host) : null;
    if (!domain || !host) continue;

    const existing = await db.merchant.findFirst({
      where: { domains: { hasSome: [host, domain] } },
      select: { id: true, domains: true },
    });

    let merchantId = existing?.id ?? null;
    if (!merchantId) {
      const slug = merchantSlug(domain);
      try {
        const created = await db.merchant.create({
          data: {
            slug,
            name: merchantName(domain),
            domains: host === domain ? [domain] : [domain, host],
          },
          select: { id: true },
        });
        merchantId = created.id;
      } catch {
        const raced = await db.merchant.findUnique({ where: { slug }, select: { id: true } });
        merchantId = raced?.id ?? null;
      }
    }
    if (!merchantId) continue;

    await db.product.update({ where: { id: row.id }, data: { merchantId } });
    attached += 1;
  }

  return { attempted: rows.length, attached };
}
