import { db } from './db';
import { canViewList, relationTo } from './relations';
import { giftInclude, viewGift, type GiftView, type ViewerRelation } from './secrecy';

export type ListView = {
  id: string;
  name: string;
  occasion: string | null;
  visibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
  isDefault: boolean;
  allowPots: boolean;
  owner: { id: string; name: string; avatarColor: string };
  giftCount: number;
  /** Absent for owners: a count of taken gifts is itself a leak. */
  reservedCount?: number;
  gifts?: GiftView[];
};

/**
 * Loads one list for one viewer, or null if they may not see it.
 *
 * The include is chosen by relation, so an owner's query never touches the
 * Reservation or PotContribution tables.
 */
export async function getListForViewer(
  listId: string,
  viewerId: string | null,
): Promise<ListView | null> {
  const list = await db.giftList.findUnique({
    where: { id: listId },
    include: { owner: { select: { id: true, name: true, avatarColor: true } } },
  });
  if (!list) return null;

  const relation = await relationTo(viewerId, list.ownerId);
  if (!canViewList(list.visibility, relation)) return null;

  const gifts = await db.gift.findMany({
    where: { listId },
    include: giftInclude(relation),
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  return {
    ...summarise(list, relation, gifts.length),
    gifts: gifts.map((g) => viewGift(g, relation, viewerId)),
    ...reservedCount(relation, gifts),
  };
}

/** Lists belonging to one user, as visible to one viewer. */
export async function getListsForViewer(
  ownerId: string,
  viewerId: string | null,
): Promise<ListView[]> {
  const relation = await relationTo(viewerId, ownerId);
  const lists = await db.giftList.findMany({
    where: { ownerId },
    include: {
      owner: { select: { id: true, name: true, avatarColor: true } },
      _count: { select: { gifts: true } },
      gifts: { select: { reservation: { select: { id: true } } } },
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  return lists
    .filter((l) => canViewList(l.visibility, relation))
    .map((l) => ({
      ...summarise(l, relation, l._count.gifts),
      ...reservedCount(
        relation,
        l.gifts.map((g) => ({ reservation: g.reservation })),
      ),
    }));
}

function summarise(
  list: {
    id: string;
    name: string;
    occasion: string | null;
    visibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
    isDefault: boolean;
    allowPots: boolean;
    owner: { id: string; name: string; avatarColor: string };
  },
  _relation: ViewerRelation,
  giftCount: number,
): Omit<ListView, 'reservedCount' | 'gifts'> {
  return {
    id: list.id,
    name: list.name,
    occasion: list.occasion,
    visibility: list.visibility,
    isDefault: list.isDefault,
    allowPots: list.allowPots,
    owner: list.owner,
    giftCount,
  };
}

/**
 * How many gifts are spoken for.
 *
 * Owners get nothing at all — telling Sophie "2 of your gifts are reserved"
 * gives away most of the surprise even without naming anybody.
 */
function reservedCount(
  relation: ViewerRelation,
  gifts: { reservation?: unknown }[],
): { reservedCount?: number } {
  if (relation === 'owner') return {};
  return { reservedCount: gifts.filter((g) => g.reservation).length };
}
