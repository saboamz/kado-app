import { db } from './db';
import { CF_READY_THRESHOLD, buildItemSimilarity, cfIsReady } from './cf';
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

  // A REAL interest label, mapped by the taxonomy onto real categories.
  // The first version used `cuisine-${tag}` as both the interest and the
  // product category, which only worked while content_facet compared the two
  // with strict equality. Once the taxonomy went in, the tier returned nothing
  // and the invariance tests would have compared two empty lists — caught by
  // the "produces a list at all" assertion, which exists for exactly this.
  await db.interest.create({ data: { userId: recipient.id, label: 'Céramique' } });

  const products = [];
  for (let i = 0; i < CATALOGUE_SIZE; i++) {
    products.push(
      await db.product.create({
        data: {
          title: `Produit ${tag} ${i}`,
          categoryId: 'Maison', // what 'Céramique' maps to
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

/**
 * cf_item is held to the SAME rule, in its own describe below, because it
 * needs a world that crosses cfIsReady()'s threshold before it returns
 * anything at all. Comparing two empty lists would prove nothing — and this is
 * the tier where the leak would be most tempting, since "don't recommend what
 * is already taken" is exactly the shape of a CF post-filter.
 */

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
    const pot = await makeGift(otherList.id, { priceCents: 10000 });
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

/**
 * cf_item held to the invariance rule, in a world that actually crosses the
 * readiness threshold.
 *
 * This is the tier where the leak would be most tempting: "don't recommend
 * something already reserved" is the natural shape of a CF post-filter, and it
 * is exactly the covert channel. So it gets the same treatment as the others,
 * with the fixture built so the target is a REAL candidate.
 */
describe('tier cf_item is blind to other peoples reservations', () => {
  const tag = `cfinv-${Date.now()}`;
  let viewer: string;
  let recipient: string;
  let outsider: string;
  const givers: string[] = [];
  const products: string[] = [];
  let seedProductId: string;

  beforeAll(async () => {
    const v = await makeUser(`V ${tag}`);
    const r = await makeUser(`R ${tag}`);
    const o = await makeUser(`O ${tag}`);
    viewer = v.id;
    recipient = r.id;
    outsider = o.id;
    await makeFriends(viewer, recipient);

    // A seed the recipient wishes for, plus neighbours co-bought with it.
    const seed = await db.product.create({ data: { title: `${tag}-seed` } });
    seedProductId = seed.id;
    products.push(seed.id);
    for (let i = 0; i < 5; i++) {
      const p = await db.product.create({
        data: { title: `${tag}-n${i}`, categoryId: `${tag}-cat${i}` },
      });
      products.push(p.id);
    }

    // Six givers who took the seed together with every neighbour, so each
    // pair clears MIN_SUPPORT and the neighbours are genuine candidates.
    const rows = [];
    for (let g = 0; g < 6; g++) {
      const user = await makeUser(`G ${tag} ${g}`);
      givers.push(user.id);
      rows.push({
        actorId: user.id,
        kind: 'purchase' as const,
        productId: seed.id,
        weight: 10,
      });
      for (const productId of products.slice(1)) {
        rows.push({ actorId: user.id, kind: 'purchase' as const, productId, weight: 10 });
      }
    }
    await db.giftEvent.createMany({ data: rows });

    // Cross the readiness threshold. Below it cf_item returns nothing and the
    // comparison below would be between two empty lists.
    const filler = Array.from({ length: CF_READY_THRESHOLD }, () => ({
      actorId: givers[0]!,
      kind: 'reserve' as const,
      productId: seed.id,
      weight: 6,
    }));
    for (let i = 0; i < filler.length; i += 1000) {
      await db.giftEvent.createMany({ data: filler.slice(i, i + 1000) });
    }

    await buildItemSimilarity();

    // The recipient wishes for the seed, which is what cf_item recommends from.
    const list = await makeList(recipient);
    const gift = await makeGift(list.id, { name: 'Souhait' });
    await db.gift.update({ where: { id: gift.id }, data: { productId: seed.id } });
  });

  afterAll(async () => {
    await db.itemSimilarity.deleteMany({ where: { productId: { in: products } } });
    await db.giftEvent.deleteMany({
      where: { actorId: { in: [...givers, viewer, recipient, outsider] } },
    });
    await db.gift.deleteMany({ where: { productId: { in: products } } });
    await db.product.deleteMany({ where: { id: { in: products } } });
    await cleanup([...givers, viewer, recipient, outsider]);
    await db.$disconnect();
  });

  it('is ready, and produces a list', async () => {
    // Both halves asserted: a tier that returned nothing would make the
    // invariance test below vacuous.
    expect(await cfIsReady()).toBe(true);
    const rows = await recommend({ viewerId: viewer, recipientId: recipient, tier: 'cf_item', limit: 12 });
    expect(rows.length).toBeGreaterThan(0);
  });

  it('explains itself with the product the recommendation came from', async () => {
    const rows = await recommend({ viewerId: viewer, recipientId: recipient, tier: 'cf_item', limit: 12 });
    // "parce que tu as offert X" — the reason a CF is explainable at all, and
    // why item-item was chosen over matrix factorisation.
    expect(rows[0]!.becauseProductId).toBe(seedProductId);
  });

  it('does not change when a third party reserves a product that IS a candidate', async () => {
    const before = await recommend({ viewerId: viewer, recipientId: recipient, tier: 'cf_item', limit: 12 });
    expect(before.length).toBeGreaterThan(0);

    const target = before[0]!.productId;

    // On the OUTSIDER's list, so the exclusion under test is the reservation
    // and not the recipient's own wish.
    const otherList = await makeList(outsider);
    const gift = await makeGift(otherList.id, { name: 'Convoité' });
    await db.gift.update({ where: { id: gift.id }, data: { productId: target } });
    await db.reservation.create({ data: { giftId: gift.id, reserverId: outsider } });

    const after = await recommend({ viewerId: viewer, recipientId: recipient, tier: 'cf_item', limit: 12 });

    expect(shape(after)).toBe(shape(before));
    expect(after.map((r) => r.productId)).toContain(target);

    await db.reservation.deleteMany({ where: { giftId: gift.id } });
    await db.gift.delete({ where: { id: gift.id } });
    await db.giftList.delete({ where: { id: otherList.id } });
  });
});
