import { cache } from 'react';
import { db } from './db';
import type { ViewerRelation } from './secrecy';

/**
 * How a viewer relates to a resource's owner.
 *
 * Everything the API returns depends on this, so it is resolved from the
 * database on every request rather than trusted from the client.
 *
 * Wrapped in React's `cache`, like getCurrentUser: the gift page asks for the
 * same pair three times in one render — once to choose the include, once for
 * the chat, once for its count — and that was three identical friendship
 * queries on a page LiveRefresh re-runs every few seconds. The memo lives for
 * one request only, so a revoked friendship is still re-read on the next one;
 * the answer can never go stale across requests.
 */
export const relationTo = cache(async function relationTo(
  viewerId: string | null,
  ownerId: string,
): Promise<ViewerRelation> {
  if (viewerId && viewerId === ownerId) return 'owner';
  if (!viewerId) return 'stranger';
  return (await areFriends(viewerId, ownerId)) ? 'friend' : 'stranger';
});

/** Friendship is symmetric: either direction counts once accepted. */
export const areFriends = cache(async function areFriends(
  a: string,
  b: string,
): Promise<boolean> {
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
});

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
