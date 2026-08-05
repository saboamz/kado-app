import { cfCandidates } from './cf';
import { db } from './db';
import { nearestByTaste, tasteVector } from './embed';
import { categoriesForInterests } from './taxonomy';

/**
 * The recommendation cascade.
 *
 * Four tiers, tried in order of how much they know: cf_item -> content_vector
 * -> content_facet -> popularity. Each row records the strategy that produced
 * it, which is what makes per-tier CTR measurable and, more importantly, what
 * makes it possible to DELETE a tier that does not earn its keep.
 *
 * ── THE LEAK THAT MUST NOT REOPEN ──────────────────────────────────────────
 *
 * Nothing here may filter on other people's reservations. Excluding items
 * somebody else has taken looks like an obvious improvement and is a covert
 * channel: the list would encode reservation state, and an owner with a second
 * account could read it by difference over time, through a feature that has no
 * apparent connection to reservations.
 *
 * Three rules, enforced below:
 *   1. A viewer is never recommended for themselves — the direct oracle.
 *   2. Only the VIEWER's own reservations are excluded. They already know
 *      about those. Other people's are NOT excluded, so a gift that is already
 *      taken can be recommended. That is an accepted product cost; the
 *      alternative is a hidden channel. It is handled at interaction time.
 *   3. No input derives from reservations on the recipient's list. Taste comes
 *      from their WISHES and their INTERESTS.
 */

export const TIERS = ['cf_item', 'content_vector', 'content_facet', 'popularity'] as const;
export type Tier = (typeof TIERS)[number];

export type RecoRow = {
  productId: string;
  score: number;
  strategy: Tier;
  rank: number;
  becauseProductId: string | null;
};

export type RecommendArgs = {
  viewerId: string;
  recipientId: string | null;
  tier: Tier;
  limit?: number;
};

/** Max 2 per category and 2 per merchant. See applyDiversity. */
const MAX_PER_CATEGORY = 2;
const MAX_PER_MERCHANT = 2;

/**
 * Produces one tier's list.
 *
 * Kept as a single entry point so the invariance tests can hold every tier to
 * the same rule with the same call.
 */
export async function recommend(args: RecommendArgs): Promise<RecoRow[]> {
  const { viewerId, recipientId, tier } = args;
  const limit = args.limit ?? 12;

  // Rule 1. Refuses explicitly rather than returning nothing: an empty list is
  // indistinguishable from "we had no ideas", and this is a hard error.
  if (recipientId && recipientId === viewerId) {
    throw new Error('Un utilisateur ne peut pas être conseillé sur lui-même.');
  }

  const excluded = await excludedProductIds(viewerId, recipientId);

  const candidates = await candidatesFor(tier, recipientId, excluded, limit * 4);

  return applyDiversity(candidates, limit).map((c, i) => ({
    productId: c.productId,
    score: c.score,
    strategy: tier,
    rank: i + 1,
    becauseProductId: c.becauseProductId ?? null,
  }));
}

/**
 * What never appears in a list.
 *
 * Two sources, and the omission of a third is the point:
 *   - products the VIEWER has already reserved (rule 2 — they know already);
 *   - products already on the recipient's own list (they asked for it, so it
 *     is not a suggestion).
 *
 * NOT included: products reserved by anybody else. Adding them here is exactly
 * the leak. If a future change needs "already taken" behaviour, it belongs at
 * interaction time as a friend-to-friend disclosure, never in this query.
 */
async function excludedProductIds(
  viewerId: string,
  recipientId: string | null,
): Promise<Set<string>> {
  const mine = await db.reservation.findMany({
    where: { reserverId: viewerId },
    select: { gift: { select: { productId: true } } },
  });

  const excluded = new Set<string>();
  for (const row of mine) {
    if (row.gift.productId) excluded.add(row.gift.productId);
  }

  if (recipientId) {
    // The recipient's own wishes. Reservations ON that list are deliberately
    // not read — only the wishes themselves.
    const wished = await db.gift.findMany({
      where: { list: { ownerId: recipientId }, productId: { not: null } },
      select: { productId: true },
    });
    for (const row of wished) if (row.productId) excluded.add(row.productId);
  }

  return excluded;
}

type Candidate = {
  productId: string;
  score: number;
  categoryId: string | null;
  merchantId: string | null;
  becauseProductId?: string | null;
};

async function candidatesFor(
  tier: Tier,
  recipientId: string | null,
  excluded: Set<string>,
  take: number,
): Promise<Candidate[]> {
  switch (tier) {
    case 'content_facet':
      return contentFacet(recipientId, excluded, take);
    case 'popularity':
      return popularityTier(excluded, take);
    case 'cf_item':
      return cfTier(recipientId, excluded, take);
    case 'content_vector':
      return contentVector(recipientId, excluded, take);
  }
}

/**
 * cf_item — neighbours of what the recipient already wants.
 *
 * Gated on cfIsReady() inside cfCandidates: below the threshold it returns
 * nothing and the cascade falls through to content. A CF firing on too little
 * data produces confident nonsense, which is harder to notice than an empty
 * tier.
 *
 * The category and merchant are fetched only for the diversity pass — the
 * scoring is entirely from the precomputed similarity table.
 */
async function cfTier(
  recipientId: string | null,
  excluded: Set<string>,
  take: number,
): Promise<Candidate[]> {
  if (!recipientId) return [];

  const candidates = await cfCandidates(recipientId, excluded, take);
  if (candidates.length === 0) return [];

  const products = await db.product.findMany({
    where: { id: { in: candidates.map((c) => c.productId) }, status: 'active', mergedInto: null },
    select: { id: true, categoryId: true, merchantId: true },
  });
  const facets = new Map(products.map((p) => [p.id, p]));

  return candidates
    .filter((c) => facets.has(c.productId))
    .map((c) => ({
      productId: c.productId,
      score: c.score,
      categoryId: facets.get(c.productId)!.categoryId,
      merchantId: facets.get(c.productId)!.merchantId,
      becauseProductId: c.becauseProductId,
    }));
}

/**
 * content_vector — nearest neighbours of the recipient's taste vector.
 *
 * Returns nothing when nothing is embedded yet, so the cascade falls through
 * rather than taking a page down. The seed is the recipient's WISHES; no part
 * of this reads Reservation, which is the invariant the leak suite enforces.
 */
async function contentVector(
  recipientId: string | null,
  excluded: Set<string>,
  take: number,
): Promise<Candidate[]> {
  if (!recipientId) return [];

  const vector = await tasteVector(recipientId);
  if (!vector) return [];

  const neighbours = await nearestByTaste(vector, excluded, take);
  if (neighbours.length === 0) return [];

  const products = await db.product.findMany({
    where: { id: { in: neighbours.map((n) => n.productId) } },
    select: { id: true, categoryId: true, merchantId: true },
  });
  const facets = new Map(products.map((p) => [p.id, p]));

  return neighbours
    .filter((n) => facets.has(n.productId))
    .map((n) => ({
      productId: n.productId,
      score: n.score,
      categoryId: facets.get(n.productId)!.categoryId,
      merchantId: facets.get(n.productId)!.merchantId,
    }));
}

/**
 * content_facet — products matching the recipient's declared interests, in a
 * sensible price band, ranked by popularity.
 *
 * Pure SQL, works on day zero, and this is the tier that will carry the
 * traffic at launch. It is not a stopgap until the CF arrives; it is the
 * product being shipped.
 */
async function contentFacet(
  recipientId: string | null,
  excluded: Set<string>,
  take: number,
): Promise<Candidate[]> {
  if (!recipientId) return [];

  const interests = await db.interest.findMany({
    where: { userId: recipientId },
    select: { label: true },
  });
  if (interests.length === 0) return [];

  // Interests and categories are two different vocabularies: people declare
  // "Café" and "Randonnée", products are filed under "Maison" and "Sport".
  // Matching them with strict equality never matched anything, and did so
  // silently — an empty tier is indistinguishable from a tier with nothing to
  // suggest. categoriesForInterests bridges them.
  const categories = categoriesForInterests(interests.map((i) => i.label));
  if (categories.length === 0) return [];

  const rows = await db.product.findMany({
    where: {
      status: 'active',
      mergedInto: null, // never recommend a row that lost a dedup merge
      categoryId: { in: categories },
      id: { notIn: [...excluded] },
    },
    orderBy: [{ popularity: 'desc' }, { id: 'asc' }], // id breaks ties stably
    take,
    select: { id: true, popularity: true, categoryId: true, merchantId: true },
  });

  return rows.map((r) => ({
    productId: r.id,
    score: r.popularity,
    categoryId: r.categoryId,
    merchantId: r.merchantId,
  }));
}

/** popularity — the floor of the cascade. Always available, never empty. */
async function popularityTier(
  excluded: Set<string>,
  take: number,
): Promise<Candidate[]> {
  const rows = await db.product.findMany({
    where: {
      status: 'active',
      mergedInto: null,
      id: { notIn: [...excluded] },
    },
    orderBy: [{ popularity: 'desc' }, { id: 'asc' }],
    take,
    select: { id: true, popularity: true, categoryId: true, merchantId: true },
  });

  return rows.map((r) => ({
    productId: r.id,
    score: r.popularity,
    categoryId: r.categoryId,
    merchantId: r.merchantId,
  }));
}

/**
 * Diversity pass: at most 2 per category and 2 per merchant.
 *
 * Without it the top of a list is five variants of the same headphones, and
 * the feature looks stupid however good the scoring is. Applied after scoring
 * so it never changes the order of what survives — only which rows do.
 */
export function applyDiversity<T extends Candidate>(rows: T[], limit: number): T[] {
  const perCategory = new Map<string, number>();
  const perMerchant = new Map<string, number>();
  const kept: T[] = [];

  for (const row of rows) {
    if (kept.length >= limit) break;

    const category = row.categoryId ?? `__none-${row.productId}`;
    const merchant = row.merchantId ?? `__none-${row.productId}`;
    const seenCategory = perCategory.get(category) ?? 0;
    const seenMerchant = perMerchant.get(merchant) ?? 0;

    if (seenCategory >= MAX_PER_CATEGORY || seenMerchant >= MAX_PER_MERCHANT) continue;

    perCategory.set(category, seenCategory + 1);
    perMerchant.set(merchant, seenMerchant + 1);
    kept.push(row);
  }

  return kept;
}

/**
 * Runs the cascade: the first tier that returns anything wins.
 *
 * Returns the rows and the tier that produced them, because a list whose
 * provenance is unknown cannot be evaluated later.
 */
export async function recommendCascade(
  args: Omit<RecommendArgs, 'tier'>,
): Promise<{ rows: RecoRow[]; tier: Tier | null }> {
  for (const tier of TIERS) {
    const rows = await recommend({ ...args, tier });
    if (rows.length > 0) return { rows, tier };
  }
  return { rows: [], tier: null };
}

/**
 * Popularity, weighted by confidence and decayed over time.
 *
 * A raw count would let a product from a year ago outrank a current
 * best-seller forever, because history only accumulates. The half-life is 180
 * days: an event that old counts half as much as one from today.
 *
 * Recomputed from the event log rather than incremented, so a correction to
 * the weights or a purge of forged events actually takes effect.
 */
export const POPULARITY_HALF_LIFE_DAYS = 180;

export function decayedWeight(weight: number, ageDays: number): number {
  return weight * Math.pow(0.5, ageDays / POPULARITY_HALF_LIFE_DAYS);
}

/** Recomputes Product.popularity for every product with recent events. */
export async function refreshPopularity(now = new Date()): Promise<number> {
  // One statement, aggregated in the database.
  //
  // The first version read every event into a Map and issued one UPDATE per
  // product. Both halves scale with the log rather than with the catalogue:
  // at a million events that is a million rows crossing the wire, and the
  // per-product round trips dominate whatever is left. This is a nightly cron
  // query, so it has to be a query.
  //
  // The decay is the same 0.5^(age/half-life) as decayedWeight(), evaluated by
  // Postgres. EXTRACT(EPOCH …)/86400 is the age in days as a float.
  const updated = await db.$executeRawUnsafe(
    `
    WITH scored AS (
      SELECT e."productId" AS id,
             SUM(
               e.weight
               * POWER(
                   0.5,
                   EXTRACT(EPOCH FROM ($1::timestamptz - e."occurredAt")) / 86400.0 / $2
                 )
             ) AS score
      FROM "GiftEvent" e
      WHERE e."productId" IS NOT NULL
      GROUP BY 1
    )
    UPDATE "Product" p
    -- Negative evidence really can push a product below zero; clamping at 0
    -- would throw away the distinction between "disliked" and "unknown".
    SET popularity = ROUND(scored.score)
    FROM scored
    WHERE p.id = scored.id
    `,
    now,
    POPULARITY_HALF_LIFE_DAYS,
  );

  return updated;
}

/**
 * The share of each tier across a batch of stored recommendations.
 *
 * The health signal for phase 5: if cf_item's share does not rise as data
 * accumulates, the fault is DEDUPLICATION rather than the model — the signal
 * is split across duplicate product rows and no pair reaches the support
 * threshold.
 */
export async function tierMix(
  since: Date,
): Promise<Record<string, number>> {
  const rows = await db.recommendation.groupBy({
    by: ['strategy'],
    where: { generatedAt: { gte: since } },
    _count: { _all: true },
  });

  const total = rows.reduce((sum, r) => sum + r._count._all, 0);
  if (total === 0) return {};

  return Object.fromEntries(rows.map((r) => [r.strategy, r._count._all / total]));
}
