import { db } from './db';
import { getListForViewer } from './gifts';
import {
  cleanup,
  makeFriends,
  makeGift,
  makeList,
  makeUser,
} from '@/test/factories';

/**
 * Reservation behaviour against the real database.
 *
 * The server actions themselves need a request context (cookies), so these
 * exercise the same queries and constraints the actions rely on.
 */
describe('reservations', () => {
  let owner: { id: string };
  let alice: { id: string };
  let bob: { id: string };
  let listId: string;
  let giftId: string;

  beforeAll(async () => {
    owner = await makeUser('Owner');
    alice = await makeUser('Alice');
    bob = await makeUser('Bob');
    await makeFriends(owner.id, alice.id);
    await makeFriends(owner.id, bob.id);

    const list = await makeList(owner.id);
    listId = list.id;
    giftId = (await makeGift(list.id, { name: 'Théière' })).id;
  });

  afterEach(async () => {
    await db.reservation.deleteMany({ where: { giftId } });
  });

  afterAll(async () => {
    await cleanup([owner.id, alice.id, bob.id]);
    await db.$disconnect();
  });

  it('lets one friend hold a gift', async () => {
    await db.reservation.create({ data: { giftId, reserverId: alice.id } });

    const view = await getListForViewer(listId, alice.id);
    expect(view!.gifts![0]!.reservation).toMatchObject({ state: 'mine' });
  });

  it('refuses a second reservation at the database, not in application code', async () => {
    await db.reservation.create({ data: { giftId, reserverId: alice.id } });

    // giftId is unique on Reservation. Without that constraint, two friends
    // clicking at the same moment would both pass a check-then-write test and
    // both believe they had it.
    await expect(
      db.reservation.create({ data: { giftId, reserverId: bob.id } }),
    ).rejects.toThrow();
  });

  it('survives a genuine race between two friends', async () => {
    const results = await Promise.allSettled([
      db.reservation.create({ data: { giftId, reserverId: alice.id } }),
      db.reservation.create({ data: { giftId, reserverId: bob.id } }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.reservation.count({ where: { giftId } })).toBe(1);
  });

  it('releases only what the holder holds', async () => {
    await db.reservation.create({ data: { giftId, reserverId: alice.id } });

    // Bob trying to release Alice's reservation removes nothing.
    const bobAttempt = await db.reservation.deleteMany({
      where: { giftId, reserverId: bob.id },
    });
    expect(bobAttempt.count).toBe(0);
    expect(await db.reservation.count({ where: { giftId } })).toBe(1);

    const aliceRelease = await db.reservation.deleteMany({
      where: { giftId, reserverId: alice.id },
    });
    expect(aliceRelease.count).toBe(1);
  });

  it('frees the gift again once released', async () => {
    await db.reservation.create({ data: { giftId, reserverId: alice.id } });
    await db.reservation.deleteMany({ where: { giftId, reserverId: alice.id } });

    const view = await getListForViewer(listId, bob.id);
    expect(view!.gifts![0]!.reservation).toEqual({ state: 'free' });
  });

  it('vanishes with the gift', async () => {
    const doomed = await makeGift(listId, { name: 'Éphémère' });
    await db.reservation.create({
      data: { giftId: doomed.id, reserverId: alice.id },
    });

    await db.gift.delete({ where: { id: doomed.id } });
    expect(
      await db.reservation.count({ where: { giftId: doomed.id } }),
    ).toBe(0);
  });
});

describe('what a reservation reveals, and to whom', () => {
  let owner: { id: string };
  let alice: { id: string };
  let bob: { id: string };
  let listId: string;
  let giftId: string;

  beforeAll(async () => {
    owner = await makeUser('Owner');
    alice = await makeUser('Alice');
    bob = await makeUser('Bob');
    await makeFriends(owner.id, alice.id);
    await makeFriends(owner.id, bob.id);

    const list = await makeList(owner.id);
    listId = list.id;
    giftId = (await makeGift(list.id)).id;
    await db.reservation.create({ data: { giftId, reserverId: alice.id } });
  });

  afterAll(async () => {
    await cleanup([owner.id, alice.id, bob.id]);
    await db.$disconnect();
  });

  it('tells the holder it is theirs', async () => {
    const view = await getListForViewer(listId, alice.id);
    expect(view!.gifts![0]!.reservation?.state).toBe('mine');
  });

  it('tells another friend it is taken, and nothing more', async () => {
    const view = await getListForViewer(listId, bob.id);
    expect(view!.gifts![0]!.reservation).toEqual({ state: 'taken' });
    // Not even the holder's id reaches another friend.
    expect(JSON.stringify(view)).not.toContain(alice.id);
  });

  it('tells the owner nothing at all', async () => {
    const view = await getListForViewer(listId, owner.id);
    expect(view!.gifts![0]).not.toHaveProperty('reservation');
    expect(view).not.toHaveProperty('reservedCount');
    expect(JSON.stringify(view)).not.toContain(alice.id);
  });

  it('gives the owner a payload identical to the unreserved case', async () => {
    const reserved = await getListForViewer(listId, owner.id);

    await db.reservation.deleteMany({ where: { giftId } });
    const free = await getListForViewer(listId, owner.id);

    // The strongest statement of the rule: an owner cannot tell the two apart,
    // because there is nothing in the payload that differs.
    expect(JSON.stringify(reserved)).toBe(JSON.stringify(free));

    await db.reservation.create({ data: { giftId, reserverId: alice.id } });
  });
});
