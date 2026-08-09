import { priceBand } from './catalogue';
import { judge } from './catalogue-quality';
import { db } from './db';
import { EMPTY, extractProduct } from './extract';
import { fetchViaReader, readerTitle } from './reader-fallback';
import { findOrCreateProduct } from './product-resolve';
import { fetchHtml } from './fetch-page';
import { LINK_FETCH_PER_USER, rateLimit, recordAttempt } from './rate-limit';
import { checkUrl } from './ssrf';

/**
 * Linking a wish to the canonical thing it points at.
 *
 * ── Why this file exists ───────────────────────────────────────────────────
 *
 * The catalogue machinery was already here — extraction, three-key
 * deduplication, canonical resolution, all tested — and connected to nothing.
 * previewProduct() in catalogue-actions.ts was the only caller of
 * findOrCreateProduct(), and no component ever called previewProduct(). So
 * Product stayed empty in production, Gift.productId stayed null, and the two
 * recommender tiers that depend on it could never fire however much traffic
 * arrived. This closes that gap.
 *
 * ── Why it never blocks the save ───────────────────────────────────────────
 *
 * Reading a merchant page means an outbound request to a server we do not
 * control: it can be slow, paywalled, JS-rendered, or simply refuse a bot.
 * None of that is the wisher's problem, and none of it should cost them their
 * gift. So the gift is written first and this runs after, failing silently.
 * A wish with no product row is a completely ordinary outcome — it is what
 * "un week-end en Islande" will always be.
 */

/**
 * Resolves a gift's URL to a product row and attaches it.
 *
 * Returns the product id when one was linked, null otherwise. Never throws:
 * every failure path is a link we could not make, not an error to surface.
 */
export async function linkGiftToProduct(
  giftId: string,
  url: string | null,
  categoryId: string | null,
  userId: string,
  /**
   * Whether to fall back to the reading proxy when the direct read fails.
   *
   * On by default, because that is the whole point. Off for the nightly
   * sweep, which already retries a link every night and would otherwise turn
   * one failed save into an outbound proxy request per gift per night, for
   * gifts that have already failed both ways.
   */
  useReader = true,
): Promise<string | null> {
  if (!url) return null;

  /*
   * Every read costs one from the person's hourly budget.
   *
   * This is our server fetching a URL somebody else chose. Unbounded, a loop
   * of saves turns the app into a relay: a burst of requests from our address
   * to a target of their choosing, spending the function quota on the way.
   *
   * Recorded whatever the outcome, unlike the sign-in limiter where only
   * failures count — there the thing being limited is guessing, here it is
   * the outbound request itself, and a successful fetch costs exactly as much
   * as a failed one.
   */
  const budget = await rateLimit('link:fetch', userId, LINK_FETCH_PER_USER);
  if (!budget.allowed) return null;
  await recordAttempt('link:fetch', userId);

  // The SSRF guard runs before the fetch. A pasted link is attacker
  // controlled, and this runs server-side with whatever network the host
  // gives us.
  const verdict = await checkUrl(url);
  if (!verdict.ok) return null;

  let extracted;
  try {
    extracted = extractProduct(await fetchHtml(verdict.url.href));
  } catch {
    /*
     * The direct read failed — 403, a bot check, a timeout. Ordinary, and
     * silent: the gift is already saved and must not depend on a shop being
     * reachable.
     *
     * Before giving up, one more attempt through the reading proxy, which
     * gets past the refusals a server-side request collects. It returns a
     * TITLE only, never a price — see reader-fallback.ts for the measurements
     * behind that. A named row is worth having; a guessed price is not.
     *
     * The try block stays deliberately narrow. Wrapping the database work
     * below in it as well — which this used to do — meant a Prisma error or a
     * violated constraint was swallowed with the same silence, and the
     * catalogue stayed empty with nothing to say why.
     */
    if (!useReader) return null;

    const title = await fetchViaReader(verdict.url.href)
      .then(readerTitle)
      .catch(() => null);

    if (!title) return null;

    extracted = { ...EMPTY, title, extractedBy: 'reader' as const };
  }

  // No title means nothing identifiable was found; a row with no name is not
  // a product.
  if (!extracted.title) return null;

  const product = await findOrCreateProduct({
    ...extracted,
    sourceUrl: verdict.url.href,
    categoryId,
  });
  if (!product) return null;

  // Scoped to a gift that still has no product: if two saves race, or the
  // wisher edited the link again while this was running, the later decision
  // wins rather than being overwritten by a slower request.
  await db.gift.updateMany({
    where: { id: giftId, productId: null },
    data: { productId: product.id },
  });

  return product.id;
}

/**
 * Retries the links that never resolved.
 *
 * A merchant can be down for an afternoon, rate-limit us, or answer a
 * timeout — all temporary, and all currently permanent: the resolver runs
 * once when the gift is saved and nothing ever tries again. Those wishes stay
 * unlinked forever, and the recommender never sees them.
 *
 * Run from the nightly cron, which is why it takes a budget: a serverless
 * function has a hard ceiling, and a sweep that tries to catch up on a
 * thousand gifts in one run would be cut off mid-way with nothing recorded.
 * Whatever is left is simply picked up tomorrow.
 *
 * The oldest first, so a gift is not passed over indefinitely by newer
 * arrivals.
 */
export async function sweepUnlinkedGifts(
  limit = 25,
  budgetMs = 30_000,
): Promise<{ attempted: number; linked: number }> {
  const candidates = await db.gift.findMany({
    where: { productId: null, url: { not: null } },
    select: {
      id: true,
      url: true,
      category: true,
      list: { select: { ownerId: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const startedAt = Date.now();
  let attempted = 0;
  let linked = 0;

  for (const gift of candidates) {
    // Stop before the function does, rather than being killed part-way.
    // `>=` so a zero budget does no work at all: strictly-greater let the
    // first attempt through, since no time has elapsed yet.
    if (Date.now() - startedAt >= budgetMs) break;

    attempted += 1;
    // Charged to the gift's owner, like a save would be: the sweep must not
    // become a way around the per-person budget.
    const productId = await linkGiftToProduct(
      gift.id,
      gift.url,
      gift.category,
      gift.list.ownerId,
      // Direct read only. A save has already tried the proxy for this link;
      // asking it again every night for something that failed twice is spend
      // without a story.
      false,
    );
    if (productId) linked += 1;
  }

  return { attempted, linked };
}

/**
 * Re-reads quarantined rows, and promotes the ones that turn out to be real.
 *
 * ── Why quarantine needs its own sweep ─────────────────────────────────────
 *
 * sweepUnlinkedGifts looks for gifts with `productId: null`. A quarantined
 * product IS attached to its gift — it exists, it is simply held back from
 * recommendation — so that sweep would never look at it again and `stale`
 * would be a graveyard rather than a waiting room.
 *
 * What makes a second read worth doing: the first one often failed for
 * reasons that pass. A merchant behind a bot check at 3am serves the real
 * page the next day; a shop that was mid-deploy comes back. The row is
 * promoted the moment a read finds a price or an image.
 *
 * A row that never improves simply stays in `stale` — invisible to every
 * recommender tier, still attached to the wish that named it, costing one row.
 *
 * ── Why no per-person rate limit ───────────────────────────────────────────
 *
 * sweepUnlinkedGifts charges each fetch to the gift's owner, because that
 * sweep is finishing work a person started and must not become a way around
 * their budget. This one is not: a quarantined row may be shared by several
 * wishes, or by none once the original was deleted. There is nobody to
 * charge. `limit` and `budgetMs` are what bound it instead — 25 rows and 30
 * seconds a night, against a catalogue that grows by a handful a day.
 */
export async function promoteQuarantined(
  limit = 25,
  budgetMs = 30_000,
): Promise<{ attempted: number; promoted: number }> {
  const candidates = await db.product.findMany({
    where: { status: 'stale', mergedInto: null, sourceUrl: { not: null } },
    // Oldest first, so nothing waits forever behind a steady arrival of new
    // quarantined rows.
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: { id: true, sourceUrl: true },
  });

  const startedAt = Date.now();
  let attempted = 0;
  let promoted = 0;

  for (const product of candidates) {
    if (Date.now() - startedAt >= budgetMs) break;
    attempted += 1;

    const verdict = await checkUrl(product.sourceUrl!);
    if (!verdict.ok) continue;

    let extracted;
    try {
      extracted = extractProduct(await fetchHtml(verdict.url.href));
    } catch {
      // Still unreachable. It keeps its place in the queue and its turn will
      // come round again; `updatedAt` is untouched, so it stays at the front.
      continue;
    }

    if (judge(extracted).kind !== 'active') continue;

    /*
     * Promoted, and the new facts written with it.
     *
     * Gaps only, exactly as findOrCreateProduct does on a revisit: the title
     * and category already on the row may have been corrected by a person,
     * and a fresher read of the merchant page is no reason to overwrite that.
     */
    await db.product.update({
      where: { id: product.id },
      data: {
        status: 'active',
        imageUrl: extracted.imageUrl ?? undefined,
        priceCents: extracted.priceCents ?? undefined,
        priceBand: extracted.priceCents != null ? priceBand(extracted.priceCents) : undefined,
        brand: extracted.brand ?? undefined,
        gtin: extracted.gtin ?? undefined,
      },
    });
    promoted += 1;
  }

  return { attempted, promoted };
}
