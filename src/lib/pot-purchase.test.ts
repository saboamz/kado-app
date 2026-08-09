import { mayDeclarePurchase } from './pot-rules';
import { viewGift, type GiftRow } from './secrecy';

/**
 * Who owes what, and who is allowed to know.
 *
 * No money moves through this app: a contribution is a promise, so at the end
 * one person pays the shop the whole amount. They were the single person
 * unable to see who owed them what — they could watch "100 € réunis" and have
 * nobody to ask.
 *
 * Declaring the purchase opens that up, and only to them. The timing is the
 * whole design: before a purchase, a name beside an amount is something to be
 * judged on; after it, the same information is what lets somebody be paid
 * back.
 */
const ALICE = 'alice';
const BOB = 'bob';
const CAMILLE = 'camille';

const gift = (over: Partial<GiftRow> = {}): GiftRow => ({
  id: 'g1',
  name: 'Théière en fonte',
  description: null,
  priceCents: 6000,
  currency: 'EUR',
  url: null,
  merchant: null,
  imageUrl: null,
  category: 'Maison',
  priority: 2,
  listId: 'l1',
  createdAt: new Date('2026-01-01'),
  reservation: {
    reserverId: BOB,
    createdAt: new Date('2026-02-01'),
    openedToOthers: true,
  },
  contributions: [
    { contributorId: ALICE, amountCents: 2000, contributor: { name: 'Alice Meyer' } },
    { contributorId: BOB, amountCents: 2500, contributor: { name: 'Bob Léon' } },
    { contributorId: CAMILLE, amountCents: 1500, contributor: { name: 'Camille Rey' } },
  ],
  ...over,
});

/** The same pot, with Alice having declared that she paid for it. */
const bought = (buyer = ALICE) =>
  gift({
    reservation: {
      reserverId: BOB,
      createdAt: new Date('2026-02-01'),
      openedToOthers: true,
      purchasedById: buyer,
      purchasedBy: { name: buyer === ALICE ? 'Alice Meyer' : 'Bob Léon' },
    },
  });

describe('before anybody has bought it', () => {
  it('tells nobody who promised what', () => {
    // Including the person who will eventually pay: the information appears
    // with the risk, not before it.
    for (const viewer of [ALICE, BOB, CAMILLE]) {
      const view = viewGift(gift(), 'friend', viewer);
      expect(view.pot?.owed).toBeUndefined();
      expect(view.pot?.buyer).toBeUndefined();
    }
  });

  it('still shows the total and the count', () => {
    const view = viewGift(gift(), 'friend', ALICE);
    expect(view.pot?.raisedCents).toBe(6000);
    expect(view.pot?.contributorCount).toBe(3);
    expect(view.pot?.myContributionCents).toBe(2000);
  });
});

describe('once somebody has bought it', () => {
  it('shows the buyer who owes them what, and how much', () => {
    const view = viewGift(bought(), 'friend', ALICE);

    expect(view.pot?.buyer).toEqual({ name: 'Alice Meyer', isMe: true });
    expect(view.pot?.owed).toEqual([
      { name: 'Bob Léon', amountCents: 2500 },
      { name: 'Camille Rey', amountCents: 1500 },
    ]);
  });

  it('leaves the buyer out of their own debts', () => {
    // Alice put in 2000 herself. She does not owe it to herself, and listing
    // it would make the total to collect wrong.
    const view = viewGift(bought(), 'friend', ALICE);
    expect(view.pot?.owed?.map((o) => o.name)).not.toContain('Alice Meyer');
  });

  it('sorts the largest debt first', () => {
    const view = viewGift(bought(), 'friend', ALICE);
    expect(view.pot?.owed?.[0]?.amountCents).toBe(2500);
  });

  it('tells everyone else only who bought it, never the breakdown', () => {
    /*
     * The rule that matters. Bob is a contributor too — he still gets no
     * names and no amounts beyond his own, because he has nothing at stake:
     * he is not out of pocket, so knowing what Camille promised would only
     * ever be something to compare.
     */
    const view = viewGift(bought(), 'friend', BOB);

    expect(view.pot?.buyer).toEqual({ name: 'Alice Meyer', isMe: false });
    expect(view.pot?.owed).toBeUndefined();
    expect(view.pot?.myContributionCents).toBe(2500);
  });

  it('says nothing to somebody who never chipped in', () => {
    const view = viewGift(bought(), 'friend', 'quelquun-dautre');

    expect(view.pot?.buyer?.isMe).toBe(false);
    expect(view.pot?.owed).toBeUndefined();
    expect(view.pot?.myContributionCents).toBe(0);
  });

  it('groups several promises from one person into one debt', () => {
    const view = viewGift(
      gift({
        reservation: {
          reserverId: BOB,
          createdAt: new Date('2026-02-01'),
          openedToOthers: true,
          purchasedById: ALICE,
          purchasedBy: { name: 'Alice Meyer' },
        },
        contributions: [
          { contributorId: ALICE, amountCents: 2000, contributor: { name: 'Alice Meyer' } },
          { contributorId: BOB, amountCents: 1000, contributor: { name: 'Bob Léon' } },
          { contributorId: BOB, amountCents: 1500, contributor: { name: 'Bob Léon' } },
        ],
      }),
      'friend',
      ALICE,
    );

    // One line per person, not per promise: chasing somebody twice for the
    // same gift is how a favour turns into an argument.
    expect(view.pot?.owed).toEqual([{ name: 'Bob Léon', amountCents: 2500 }]);
  });
});

describe('the list owner', () => {
  it('sees none of it, purchase or not', () => {
    // The pot is derived from the reservation and an owner returns before any
    // of this is read. A purchase changes nothing about that.
    const view = viewGift(bought(), 'owner', 'owner-1');

    expect(view.pot).toBeUndefined();
    expect(view.reservation).toBeUndefined();
  });
});

describe('who may claim the purchase', () => {
  it('is anybody already in the pot', () => {
    expect(mayDeclarePurchase(true)).toBe(true);
  });

  it('is nobody else', () => {
    /*
     * The condition that makes the names safe to show.
     *
     * Without it the breakdown is a button anyone who can see the gift may
     * press — no contribution, nothing at stake, every name and amount
     * revealed. The claim has to cost something to be worth trusting.
     */
    expect(mayDeclarePurchase(false)).toBe(false);
  });
});
