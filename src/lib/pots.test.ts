import { db } from './db';
import { getListForViewer } from './gifts';
import {
  cleanup,
  makeFriends,
  makeGift,
  makeList,
  makeUser,
} from '@/test/factories';

describe('collaborative pots', () => {
  let owner: { id: string };
  let alice: { id: string };
  let bob: { id: string };
  let listId: string;
  let potId: string;

  beforeAll(async () => {
    owner = await makeUser('Owner');
    alice = await makeUser('Alice');
    bob = await makeUser('Bob');
    await makeFriends(owner.id, alice.id);
    await makeFriends(owner.id, bob.id);

    const list = await makeList(owner.id);
    listId = list.id;
    potId = (
      await makeGift(list.id, {
        name: 'MacBook',
        priceCents: 159900,
        isPot: true,
      })
    ).id;
  });

  afterEach(async () => {
    await db.potContribution.deleteMany({ where: { giftId: potId } });
  });

  afterAll(async () => {
    await cleanup([owner.id, alice.id, bob.id]);
    await db.$disconnect();
  });

  const potFor = async (viewerId: string) => {
    const view = await getListForViewer(listId, viewerId);
    return view!.gifts!.find((g) => g.id === potId)!.pot;
  };

  it('starts empty', async () => {
    expect(await potFor(alice.id)).toMatchObject({
      raisedCents: 0,
      contributorCount: 0,
      myContributionCents: 0,
    });
  });

  it('sums contributions from several people', async () => {
    await db.potContribution.createMany({
      data: [
        { giftId: potId, contributorId: alice.id, amountCents: 30000 },
        { giftId: potId, contributorId: bob.id, amountCents: 25000 },
      ],
    });
    expect(await potFor(alice.id)).toMatchObject({
      raisedCents: 55000,
      contributorCount: 2,
    });
  });

  it('counts a person once even if they give twice', async () => {
    await db.potContribution.createMany({
      data: [
        { giftId: potId, contributorId: alice.id, amountCents: 10000 },
        { giftId: potId, contributorId: alice.id, amountCents: 5000 },
      ],
    });
    const pot = await potFor(alice.id);
    expect(pot).toMatchObject({ raisedCents: 15000, contributorCount: 1 });
    // Both of Alice's contributions count as hers.
    expect(pot!.myContributionCents).toBe(15000);
  });

  it("reports each viewer's own share, never anybody else's", async () => {
    await db.potContribution.createMany({
      data: [
        { giftId: potId, contributorId: alice.id, amountCents: 30000 },
        { giftId: potId, contributorId: bob.id, amountCents: 25000 },
      ],
    });
    expect((await potFor(alice.id))!.myContributionCents).toBe(30000);
    expect((await potFor(bob.id))!.myContributionCents).toBe(25000);
  });

  it('keeps totals exact across many contributions', async () => {
    // Integer cents, so no float drift however many people chip in.
    await db.potContribution.createMany({
      data: Array.from({ length: 30 }, () => ({
        giftId: potId,
        contributorId: alice.id,
        amountCents: 1010, // 10,10 €
      })),
    });
    expect((await potFor(alice.id))!.raisedCents).toBe(30300);
  });

  it('vanishes with the gift', async () => {
    const doomed = await makeGift(listId, { isPot: true, priceCents: 1000 });
    await db.potContribution.create({
      data: { giftId: doomed.id, contributorId: alice.id, amountCents: 500 },
    });
    await db.gift.delete({ where: { id: doomed.id } });
    expect(
      await db.potContribution.count({ where: { giftId: doomed.id } }),
    ).toBe(0);
  });
});

describe('what a pot reveals, and to whom', () => {
  let owner: { id: string };
  let alice: { id: string };
  let bob: { id: string };
  let listId: string;
  let potId: string;

  beforeAll(async () => {
    owner = await makeUser('Owner');
    alice = await makeUser('Alice');
    bob = await makeUser('Bob');
    await makeFriends(owner.id, alice.id);
    await makeFriends(owner.id, bob.id);

    const list = await makeList(owner.id);
    listId = list.id;
    potId = (await makeGift(list.id, { priceCents: 100000, isPot: true })).id;

    await db.potContribution.createMany({
      data: [
        { giftId: potId, contributorId: alice.id, amountCents: 40000 },
        { giftId: potId, contributorId: bob.id, amountCents: 25000 },
      ],
    });
  });

  afterAll(async () => {
    await cleanup([owner.id, alice.id, bob.id]);
    await db.$disconnect();
  });

  it('shows a friend the total without naming contributors', async () => {
    const view = await getListForViewer(listId, alice.id);
    const json = JSON.stringify(view);
    expect(json).not.toContain(bob.id);
    expect(view!.gifts!.find((g) => g.id === potId)!.pot).toMatchObject({
      raisedCents: 65000,
      contributorCount: 2,
    });
  });

  it('shows the owner no pot at all', async () => {
    const view = await getListForViewer(listId, owner.id);
    const gift = view!.gifts!.find((g) => g.id === potId)!;
    expect(gift).not.toHaveProperty('pot');
    expect(JSON.stringify(view)).not.toContain(alice.id);
  });

  it('gives the owner a payload identical to an empty pot', async () => {
    const funded = await getListForViewer(listId, owner.id);

    await db.potContribution.deleteMany({ where: { giftId: potId } });
    const empty = await getListForViewer(listId, owner.id);

    // The owner cannot tell whether money has been collected for their gift.
    expect(JSON.stringify(funded)).toBe(JSON.stringify(empty));
  });
});
