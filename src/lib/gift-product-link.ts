import { db } from './db';
import { extractProduct } from './extract';
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
     * Network failures only, and silent on purpose: a merchant that is slow,
     * paywalled, JS-rendered or hostile to bots is an ordinary Tuesday, and
     * the gift is already saved.
     *
     * The try block is deliberately narrow. Wrapping the database work below
     * in it as well — which is what this used to do — meant a Prisma error, a
     * violated constraint or a bug of mine was swallowed with exactly the same
     * silence, and the catalogue would have stayed empty with nothing to say
     * why.
     */
    return null;
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
