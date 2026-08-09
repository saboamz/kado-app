import { viewGift, type GiftRow } from './secrecy';

/**
 * A price nobody typed.
 *
 * When a wish carries a link but no price, the catalogue row it resolved to
 * often has one — read off the merchant's own page. Showing it saves a friend
 * from guessing, provided it is never mistaken for a figure the wisher wrote.
 */
const base = (over: Partial<GiftRow> = {}): GiftRow => ({
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
  ...over,
});

describe('an estimated price', () => {
  it('is offered when the wish has none', () => {
    const view = viewGift(
      base({ product: { priceCents: 4500, currency: 'EUR' } }),
      'friend',
      'alice',
    );

    expect(view.estimatedPriceCents).toBe(4500);
    // Kept OUT of priceCents on purpose: merged in, it would be
    // indistinguishable on screen from a figure the wisher actually wrote.
    expect(view.priceCents).toBeNull();
  });

  it('never overrides a price the wisher gave', () => {
    // They know what they want; the catalogue only knows what a page said.
    const view = viewGift(
      base({ priceCents: 3900, product: { priceCents: 4500, currency: 'EUR' } }),
      'friend',
      'alice',
    );

    expect(view.priceCents).toBe(3900);
    expect(view.estimatedPriceCents).toBeUndefined();
  });

  it('is absent when the catalogue has no price either', () => {
    const view = viewGift(
      base({ product: { priceCents: null, currency: 'EUR' } }),
      'friend',
      'alice',
    );
    expect(view.estimatedPriceCents).toBeUndefined();
  });

  it('is absent when the wish resolved to no product at all', () => {
    // "Un week-end en Islande" — an ordinary outcome, not a failure.
    expect(viewGift(base(), 'friend', 'alice').estimatedPriceCents).toBeUndefined();
  });

  it('is shown to the owner too', () => {
    /*
     * It comes from the merchant's page, not from anything anybody did with
     * the wish — it says nothing about who looked, reserved or contributed,
     * so it is not part of what secrecy.ts hides. And it is useful to them:
     * it is how an owner notices the link resolved to the wrong article.
     */
    const view = viewGift(
      base({ product: { priceCents: 4500, currency: 'EUR' } }),
      'owner',
      'owner-1',
    );

    expect(view.estimatedPriceCents).toBe(4500);
    // Still no reservation data, which is the part that must never appear.
    expect(view.reservation).toBeUndefined();
    expect(view.pot).toBeUndefined();
  });

  it('never becomes a pot target', () => {
    /*
     * The reason the two fields stay separate.
     *
     * targetCents drives "the pot is full" and the progress bar. Aimed at a
     * guess, contributors would be told they are done when they are not, and
     * a wrong estimate would silently cap what gets collected.
     */
    const view = viewGift(
      base({
        product: { priceCents: 4500, currency: 'EUR' },
        reservation: {
          reserverId: 'bob',
          createdAt: new Date('2026-02-01'),
          openedToOthers: true,
        },
        contributions: [{ contributorId: 'bob', amountCents: 1000 }],
      }),
      'friend',
      'alice',
    );

    expect(view.estimatedPriceCents).toBe(4500);
    expect(view.pot?.targetCents).toBeNull();
  });
});
