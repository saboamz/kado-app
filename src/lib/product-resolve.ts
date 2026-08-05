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

export type ResolveInput = Extracted & { sourceUrl: string | null };

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
    // Fill gaps only. Overwriting a good GTIN with a null from a weaker
    // extraction would lose the one key that identifies this across merchants.
    return db.product.update({
      where: { id: canonicalId },
      data: {
        gtin: input.gtin ?? undefined,
        imageUrl: input.imageUrl ?? undefined,
        brand: input.brand ?? undefined,
        description: input.description ?? undefined,
        priceCents: input.priceCents ?? undefined,
        priceBand: input.priceCents != null ? priceBand(input.priceCents) : undefined,
      },
    });
  }

  if (!input.title) return null; // a product with no name is not a product

  try {
    return await db.product.create({
      data: {
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
