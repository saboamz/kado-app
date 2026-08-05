import { db } from './db';
import {
  POPULARITY_HALF_LIFE_DAYS,
  applyDiversity,
  decayedWeight,
  recommendCascade,
  refreshPopularity,
  tierMix,
} from './reco';
import { cleanup, makeUser } from '@/test/factories';

describe('the diversity pass', () => {
  const make = (id: string, categoryId: string | null, merchantId: string | null) => ({
    productId: id,
    score: 1,
    categoryId,
    merchantId,
  });

  it('keeps at most two per category', () => {
    // Without this the top of a list is five variants of the same headphones,
    // and the feature looks stupid however good the scoring is.
    const kept = applyDiversity(
      [
        make('a', 'audio', 'm1'),
        make('b', 'audio', 'm2'),
        make('c', 'audio', 'm3'),
        make('d', 'cuisine', 'm4'),
      ],
      12,
    );
    expect(kept.map((r) => r.productId)).toEqual(['a', 'b', 'd']);
  });

  it('keeps at most two per merchant', () => {
    const kept = applyDiversity(
      [
        make('a', 'c1', 'amazon'),
        make('b', 'c2', 'amazon'),
        make('c', 'c3', 'amazon'),
        make('d', 'c4', 'fnac'),
      ],
      12,
    );
    expect(kept.map((r) => r.productId)).toEqual(['a', 'b', 'd']);
  });

  it('never reorders what survives', () => {
    // Diversity decides WHICH rows live, never in what order. Reordering here
    // would silently override the scoring.
    const kept = applyDiversity(
      [make('a', 'c1', 'm1'), make('b', 'c2', 'm2'), make('c', 'c3', 'm3')],
      12,
    );
    expect(kept.map((r) => r.productId)).toEqual(['a', 'b', 'c']);
  });

  it('does not treat two unknown categories as the same category', () => {
    // A null categoryId is "we do not know", not a category. Bucketing them
    // together would cap the whole uncategorised catalogue at two rows.
    const kept = applyDiversity(
      [make('a', null, null), make('b', null, null), make('c', null, null)],
      12,
    );
    expect(kept).toHaveLength(3);
  });

  it('respects the limit', () => {
    const rows = Array.from({ length: 40 }, (_, i) => make(`p${i}`, `c${i}`, `m${i}`));
    expect(applyDiversity(rows, 12)).toHaveLength(12);
  });
});

describe('popularity decays', () => {
  it('halves over the half-life', () => {
    expect(decayedWeight(10, 0)).toBeCloseTo(10, 6);
    expect(decayedWeight(10, POPULARITY_HALF_LIFE_DAYS)).toBeCloseTo(5, 6);
    expect(decayedWeight(10, POPULARITY_HALF_LIFE_DAYS * 2)).toBeCloseTo(2.5, 6);
  });

  it('lets a current best-seller overtake last years hit', async () => {
    // The reason decay exists at all. A raw count only ever accumulates, so a
    // product popular a year ago would outrank today's best-seller forever.
    const old = decayedWeight(10, 365); // one purchase, a year ago
    const fresh = decayedWeight(6, 1); // one reservation, yesterday
    expect(fresh).toBeGreaterThan(old);
  });

  it('keeps negative evidence negative through the decay', () => {
    expect(decayedWeight(-3, 30)).toBeLessThan(0);
  });
});

describe('refreshPopularity against the database', () => {
  let actor: { id: string };
  const productIds: string[] = [];

  beforeAll(async () => {
    actor = await makeUser('Actor');
  });

  afterAll(async () => {
    await db.giftEvent.deleteMany({ where: { actorId: actor.id } });
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    await cleanup([actor.id]);
    await db.$disconnect();
  });

  it('ranks a recent reservation above an ancient purchase', async () => {
    const ancient = await db.product.create({ data: { title: 'Ancien' } });
    const recent = await db.product.create({ data: { title: 'Récent' } });
    productIds.push(ancient.id, recent.id);

    const now = new Date('2026-08-05T00:00:00Z');
    const yearAgo = new Date('2025-08-05T00:00:00Z');

    await db.giftEvent.create({
      data: {
        actorId: actor.id,
        kind: 'purchase',
        productId: ancient.id,
        weight: 10,
        occurredAt: yearAgo,
      },
    });
    await db.giftEvent.create({
      data: {
        actorId: actor.id,
        kind: 'reserve',
        productId: recent.id,
        weight: 6,
        occurredAt: now,
      },
    });

    await refreshPopularity(now);

    const [a, r] = await Promise.all([
      db.product.findUnique({ where: { id: ancient.id } }),
      db.product.findUnique({ where: { id: recent.id } }),
    ]);
    // 10 decayed over a year loses to 6 from today, which is the whole point.
    expect(r!.popularity).toBeGreaterThan(a!.popularity);
  });

  it('lets negative evidence push a product below zero', async () => {
    const disliked = await db.product.create({ data: { title: 'Rejeté' } });
    productIds.push(disliked.id);

    const now = new Date('2026-08-05T00:00:00Z');
    await db.giftEvent.createMany({
      data: [1, 2, 3].map(() => ({
        actorId: actor.id,
        kind: 'dismiss_reco' as const,
        productId: disliked.id,
        weight: -2,
        occurredAt: now,
      })),
    });

    await refreshPopularity(now);

    // Clamping at zero would erase the difference between "people actively
    // dismissed this" and "nobody has seen it yet".
    const row = await db.product.findUnique({ where: { id: disliked.id } });
    expect(row!.popularity).toBeLessThan(0);
  });
});

describe('the cascade', () => {
  let viewer: { id: string };
  let recipient: { id: string };
  const productIds: string[] = [];

  beforeAll(async () => {
    viewer = await makeUser('Viewer');
    recipient = await makeUser('Recipient');
    for (let i = 0; i < 20; i++) {
      const p = await db.product.create({
        data: { title: `Cascade ${Date.now()} ${i}`, popularity: 100 - i },
      });
      productIds.push(p.id);
    }
  });

  afterAll(async () => {
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    await cleanup([viewer.id, recipient.id]);
    await db.$disconnect();
  });

  it('falls through the unbuilt tiers to the one that works', async () => {
    const { rows, tier } = await recommendCascade({
      viewerId: viewer.id,
      recipientId: recipient.id,
      limit: 12,
    });

    // cf_item and content_vector return nothing today; content_facet needs
    // declared interests, which this recipient has none of. So popularity —
    // the floor — is what carries it, exactly as it will at launch.
    expect(tier).toBe('popularity');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.strategy === 'popularity')).toBe(true);
  });

  it('numbers the ranks from one, in order', async () => {
    const { rows } = await recommendCascade({
      viewerId: viewer.id,
      recipientId: recipient.id,
      limit: 12,
    });
    expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
  });
});

describe('tierMix', () => {
  const viewerId = `mix-viewer-${Date.now()}`;

  afterAll(async () => {
    await db.recommendation.deleteMany({ where: { viewerId } });
    await db.$disconnect();
  });

  it('reports the share of each strategy', async () => {
    const batchId = `batch-${Date.now()}`;
    await db.recommendation.createMany({
      data: [
        ...Array.from({ length: 3 }, (_, i) => ({
          viewerId,
          productId: `p${i}`,
          score: 1,
          strategy: 'popularity',
          rank: i + 1,
          batchId,
        })),
        {
          viewerId,
          productId: 'p9',
          score: 1,
          strategy: 'content_facet',
          rank: 4,
          batchId,
        },
      ],
    });

    const mix = await tierMix(new Date(Date.now() - 60_000));
    // The health signal for phase 5: if cf_item's share does not rise as data
    // accumulates, the fault is deduplication rather than the model.
    expect(mix.popularity).toBeCloseTo(0.75, 2);
    expect(mix.content_facet).toBeCloseTo(0.25, 2);
  });

  it('returns nothing rather than dividing by zero on an empty window', async () => {
    expect(await tierMix(new Date(Date.now() + 60_000))).toEqual({});
  });
});
