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
 *
 * It no longer refuses a "collaborative" gift: there is no such gift any
 * more. Every gift is reserved the same way, and its holder decides
 * afterwards whether to invite the others in.
 */
async function requireReservableGift(giftId: string) {
  const user = await requireUser();

  const gift = await db.gift.findUnique({
    where: { id: giftId },
    select: {
      id: true,
      name: true,
      listId: true,
      // Carried onto the event: the product it resolves to, and the price and
      // category AS THEY ARE NOW.
      productId: true,
      priceCents: true,
      category: true,
      list: { select: { ownerId: true, visibility: true } },
    },
  });
  if (!gift) return { error: 'error.giftNotFound' } as const;

  const relation = await relationTo(user.id, gift.list.ownerId);
  if (relation === 'owner') {
    return { error: 'error.cannotReserveOwn' } as const;
  }
  if (relation === 'stranger') {
    return { error: "Vous n'avez pas accès à cette liste." } as const;
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

/**
 * Opens a reservation to the other friends, turning it into a pot.
 *
 * Only the holder may do this: it is their claim to share. Everyone who can
 * see the list can then contribute — the same audience that could already see
 * the gift was taken, so opening reveals nothing new to anyone.
 *
 * The list's owner is not among them, and nothing here changes that: the pot
 * is derived from the reservation, and an owner's queries never load one.
 */
export async function openToOthers(giftId: string): Promise<ReservationResult> {
  const found = await requireReservableGift(giftId);
  if ('error' in found) return { error: found.error };
  const { user, gift } = found;

  // Scoped to this reserver, and to a reservation that is not open already,
  // so a second click cannot move openedAt and rewrite when it happened.
  const { count } = await db.reservation.updateMany({
    where: { giftId, reserverId: user.id, openedToOthers: false },
    data: { openedToOthers: true, openedAt: new Date() },
  });

  if (count === 0) {
    return { error: "Vous n'avez pas réservé ce cadeau." };
  }

  revalidatePath(`/gifts/${giftId}`);
  revalidatePath(`/lists/${gift.listId}`);
  return {};
}

/**
 * Closes an open reservation back to a solo one.
 *
 * Refused once anybody else has put money in. Closing then would leave their
 * contributions attached to a gift they can no longer see or withdraw from —
 * the app would be holding money on behalf of someone it had just shut out.
 * They have to withdraw first, which they can do themselves.
 */
export async function closeToOthers(giftId: string): Promise<ReservationResult> {
  const found = await requireReservableGift(giftId);
  if ('error' in found) return { error: found.error };
  const { user, gift } = found;

  const others = await db.potContribution.count({
    where: { giftId, contributorId: { not: user.id } },
  });
  if (others > 0) {
    return {
      error:
        'D’autres personnes ont déjà participé. Elles doivent retirer leur participation avant que vous puissiez refermer.',
    };
  }

  const { count } = await db.reservation.updateMany({
    where: { giftId, reserverId: user.id, openedToOthers: true },
    data: { openedToOthers: false, openedAt: null },
  });

  if (count === 0) {
    return { error: "Ce cadeau n'est pas ouvert aux autres." };
  }

  revalidatePath(`/gifts/${giftId}`);
  revalidatePath(`/lists/${gift.listId}`);
  return {};
}
