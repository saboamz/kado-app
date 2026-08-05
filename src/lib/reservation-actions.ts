'use server';

import { revalidatePath } from 'next/cache';
import { db } from './db';
import { logEvent } from './events';
import { relationTo } from './relations';
import { requireUser } from './session';

export type ReservationResult = { error?: string };

/**
 * Loads a gift a friend is allowed to act on.
 *
 * Refuses three cases, each for its own reason:
 *  - the owner, because reserving your own gift would defeat the point and
 *    would put a row in a table their own queries must never touch;
 *  - a stranger, because reservations are a thing friends do;
 *  - a list whose visibility does not admit this viewer.
 */
async function requireReservableGift(giftId: string) {
  const user = await requireUser();

  const gift = await db.gift.findUnique({
    where: { id: giftId },
    select: {
      id: true,
      name: true,
      isPot: true,
      listId: true,
      // Carried onto the event: the product it resolves to, and the price and
      // category AS THEY ARE NOW.
      productId: true,
      priceCents: true,
      category: true,
      list: { select: { ownerId: true, visibility: true } },
    },
  });
  if (!gift) return { error: 'Cadeau introuvable' } as const;

  const relation = await relationTo(user.id, gift.list.ownerId);
  if (relation === 'owner') {
    return { error: 'Vous ne pouvez pas réserver un cadeau de votre liste.' } as const;
  }
  if (relation === 'stranger') {
    return { error: "Vous n'avez pas accès à cette liste." } as const;
  }
  if (gift.isPot) {
    return {
      error: 'Ce cadeau est collaboratif : participez à la cagnotte.',
    } as const;
  }

  return { user, gift } as const;
}

export async function reserveGift(giftId: string): Promise<ReservationResult> {
  const found = await requireReservableGift(giftId);
  if ('error' in found) return { error: found.error };
  const { user, gift } = found;

  try {
    // giftId is unique on Reservation, so a second reservation loses the race
    // at the database rather than in a check-then-write window.
    //
    // The event is written in the SAME transaction: an event describing a
    // reservation that then failed is worse than no event, because it trains
    // the model on something that never happened.
    await db.$transaction(async (tx) => {
      await tx.reservation.create({
        data: { giftId, reserverId: user.id },
      });
      await logEvent(
        {
          actorId: user.id, // from the session, never from the caller
          kind: 'reserve',
          recipientId: gift.list.ownerId,
          giftId,
          productId: gift.productId,
          // The price as it is NOW. Reading it back from Product later would
          // rewrite history every time the merchant runs a sale.
          priceCents: gift.priceCents,
          categoryId: gift.category,
        },
        tx,
      );
    });
  } catch {
    return { error: "Quelqu'un vient de réserver ce cadeau." };
  }

  revalidatePath(`/gifts/${giftId}`);
  revalidatePath(`/lists/${gift.listId}`);
  return {};
}

export async function releaseGift(giftId: string): Promise<ReservationResult> {
  const found = await requireReservableGift(giftId);
  if ('error' in found) return { error: found.error };
  const { user, gift } = found;

  // Scoped to this reserver: you can only release what you hold.
  //
  // The event is written only when a row was actually deleted, and inside the
  // same transaction as the delete. Logging unconditionally would let anyone
  // manufacture negative signal against any product by repeatedly "releasing"
  // gifts they never reserved — unreserve carries −3.0, so it is the cheapest
  // way to push something out of everyone's recommendations.
  const count = await db.$transaction(async (tx) => {
    const deleted = await tx.reservation.deleteMany({
      where: { giftId, reserverId: user.id },
    });
    if (deleted.count > 0) {
      await logEvent(
        {
          actorId: user.id,
          kind: 'unreserve',
          recipientId: gift.list.ownerId,
          giftId,
          productId: gift.productId,
          priceCents: gift.priceCents,
          categoryId: gift.category,
        },
        tx,
      );
    }
    return deleted.count;
  });

  if (count === 0) {
    return { error: "Vous n'aviez pas réservé ce cadeau." };
  }

  revalidatePath(`/gifts/${giftId}`);
  revalidatePath(`/lists/${gift.listId}`);
  return {};
}
