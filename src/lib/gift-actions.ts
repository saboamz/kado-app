'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from './db';
import { logEvent } from './events';
import { deleteUpload, storeUpload } from './uploads';
import { parseMoney } from './format';
import { requireUser } from './session';
import { linkGiftToProduct } from './gift-product-link';
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
): Promise<{ url?: string | null; error?: string }> {
  const file = formData.get(field);

  if (file instanceof File && file.size > 0) {
    const stored = await storeUpload(file, 'gifts');
    if (!stored.ok) return { error: stored.error };
    // The replaced file is not needed once the new one is saved.
    await deleteUpload(current);
    return { url: stored.path };
  }

  if (formData.get(`${field}Removed`) === '1') {
    await deleteUpload(current);
    return { url: null };
  }

  return {};
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

  const image = await resolveImage(formData, 'image', null);
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

  const image = await resolveImage(formData, 'image', gift.imageUrl);
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
    await linkGiftToProduct(giftId, next.url, next.category, user.id);
  }

  revalidatePath(`/lists/${gift.listId}`);
  revalidatePath(`/gifts/${giftId}`);
  redirect(`/gifts/${giftId}`);
}

export async function deleteGift(giftId: string): Promise<void> {
  const { gift } = await requireOwnedGift(giftId);
  await db.gift.delete({ where: { id: giftId } });
  // The row is gone; its image would otherwise sit on disk forever.
  await deleteUpload(gift.imageUrl);
  revalidatePath(`/lists/${gift.listId}`);
  redirect(`/lists/${gift.listId}`);
}
