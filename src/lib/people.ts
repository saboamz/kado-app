import { db } from './db';
import { friendIds } from './relations';

export type PersonResult = {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl: string | null;
  bio: string | null;
  listCount: number;
  relation: 'friend' | 'pending-sent' | 'pending-received' | 'none';
  friendshipId: string | null;
};

/**
 * Finds people by name or exact e-mail.
 *
 * E-mail matches must be exact: a partial match would let anyone enumerate
 * addresses by typing prefixes, which is the same leak the login page avoids.
 */
export async function searchPeople(
  query: string,
  viewerId: string,
): Promise<PersonResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const people = await db.user.findMany({
    where: {
      id: { not: viewerId },
      OR: [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { email: trimmed.toLowerCase() },
      ],
    },
    select: {
      id: true,
      name: true,
      avatarColor: true,
      avatarUrl: true,
      bio: true,
      _count: { select: { lists: true } },
    },
    take: 20,
    orderBy: { name: 'asc' },
  });

  return withRelations(people, viewerId);
}

/** People the viewer might know: friends of their friends, then anyone else. */
export async function suggestPeople(
  viewerId: string,
): Promise<PersonResult[]> {
  const friends = await friendIds(viewerId);

  const people = await db.user.findMany({
    where: { id: { not: viewerId, notIn: friends } },
    select: {
      id: true,
      name: true,
      avatarColor: true,
      avatarUrl: true,
      bio: true,
      _count: { select: { lists: true } },
    },
    take: 12,
    orderBy: { createdAt: 'desc' },
  });

  return withRelations(people, viewerId);
}

/** Attaches the viewer's relationship to each person in one extra query. */
async function withRelations(
  people: {
    id: string;
    name: string;
    avatarColor: string;
  avatarUrl: string | null;
    bio: string | null;
    _count: { lists: number };
  }[],
  viewerId: string,
): Promise<PersonResult[]> {
  if (people.length === 0) return [];

  const ids = people.map((p) => p.id);
  const friendships = await db.friendship.findMany({
    where: {
      OR: [
        { requesterId: viewerId, addresseeId: { in: ids } },
        { requesterId: { in: ids }, addresseeId: viewerId },
      ],
    },
  });

  return people.map((person) => {
    const link = friendships.find(
      (f) => f.requesterId === person.id || f.addresseeId === person.id,
    );

    let relation: PersonResult['relation'] = 'none';
    if (link?.status === 'ACCEPTED') relation = 'friend';
    else if (link?.status === 'PENDING') {
      relation =
        link.requesterId === viewerId ? 'pending-sent' : 'pending-received';
    }

    return {
      id: person.id,
      name: person.name,
      avatarColor: person.avatarColor,
      avatarUrl: person.avatarUrl,
      bio: person.bio,
      listCount: person._count.lists,
      relation,
      friendshipId: link?.id ?? null,
    };
  });
}

export type FriendGroups = {
  friends: PersonResult[];
  received: PersonResult[];
  sent: PersonResult[];
};

/** Everyone the viewer is connected to, grouped by the state of the link. */
export async function getFriendGroups(
  viewerId: string,
): Promise<FriendGroups> {
  const friendships = await db.friendship.findMany({
    where: {
      status: { in: ['ACCEPTED', 'PENDING'] },
      OR: [{ requesterId: viewerId }, { addresseeId: viewerId }],
    },
    include: {
      requester: {
        select: {
          id: true,
          name: true,
          avatarColor: true,
      avatarUrl: true,
          bio: true,
          _count: { select: { lists: true } },
        },
      },
      addressee: {
        select: {
          id: true,
          name: true,
          avatarColor: true,
      avatarUrl: true,
          bio: true,
          _count: { select: { lists: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const groups: FriendGroups = { friends: [], received: [], sent: [] };

  for (const link of friendships) {
    const other =
      link.requesterId === viewerId ? link.addressee : link.requester;
    const entry: PersonResult = {
      id: other.id,
      name: other.name,
      avatarColor: other.avatarColor,
      avatarUrl: other.avatarUrl,
      bio: other.bio,
      listCount: other._count.lists,
      relation:
        link.status === 'ACCEPTED'
          ? 'friend'
          : link.requesterId === viewerId
            ? 'pending-sent'
            : 'pending-received',
      friendshipId: link.id,
    };

    if (entry.relation === 'friend') groups.friends.push(entry);
    else if (entry.relation === 'pending-received') groups.received.push(entry);
    else groups.sent.push(entry);
  }

  return groups;
}
