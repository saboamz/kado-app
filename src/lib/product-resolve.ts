import { judge } from './catalogue-quality';
import { merchantDomain, merchantName, merchantSlug } from './merchants';
import { db } from './db';
import { normalizeUrl, priceBand, titleKey, urlHash } from './catalogue';
import type { Extracted } from './extract';

/**
 * Turning an extraction into one canonical catalogue row.
 *
 * The keys are tried in order of how much they prove:
 *   1. GTIN     — globally unique, survives across merchants
 *   2. urlHash  — the same page is the same product
 *   3. titleKey — same title AND same merchant, and ONLY for a row that has
 *                 no URL at all; scoped to the merchant, because the same
 *                 title at two shops is two listings
 *
 * Anything looser would merge on a coincidence, and a wrong merge puts another
 * person's article on a real wish list. When nothing matches, a new row is the
 * right answer.
 *
 * That third key is narrower than it looks, and the narrowing is load-bearing
 * — see the comment on `key` below. Two colours of the same jumper share a
 * shop and a title and differ only in the URL, so keying on the title would
 * both merge them on lookup and, through @@unique([merchantId, titleKey]),
 * stop the second one being stored at all.
 */

export type ResolveInput = Extracted & {
  sourceUrl: string | null;
  /**
   * The category the wisher picked for their gift.
   *
   * A merchant page does not carry OUR taxonomy — Extracted has no category
   * field and cannot have one — so the value comes from the person who added
   * the wish. They know what they want better than a keyword rule does, and
   * the list is closed, so what they pick is already canonical.
   *
   * Product.categoryId is what content_facet matches on; without this it
   * stays null and that tier finds nothing however many products exist.
   */
  categoryId?: string | null;
};

/** Follows mergedInto so a deduplicated pair contributes one row, not two. */
export async function resolveCanonical(productId: string): Promise<string> {
  let id = productId;
  // Bounded: a cycle from a bad backfill would otherwise spin forever.
  for (let hop = 0; hop < 8; hop++) {
    const row = await db.product.findUnique({
      where: { id },
      select: { mergedInto: true },
    });
    if (!row?.mergedInto) return id;
    id = row.mergedInto;
  }
  return id;
}

export async function findOrCreateProduct(input: ResolveInput) {
  const urlNorm = input.sourceUrl ? normalizeUrl(input.sourceUrl) : null;
  const hash = urlNorm ? urlHash(urlNorm) : null;
  const merchantId = urlNorm ? await merchantForHost(urlNorm) : null;
  /*
   * The title key is only SET when there is no URL to key on.
   *
   * It is the weakest of the three keys, and it became reachable for the
   * first time when merchants started being created — until then merchantId
   * was always null, so the composite never formed and this was dead weight.
   *
   * Live, and set on every row, it does two wrong things at once. It merges
   * genuine variants on lookup: "…/p/c?color=noir" and "…/p/c?color=blanc"
   * are one shop and one title, so the black one would land on the list of
   * somebody who asked for white. And the @@unique([merchantId, titleKey])
   * index then REFUSES to store the second variant at all, because the
   * database is asserting something that is not true — one title per shop is
   * not one product.
   *
   * So it is written exactly when it is used: as the fallback identity for a
   * row that has no URL. A row with a URL is identified by its hash, which is
   * stronger evidence of a distinct article than a shared title is of the
   * same one.
   */
  const key = !hash && input.title ? titleKey(input.title) : null;

  const existing =
    (input.gtin ? await db.product.findUnique({ where: { gtin: input.gtin } }) : null) ??
    (hash ? await db.product.findUnique({ where: { urlHash: hash } }) : null) ??
    (merchantId && key
      ? await db.product.findUnique({
          where: { merchantId_titleKey: { merchantId, titleKey: key } },
        })
      : null);

  if (existing) {
    const canonicalId = await resolveCanonical(existing.id);

    /*
     * Fill gaps only. Overwriting a good GTIN with a null from a weaker
     * extraction would lose the one key that identifies this across
     * merchants.
     *
     * The category needs a stronger rule than the rest. The other fields come
     * from the merchant's page, where a fresher read is a better read; the
     * category comes from a PERSON, and two people can legitimately disagree
     * about whether a bike is Sport or Voyage. `?? undefined` only skips a
     * null input — it would happily let the second wisher move everybody
     * else's row, making the category a race won by whoever saved last. So it
     * is written once, when the row has none.
     */
    const current = await db.product.findUnique({
      where: { id: canonicalId },
      select: { categoryId: true },
    });

    return db.product.update({
      where: { id: canonicalId },
      data: {
        gtin: input.gtin ?? undefined,
        imageUrl: input.imageUrl ?? undefined,
        brand: input.brand ?? undefined,
        description: input.description ?? undefined,
        priceCents: input.priceCents ?? undefined,
        priceBand: input.priceCents != null ? priceBand(input.priceCents) : undefined,
        categoryId: current?.categoryId ?? input.categoryId ?? undefined,
      },
    });
  }

  /*
   * The quality gate, applied only on CREATION.
   *
   * An existing row is not re-judged: it may already have been promoted by a
   * better read, and demoting it here would undo that on every weak revisit.
   * Promotion is the sweep's job — see promoteQuarantined().
   */
  const verdict = judge({
    title: input.title ?? null,
    brand: input.brand ?? null,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    gtin: input.gtin ?? null,
    priceCents: input.priceCents ?? null,
    currency: input.currency ?? null,
    extractedBy: input.extractedBy ?? null,
  });
  // Narrowing for the compiler: judge() already refuses a missing title with
  // reason 'no-title', so this is unreachable — it is what tells TypeScript so.
  if (verdict.kind === 'reject' || !input.title) return null;

  try {
    return await db.product.create({
      data: {
        /*
         * Quarantined rows exist but are not recommendable: every tier
         * filters on status: 'active'. A title with no price and no image is
         * a real gift often enough to keep — and too thin to suggest.
         */
        status: verdict.kind === 'quarantine' ? 'stale' : 'active',
        /*
         * Written, not merely computed.
         *
         * merchantId was resolved above and used for the lookup, then left
         * out of the row — so even once the Merchant table had contents,
         * every product would still have come out unattached, and both the
         * (merchantId, titleKey) key and the per-merchant diversity cap would
         * have gone on reading a column nothing ever filled.
         */
        merchantId,
        title: input.title,
        brand: input.brand,
        description: input.description,
        imageUrl: input.imageUrl,
        sourceUrl: input.sourceUrl,
        urlNorm,
        urlHash: hash,
        titleKey: key,
        gtin: input.gtin,
        priceCents: input.priceCents,
        currency: input.currency ?? 'EUR',
        priceBand: priceBand(input.priceCents),
        categoryId: input.categoryId ?? null,
        extractedBy: input.extractedBy,
      },
    });
  } catch {
    // Two people pasted the same link at the same moment and this one lost the
    // unique index. The row it wanted now exists, so read it back rather than
    // showing an error for what is a completely ordinary outcome.
    return (
      (hash ? await db.product.findUnique({ where: { urlHash: hash } }) : null) ??
      (input.gtin ? await db.product.findUnique({ where: { gtin: input.gtin } }) : null) ??
      (merchantId && key
        ? await db.product.findUnique({
            where: { merchantId_titleKey: { merchantId, titleKey: key } },
          })
        : null)
    );
  }
}

/**
 * The merchant a URL belongs to, creating the row the first time it is seen.
 *
 * It used to only look up, and nothing anywhere created a merchant — so the
 * table stayed empty, every product had a null merchantId, and the two
 * mechanisms that read it silently did nothing. See merchants.ts.
 *
 * `domains` accumulates every host that resolved here, so the registrable
 * domain stays the identity while `shop.acme.com` and `acme.com` remain
 * traceable to the row they produced.
 */
async function merchantForHost(urlNorm: string): Promise<string | null> {
  const host = urlNorm.split('/')[0]?.split(':')[0];
  if (!host) return null;

  const domain = merchantDomain(host);
  if (!domain) return null;

  // The host as written, then the registrable domain: a row created from
  // `acme.com` must be found again from `shop.acme.com`.
  const existing = await db.merchant.findFirst({
    where: { domains: { hasSome: [host, domain] } },
    select: { id: true, domains: true },
  });

  if (existing) {
    // Remember this spelling, so the next lookup matches on the first query.
    if (!existing.domains.includes(host)) {
      await db.merchant
        .update({ where: { id: existing.id }, data: { domains: { push: host } } })
        .catch(() => {});
    }
    return existing.id;
  }

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
    return created.id;
  } catch {
    // Two people pasted links to the same shop at the same moment and this one
    // lost the unique index on `slug`. The row it wanted now exists.
    const raced = await db.merchant.findUnique({ where: { slug }, select: { id: true } });
    return raced?.id ?? null;
  }
}
