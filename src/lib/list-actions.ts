'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from './db';
import { requireUser } from './session';
import { fieldErrors, listSchema } from './validation';

export type FormState = { errors?: Record<string, string> };

/**
 * Loads a list the signed-in user owns, or refuses.
 *
 * Every mutation goes through this. Checking ownership inside each action
 * rather than trusting a hidden form field means a crafted request cannot
 * touch somebody else's list.
 */
async function requireOwnedList(listId: string) {
  const user = await requireUser();
  const list = await db.giftList.findUnique({
    where: { id: listId },
    select: { id: true, ownerId: true },
  });
  if (!list || list.ownerId !== user.id) {
    throw new Error('Liste introuvable');
  }
  return { user, list };
}

export async function createList(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = listSchema.safeParse({
    name: formData.get('name'),
    occasion: formData.get('occasion'),
    visibility: formData.get('visibility') ?? 'FRIENDS',
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const list = await db.giftList.create({
    data: {
      ownerId: user.id,
      name: parsed.data.name,
      occasion: parsed.data.occasion || null,
      visibility: parsed.data.visibility,
    },
  });

  revalidatePath('/lists');
  redirect(`/lists/${list.id}`);
}

export async function updateList(
  listId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwnedList(listId);

  const parsed = listSchema.safeParse({
    name: formData.get('name'),
    occasion: formData.get('occasion'),
    visibility: formData.get('visibility') ?? 'FRIENDS',
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await db.giftList.update({
    where: { id: listId },
    data: {
      name: parsed.data.name,
      occasion: parsed.data.occasion || null,
      visibility: parsed.data.visibility,
    },
  });

  revalidatePath(`/lists/${listId}`);
  revalidatePath('/lists');
  redirect(`/lists/${listId}`);
}

export async function deleteList(listId: string): Promise<void> {
  await requireOwnedList(listId);
  // Gifts, reservations and contributions cascade from the schema.
  await db.giftList.delete({ where: { id: listId } });
  revalidatePath('/lists');
  redirect('/lists');
}

export async function setDefaultList(listId: string): Promise<void> {
  const { user } = await requireOwnedList(listId);
  // Exactly one default per user, so clear the others in the same transaction.
  await db.$transaction([
    db.giftList.updateMany({
      where: { ownerId: user.id },
      data: { isDefault: false },
    }),
    db.giftList.update({ where: { id: listId }, data: { isDefault: true } }),
  ]);
  revalidatePath('/lists');
  revalidatePath(`/lists/${listId}`);
}
