'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from './db';
import { relationTo } from './relations';
import { requireUser } from './session';

export type ChatResult = { error?: string };

const messageSchema = z
  .string()
  .trim()
  .min(1, 'Écrivez quelque chose.')
  .max(2000, 'Ce message est trop long.');

export async function postChatMessage(
  giftId: string,
  body: string,
): Promise<ChatResult> {
  const user = await requireUser();

  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Message invalide.' };
  }

  const gift = await db.gift.findUnique({
    where: { id: giftId },
    select: { listId: true, list: { select: { ownerId: true } } },
  });
  if (!gift) return { error: 'Cadeau introuvable' };

  const relation = await relationTo(user.id, gift.list.ownerId);
  if (relation === 'owner') {
    // Not merely refused: the owner has no business in a room whose whole
    // purpose is to keep something from them.
    return { error: "Ce salon n'existe pas pour vous." };
  }
  if (relation !== 'friend') {
    return { error: "Vous n'avez pas accès à cette liste." };
  }

  await db.chatMessage.create({
    data: { giftId, authorId: user.id, body: parsed.data },
  });

  revalidatePath(`/gifts/${giftId}`);
  return {};
}

/** Removes a message. Only its author may do so. */
export async function deleteChatMessage(
  messageId: string,
): Promise<ChatResult> {
  const user = await requireUser();

  const message = await db.chatMessage.findUnique({
    where: { id: messageId },
    select: { giftId: true, authorId: true },
  });
  if (!message || message.authorId !== user.id) {
    return { error: 'Message introuvable.' };
  }

  await db.chatMessage.delete({ where: { id: messageId } });
  revalidatePath(`/gifts/${message.giftId}`);
  return {};
}
