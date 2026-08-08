import { judge } from './catalogue-quality';
import { db } from './db';
import { normalizeUrl, priceBand, titleKey, urlHash } from './catalogue';
import type { Extracted } from './extract';

/**
 * Turning an extraction into one canonical catalogue row.
 *
 * The keys are tried in order of how much they prove:
 *   1. GTIN     — globally unique, survives across merchants
 *   2. urlHash  — the same page is the same product
 *   3. titleKey — same title AND same merchant; scoped, because the same title
 *                 at two merchants is two listings
 *
 * Anything looser would merge on a coincidence, and a wrong merge puts another
 * person's article on a real wish list. When nothing matches, a new row is the
 * right answer.
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
  const key = input.title ? titleKey(input.title) : null;

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

/** Matches a normalised URL's host to a known merchant, creating none. */
async function merchantForHost(urlNorm: string): Promise<string | null> {
  const host = urlNorm.split('/')[0]?.split(':')[0];
  if (!host) return null;
  const merchant = await db.merchant.findFirst({
    where: { domains: { has: host } },
    select: { id: true },
  });
  return merchant?.id ?? null;
}
