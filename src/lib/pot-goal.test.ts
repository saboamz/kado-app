import { viewGift, type GiftRow } from './secrecy';

/**
 * What a pot is aiming at.
 *
 * The target decides when contributors are told to stop, so it has to be a
 * figure somebody took responsibility for. That is why it lives on the
 * reservation — set by whoever opened the pot — and why an estimated price
 * cannot become one on its own however convenient that would be.
 */
const gift = (over: Partial<GiftRow> = {}): GiftRow => ({
  id: 'g1',
  name: 'Théière en fonte',
  description: null,
  priceCents: null,
  currency: 'EUR',
  url: 'https://boutique.test/theiere',
  merchant: null,
  imageUrl: null,
  category: 'Maison',
  priority: 2,
  listId: 'l1',
  createdAt: new Date('2026-01-01'),
  reservation: {
    reserverId: 'bob',
    createdAt: new Date('2026-02-01'),
    openedToOthers: true,
  },
  contributions: [{ contributorId: 'bob', amountCents: 1000 }],
  ...over,
});

describe('the goal a pot aims at', () => {
  it('is what the person opening it said', () => {
    const view = viewGift(
      gift({
        reservation: {
          reserverId: 'bob',
          createdAt: new Date('2026-02-01'),
          openedToOthers: true,
          targetCents: 4000,
        },
      }),
      'friend',
      'alice',
    );

    expect(view.pot?.targetCents).toBe(4000);
  });

  it('wins over the wish price, because it is more recent evidence', () => {
    /*
     * The opener has the merchant's page in front of them and nobody else
     * does. If the wisher wrote 39 € months ago and the article is now on
     * sale at 20 €, the opener's figure is the one people will actually pay.
     */
    const view = viewGift(
      gift({
        priceCents: 3900,
        reservation: {
          reserverId: 'bob',
          createdAt: new Date('2026-02-01'),
          openedToOthers: true,
          targetCents: 2000,
        },
      }),
      'friend',
      'alice',
    );

    expect(view.pot?.targetCents).toBe(2000);
  });

  it('falls back to the wish price for a pot opened before goals existed', () => {
    // Every pot already open when this shipped has a null target and must go
    // on behaving exactly as it did.
    const view = viewGift(gift({ priceCents: 3900 }), 'friend', 'alice');
    expect(view.pot?.targetCents).toBe(3900);
  });

  it('is absent when nobody set one and the wish has no price', () => {
    /*
     * A pot with no goal is a real state, not a broken one: contributions
     * still add up, there is simply no bar and no "complete". Better than
     * inventing a target somebody would then be told they had reached.
     */
    const view = viewGift(gift(), 'friend', 'alice');

    expect(view.pot).toBeDefined();
    expect(view.pot?.targetCents).toBeNull();
    expect(view.pot?.raisedCents).toBe(1000);
  });

  it('is never taken from an estimated price on its own', () => {
    /*
     * The rule this whole design protects.
     *
     * A price read off a shop is a guess. Aimed at, a pot would announce
     * itself complete on the strength of it — four friends put in 5 € each,
     * are told they are done, and whoever buys the thing discovers the promo
     * ended and pays the difference out of their own pocket, in a chat the
     * owner cannot see.
     */
    const view = viewGift(
      gift({ product: { priceCents: 4500, currency: 'EUR' } }),
      'friend',
      'alice',
    );

    expect(view.estimatedPriceCents).toBe(4500);
    expect(view.pot?.targetCents).toBeNull();
  });

  it('shows the owner none of it', () => {
    // The pot is derived from the reservation, and an owner returns before
    // any of this is read. A goal changes nothing about that.
    const view = viewGift(
      gift({
        reservation: {
          reserverId: 'bob',
          createdAt: new Date('2026-02-01'),
          openedToOthers: true,
          targetCents: 4000,
        },
      }),
      'owner',
      'owner-1',
    );

    expect(view.pot).toBeUndefined();
    expect(view.reservation).toBeUndefined();
  });
});
