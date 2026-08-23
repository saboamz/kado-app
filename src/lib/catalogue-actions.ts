'use server';

import { db } from './db';
import { fetchImageBytes } from './fetch-page';
import { readProductPage } from './gift-product-link';
import { findOrCreateProduct } from './product-resolve';
import { LINK_FETCH_PER_USER, rateLimit, recordAttempt } from './rate-limit';
import { requireUser } from './session';
import { checkUrl } from './ssrf';
import { deleteUpload, MAX_UPLOAD_BYTES, storeImageBytes } from './uploads';

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
      imagePath: await ensureStoredImage(product),
    },
  };
}

/**
 * Our own copy of the product's picture, made at most once per product.
 *
 * The merchant's URL cannot be shown — the CSP only trusts our origin — and
 * must not be written onto a gift, where it would rot when the shop moves the
 * file. So the first preview that reads a product downloads its picture
 * through the same guard as the page, pushes it through the same validation
 * as any upload, and writes the path on the product row for every later gift
 * to share.
 *
 * Failures return null and cost nothing: a wish without a picture is the
 * ordinary case, not an error.
 */
async function ensureStoredImage(product: {
  id: string;
  imageUrl: string | null;
  imageStoredPath: string | null;
}): Promise<string | null> {
  if (product.imageStoredPath) return product.imageStoredPath;
  if (!product.imageUrl) return null;

  // Attacker-controlled like the page URL, and fetched server-side like it.
  const verdict = await checkUrl(product.imageUrl);
  if (!verdict.ok) return null;

  let stored;
  try {
    const bytes = await fetchImageBytes(verdict.url.href, MAX_UPLOAD_BYTES);
    stored = await storeImageBytes(bytes, 'gifts');
  } catch {
    return null;
  }
  if (!stored.ok) return null;

  // Two previews can race here. The row is claimed only while still empty, so
  // exactly one copy wins; the loser removes its file and reads the winner's.
  const claimed = await db.product.updateMany({
    where: { id: product.id, imageStoredPath: null },
    data: { imageStoredPath: stored.path },
  });
  if (claimed.count === 0) {
    await deleteUpload(stored.path);
    const row = await db.product.findUnique({
      where: { id: product.id },
      select: { imageStoredPath: true },
    });
    return row?.imageStoredPath ?? null;
  }
  return stored.path;
}
