import { db } from './db';
import { getListForViewer, getListsForViewer } from './gifts';
import {
  cleanup,
  makeFriends,
  makeGift,
  makeList,
  makeUser,
} from '@/test/factories';

/**
 * These run against the real database. The rule is only worth anything if it
 * holds against actual queries, not against mocks that agree with us.
 */
describe('the secrecy rule, against a real database', () => {
  let owner: { id: string };
  let friend: { id: string };
  let other: { id: string };
  let stranger: { id: string };
  let listId: string;
  let giftId: string;
  let potId: string;

  beforeAll(async () => {
    owner = await makeUser('Owner');
    friend = await makeUser('Friend');
    other = await makeUser('Other Friend');
    stranger = await makeUser('Stranger');
    await makeFriends(owner.id, friend.id);
    await makeFriends(owner.id, other.id);

    const list = await makeList(owner.id, { name: 'Anniversaire' });
    listId = list.id;
    giftId = (await makeGift(list.id, { name: 'AirPods' })).id;
    potId = (await makeGift(list.id, { name: 'MacBook', priceCents: 159900, isPot: true })).id;

    await db.reservation.create({
      data: { giftId, reserverId: other.id },
    });
    await db.potContribution.createMany({
      data: [
        { giftId: potId, contributorId: friend.id, amountCents: 5000 },
        { giftId: potId, contributorId: other.id, amountCents: 7000 },
      ],
    });
  });

  afterAll(async () => {
    await cleanup([owner.id, friend.id, other.id, stranger.id]);
    await db.$disconnect();
  });

  it('hands the owner no reservation data whatsoever', async () => {
    const view = await getListForViewer(listId, owner.id);
    const gift = view!.gifts!.find((g) => g.id === giftId)!;
    expect(gift).not.toHaveProperty('reservation');
    expect(gift).not.toHaveProperty('pot');
    expect(view).not.toHaveProperty('reservedCount');
  });

  it('leaks no reserver id anywhere in the owner payload', async () => {
    const view = await getListForViewer(listId, owner.id);
    const json = JSON.stringify(view);
    expect(json).not.toContain(other.id);
    expect(json).not.toContain(friend.id);
  });

  it('tells a friend the gift is taken, without saying by whom', async () => {
    const view = await getListForViewer(listId, friend.id);
    const gift = view!.gifts!.find((g) => g.id === giftId)!;
    expect(gift.reservation).toEqual({ state: 'taken' });
    expect(JSON.stringify(view)).not.toContain(other.id);
  });

  it('tells the holder that the reservation is theirs', async () => {
    const view = await getListForViewer(listId, other.id);
    const gift = view!.gifts!.find((g) => g.id === giftId)!;
    expect(gift.reservation?.state).toBe('mine');
  });

  it('gives friends a reserved count and owners none', async () => {
    const asFriend = await getListForViewer(listId, friend.id);
    expect(asFriend!.reservedCount).toBe(1);
    const asOwner = await getListForViewer(listId, owner.id);
    expect(asOwner!.reservedCount).toBeUndefined();
  });

  it('shows the pot total to friends and hides it from the owner', async () => {
    const asFriend = await getListForViewer(listId, friend.id);
    const pot = asFriend!.gifts!.find((g) => g.id === potId)!;
    expect(pot.pot).toMatchObject({
      raisedCents: 12000,
      contributorCount: 2,
      myContributionCents: 5000,
    });

    const asOwner = await getListForViewer(listId, owner.id);
    expect(asOwner!.gifts!.find((g) => g.id === potId)).not.toHaveProperty('pot');
  });

  it('omits the reserved count from list summaries for the owner', async () => {
    const asOwner = await getListsForViewer(owner.id, owner.id);
    expect(asOwner[0]).not.toHaveProperty('reservedCount');
    const asFriend = await getListsForViewer(owner.id, friend.id);
    expect(asFriend[0]!.reservedCount).toBe(1);
  });
});

describe('list visibility against a real database', () => {
  let owner: { id: string };
  let friend: { id: string };
  let stranger: { id: string };
  const ids: string[] = [];

  beforeAll(async () => {
    owner = await makeUser('Owner');
    friend = await makeUser('Friend');
    stranger = await makeUser('Stranger');
    ids.push(owner.id, friend.id, stranger.id);
    await makeFriends(owner.id, friend.id);
  });

  afterAll(async () => {
    await cleanup(ids);
    await db.$disconnect();
  });

  it('hides a private list from everyone but the owner', async () => {
    const list = await makeList(owner.id, { visibility: 'PRIVATE' });
    expect(await getListForViewer(list.id, owner.id)).not.toBeNull();
    expect(await getListForViewer(list.id, friend.id)).toBeNull();
    expect(await getListForViewer(list.id, stranger.id)).toBeNull();
  });

  it('shows a friends list to friends but not to strangers', async () => {
    const list = await makeList(owner.id, { visibility: 'FRIENDS' });
    expect(await getListForViewer(list.id, friend.id)).not.toBeNull();
    expect(await getListForViewer(list.id, stranger.id)).toBeNull();
    expect(await getListForViewer(list.id, null)).toBeNull();
  });

  it('shows a public list to anyone, signed in or not', async () => {
    const list = await makeList(owner.id, { visibility: 'PUBLIC' });
    expect(await getListForViewer(list.id, stranger.id)).not.toBeNull();
    expect(await getListForViewer(list.id, null)).not.toBeNull();
  });

  it('returns null for a list that does not exist', async () => {
    expect(await getListForViewer('missing-id', owner.id)).toBeNull();
  });
});
