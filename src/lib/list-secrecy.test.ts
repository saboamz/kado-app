import { db } from './db';
import { getListsForViewer, listInclude } from './gifts';
import { cleanup, makeFriends, makeGift, makeList, makeUser } from '@/test/factories';

/**
 * The list *index* must keep the rule the list *detail* keeps.
 *
 * getListForViewer picks its include with giftInclude(relation), so an owner's
 * query never touches Reservation. getListsForViewer builds its own include by
 * hand, which is how it came to select reservations for every viewer —
 * including the owner — and throw them away afterwards in reservedCount().
 *
 * Discarding the rows later is not the rule. The rule is that they are never
 * fetched: a redaction that depends on remembering to drop a key is one
 * refactor away from failing, and the response of that refactor is a leak with
 * every test still green.
 *
 * These tests hold the index to the behaviour and to the query.
 */
describe('the list index keeps the secrecy rule', () => {
  let owner: { id: string };
  let friend: { id: string };
  let giftId: string;

  beforeAll(async () => {
    owner = await makeUser('Owner');
    friend = await makeUser('Friend');
    await makeFriends(owner.id, friend.id);

    const list = await makeList(owner.id);
    giftId = (await makeGift(list.id, { name: 'Théière' })).id;
  });

  afterEach(async () => {
    await db.reservation.deleteMany({ where: { giftId } });
  });

  afterAll(async () => {
    await cleanup([owner.id, friend.id]);
    await db.$disconnect();
  });

  it('gives an owner the identical payload whether or not a gift is taken', async () => {
    // The same byte-for-byte assertion the detail view makes, applied to the
    // index. If reservedCount ever reaches an owner, this is what catches it.
    const free = await getListsForViewer(owner.id, owner.id);

    await db.reservation.create({ data: { giftId, reserverId: friend.id } });
    const taken = await getListsForViewer(owner.id, owner.id);

    expect(JSON.stringify(taken)).toBe(JSON.stringify(free));
  });

  it('omits reservedCount for an owner and provides it to a friend', async () => {
    await db.reservation.create({ data: { giftId, reserverId: friend.id } });

    const asOwner = await getListsForViewer(owner.id, owner.id);
    expect(asOwner[0]).not.toHaveProperty('reservedCount');

    const asFriend = await getListsForViewer(owner.id, friend.id);
    expect(asFriend[0]!.reservedCount).toBe(1);
  });

  it('builds the owners include without reservations at all', () => {
    // The two assertions above pass even when the rows ARE fetched and then
    // discarded — that is precisely the state this file was written for, so
    // they cannot be the only guard.
    //
    // What the rule actually demands is that the query not ask for them, and
    // that is a property of the include, not of the response. listInclude is
    // exported for this: called with 'owner' it must contain no reservation
    // key, the same way giftInclude('owner') returns {}.
    expect(JSON.stringify(listInclude('owner'))).not.toMatch(/reservation/i);
    expect(JSON.stringify(listInclude('friend'))).toMatch(/reservation/i);
  });
});
