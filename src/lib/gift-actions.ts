'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from './db';
import { parseMoney } from './format';
import { requireUser } from './session';
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
    select: { id: true, listId: true, list: { select: { ownerId: true } } },
  });
  if (!gift || gift.list.ownerId !== user.id) {
    throw new Error('Cadeau introuvable');
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
    isPot: formData.get('isPot') === 'on',
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
    isPot: !!data.isPot,
  };
}

export async function createGift(
  listId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwnedList(listId);

  const parsed = parseGiftForm(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // A price that was typed but could not be read is an error, not a silent null.
  if (parsed.data.price && parseMoney(parsed.data.price) === null) {
    return { errors: { price: 'Ce montant semble invalide.' } };
  }

  await db.gift.create({ data: { listId, ...giftData(parsed.data) } });

  revalidatePath(`/lists/${listId}`);
  redirect(`/lists/${listId}`);
}

export async function updateGift(
  giftId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { gift } = await requireOwnedGift(giftId);

  const parsed = parseGiftForm(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (parsed.data.price && parseMoney(parsed.data.price) === null) {
    return { errors: { price: 'Ce montant semble invalide.' } };
  }

  await db.gift.update({ where: { id: giftId }, data: giftData(parsed.data) });

  revalidatePath(`/lists/${gift.listId}`);
  revalidatePath(`/gifts/${giftId}`);
  redirect(`/gifts/${giftId}`);
}

export async function deleteGift(giftId: string): Promise<void> {
  const { gift } = await requireOwnedGift(giftId);
  await db.gift.delete({ where: { id: giftId } });
  revalidatePath(`/lists/${gift.listId}`);
  redirect(`/lists/${gift.listId}`);
}
