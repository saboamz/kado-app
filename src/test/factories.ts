import { db } from '@/lib/db';
import { nameKey } from '@/lib/name-key';

let seq = 0;
const uniq = () => `${Date.now()}-${seq++}`;

/**
 * A user whose name is made unique here, not by the caller: names are
 * usernames now, and test files run in parallel — two suites each asking
 * for an "Owner" at the same moment must not fight over the index. A test
 * that needs the exact name reads it back from the row.
 */
export async function makeUser(name = 'Test User') {
  const unique = `${name} ${uniq()}`;
  return db.user.create({
    data: {
      email: `test-${uniq()}@example.com`,
      passwordHash: 'scrypt:00:00',
      name: unique,
      nameKey: nameKey(unique),
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
  over: { name?: string; priceCents?: number } = {},
) {
  return db.gift.create({
    data: {
      listId,
      name: over.name ?? 'Cadeau',
      priceCents: over.priceCents ?? 1000,
    },
  });
}

/**
 * Reserves a gift, optionally opening it to the other friends.
 *
 * A pot is a reservation its holder opened — there is no such thing as a
 * "pot gift" any more — so a test that wants one starts here.
 */
export async function makeReservation(
  giftId: string,
  reserverId: string,
  over: { openedToOthers?: boolean } = {},
) {
  const opened = over.openedToOthers ?? false;
  return db.reservation.create({
    data: {
      giftId,
      reserverId,
      openedToOthers: opened,
      openedAt: opened ? new Date() : null,
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
