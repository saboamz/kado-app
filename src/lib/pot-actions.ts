'use server';

import { revalidatePath } from 'next/cache';
import { db } from './db';
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
  if (!gift) return { error: 'Cadeau introuvable' } as const;
  if (!gift.reservation?.openedToOthers) {
    return {
      error: "Ce cadeau n'est pas ouvert à plusieurs.",
    } as const;
  }

  const relation = await relationTo(user.id, gift.list.ownerId);
  if (relation === 'owner') {
    return {
      error: 'Vous ne pouvez pas participer à une cagnotte de votre liste.',
    } as const;
  }
  if (relation === 'stranger') {
    return { error: "Vous n'avez pas accès à cette liste." } as const;
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
  if (cents === null) return { error: 'Ce montant semble invalide.' };
  if (cents < MIN_CENTS) return { error: 'Le minimum est de 1 €.' };
  if (cents > MAX_CENTS) return { error: 'Ce montant est trop élevé.' };

  // Overshooting the target helps nobody: the extra would have to be refunded
  // by hand. Cap the contribution at what is still needed.
  if (gift.priceCents) {
    const raised = await db.potContribution.aggregate({
      where: { giftId },
      _sum: { amountCents: true },
    });
    const remaining = gift.priceCents - (raised._sum.amountCents ?? 0);
    if (remaining <= 0) {
      return { error: 'La cagnotte est déjà complète. Merci !' };
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

  const { count } = await db.potContribution.deleteMany({
    where: { giftId, contributorId: user.id },
  });
  if (count === 0) {
    return { error: "Vous n'avez rien versé dans cette cagnotte." };
  }

  revalidatePath(`/gifts/${giftId}`);
  revalidatePath(`/lists/${gift.listId}`);
  return {};
}
