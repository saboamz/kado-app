import { db } from './db';

/**
 * Item-item collaborative filtering.
 *
 * ── Why item-item, and not matrix factorisation ──────────────────────────
 *
 * The matrix is implicit and nearly empty at launch: 0 to 3 gifts per
 * realistic user. ALS/BPR need hundreds of interactions per latent dimension
 * before they beat plain popularity, and hand back inexplicable embeddings
 * when the result is bad. User-user is worse still: users are the axis that is
 * both sparse AND volatile, so the neighbourhoods would be noise.
 *
 * Items accumulate signal, their similarity is stable over days, it
 * precomputes, and every recommendation gets a one-line explanation —
 * "parce que tu as offert la Chemex" — which is what becauseProductId stores.
 */

/**
 * λ in similarity = cosine × support/(support + λ).
 *
 * THE detail that decides whether this works at low volume. Cosine alone gives
 * 1.0 to any pair a single person bought together — which, in a sparse system,
 * is MOST pairs. The top of every list would be support-1 coincidences, and
 * that reads as a broken model rather than as a data problem.
 *
 * At λ=10: support 3 keeps 23% of the cosine, support 50 keeps 83%.
 */
export const SHRINKAGE = 10;

/** Below this, a pair is a coincidence rather than evidence. */
export const MIN_SUPPORT = 3;

/** How much gifting evidence must exist before the tier fires at all. */
export const CF_READY_THRESHOLD = 5_000;

/** Only committed intent trains the matrix. */
const GIFTING_KINDS = ['reserve', 'purchase', 'contribute'] as const;

/** Two years. Older taste is not this person's taste any more. */
const WINDOW_MONTHS = 24;

/**
 * Per-giver basket cap.
 *
 * The self-join is O(basket²) per giver, so one automated account with ten
 * thousand events would dominate the matrix AND the runtime. Capping is a
 * correctness measure as much as a performance one.
 */
const MAX_BASKET = 200;

/**
 * Is there enough gifting evidence for the CF to mean anything?
 *
 * A CF that fires on too little data is WORSE than no CF: it produces
 * confident nonsense, and confident nonsense is harder to notice than an empty
 * tier. Below the threshold the tier yields nothing and the cascade falls
 * through to content, which is a working product rather than a placeholder.
 */
export async function cfIsReady(): Promise<boolean> {
  const count = await db.giftEvent.count({
    where: { kind: { in: [...GIFTING_KINDS] }, productId: { not: null } },
  });
  return count >= CF_READY_THRESHOLD;
}

/** Diagnostic form: the number as well as the verdict. */
export async function cfReadiness(): Promise<{
  ready: boolean;
  events: number;
  threshold: number;
}> {
  const events = await db.giftEvent.count({
    where: { kind: { in: [...GIFTING_KINDS] }, productId: { not: null } },
  });
  return { ready: events >= CF_READY_THRESHOLD, events, threshold: CF_READY_THRESHOLD };
}

/**
 * Rebuilds the whole similarity table. Nightly, never on the serving path.
 *
 * Written as one statement so Postgres does the join rather than shipping the
 * basket of every user into Node. The pieces, in order:
 *
 *  - `basket`  resolves each event's product through mergedInto, so a
 *              deduplicated pair contributes ONE row rather than two. Without
 *              this the support threshold is never reached by either half and
 *              cf_item silently stays empty — the failure tierMix() exists to
 *              catch.
 *  - `capped`  applies MAX_BASKET per giver.
 *  - `conf`    log-damps the weight: ln(1 + Σw). Someone who reserved the same
 *              product four times is not four times the evidence.
 *  - `pairs`   the self-join, i < j so each unordered pair is counted once,
 *              then mirrored at the end.
 *  - the final select applies cosine and the shrinkage.
 */
export async function buildItemSimilarity(now = new Date()): Promise<number> {
  const since = new Date(now);
  since.setMonth(since.getMonth() - WINDOW_MONTHS);

  await db.$executeRawUnsafe('DELETE FROM "ItemSimilarity"');

  const inserted = await db.$executeRawUnsafe(
    `
    WITH basket AS (
      SELECT e."actorId" AS giver,
             COALESCE(p."mergedInto", e."productId") AS product,
             SUM(e.weight) AS w
      FROM "GiftEvent" e
      JOIN "Product" p ON p.id = e."productId"
      WHERE e.kind::text = ANY($1)
        AND e."productId" IS NOT NULL
        AND e."occurredAt" >= $2
        AND e.weight > 0
      GROUP BY 1, 2
    ),
    ranked AS (
      SELECT giver, product, w,
             ROW_NUMBER() OVER (PARTITION BY giver ORDER BY w DESC, product) AS rn
      FROM basket
    ),
    conf AS (
      -- Log-damped confidence, and the basket cap.
      SELECT giver, product, LN(1 + w) AS c
      FROM ranked
      WHERE rn <= $3
    ),
    norms AS (
      SELECT product, SQRT(SUM(c * c)) AS norm FROM conf GROUP BY product
    ),
    pairs AS (
      SELECT a.product AS p1, b.product AS p2,
             SUM(a.c * b.c) AS dot,
             COUNT(*)::int  AS support
      FROM conf a
      JOIN conf b ON a.giver = b.giver AND a.product < b.product
      GROUP BY 1, 2
      HAVING COUNT(*) >= $4
    ),
    scored AS (
      SELECT p1, p2, support,
             -- cosine, then shrunk toward zero by how thin the support is
             (dot / NULLIF(n1.norm * n2.norm, 0))
               * (support::float / (support + $5)) AS score
      FROM pairs
      JOIN norms n1 ON n1.product = p1
      JOIN norms n2 ON n2.product = p2
    )
    INSERT INTO "ItemSimilarity" ("productId", "neighborId", score, support, "computedAt")
    SELECT p1, p2, score, support, NOW() FROM scored WHERE score > 0
    UNION ALL
    -- Mirror: the join produced each pair once, but lookups go both ways.
    SELECT p2, p1, score, support, NOW() FROM scored WHERE score > 0
    `,
    [...GIFTING_KINDS],
    since,
    MAX_BASKET,
    MIN_SUPPORT,
    SHRINKAGE,
  );

  return inserted;
}

export type CfCandidate = {
  productId: string;
  score: number;
  becauseProductId: string;
};

/**
 * Neighbours of what the recipient already wants.
 *
 * ── THE LEAK ────────────────────────────────────────────────────────────
 * The seed set is the recipient's WISHES. Never the reservations on their
 * list: deriving a recommendation from who reserved what is the covert channel
 * the whole invariance suite exists to prevent.
 *
 * Serving is one indexed select against the precomputed table.
 */
export async function cfCandidates(
  recipientId: string,
  excluded: Set<string>,
  take: number,
): Promise<CfCandidate[]> {
  if (!(await cfIsReady())) return [];

  const wishes = await db.gift.findMany({
    where: { list: { ownerId: recipientId }, productId: { not: null } },
    select: { productId: true },
  });

  const seeds = [...new Set(wishes.map((w) => w.productId!).filter(Boolean))];
  if (seeds.length === 0) return [];

  const neighbours = await db.itemSimilarity.findMany({
    where: { productId: { in: seeds }, neighborId: { notIn: [...excluded, ...seeds] } },
    orderBy: { score: 'desc' },
    take: take * 3,
    select: { productId: true, neighborId: true, score: true },
  });

  // One row per neighbour, keeping its best-scoring reason — that reason is
  // what becomes "parce que tu as offert X".
  const best = new Map<string, CfCandidate>();
  for (const row of neighbours) {
    const current = best.get(row.neighborId);
    if (!current || row.score > current.score) {
      best.set(row.neighborId, {
        productId: row.neighborId,
        score: row.score,
        becauseProductId: row.productId,
      });
    }
  }

  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, take);
}

/** The shrinkage, exposed so its behaviour can be asserted directly. */
export function shrink(cosine: number, support: number, lambda = SHRINKAGE): number {
  return cosine * (support / (support + lambda));
}
