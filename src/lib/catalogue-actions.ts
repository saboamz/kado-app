'use server';

import { extractProduct } from './extract';
import { fetchHtml } from './fetch-page';
import { findOrCreateProduct } from './product-resolve';
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
  product: { id: string; title: string; imageUrl: string | null; priceCents: number | null } | null;
  /** French, because these strings are shown to the user as-is. */
  error?: string;
};

export async function previewProduct(rawUrl: string): Promise<PreviewResult> {
  await requireUser();

  const verdict = await checkUrl(rawUrl);
  if (!verdict.ok) return { product: null, error: verdict.reason };

  let html: string;
  try {
    html = await fetchHtml(verdict.url.href);
  } catch {
    // A link we cannot read is NOT an error the user has to fix: paywalls and
    // JS-rendered pages are ordinary. They write the wish by hand instead.
    return { product: null };
  }

  const extracted = extractProduct(html);
  if (!extracted.title) return { product: null };

  const product = await findOrCreateProduct({ ...extracted, sourceUrl: verdict.url.href });
  if (!product) return { product: null };

  return {
    product: {
      id: product.id,
      title: product.title,
      imageUrl: product.imageUrl,
      priceCents: product.priceCents,
    },
  };
}
