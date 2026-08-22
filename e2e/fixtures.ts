import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

/**
 * Fixtures for end-to-end runs.
 *
 * Earlier versions of these specs reserved and released gifts from the seed.
 * That coupled every test to the seed's exact state, so one aborted run left
 * a reservation behind and the next run failed for reasons unrelated to what
 * it was testing — twice.
 *
 * Each spec now creates its own owner, friends and gifts, and deletes them
 * afterwards. Nothing touches the seed.
 */
const db = new PrismaClient();

/** Every generated account uses the same password as the demo accounts. */
export const TEST_PASSWORD = 'kadlio1234';

// Hashing is deliberately slow, so do it once per process rather than per user.
let cachedHash: Promise<string> | null = null;
const passwordHash = () => (cachedHash ??= hashPassword(TEST_PASSWORD));

let counter = 0;
const unique = () => `e2e-${Date.now()}-${counter++}`;

export type Scenario = {
  /** Unique per scenario; every generated name ends with it. */
  tag: string;
  ownerEmail: string;
  friendEmail: string;
  otherFriendEmail: string;
  listId: string;
  freeGiftId: string;
  takenGiftId: string;
  /** Collaborative gift with a 500 € target and nothing collected yet. */
  potGiftId: string;
  userIds: string[];
};

/**
 * Builds an owner with two friends and a list holding one free gift and one
 * already reserved by the second friend.
 *
 * Accounts get a real password hash, so specs sign in through the interface
 * exactly as a person would rather than forging a session.
 */
export async function createScenario(): Promise<Scenario> {
  const tag = unique();
  const hash = await passwordHash();

  const owner = await db.user.create({
    data: {
      email: `owner-${tag}@example.com`,
      name: `Propriétaire ${tag}`,
      passwordHash: hash,
    },
  });
  const friend = await db.user.create({
    data: {
      email: `friend-${tag}@example.com`,
      name: `Ami ${tag}`,
      passwordHash: hash,
    },
  });
  const other = await db.user.create({
    data: {
      email: `other-${tag}@example.com`,
      name: `Autre ${tag}`,
      passwordHash: hash,
    },
  });

  await db.friendship.createMany({
    data: [
      { requesterId: friend.id, addresseeId: owner.id, status: 'ACCEPTED' },
      { requesterId: other.id, addresseeId: owner.id, status: 'ACCEPTED' },
    ],
  });

  const list = await db.giftList.create({
    data: {
      ownerId: owner.id,
      name: `Liste ${tag}`,
      gifts: {
        create: [
          { name: `Libre ${tag}`, priceCents: 4200 },
          { name: `Pris ${tag}`, priceCents: 6800 },
          { name: `Ensemble ${tag}`, priceCents: 50000 },
        ],
      },
    },
    include: { gifts: true },
  });

  const free = list.gifts.find((g) => g.name.startsWith('Libre'))!;
  const taken = list.gifts.find((g) => g.name.startsWith('Pris'))!;
  const pot = list.gifts.find((g) => g.name.startsWith('Ensemble'))!;

  await db.reservation.create({
    data: { giftId: taken.id, reserverId: other.id },
  });

  // The "Ensemble" gift is a pot because `other` reserved it and opened it to
  // the rest — the model now. The list's owner never ticked a box, and the
  // specs that check what they can see rely on that being the only route in.
  await db.reservation.create({
    data: {
      giftId: pot.id,
      reserverId: other.id,
      openedToOthers: true,
      openedAt: new Date(),
    },
  });

  return {
    tag,
    ownerEmail: owner.email,
    friendEmail: friend.email,
    otherFriendEmail: other.email,
    listId: list.id,
    freeGiftId: free.id,
    takenGiftId: taken.id,
    potGiftId: pot.id,
    userIds: [owner.id, friend.id, other.id],
  };
}

/** Removes a scenario. Users cascade to lists, gifts and reservations. */
export async function destroyScenario(scenario: Scenario): Promise<void> {
  await db.friendship.deleteMany({
    where: {
      OR: [
        { requesterId: { in: scenario.userIds } },
        { addresseeId: { in: scenario.userIds } },
      ],
    },
  });
  await db.user.deleteMany({ where: { id: { in: scenario.userIds } } });
}

export async function disconnect(): Promise<void> {
  await db.$disconnect();
}
