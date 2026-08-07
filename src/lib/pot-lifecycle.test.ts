import { db } from './db';
import { getListForViewer } from './gifts';
import {
  cleanup,
  makeFriends,
  makeGift,
  makeList,
  makeReservation,
  makeUser,
} from '@/test/factories';

/**
 * Whether a gift is collaborative is now the friends' decision, not the list
 * owner's.
 *
 * It used to be Gift.isPot, ticked by the owner when they added the wish —
 * the one person who cannot know whether one friend will buy it alone or four
 * will club together, and the one person who must not find out.
 *
 * So a reservation is the single claim on a gift, and its holder decides
 * afterwards whether to open it. These tests hold that lifecycle in place and,
 * more importantly, hold the secrecy rule across every stage of it: an owner's
 * payload must be identical whether the gift is free, taken, or funded by four
 * people.
 */
describe('a pot is a reservation its holder opened', () => {
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

  const giftFor = async (viewerId: string) => {
    const list = await getListForViewer(listId, viewerId);
    return list!.gifts!.find((g) => g.id === giftId)!;
  };

  it('is not a pot while the reservation is closed', async () => {
    await makeReservation(giftId, alice.id);

    const forHolder = await giftFor(alice.id);
    expect(forHolder.reservation?.state).toBe('mine');
    expect(forHolder).not.toHaveProperty('pot');
  });

  it('becomes a pot once the holder opens it', async () => {
    await makeReservation(giftId, alice.id, { openedToOthers: true });

    const forHolder = await giftFor(alice.id);
    expect(forHolder.reservation).toMatchObject({ state: 'open', mine: true });
    expect(forHolder.pot).toMatchObject({ targetCents: 100000, raisedCents: 0 });
  });

  it('lets another friend see and join an open gift', async () => {
    await makeReservation(giftId, alice.id, { openedToOthers: true });

    // Bob did not reserve it, but he can see the pot and act on it — which is
    // the whole point of opening.
    const forBob = await giftFor(bob.id);
    expect(forBob.reservation).toMatchObject({ state: 'open', mine: false });
    expect(forBob.pot).toBeDefined();
  });

  it('shows a closed reservation as taken, with nothing to join', async () => {
    await makeReservation(giftId, alice.id);

    const forBob = await giftFor(bob.id);
    expect(forBob.reservation).toEqual({ state: 'taken' });
    expect(forBob).not.toHaveProperty('pot');
  });

  it('never names the holder, open or closed', async () => {
    await makeReservation(giftId, alice.id, { openedToOthers: true });
    await db.potContribution.create({
      data: { giftId, contributorId: alice.id, amountCents: 20000 },
    });

    // Bob learns there is a pot and what it totals; who started it and who
    // funded it stay between each person and the app.
    const forBob = await giftFor(bob.id);
    expect(JSON.stringify(forBob)).not.toContain(alice.id);
    expect(forBob.pot?.myContributionCents).toBe(0);
  });
});

/**
 * The rule the whole application exists to keep, checked across the states
 * this change introduced.
 */
describe('the owner sees nothing, at every stage', () => {
  let owner: { id: string };
  let alice: { id: string };
  let listId: string;
  let giftId: string;

  beforeAll(async () => {
    owner = await makeUser('Owner');
    alice = await makeUser('Alice');
    await makeFriends(owner.id, alice.id);
    const list = await makeList(owner.id);
    listId = list.id;
    giftId = (await makeGift(list.id, { priceCents: 100000 })).id;
  });

  afterEach(async () => {
    await db.potContribution.deleteMany({ where: { giftId } });
    await db.reservation.deleteMany({ where: { giftId } });
  });

  afterAll(async () => {
    await cleanup([owner.id, alice.id]);
    await db.$disconnect();
  });

  const ownerPayload = async () =>
    JSON.stringify(await getListForViewer(listId, owner.id));

  it('gives an identical payload whether the gift is free, taken or open', async () => {
    // The strongest form of the rule: not "the owner is not told", but "there
    // is nothing to tell them apart with". Byte-for-byte across all three.
    const free = await ownerPayload();

    await makeReservation(giftId, alice.id);
    const taken = await ownerPayload();

    await db.reservation.updateMany({
      where: { giftId },
      data: { openedToOthers: true, openedAt: new Date() },
    });
    await db.potContribution.create({
      data: { giftId, contributorId: alice.id, amountCents: 45000 },
    });
    const funded = await ownerPayload();

    expect(taken).toBe(free);
    expect(funded).toBe(free);
  });

  it('leaks no amount, no count and no state name', async () => {
    await makeReservation(giftId, alice.id, { openedToOthers: true });
    await db.potContribution.create({
      data: { giftId, contributorId: alice.id, amountCents: 45000 },
    });

    const payload = await ownerPayload();
    expect(payload).not.toContain('45000');
    expect(payload).not.toContain(alice.id);
    expect(payload).not.toContain('"open"');
    expect(payload).not.toContain('openedToOthers');
  });
});
