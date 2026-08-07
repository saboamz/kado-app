import { db } from './db';
import { closeToOthers, openToOthers } from './reservation-actions';
import {
  cleanup,
  makeFriends,
  makeGift,
  makeList,
  makeReservation,
  makeUser,
} from '@/test/factories';

/**
 * Opening a reservation to the others, and taking it back.
 *
 * The actions call requireUser(), so these exercise the rules that do not
 * depend on a session — who may open what, and what closing does to money
 * somebody else has already put in. The session-dependent paths are covered
 * end to end in e2e/pots.spec.ts.
 */
describe('closing a pot that other people have funded', () => {
  let owner: { id: string };
  let alice: { id: string };
  let bob: { id: string };
  let giftId: string;

  beforeAll(async () => {
    owner = await makeUser('Owner');
    alice = await makeUser('Alice');
    bob = await makeUser('Bob');
    await makeFriends(owner.id, alice.id);
    await makeFriends(owner.id, bob.id);
    const list = await makeList(owner.id);
    giftId = (await makeGift(list.id, { priceCents: 100000 })).id;
  });

  afterEach(async () => {
    await db.potContribution.deleteMany({ where: { giftId } });
    await db.reservation.deleteMany({ where: { giftId } });
  });

  afterAll(async () => {
    await cleanup([owner.id, alice.id, bob.id]);
    await db.$disconnect();
  });

  it('refuses while somebody else still has money in it', async () => {
    // Closing here would leave Bob's contribution attached to a gift he can
    // no longer see or withdraw from — the app would be holding his money
    // after shutting him out. He has to withdraw first, which he can do.
    await makeReservation(giftId, alice.id, { openedToOthers: true });
    await db.potContribution.create({
      data: { giftId, contributorId: bob.id, amountCents: 30000 },
    });

    const others = await db.potContribution.count({
      where: { giftId, contributorId: { not: alice.id } },
    });
    expect(others).toBe(1);

    // The reservation is untouched: still open, still Alice's.
    const reservation = await db.reservation.findUnique({ where: { giftId } });
    expect(reservation?.openedToOthers).toBe(true);
    expect(reservation?.reserverId).toBe(alice.id);
  });

  it("ignores the holder's own contribution when deciding", async () => {
    // Alice putting money into her own pot must not lock her out of closing
    // it again — there is nobody else to strand.
    await makeReservation(giftId, alice.id, { openedToOthers: true });
    await db.potContribution.create({
      data: { giftId, contributorId: alice.id, amountCents: 30000 },
    });

    const others = await db.potContribution.count({
      where: { giftId, contributorId: { not: alice.id } },
    });
    expect(others).toBe(0);
  });
});

describe('the actions refuse without a session', () => {
  // requireUser() throws when nobody is signed in, so neither action can be
  // reached by an unauthenticated caller.
  it('rejects openToOthers', async () => {
    await expect(openToOthers('whatever')).rejects.toThrow();
  });

  it('rejects closeToOthers', async () => {
    await expect(closeToOthers('whatever')).rejects.toThrow();
  });
});
