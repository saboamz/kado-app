import { db } from './db';
import { daysUntilDate } from './format';
import type { ViewerRelation } from './secrecy';

export type LifeEventView = {
  id: string;
  label: string;
  day: number;
  month: number;
  visibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
  /** Days until the next occurrence, 0 on the day itself. */
  days: number;
};

/**
 * Which visibilities a viewer may read, given how they relate to the owner.
 *
 * The same three-way rule the lists use, kept in one place so an event and a
 * list can never disagree about what "FRIENDS" means.
 */
function readable(relation: ViewerRelation): Array<'PRIVATE' | 'FRIENDS' | 'PUBLIC'> {
  if (relation === 'owner') return ['PRIVATE', 'FRIENDS', 'PUBLIC'];
  if (relation === 'friend') return ['FRIENDS', 'PUBLIC'];
  return ['PUBLIC'];
}

/**
 * One person's events, filtered to what this viewer may see and ordered by
 * how soon they fall.
 *
 * The ordering happens here rather than in SQL: an event stores a day and a
 * month with no year, so "soonest" means the next occurrence, which the
 * database cannot express with an ORDER BY on two integers.
 */
export async function eventsForViewer(
  ownerId: string,
  relation: ViewerRelation,
): Promise<LifeEventView[]> {
  const rows = await db.lifeEvent.findMany({
    where: { ownerId, visibility: { in: readable(relation) } },
    select: { id: true, label: true, day: true, month: true, visibility: true },
  });

  return rows
    .map((r) => ({ ...r, days: daysUntilDate(r.day, r.month) }))
    .sort((a, b) => a.days - b.days);
}

/**
 * The events of everybody the viewer is friends with, soonest first.
 *
 * Friends only: this feeds the "what is coming up" screens, and a stranger's
 * public event has no place in a list of people you know.
 */
export async function upcomingForFriends(
  friendIds: string[],
  limit?: number,
): Promise<Array<LifeEventView & { owner: { id: string; name: string; avatarUrl: string | null } }>> {
  if (friendIds.length === 0) return [];

  const rows = await db.lifeEvent.findMany({
    where: { ownerId: { in: friendIds }, visibility: { in: ['FRIENDS', 'PUBLIC'] } },
    select: {
      id: true,
      label: true,
      day: true,
      month: true,
      visibility: true,
      owner: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  const sorted = rows
    .map((r) => ({ ...r, days: daysUntilDate(r.day, r.month) }))
    .sort((a, b) => a.days - b.days);

  return limit ? sorted.slice(0, limit) : sorted;
}
