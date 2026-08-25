import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { logEvent } from '@/lib/events';
import { fetchImageBytes } from '@/lib/fetch-page';
import { linkGiftToProduct } from '@/lib/gift-product-link';
import { rateLimit, recordAttempt, UPLOAD_PER_USER } from '@/lib/rate-limit';
import { getCurrentUser } from '@/lib/session';
import { checkUrl } from '@/lib/ssrf';
import { MAX_UPLOAD_BYTES, storeImageBytes } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

/**
 * A wish sent by the browser extension, extracted where no bot wall exists.
 *
 * The extension reads the page IN the person's browser — real session, real
 * rendering — so it sees titles and prices on the very shops that answer our
 * server with a 403 or a captcha. That is the one thing it can do that the
 * paste-a-link flow cannot, and it is why this endpoint accepts the gift's
 * fields from the client at all.
 *
 * ── Two levels of trust, kept apart ────────────────────────────────────────
 *
 * The GIFT takes the client's words: it is this person's wish on their own
 * list, and the form has always let them write any name or price by hand.
 *
 * The CATALOGUE does not. Product rows are shared across users and feed the
 * recommender, so they only ever come from our server's own read of the page
 * (linkGiftToProduct below) — a tampered extension can misname its owner's
 * wish, and nothing anybody else sees.
 *
 * The image is fetched by US from the URL the client names, through the same
 * SSRF guard and upload validation as everything else — client bytes and
 * client paths are never written.
 */
const giftFromExtension = z.object({
  listId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(140),
  url: z.string().trim().url().max(2000).startsWith('http'),
  priceCents: z.number().int().min(0).max(10_000_000).nullish(),
  imageUrl: z.string().trim().url().max(2000).startsWith('http').nullish(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'signed-out' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const parsed = giftFromExtension.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid-gift' }, { status: 400 });
  }
  const { listId, name, url, priceCents, imageUrl } = parsed.data;

  // Same silence for "not yours" and "not there": a 403 would confirm that
  // somebody else's list id exists.
  const list = await db.giftList.findUnique({
    where: { id: listId },
    select: { ownerId: true },
  });
  if (!list || list.ownerId !== user.id) {
    return NextResponse.json({ error: 'unknown-list' }, { status: 404 });
  }

  const merchant = new URL(url).hostname.replace(/^www\./, '');
  const gift = await db.gift.create({
    data: {
      listId,
      name,
      url,
      merchant,
      priceCents: priceCents ?? null,
    },
  });

  // Reported back: when this fails — an image CDN that only answers real
  // browsers — the extension can send the picture from the screen instead.
  let imageStored = false;
  if (imageUrl) {
    const stored = await storeImageFrom(imageUrl, user.id);
    if (stored) {
      await db.gift.update({ where: { id: gift.id }, data: { imageUrl: stored } });
      imageStored = true;
    }
  }

  /*
   * The catalogue's own read — WITHOUT the reader fallback. The direct
   * attempt is bounded at 5s; the proxy would add 8 more, and this response
   * has already spent time on the image above. The extension's data made the
   * gift complete either way; a product row the direct read cannot make
   * today is made the day somebody pastes the link somewhere readable.
   */
  const productId = await linkGiftToProduct(gift.id, url, null, user.id, false);

  await logEvent({
    actorId: user.id,
    kind: 'add_wish',
    giftId: gift.id,
    productId,
    priceCents: priceCents ?? null,
    categoryId: null,
  });

  revalidatePath(`/lists/${listId}`);
  return NextResponse.json({ giftId: gift.id, listId, imageStored });
}

/**
 * Downloads the page's picture ourselves and stores it as a gift upload.
 *
 * Counted against the person's upload budget: this is our server fetching a
 * URL somebody chose, and storage somebody else pays for. Every failure —
 * refused URL, wall, oversize, not an image — is a wish without a picture,
 * never an error.
 */
async function storeImageFrom(imageUrl: string, userId: string): Promise<string | null> {
  const budget = await rateLimit('upload', userId, UPLOAD_PER_USER);
  if (!budget.allowed) return null;
  await recordAttempt('upload', userId);

  const verdict = await checkUrl(imageUrl);
  if (!verdict.ok) return null;

  try {
    const bytes = await fetchImageBytes(verdict.url.href, MAX_UPLOAD_BYTES);
    const stored = await storeImageBytes(bytes, 'gifts');
    return stored.ok ? stored.path : null;
  } catch {
    return null;
  }
}
