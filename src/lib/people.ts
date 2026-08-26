import { db } from './db';
import { nameKey } from './name-key';

export type PersonResult = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  listCount: number;
  relation: 'friend' | 'pending-sent' | 'pending-received' | 'none';
  friendshipId: string | null;
};

/**
 * Finds one person: by their exact username, or their exact e-mail.
 *
 * Exact on purpose, both ways. A name is a username now — one per person —
 * so the name typed either is somebody or is nobody, and a partial match
 * would only let anyone leaf through the members by fragments. E-mail was
 * always exact: a prefix match would let anyone enumerate addresses, the
 * same leak the login page avoids. People reach each other by knowing a
 * name, an address, or an invitation link — nothing else.
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
      OR: [{ nameKey: nameKey(trimmed) }, { email: trimmed.toLowerCase() }],
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      bio: true,
      _count: { select: { lists: true } },
    },
    take: 2,
  });

  return withRelations(people, viewerId);
}

/** Attaches the viewer's relationship to each person in one extra query. */
async function withRelations(
  people: {
    id: string;
    name: string;
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
          avatarUrl: true,
          bio: true,
          _count: { select: { lists: true } },
        },
      },
      addressee: {
        select: {
          id: true,
          name: true,
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
