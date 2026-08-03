import { db } from './db';
import type { ViewerRelation } from './secrecy';

/**
 * How a viewer relates to a resource's owner.
 *
 * Everything the API returns depends on this, so it is resolved from the
 * database on every request rather than trusted from the client.
 */
export async function relationTo(
  viewerId: string | null,
  ownerId: string,
): Promise<ViewerRelation> {
  if (viewerId && viewerId === ownerId) return 'owner';
  if (!viewerId) return 'stranger';
  return (await areFriends(viewerId, ownerId)) ? 'friend' : 'stranger';
}

/** Friendship is symmetric: either direction counts once accepted. */
export async function areFriends(a: string, b: string): Promise<boolean> {
  const row = await db.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
    select: { id: true },
  });
  return row !== null;
}

/** Ids of everyone the viewer is friends with. */
export async function friendIds(viewerId: string): Promise<string[]> {
  const rows = await db.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: viewerId }, { addresseeId: viewerId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === viewerId ? r.addresseeId : r.requesterId));
}

/** Whether a viewer may see a list at all, given its visibility setting. */
export function canViewList(
  visibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC',
  relation: ViewerRelation,
): boolean {
  if (relation === 'owner') return true;
  if (visibility === 'PUBLIC') return true;
  if (visibility === 'FRIENDS') return relation === 'friend';
  return false;
}
