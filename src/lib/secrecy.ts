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
  reservation?: {
    reserverId: string;
    createdAt: Date;
    openedToOthers: boolean;
  } | null;
  contributions?: { contributorId: string; amountCents: number }[];
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
      targetCents: gift.priceCents,
      raisedCents: contributions.reduce((sum, c) => sum + c.amountCents, 0),
      contributorCount: new Set(contributions.map((c) => c.contributorId)).size,
      myContributionCents: contributions
        .filter((c) => c.contributorId === viewerId)
        .reduce((sum, c) => sum + c.amountCents, 0),
    };
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
  if (relation === 'owner') return {} as const;
  return {
    reservation: {
      select: { reserverId: true, createdAt: true, openedToOthers: true },
    },
    contributions: { select: { contributorId: true, amountCents: true } },
  } as const;
}
