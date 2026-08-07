import { giftInclude, viewGift, viewReservation, type GiftRow } from './secrecy';

const OWNER = 'user-owner';
const ALICE = 'user-alice';
const BOB = 'user-bob';

const gift = (over: Partial<GiftRow> = {}): GiftRow => ({
  id: 'g1',
  name: 'AirPods Pro 3',
  description: 'Version USB-C',
  priceCents: 27900,
  currency: 'EUR',
  url: 'https://apple.com',
  merchant: 'Apple Store',
  imageUrl: null,
  category: 'Tech',
  priority: 3,
  listId: 'l1',
  createdAt: new Date('2026-01-01'),
  reservation: null,
  contributions: [],
  ...over,
});

describe('the secrecy rule', () => {
  it('omits the reservation key entirely for an owner', () => {
    const view = viewGift(
      gift({ reservation: { reserverId: ALICE, createdAt: new Date(), openedToOthers: false } }),
      'owner',
      OWNER,
    );
    expect(view).not.toHaveProperty('reservation');
    expect(view).not.toHaveProperty('pot');
  });

  it('gives an owner the identical payload whether or not a gift is taken', () => {
    // This is the strongest form of the rule: an owner cannot distinguish the
    // two cases, because the serialised objects are byte-for-byte equal.
    const free = viewGift(gift(), 'owner', OWNER);
    const taken = viewGift(
      gift({ reservation: { reserverId: ALICE, createdAt: new Date(), openedToOthers: false } }),
      'owner',
      OWNER,
    );
    expect(JSON.stringify(free)).toBe(JSON.stringify(taken));
  });

  it('gives an owner the identical payload whether or not a pot has money', () => {
    const empty = viewGift(gift({}), 'owner', OWNER);
    const funded = viewGift(
      gift({
        contributions: [
          { contributorId: ALICE, amountCents: 5000 },
          { contributorId: BOB, amountCents: 12000 },
        ],
      }),
      'owner',
      OWNER,
    );
    expect(JSON.stringify(empty)).toBe(JSON.stringify(funded));
  });

  it('never fetches reservation rows for an owner in the first place', () => {
    expect(giftInclude('owner')).toEqual({});
    expect(giftInclude('friend')).toHaveProperty('reservation');
  });

  it('still tells a friend the gift is free', () => {
    const view = viewGift(gift(), 'friend', ALICE);
    expect(view.reservation).toEqual({ state: 'free' });
  });

  it('tells a friend when they hold the gift themselves', () => {
    const view = viewGift(
      gift({ reservation: { reserverId: ALICE, createdAt: new Date('2026-02-02'), openedToOthers: false } }),
      'friend',
      ALICE,
    );
    expect(view.reservation?.state).toBe('mine');
  });

  it('tells a friend a gift is taken without naming who took it', () => {
    const view = viewGift(
      gift({ reservation: { reserverId: BOB, createdAt: new Date(), openedToOthers: false } }),
      'friend',
      ALICE,
    );
    expect(view.reservation).toEqual({ state: 'taken' });
    expect(JSON.stringify(view)).not.toContain(BOB);
  });
});

describe('pot totals', () => {
  // A pot is a reservation its holder opened, so the fixture needs one: the
  // contributions alone no longer make a gift collaborative.
  const funded = gift({
    priceCents: 159900,
    reservation: {
      reserverId: BOB,
      createdAt: new Date('2026-01-05'),
      openedToOthers: true,
    },
    contributions: [
      { contributorId: ALICE, amountCents: 5000 },
      { contributorId: BOB, amountCents: 12000 },
      { contributorId: BOB, amountCents: 3000 },
    ],
  });

  it('aggregates the total and counts distinct contributors', () => {
    const view = viewGift(funded, 'friend', ALICE);
    expect(view.pot).toMatchObject({
      targetCents: 159900,
      raisedCents: 20000,
      contributorCount: 2,
      myContributionCents: 5000,
    });
  });

  it("reports the viewer's own share, never anyone else's", () => {
    const view = viewGift(funded, 'friend', BOB);
    expect(view.pot?.myContributionCents).toBe(15000);
    expect(JSON.stringify(view)).not.toContain(ALICE);
  });

  it('omits the pot for a gift that is not collaborative', () => {
    expect(viewGift(gift(), 'friend', ALICE)).not.toHaveProperty('pot');
  });
});

describe('viewReservation', () => {
  it('treats a signed-out viewer as unable to own a reservation', () => {
    expect(
      viewReservation({ reserverId: ALICE, createdAt: new Date(), openedToOthers: false }, null),
    ).toEqual({ state: 'taken' });
  });
});
