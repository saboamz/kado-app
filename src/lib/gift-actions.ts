'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from './db';
import { logEvent } from './events';
import { deleteUpload, storeUpload } from './uploads';
import { parseMoney } from './format';
import { rateLimit, recordAttempt, UPLOAD_PER_USER } from './rate-limit';
import { requireUser } from './session';
import { ensureStoredProductImage, linkGiftToProduct } from './gift-product-link';
import { fieldErrors, giftSchema, type GiftInput } from './validation';

export type FormState = { errors?: Record<string, string> };

/** Normalises "apple.com/x" to a real URL so links are clickable. */
function normaliseUrl(value: string): string | null {
  if (!value) return null;
  return /^https?:\/\//.test(value) ? value : `https://${value}`;
}

/** Derives a shop name from a URL when the user did not give one. */
function merchantFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function requireOwnedList(listId: string) {
  const user = await requireUser();
  const list = await db.giftList.findUnique({
    where: { id: listId },
    select: { id: true, ownerId: true },
  });
  if (!list || list.ownerId !== user.id) throw new Error('Liste introuvable');
  return { user, list };
}

/**
 * Loads a gift the signed-in user owns, through its list.
 *
 * Note what this deliberately does not allow: a friend who reserved a gift
 * still cannot edit or delete it. Only the owner shapes their own list.
 */
async function requireOwnedGift(giftId: string) {
  const user = await requireUser();
  const gift = await db.gift.findUnique({
    where: { id: giftId },
    select: {
      id: true,
      listId: true,
      imageUrl: true,
      // Compared against the submitted link, to know whether the product
      // this wish points at has changed.
      url: true,
      // Lets the quick-add enrichment recognise a wish it already resolved.
      productId: true,
      list: { select: { ownerId: true } },
    },
  });
  if (!gift || gift.list.ownerId !== user.id) {
    throw new Error('error.giftNotFound');
  }
  return { user, gift };
}

function parseGiftForm(formData: FormData) {
  return giftSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    price: formData.get('price'),
    url: formData.get('url'),
    merchant: formData.get('merchant'),
    category: formData.get('category'),
    priority: formData.get('priority') ?? 2,
  });
}

function giftData(data: GiftInput) {
  const url = normaliseUrl(data.url ?? '');
  const priceCents = data.price ? parseMoney(data.price) : null;
  return {
    name: data.name,
    description: data.description || null,
    priceCents,
    url,
    merchant: data.merchant || merchantFromUrl(url),
    category: data.category || null,
    priority: data.priority,
  };
}

/**
 * Resolves what the image field should become.
 *
 * Three outcomes: a new file was picked, the existing one was removed, or
 * nothing changed and the current value stands.
 */
async function resolveImage(
  formData: FormData,
  field: string,
  current: string | null,
  ownerId: string,
): Promise<{ url?: string | null; error?: string }> {
  const file = formData.get(field);

  if (file instanceof File && file.size > 0) {
    // 4MB a call with nothing counting them: a loop of saves is a way to fill
    // the disk, or the Blob bill, on somebody else's money.
    const budget = await rateLimit('upload', ownerId, UPLOAD_PER_USER);
    if (!budget.allowed) return { error: 'error.tooManyUploads' };
    await recordAttempt('upload', ownerId);

    const stored = await storeUpload(file, 'gifts');
    if (!stored.ok) return { error: stored.error };
    // The replaced file is not needed once the new one is saved.
    await deleteGiftImage(current);
    return { url: stored.path };
  }

  if (formData.get(`${field}Removed`) === '1') {
    await deleteGiftImage(current);
    return { url: null };
  }

  return {};
}

/**
 * Deletes a gift's stored image — unless it is a product's shared copy.
 *
 * A picture adopted from the catalogue is one file referenced by the product
 * row and by every gift that took it. Deleting it with the gift would tear it
 * out of all of them; a file no product claims is this gift's own upload and
 * goes as before.
 */
async function deleteGiftImage(path: string | null): Promise<void> {
  if (!path) return;
  const shared = await db.product.findFirst({
    where: { imageStoredPath: path },
    select: { id: true },
  });
  if (shared) return;
  await deleteUpload(path);
}

/**
 * Adopts the catalogue's stored picture onto a gift that has none.
 *
 * Only ever reads the path from the product row the LINK resolved — nothing
 * client-sent names a file. The flag from the form says "the person saw the
 * suggested picture and left it in place"; absent, a wish stays as they made
 * it. Scoped to a still-imageless gift so a slower request cannot overwrite
 * an upload that landed meanwhile.
 */
async function adoptProductImage(giftId: string, productId: string): Promise<void> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { imageStoredPath: true },
  });
  if (!product?.imageStoredPath) return;
  await db.gift.updateMany({
    where: { id: giftId, imageUrl: null },
    data: { imageUrl: product.imageStoredPath },
  });
}

export async function createGift(
  listId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireOwnedList(listId);

  const parsed = parseGiftForm(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // A price that was typed but could not be read is an error, not a silent null.
  if (parsed.data.price && parseMoney(parsed.data.price) === null) {
    return { errors: { price: 'error.amountInvalid' } };
  }

  const image = await resolveImage(formData, 'image', null, user.id);
  if (image.error) return { errors: { image: image.error } };

  // add_wish is evidence about the person who ADDED it — themselves — not
  // about giving anything to anyone. recipientId is deliberately null: mixing
  // these in with the gift events would train the model on the wrong axis,
  // because "people who wanted X also wanted Y" is a different question from
  // "people who gave X also gave Y".
  const gift = await db.gift.create({
    data: {
      listId,
      ...giftData(parsed.data),
      ...(image.url !== undefined ? { imageUrl: image.url } : {}),
    },
  });

  /*
   * Resolve the link to a catalogue row, before the event is written.
   *
   * The event carries productId, and it is the recommender's training set: an
   * event with a null product is invisible to collaborative filtering
   * forever, because the log is append-only and nothing backfills it. So the
   * ordering matters — link first, then log.
   *
   * Awaited rather than fired and forgotten: a serverless function is frozen
   * the moment its response is returned, so a detached promise here would be
   * killed mid-request and the link would never be written. The gift is
   * already saved, and this never throws, so the cost of waiting is a slower
   * save — not a lost one.
   */
  const productId = await linkGiftToProduct(
    gift.id,
    gift.url,
    gift.category,
    user.id,
  );

  if (productId && image.url === undefined && formData.get('imageFromPage') === '1') {
    await adoptProductImage(gift.id, productId);
  }

  await logEvent({
    actorId: user.id,
    kind: 'add_wish',
    giftId: gift.id,
    productId,
    priceCents: gift.priceCents,
    categoryId: gift.category,
  });

  revalidatePath(`/lists/${listId}`);
  redirect(`/lists/${listId}`);
}

export type QuickAddResult = {
  /** Set when the input was a link: the wish exists, the slow half remains. */
  giftId?: string;
  /** An error KEY, like every form error — the client renders the sentence. */
  error?: string;
};

/**
 * The single box at the top of a list: a link, or just words.
 *
 * The minimum a wish needs is a name — the form's other six fields are
 * optional, and the save has never depended on a shop being readable. This
 * takes the interface to the same place the data model always was: words make
 * a wish immediately, and a link makes one named after its shop, so there is
 * something on the list before any page has been read.
 *
 * The reading is NOT done here, on purpose: it can take seconds, and the
 * point of this box is that the wish appears at once. The client calls
 * enrichQuickGift() next, and the card fills in under the person's eyes.
 * The full form remains the place to be precise; this is the place to be
 * quick.
 */
export async function quickAddGift(
  listId: string,
  raw: string,
): Promise<QuickAddResult> {
  const { user } = await requireOwnedList(listId);

  const input = raw.trim();
  if (!input) return { error: 'error.giftNameRequired' };

  const url = quickUrl(input);
  if (!url) {
    if (input.length > 140) return { error: 'error.nameLong' };
    const gift = await db.gift.create({ data: { listId, name: input } });
    // Same evidence as the form's add — see createGift on why recipientId
    // stays null.
    await logEvent({
      actorId: user.id,
      kind: 'add_wish',
      giftId: gift.id,
      productId: null,
      priceCents: null,
      categoryId: null,
    });
    revalidatePath(`/lists/${listId}`);
    return {};
  }

  const gift = await db.gift.create({
    data: {
      listId,
      // The shop's own name, until the page says better. merchantFromUrl only
      // returns null for an unparseable URL, which quickUrl already refused.
      name: merchantFromUrl(url) ?? input.slice(0, 140),
      url,
      merchant: merchantFromUrl(url),
    },
  });
  revalidatePath(`/lists/${listId}`);
  return { giftId: gift.id };
}

/**
 * What the pasted input has to look like before it is treated as a link.
 *
 * Anything with a space is words — "1.5L en verre" is a wish, not an address.
 * The bare-domain form matches what people actually paste from an address
 * bar with the scheme stripped.
 */
function quickUrl(input: string): string | null {
  if (/\s/.test(input)) return null;
  if (/^https?:\/\/.+/.test(input)) return input;
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(input)) return `https://${input}`;
  return null;
}

/**
 * The slow half of the quick add: reading the page behind the wish's link.
 *
 * Runs after the wish already exists, so nothing here can cost anybody their
 * gift — the exact philosophy of linkGiftToProduct, which does the fetching
 * and carries the rate limit and the SSRF guard. What is new is only that
 * the GIFT learns what the page said: each field is written where the
 * provisional value still stands, so a person who renamed or priced the wish
 * meanwhile is never overwritten by a slower request.
 */
export async function enrichQuickGift(giftId: string): Promise<void> {
  const { user, gift } = await requireOwnedGift(giftId);
  // No link to read, or a previous call already resolved it: nothing to do,
  // and no second add_wish event to pollute the training set with.
  if (!gift.url || gift.productId) return;

  const productId = await linkGiftToProduct(gift.id, gift.url, null, user.id);

  const product = productId
    ? await db.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          title: true,
          priceCents: true,
          imageUrl: true,
          imageStoredPath: true,
        },
      })
    : null;

  if (product) {
    const provisional = merchantFromUrl(gift.url);
    if (provisional) {
      await db.gift.updateMany({
        where: { id: gift.id, name: provisional },
        data: { name: product.title.slice(0, 140) },
      });
    }
    if (product.priceCents != null) {
      await db.gift.updateMany({
        where: { id: gift.id, priceCents: null },
        data: { priceCents: product.priceCents },
      });
    }
    const stored = await ensureStoredProductImage(product);
    if (stored) {
      await db.gift.updateMany({
        where: { id: gift.id, imageUrl: null },
        data: { imageUrl: stored },
      });
    }
  }

  // Logged here rather than at creation, so the event carries the productId
  // that collaborative filtering needs — the log is append-only and nothing
  // backfills it.
  await logEvent({
    actorId: user.id,
    kind: 'add_wish',
    giftId: gift.id,
    productId,
    priceCents: product?.priceCents ?? null,
    categoryId: null,
  });

  revalidatePath(`/lists/${gift.listId}`);
  revalidatePath(`/gifts/${gift.id}`);
}

export async function updateGift(
  giftId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, gift } = await requireOwnedGift(giftId);

  const parsed = parseGiftForm(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (parsed.data.price && parseMoney(parsed.data.price) === null) {
    return { errors: { price: 'error.amountInvalid' } };
  }

  const image = await resolveImage(formData, 'image', gift.imageUrl, user.id);
  if (image.error) return { errors: { image: image.error } };

  const next = giftData(parsed.data);

  /*
   * A changed link points at a different thing, so the old product row is no
   * longer what this wish means. Clearing it lets the resolver below attach
   * the right one — its update is scoped to `productId: null`, so without
   * this the stale link would simply survive.
   *
   * An unchanged link keeps its product: re-resolving on every edit would
   * fetch the merchant again for a title tweak.
   */
  const urlChanged = next.url !== gift.url;

  await db.gift.update({
    where: { id: giftId },
    data: {
      ...next,
      ...(image.url !== undefined ? { imageUrl: image.url } : {}),
      ...(urlChanged ? { productId: null } : {}),
    },
  });

  if (urlChanged) {
    const productId = await linkGiftToProduct(giftId, next.url, next.category, user.id);
    // Same adoption as on create, and just as guarded: only a gift that ends
    // this edit without any image of its own takes the catalogue's picture.
    if (
      productId &&
      image.url === undefined &&
      gift.imageUrl === null &&
      formData.get('imageFromPage') === '1'
    ) {
      await adoptProductImage(giftId, productId);
    }
  }

  revalidatePath(`/lists/${gift.listId}`);
  revalidatePath(`/gifts/${giftId}`);
  redirect(`/gifts/${giftId}`);
}

export async function deleteGift(giftId: string): Promise<void> {
  const { gift } = await requireOwnedGift(giftId);
  await db.gift.delete({ where: { id: giftId } });
  // The row is gone; its image would otherwise sit on disk forever.
  await deleteGiftImage(gift.imageUrl);
  revalidatePath(`/lists/${gift.listId}`);
  redirect(`/lists/${gift.listId}`);
}
