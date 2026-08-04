import { db } from './db';
import {
  cleanup,
  makeFriends,
  makeGift,
  makeList,
  makeUser,
} from '@/test/factories';

/**
 * Deleting an account has to reach further than the person's own rows: a
 * reservation they hold sits on somebody else's gift, and leaving it behind
 * would keep that gift marked as taken by nobody.
 */
describe('deleting an account', () => {
  it('frees the gifts the departing person had reserved', async () => {
    const owner = await makeUser('Owner');
    const leaver = await makeUser('Leaver');
    await makeFriends(owner.id, leaver.id);

    const list = await makeList(owner.id);
    const gift = await makeGift(list.id);
    await db.reservation.create({
      data: { giftId: gift.id, reserverId: leaver.id },
    });

    expect(await db.reservation.count({ where: { giftId: gift.id } })).toBe(1);

    await db.user.delete({ where: { id: leaver.id } });

    // The gift itself survives — it belongs to the owner, not the leaver.
    expect(await db.gift.findUnique({ where: { id: gift.id } })).not.toBeNull();
    expect(await db.reservation.count({ where: { giftId: gift.id } })).toBe(0);

    await cleanup([owner.id]);
  });

  it('takes the person’s own lists and gifts with them', async () => {
    const leaver = await makeUser('Leaver');
    const list = await makeList(leaver.id);
    const gift = await makeGift(list.id);

    await db.user.delete({ where: { id: leaver.id } });

    expect(
      await db.giftList.findUnique({ where: { id: list.id } }),
    ).toBeNull();
    expect(await db.gift.findUnique({ where: { id: gift.id } })).toBeNull();
  });

  it('removes the friendships in both directions', async () => {
    const stayer = await makeUser('Stayer');
    const leaver = await makeUser('Leaver');
    await makeFriends(stayer.id, leaver.id);

    await db.user.delete({ where: { id: leaver.id } });

    expect(
      await db.friendship.count({
        where: {
          OR: [{ requesterId: leaver.id }, { addresseeId: leaver.id }],
        },
      }),
    ).toBe(0);

    await cleanup([stayer.id]);
  });

  afterAll(async () => {
    await db.$disconnect();
  });
});
