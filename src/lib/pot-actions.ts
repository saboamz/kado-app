'use server';

import { revalidatePath } from 'next/cache';
import { db } from './db';
import { mayDeclarePurchase } from './pot-rules';
import { logEvent } from './events';
import { parseMoney } from './format';
import { relationTo } from './relations';
import { requireUser } from './session';

export type PotResult = { error?: string };

/** Nobody may put in less than a euro or more than ten thousand at once. */
const MIN_CENTS = 100;
const MAX_CENTS = 1_000_000;

async function requirePotGift(giftId: string) {
  const user = await requireUser();

  const gift = await db.gift.findUnique({
    where: { id: giftId },
    select: {
      id: true,
      priceCents: true,
      listId: true,
      productId: true,
      category: true,
      list: { select: { ownerId: true, allowPots: true } },
      // A pot exists because the holder opened their reservation to others.
      reservation: { select: { openedToOthers: true } },
    },
  });
  if (!gift) return { error: 'error.giftNotFound' } as const;
  if (!gift.reservation?.openedToOthers) {
    return {
      error: 'error.notOpenToOthers',
    } as const;
  }

  const relation = await relationTo(user.id, gift.list.ownerId);
  if (relation === 'owner') {
    return {
      error: 'error.cannotContributeOwn',
    } as const;
  }
  if (relation === 'stranger') {
    return { error: 'error.noAccessToList' } as const;
  }

  return { user, gift } as const;
}

export async function contribute(
  giftId: string,
  amount: string,
): Promise<PotResult> {
  const found = await requirePotGift(giftId);
  if ('error' in found) return { error: found.error };
  const { user, gift } = found;

  const cents = parseMoney(amount);
  if (cents === null) return { error: 'error.amountInvalid' };
  if (cents < MIN_CENTS) return { error: 'error.amountMinimum' };
  if (cents > MAX_CENTS) return { error: 'error.amountTooHigh' };

  // Overshooting the target helps nobody: the extra would have to be refunded
  // by hand. Cap the contribution at what is still needed.
  if (gift.priceCents) {
    const raised = await db.potContribution.aggregate({
      where: { giftId },
      _sum: { amountCents: true },
    });
    const remaining = gift.priceCents - (raised._sum.amountCents ?? 0);
    if (remaining <= 0) {
      return { error: 'error.potComplete' };
    }
    if (cents > remaining) {
      return {
        error: `Il ne reste que ${(remaining / 100).toLocaleString('fr-FR')} € à réunir.`,
      };
    }
  }

  // Contributions accumulate rather than replace: someone may chip in twice.
  //
  // Event in the same transaction, and priceCents is what was actually PUT IN,
  // not the gift's asking price — the event records what happened.
  await db.$transaction(async (tx) => {
    await tx.potContribution.create({
      data: { giftId, contributorId: user.id, amountCents: cents },
    });
    await logEvent(
      {
        actorId: user.id,
        kind: 'contribute',
        recipientId: gift.list.ownerId,
        giftId,
        productId: gift.productId,
        priceCents: cents,
        categoryId: gift.category,
      },
      tx,
    );
  });

  revalidatePath(`/gifts/${giftId}`);
  revalidatePath(`/lists/${gift.listId}`);
  return {};
}

/** Withdraws everything this contributor put in. */
export async function withdrawContribution(
  giftId: string,
): Promise<PotResult> {
  const found = await requirePotGift(giftId);
  if ('error' in found) return { error: found.error };
  const { user, gift } = found;

  /*
   * Refused once somebody has paid for the gift.
   *
   * Withdrawing then is not leaving a pot, it is taking back what you owe a
   * friend who has already put the money down for you. Enforced here and not
   * only in the UI: hiding a button is a suggestion, this is the rule.
   */
  const reservation = await db.reservation.findUnique({
    where: { giftId },
    select: { purchasedById: true },
  });
  if (reservation?.purchasedById) return { error: 'error.alreadyBought' };

  const { count } = await db.potContribution.deleteMany({
    where: { giftId, contributorId: user.id },
  });
  if (count === 0) {
    return { error: 'error.nothingContributed' };
  }

  revalidatePath(`/gifts/${giftId}`);
  revalidatePath(`/lists/${gift.listId}`);
  return {};
}

/**
 * Says that you went and bought the thing.
 *
 * ── Why this exists, and why it opens the names ────────────────────────────
 *
 * No money moves through this app. A contribution is a PROMISE, so at the end
 * one person pays the shop the whole amount and is owed by everyone else —
 * and until now they were the single person unable to see who owed them what.
 * They could watch "100 € réunis" and have nobody to ask.
 *
 * Declaring the purchase is what reveals the breakdown, and only to them. The
 * others go on seeing a count and a total, plus the one line that concerns
 * them: what they owe, and to whom.
 *
 * The timing is the point. Before a purchase, a name beside an amount is only
 * something to be judged on — somebody puts in what looks acceptable rather
 * than what they can afford. After it, the same information is what lets a
 * person be paid back. The risk is what opens the door.
 */
export async function declarePurchase(giftId: string): Promise<PotResult> {
  const found = await requirePotGift(giftId);
  if ('error' in found) return { error: found.error };
  const { user } = found;

  const mine = await db.potContribution.findFirst({
    where: { giftId, contributorId: user.id },
    select: { id: true },
  });
  if (!mayDeclarePurchase(Boolean(mine))) return { error: 'error.contributeFirst' };

  // Scoped to a pot nobody has claimed, so two people pressing at once cannot
  // overwrite each other — the first to arrive is the one who paid.
  const { count } = await db.reservation.updateMany({
    where: { giftId, openedToOthers: true, purchasedById: null },
    data: { purchasedById: user.id, purchasedAt: new Date() },
  });
  if (count === 0) return { error: 'error.alreadyPurchased' };

  revalidatePath(`/gifts/${giftId}`);
  return {};
}

/**
 * Takes back a declared purchase, reopening the pot.
 *
 * ── Why this has to exist ──────────────────────────────────────────────────
 *
 * Declaring a purchase does three irreversible things at once: it closes the
 * pot, it locks withdrawals, and it shows the buyer everyone's name and
 * amount. Somebody who presses it by mistake — or who thought they were
 * volunteering rather than reporting a payment — had no way back, and a pot
 * short of its goal could never be topped up again.
 *
 * So it is undoable, by the person who claimed it, and only by them. What
 * they have already seen cannot be unseen; what CAN be given back is the
 * pot's ability to carry on.
 */
export async function undoPurchase(giftId: string): Promise<PotResult> {
  const found = await requirePotGift(giftId);
  if ('error' in found) return { error: found.error };
  const { user } = found;

  // Scoped to this claimant, so nobody can cancel somebody else's purchase.
  const { count } = await db.reservation.updateMany({
    where: { giftId, openedToOthers: true, purchasedById: user.id },
    data: { purchasedById: null, purchasedAt: null },
  });
  if (count === 0) return { error: 'error.notTheBuyer' };

  revalidatePath(`/gifts/${giftId}`);
  return {};
}
