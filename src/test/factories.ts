import { db } from '@/lib/db';

let seq = 0;
const uniq = () => `${Date.now()}-${seq++}`;

export async function makeUser(name = 'Test User') {
  return db.user.create({
    data: {
      email: `test-${uniq()}@example.com`,
      passwordHash: 'scrypt:00:00',
      name,
    },
  });
}

export async function makeFriends(a: string, b: string) {
  return db.friendship.create({
    data: { requesterId: a, addresseeId: b, status: 'ACCEPTED' },
  });
}

export async function makeList(
  ownerId: string,
  over: { name?: string; visibility?: 'PRIVATE' | 'FRIENDS' | 'PUBLIC' } = {},
) {
  return db.giftList.create({
    data: { ownerId, name: over.name ?? 'Liste', visibility: over.visibility },
  });
}

export async function makeGift(
  listId: string,
  over: { name?: string; priceCents?: number; isPot?: boolean } = {},
) {
  return db.gift.create({
    data: {
      listId,
      name: over.name ?? 'Cadeau',
      priceCents: over.priceCents ?? 1000,
      isPot: over.isPot ?? false,
    },
  });
}

/** Removes everything created by a test run. Users cascade to their data. */
export async function cleanup(userIds: string[]) {
  await db.friendship.deleteMany({
    where: {
      OR: [{ requesterId: { in: userIds } }, { addresseeId: { in: userIds } }],
    },
  });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
}
