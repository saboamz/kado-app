import { db } from './db';
import { extractProduct } from './extract';
import { findOrCreateProduct } from './product-resolve';
import { fetchHtml } from './fetch-page';
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
): Promise<string | null> {
  if (!url) return null;

  try {
    // The same SSRF guard the preview action uses. A pasted link is attacker
    // controlled, and this runs server-side with whatever network the host
    // gives us.
    const verdict = await checkUrl(url);
    if (!verdict.ok) return null;

    const html = await fetchHtml(verdict.url.href);
    const extracted = extractProduct(html);
    // No title means nothing identifiable was found; a row with no name is
    // not a product.
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
  } catch {
    // Deliberately silent. See the note at the top: a merchant we cannot read
    // is ordinary, and the gift is already saved.
    return null;
  }
}
