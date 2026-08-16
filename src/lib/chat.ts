import { db } from './db';
import { relationTo } from './relations';

export type ChatMessageView = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  mine: boolean;
};

/**
 * The secret chat around one gift.
 *
 * This is the one place friends coordinate a surprise in writing, so it is
 * the most damaging thing in the application for an owner to read. Unlike
 * reservations — where the owner is shown a redacted view — an owner asking
 * for these messages gets nothing at all, and the caller cannot tell the
 * difference between "no messages" and "not for you".
 */
export async function getChatForViewer(
  giftId: string,
  viewerId: string,
): Promise<ChatMessageView[] | null> {
  const gift = await db.gift.findUnique({
    where: { id: giftId },
    select: { list: { select: { ownerId: true, visibility: true } } },
  });
  if (!gift) return null;

  const relation = await relationTo(viewerId, gift.list.ownerId);
  // Owners and strangers alike: no chat, no hint that one exists.
  if (relation !== 'friend') return null;

  const messages = await db.chatMessage.findMany({
    where: { giftId },
    include: {
      author: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  return messages.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    author: m.author,
    mine: m.authorId === viewerId,
  }));
}

/**
 * How many messages a friend would see. Zero for anybody else.
 *
 * The permission check is repeated rather than delegated to
 * getChatForViewer, which used to load 200 message rows and their author
 * joins only to read `.length`. The gate is the same three lines and the same
 * order — resolve the owner, refuse anybody who is not a friend, and only
 * then touch the table — so the secret is kept by the same rule, without
 * fetching the bodies nobody asked for.
 */
export async function countChatForViewer(
  giftId: string,
  viewerId: string,
): Promise<number> {
  const gift = await db.gift.findUnique({
    where: { id: giftId },
    select: { list: { select: { ownerId: true, visibility: true } } },
  });
  if (!gift) return 0;

  const relation = await relationTo(viewerId, gift.list.ownerId);
  if (relation !== 'friend') return 0;

  return db.chatMessage.count({ where: { giftId } });
}
