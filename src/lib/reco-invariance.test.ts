import { db } from './db';
import { recommend, type Tier } from './reco';
import { cleanup, makeFriends, makeGift, makeList, makeUser } from '@/test/factories';

/**
 * THE LEAK THAT MUST NOT REOPEN.
 *
 * The obvious improvement to a recommender is to filter out items other people
 * have already reserved. It must never be made. The list would encode the
 * reservation state, and an owner with a second account could read it by
 * difference over time — through a feature with no apparent connection to
 * reservations at all.
 *
 * So: a reservation made by somebody else must change NOTHING. Not the rows,
 * not the scores, not the order. This file is written before the tiers exist,
 * and every tier is held to it.
 *
 * THE FIXTURE TRAP, which caught me at every tier of the last project: the
 * product that gets reserved must be a REAL CANDIDATE. If it is excluded for
 * some other reason — already on the recipient's list, pruned by diversity,
 * support of 1 — then the leaky build produces an identical list and the
 * assertion passes without ever testing anything. Every test below asserts
 * candidacy first, and that assertion is the one that makes the rest mean
 * something.
 */

type Ctx = {
  viewer: string;
  recipient: string;
  outsider: string;
  productIds: string[];
  cleanupIds: string[];
};

/** Sixty products, because a catalogue smaller than k makes every strategy
 * return everything and score identically — a fixture that cannot distinguish. */
const CATALOGUE_SIZE = 60;

async function seedWorld(tag: string): Promise<Ctx> {
  const viewer = await makeUser(`Viewer ${tag}`);
  const recipient = await makeUser(`Recipient ${tag}`);
  const outsider = await makeUser(`Outsider ${tag}`);
  await makeFriends(viewer.id, recipient.id);
  await makeFriends(outsider.id, recipient.id);

  await db.interest.create({
    data: { userId: recipient.id, label: `cuisine-${tag}` },
  });

  const products = [];
  for (let i = 0; i < CATALOGUE_SIZE; i++) {
    products.push(
      await db.product.create({
        data: {
          title: `Produit ${tag} ${i}`,
          categoryId: `cuisine-${tag}`,
          priceCents: 2000 + i * 100,
          priceBand: 3,
          popularity: CATALOGUE_SIZE - i,
        },
      }),
    );
  }

  return {
    viewer: viewer.id,
    recipient: recipient.id,
    outsider: outsider.id,
    productIds: products.map((p) => p.id),
    cleanupIds: [viewer.id, recipient.id, outsider.id],
  };
}

async function teardown(ctx: Ctx) {
  await db.recommendation.deleteMany({ where: { viewerId: ctx.viewer } });
  await db.giftEvent.deleteMany({ where: { actorId: { in: ctx.cleanupIds } } });
  await db.product.deleteMany({ where: { id: { in: ctx.productIds } } });
  await cleanup(ctx.cleanupIds);
}

/** A recommendation list reduced to what a leak would perturb. */
const shape = (rows: { productId: string; score: number; rank: number }[]) =>
  rows.map((r) => `${r.rank}:${r.productId}:${r.score.toFixed(6)}`).join('|');

/**
 * Tiers that are built and can produce a list today. cf_item and
 * content_vector return [] by design until phases 5 and 4b fill them in, and
 * an invariance test between two empty lists proves nothing — so they are
 * held to the rule by IMPLEMENTED_TIERS once they produce rows, and by the
 * unimplemented-tier test below until then.
 */
const IMPLEMENTED_TIERS = ['content_facet', 'popularity'] as const;

describe.each(IMPLEMENTED_TIERS)('tier %s is blind to other peoples reservations', (tier: Tier) => {
  let ctx: Ctx;

  beforeAll(async () => {
    ctx = await seedWorld(`${tier}-${Date.now()}`);
  });

  afterAll(async () => {
    await teardown(ctx);
    await db.$disconnect();
  });

  it('produces a list at all, so the comparison below is not between two empties', async () => {
    // Two empty lists are trivially equal. Without this the invariance test
    // would pass on a tier that returns nothing, which is the emptiest form of
    // the vacuous-absence trap.
    const rows = await recommend({
      viewerId: ctx.viewer,
      recipientId: ctx.recipient,
      tier,
      limit: 12,
    });
    expect(rows.length).toBeGreaterThan(0);
  });

  it('does not change when a third party reserves a product that IS a candidate', async () => {
    const before = await recommend({
      viewerId: ctx.viewer,
      recipientId: ctx.recipient,
      tier,
      limit: 12,
    });
    expect(before.length).toBeGreaterThan(0);

    // THE FIXTURE TRAP. Reserve something the tier actually recommended, so
    // the leaky build would genuinely have to drop a row. Reserving a product
    // that was never a candidate proves nothing: both builds return the same
    // list and the assertion passes empty.
    const target = before[0]!.productId;
    expect(before.map((r) => r.productId)).toContain(target);

    // The reservation must hang off a gift on SOMEBODY ELSE'S list. Putting it
    // on the recipient's own list excludes the product as a WISH — which is a
    // different rule — and then the assertion below passes for the wrong
    // reason. This is the fixture trap in its inverted form: the target stops
    // being a candidate for a reason that has nothing to do with the leak, and
    // a leaky build would look identical.
    const otherList = await makeList(ctx.outsider);
    const gift = await makeGift(otherList.id, { name: 'Cadeau convoité' });
    await db.gift.update({ where: { id: gift.id }, data: { productId: target } });
    await db.reservation.create({
      data: { giftId: gift.id, reserverId: ctx.outsider },
    });

    const after = await recommend({
      viewerId: ctx.viewer,
      recipientId: ctx.recipient,
      tier,
      limit: 12,
    });

    // Identical rows, identical scores, identical order. Anything else is a
    // channel through which reservation state escapes.
    expect(shape(after)).toBe(shape(before));
    expect(after.map((r) => r.productId)).toContain(target);

    await db.reservation.deleteMany({ where: { giftId: gift.id } });
    await db.gift.delete({ where: { id: gift.id } });
    await db.giftList.delete({ where: { id: otherList.id } });
  });

  it('does not change when a third party contributes to a pot', async () => {
    const before = await recommend({
      viewerId: ctx.viewer,
      recipientId: ctx.recipient,
      tier,
      limit: 12,
    });
    const target = before[0]!.productId;

    // Same reasoning: another person's list, so the exclusion under test is
    // the pot contribution and not the recipient's own wish.
    const otherList = await makeList(ctx.outsider);
    const pot = await makeGift(otherList.id, { isPot: true, priceCents: 10000 });
    await db.gift.update({ where: { id: pot.id }, data: { productId: target } });
    await db.potContribution.create({
      data: { giftId: pot.id, contributorId: ctx.outsider, amountCents: 5000 },
    });

    const after = await recommend({
      viewerId: ctx.viewer,
      recipientId: ctx.recipient,
      tier,
      limit: 12,
    });
    expect(shape(after)).toBe(shape(before));

    await db.potContribution.deleteMany({ where: { giftId: pot.id } });
    await db.gift.delete({ where: { id: pot.id } });
    await db.giftList.delete({ where: { id: otherList.id } });
  });
});

describe('the tiers that are not built yet', () => {
  it.each(['cf_item', 'content_vector'] as const)(
    '%s returns nothing rather than throwing, so the cascade falls through',
    async (tier) => {
      const viewer = await makeUser('V');
      const recipient = await makeUser('R');
      const rows = await recommend({
        viewerId: viewer.id,
        recipientId: recipient.id,
        tier,
        limit: 12,
      });
      // Empty, NOT an exception: an unbuilt tier must not take a page down.
      // This is also why they are excluded from the invariance suite above —
      // comparing two empty lists would pass whatever the code did.
      expect(rows).toEqual([]);
      await cleanup([viewer.id, recipient.id]);
    },
  );
});

describe('the viewer is never recommended to themselves', () => {
  let ctx: Ctx;

  beforeAll(async () => {
    ctx = await seedWorld(`self-${Date.now()}`);
  });

  afterAll(async () => {
    await teardown(ctx);
    await db.$disconnect();
  });

  it('refuses explicitly rather than returning an empty list', async () => {
    // The direct oracle: recommending someone for themselves would tell them
    // what the system thinks they want, which is one step from telling them
    // what their friends are about to buy.
    await expect(
      recommend({
        viewerId: ctx.viewer,
        recipientId: ctx.viewer,
        tier: 'popularity',
        limit: 12,
      }),
    ).rejects.toThrow();
  });
});

describe("only the viewer's OWN reservations are excluded", () => {
  let ctx: Ctx;

  beforeAll(async () => {
    ctx = await seedWorld(`own-${Date.now()}`);
  });

  afterAll(async () => {
    await teardown(ctx);
    await db.$disconnect();
  });

  it('drops what the viewer already holds, because they already know', async () => {
    const before = await recommend({
      viewerId: ctx.viewer,
      recipientId: ctx.recipient,
      tier: 'popularity',
      limit: 12,
    });
    const target = before[0]!.productId;
    expect(before.map((r) => r.productId)).toContain(target); // a real candidate

    const list = await makeList(ctx.recipient);
    const gift = await makeGift(list.id);
    await db.gift.update({ where: { id: gift.id }, data: { productId: target } });
    // The VIEWER reserves it this time.
    await db.reservation.create({
      data: { giftId: gift.id, reserverId: ctx.viewer },
    });

    const after = await recommend({
      viewerId: ctx.viewer,
      recipientId: ctx.recipient,
      tier: 'popularity',
      limit: 12,
    });

    // Excluding this leaks nothing: the viewer put it there. Excluding
    // somebody else's would be the hidden channel.
    expect(after.map((r) => r.productId)).not.toContain(target);

    await db.reservation.deleteMany({ where: { giftId: gift.id } });
    await db.gift.delete({ where: { id: gift.id } });
    await db.giftList.delete({ where: { id: list.id } });
  });
});
