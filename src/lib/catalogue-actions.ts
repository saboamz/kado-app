'use server';

import { ensureStoredProductImage, readProductPage } from './gift-product-link';
import { findOrCreateProduct } from './product-resolve';
import { LINK_FETCH_PER_USER, rateLimit, recordAttempt } from './rate-limit';
import { requireUser } from './session';
import { checkUrl } from './ssrf';

/**
 * Resolving a pasted link into a catalogue row.
 *
 * Server-side and nowhere else. Merchants send no CORS headers so the browser
 * could not do it anyway, but the real reason is that the client must not be
 * the one deciding what a product is — that decision is what the whole
 * catalogue's integrity rests on.
 */

export type PreviewResult = {
  product: {
    id: string;
    title: string;
    priceCents: number | null;
    /** OUR stored copy of the merchant's picture — a path the CSP allows the
        form to display, unlike the merchant's own URL. Null when the page had
        no readable image. */
    imagePath: string | null;
  } | null;
  /** French, because these strings are shown to the user as-is. */
  error?: string;
};

export async function previewProduct(rawUrl: string): Promise<PreviewResult> {
  const user = await requireUser();

  /*
   * Throttled, because this is the action that makes our server fetch a URL
   * somebody else chose.
   *
   * LINK_FETCH_PER_USER was written for exactly this and its comment says so,
   * but the only caller was the GIF search — the preview, which is the more
   * direct outbound relay of the two, was unthrottled. In a loop it is a free
   * authenticated way to point our traffic at a host of the caller's choosing,
   * and to burn the function budget doing it.
   */
  const budget = await rateLimit('link:preview', user.id, LINK_FETCH_PER_USER);
  if (!budget.allowed) {
    return { product: null, error: 'Trop de liens d’affilée. Réessayez dans un instant.' };
  }
  await recordAttempt('link:preview', user.id);

  const verdict = await checkUrl(rawUrl);
  if (!verdict.ok) return { product: null, error: verdict.reason };

  // Direct read, then the reading proxy — the same two attempts the
  // after-save resolver makes. A link we cannot read either way is NOT an
  // error the user has to fix: paywalls and JS-rendered pages are ordinary.
  // They write the wish by hand instead.
  const extracted = await readProductPage(verdict.url.href);
  if (!extracted) return { product: null };

  const product = await findOrCreateProduct({ ...extracted, sourceUrl: verdict.url.href });
  if (!product) return { product: null };

  return {
    product: {
      id: product.id,
      title: product.title,
      priceCents: product.priceCents ?? extracted.priceCents,
      imagePath: await ensureStoredProductImage(product),
    },
  };
}
