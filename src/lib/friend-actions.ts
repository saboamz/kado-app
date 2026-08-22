'use server';

import { revalidatePath } from 'next/cache';
import { db } from './db';
import { FRIEND_REQUEST_PER_USER, rateLimit, recordAttempt } from './rate-limit';
import { requireUser } from './session';

export type FriendResult = { error?: string };

/**
 * Sends a friend request.
 *
 * Friendship is one row with a direction, so a request that crosses one
 * already sent the other way is accepted rather than duplicated — otherwise
 * two people who both press "add" would deadlock, each waiting on the other.
 */
export async function requestFriendship(
  addresseeId: string,
): Promise<FriendResult> {
  const user = await requireUser();
  if (addresseeId === user.id) {
    return { error: 'error.cannotAddYourself' };
  }

  // Each request puts a notification in front of somebody else. Unbounded,
  // that is a way to fill a stranger's alerts from a script.
  const budget = await rateLimit('friend:request', user.id, FRIEND_REQUEST_PER_USER);
  if (!budget.allowed) return { error: 'error.tooManyRequests' };
  await recordAttempt('friend:request', user.id);

  const target = await db.user.findUnique({
    where: { id: addresseeId },
    select: { id: true },
  });
  if (!target) return { error: 'error.personNotFound' };

  const existing = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: user.id, addresseeId },
        { requesterId: addresseeId, addresseeId: user.id },
      ],
    },
  });

  if (existing) {
    if (existing.status === 'BLOCKED') {
      return { error: 'error.tryLater' };
    }
    if (existing.status === 'ACCEPTED') {
      return { error: 'error.alreadyFriends' };
    }
    // They asked first: treat this as the acceptance it plainly is.
    if (existing.addresseeId === user.id) {
      await db.friendship.update({
        where: { id: existing.id },
        data: { status: 'ACCEPTED' },
      });
      await notifyAccepted(existing.requesterId, user.name);
      revalidatePath('/friends');
      return {};
    }
    return { error: 'error.requestAlreadySent' };
  }

  await db.friendship.create({
    data: { requesterId: user.id, addresseeId, status: 'PENDING' },
  });
  await db.notification.create({
    data: {
      userId: addresseeId,
      type: 'FRIEND_REQUEST',
      body: `${user.name} souhaite devenir votre ami.`,
      href: '/friends',
    },
  });

  revalidatePath('/friends');
  revalidatePath(`/u/${addresseeId}`);
  return {};
}

export async function acceptFriendship(
  friendshipId: string,
): Promise<FriendResult> {
  const user = await requireUser();

  // Scoped to the addressee: only the person asked can accept.
  const { count } = await db.friendship.updateMany({
    where: { id: friendshipId, addresseeId: user.id, status: 'PENDING' },
    data: { status: 'ACCEPTED' },
  });
  if (count === 0) return { error: 'error.requestGone' };

  const friendship = await db.friendship.findUnique({
    where: { id: friendshipId },
    select: { requesterId: true },
  });
  if (friendship) await notifyAccepted(friendship.requesterId, user.name);

  revalidatePath('/friends');
  revalidatePath('/app');
  return {};
}

/** Declines a pending request, or ends an existing friendship. */
export async function removeFriendship(
  friendshipId: string,
): Promise<FriendResult> {
  const user = await requireUser();

  const { count } = await db.friendship.deleteMany({
    where: {
      id: friendshipId,
      OR: [{ requesterId: user.id }, { addresseeId: user.id }],
    },
  });
  if (count === 0) return { error: 'error.relationGone' };

  revalidatePath('/friends');
  revalidatePath('/app');
  return {};
}

async function notifyAccepted(userId: string, name: string) {
  await db.notification.create({
    data: {
      userId,
      type: 'FRIEND_ACCEPTED',
      body: `${name} a accepté votre demande.`,
      href: '/friends',
    },
  });
}
