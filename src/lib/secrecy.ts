/**
 * The rule this application exists to keep.
 *
 * A list owner must never learn that one of their gifts has been reserved, or
 * that money has been collected for it — not who, not how many, not that
 * anything happened at all.
 *
 * Enforcing that in the UI is not enough: the data would still be sitting in
 * the JSON payload for anyone who opens devtools. So the rule lives here, at
 * the boundary where rows become responses, and every route that can be called
 * by an owner passes through it.
 */

export type ViewerRelation = 'owner' | 'friend' | 'stranger';

/** A gift as it exists in the database, before any redaction. */
export type GiftRow = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number | null;
  currency: string;
  url: string | null;
  merchant: string | null;
  imageUrl: string | null;
  category: string | null;
  priority: number;
  listId: string;
  createdAt: Date;
  /** The catalogue row this wish resolved to, when it has one. */
  product?: { priceCents: number | null; currency: string } | null;
  reservation?: {
    reserverId: string;
    createdAt: Date;
    openedToOthers: boolean;
    /** The goal its opener set. Null on pots opened before goals existed. */
    targetCents?: number | null;
    /** Who advanced the money, once somebody says they did. */
    purchasedById?: string | null;
    purchasedBy?: { name: string } | null;
  } | null;
  contributions?: {
    contributorId: string;
    amountCents: number;
    /** Only selected once somebody has declared the purchase. See potInclude. */
    contributor?: { name: string } | null;
  }[];
};

/**
 * What a viewer is allowed to know about a gift's reservation.
 *
 * `open` is a gift somebody claimed and then invited the others into. It is
 * deliberately distinct from `taken`: a friend arriving at an open gift can
 * still act on it, where a taken one is closed to them.
 *
 * Whether the viewer holds it is carried alongside the state rather than
 * folded into it, because an open pot needs both — the holder sees "you
 * started this", everyone else sees "you can join".
 */
export type ReservationView =
  | { state: 'free' }
  | { state: 'mine'; since: string }
  | { state: 'taken' }
  | { state: 'open'; mine: boolean; since: string };

export type PotView = {
  targetCents: number | null;
  raisedCents: number;
  contributorCount: number;
  /** What this viewer personally put in. Never anybody else's figure. */
  myContributionCents: number;
  /**
   * Who went and bought it, once they have said so. Null while nobody has.
   *
   * Their name is shown to the others because it answers the only question
   * that matters at that point: who do I owe, and where do I send it.
   */
  buyer?: { name: string; isMe: boolean } | null;
  /**
   * Who promised what — visible ONLY to the person who paid.
   *
   * No money moves through this app. A contribution is a promise, and the
   * buyer is out of pocket for the whole amount, so they are the one person
   * who has to be able to chase it. Everybody else keeps seeing a count and
   * a total: an amount read next to a name stops being a number somebody
   * could afford and becomes one they will be judged on.
   *
   * Absent until a purchase is declared, for everyone including the eventual
   * buyer — the information appears with the risk, not before it.
   */
  owed?: { name: string; amountCents: number }[];
};

export type GiftView = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number | null;
  currency: string;
  url: string | null;
  merchant: string | null;
  imageUrl: string | null;
  category: string | null;
  priority: number;
  listId: string;
  createdAt: string;
  /**
   * A price nobody typed, taken from the catalogue row the link resolved to.
   *
   * Kept SEPARATE from priceCents rather than filled into it, for two
   * reasons. It is a guess and has to be labelled as one on screen — merged
   * in, it would be indistinguishable from a figure the wisher actually
   * wrote. And priceCents is the pot's target: a pot that completes against
   * an estimate would tell contributors they are done when they are not.
   *
   * Absent when the wish carries its own price, or when nothing was found.
   */
  estimatedPriceCents?: number | null;
  /** Absent for owners. Its absence is the feature. */
  reservation?: ReservationView;
  /**
   * Absent for owners, and for any gift whose holder has not opened it.
   *
   * A pot now exists because a friend invited others in, not because the list
   * owner ticked a box when they added the wish.
   */
  pot?: PotView;
};

/**
 * Projects a gift row for one viewer.
 *
 * For an owner the reservation and pot keys are not emptied or zeroed — they
 * are absent from the object entirely, so there is no shape difference between
 * "nobody reserved this" and "somebody did". An owner cannot tell the two
 * apart, because their payload is identical.
 */
export function viewGift(
  gift: GiftRow,
  relation: ViewerRelation,
  viewerId: string | null,
): GiftView {
  const base: GiftView = {
    id: gift.id,
    name: gift.name,
    description: gift.description,
    priceCents: gift.priceCents,
    currency: gift.currency,
    url: gift.url,
    merchant: gift.merchant,
    imageUrl: gift.imageUrl,
    category: gift.category,
    priority: gift.priority,
    listId: gift.listId,
    createdAt: gift.createdAt.toISOString(),
  };

  /*
   * Only when the wisher gave no price of their own. Theirs always wins:
   * they know what they want, and the catalogue only knows what a page said.
   *
   * Deliberately ABOVE the owner's early return, so an owner sees it too.
   * The figure comes from the merchant's page, not from anything anybody did
   * with the wish — it says nothing about who looked, reserved or
   * contributed, so it is not secret. Showing it to the owner is also useful:
   * it is how they notice the link resolved to the wrong article.
   */
  if (gift.priceCents == null && gift.product?.priceCents != null) {
    base.estimatedPriceCents = gift.product.priceCents;
  }

  if (relation === 'owner') return base;

  base.reservation = viewReservation(gift.reservation ?? null, viewerId);

  /*
   * The pot exists because the holder opened the reservation to others — not
   * because the list owner ticked a box. It is therefore derived from the
   * reservation, and an owner never reaches this line: they returned above.
   */
  if (gift.reservation?.openedToOthers) {
    const contributions = gift.contributions ?? [];
    base.pot = {
      /*
       * The opener's goal, and only then the wish's own price.
       *
       * The price is the fallback for pots opened before a goal could be set;
       * new ones carry their own. An ESTIMATE never reaches here — it is a
       * separate field precisely so it cannot, because a pot completing
       * against a guess tells contributors they are done when they are not.
       */
      targetCents: gift.reservation.targetCents ?? gift.priceCents,
      raisedCents: contributions.reduce((sum, c) => sum + c.amountCents, 0),
      contributorCount: new Set(contributions.map((c) => c.contributorId)).size,
      myContributionCents: contributions
        .filter((c) => c.contributorId === viewerId)
        .reduce((sum, c) => sum + c.amountCents, 0),
    };

    const buyerId = gift.reservation.purchasedById ?? null;
    if (buyerId) {
      base.pot.buyer = {
        name: gift.reservation.purchasedBy?.name ?? '',
        isMe: buyerId === viewerId,
      };

      /*
       * The breakdown, and only for the person who paid.
       *
       * Guarded on the VIEWER, not on the data: the query selects names once
       * a purchase exists, and this is what decides whether they leave this
       * function. Anyone else — including another contributor — gets the same
       * count and total they got before.
       */
      if (buyerId === viewerId) {
        const byPerson = new Map<string, { name: string; amountCents: number }>();
        for (const c of contributions) {
          // The buyer's own promise is not a debt to themselves.
          if (c.contributorId === viewerId) continue;
          const found = byPerson.get(c.contributorId);
          if (found) found.amountCents += c.amountCents;
          else
            byPerson.set(c.contributorId, {
              name: c.contributor?.name ?? '',
              amountCents: c.amountCents,
            });
        }
        base.pot.owed = [...byPerson.values()].sort(
          (a, b) => b.amountCents - a.amountCents,
        );
      }
    }
  }

  return base;
}

/**
 * A friend learns whether a gift is taken, and whether they are the one who
 * took it — never who else did. Naming the reserver would let friends leak it
 * to the owner by accident, and it is not information they need.
 */
export function viewReservation(
  reservation: {
    reserverId: string;
    createdAt: Date;
    openedToOthers: boolean;
  } | null,
  viewerId: string | null,
): ReservationView {
  if (!reservation) return { state: 'free' };

  const mine = Boolean(viewerId) && reservation.reserverId === viewerId;
  const since = reservation.createdAt.toISOString();

  // Open to everyone who can see the list: the state says so plainly, and
  // `mine` distinguishes the person who started it from those joining. Who
  // else has joined is still never named.
  if (reservation.openedToOthers) return { state: 'open', mine, since };

  return mine ? { state: 'mine', since } : { state: 'taken' };
}

/**
 * The Prisma `include` needed to build a view for this relation.
 *
 * For an owner it returns nothing, so the reservation rows are never even
 * fetched. Redaction that relies on remembering to delete a key later is one
 * refactor away from failing; not loading the data cannot fail that way.
 */
export function giftInclude(relation: ViewerRelation) {
  /*
   * The product is joined for EVERYONE, owners included.
   *
   * It carries a price read off a merchant page and nothing about what
   * anybody did with the wish, so it is not part of what this file hides.
   * Kept in both branches rather than hoisted, so the owner branch stays a
   * complete, readable statement of what an owner's query may touch.
   */
  if (relation === 'owner') {
    return { product: { select: { priceCents: true, currency: true } } } as const;
  }
  return {
    product: { select: { priceCents: true, currency: true } },
    reservation: {
      select: {
        reserverId: true,
        createdAt: true,
        openedToOthers: true,
        targetCents: true,
        purchasedById: true,
        purchasedBy: { select: { name: true } },
      },
    },
    /*
     * Names are fetched for every friend, and viewGift decides who keeps them.
     *
     * Scoping the QUERY to the buyer would mean this selector depending on
     * who is asking, and the one rule this file exists to keep is that the
     * shape is decided by RELATION alone. A contributor's name is not the
     * secret here — the list owner never reaches this branch at all, and that
     * is what the containment tests hold. Who owes what stays with the buyer
     * because viewGift drops it, in one place, checked by a test.
     */
    contributions: {
      select: {
        contributorId: true,
        amountCents: true,
        contributor: { select: { name: true } },
      },
    },
  } as const;
}
