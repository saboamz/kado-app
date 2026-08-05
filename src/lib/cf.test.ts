import { db } from './db';
import {
  CF_READY_THRESHOLD,
  MIN_SUPPORT,
  SHRINKAGE,
  buildItemSimilarity,
  cfCandidates,
  cfIsReady,
  cfReadiness,
  shrink,
} from './cf';
import { cleanup, makeUser } from '@/test/factories';

/**
 * Item-item collaborative filtering.
 *
 * The threshold tests below are asserted in BOTH directions. On an empty
 * database cfIsReady() returns false, and a cfIsReady() that is simply broken
 * returns false too — the two are indistinguishable unless something is also
 * shown to cross the bar. That is the inert-reporter trap transposed: a guard
 * nobody has seen fire is not a guard.
 */

describe('the shrinkage', () => {
  it('is what stops support-1 coincidences topping every list', () => {
    // Cosine alone gives 1.0 to any pair one person bought together, which in
    // a sparse system is most pairs. That reads as a broken model rather than
    // as a data problem, which is why it is the decisive detail here.
    expect(shrink(1.0, 1)).toBeCloseTo(1 / 11, 6);
    expect(shrink(1.0, 1)).toBeLessThan(0.1);
  });

  it('matches the documented numbers at the support levels that matter', () => {
    expect(shrink(1.0, 3)).toBeCloseTo(3 / 13, 3); // ~23%
    expect(shrink(1.0, 50)).toBeCloseTo(50 / 60, 3); // ~83%
  });

  it('rises with support and never exceeds the cosine', () => {
    let previous = 0;
    for (const support of [1, 3, 10, 50, 500]) {
      const score = shrink(0.9, support);
      expect(score).toBeGreaterThan(previous);
      expect(score).toBeLessThanOrEqual(0.9);
      previous = score;
    }
  });

  it('prefers well-supported moderate agreement over thin perfect agreement', () => {
    // The behaviour the whole mechanism exists for: a 0.6 cosine seen by 50
    // people beats a 1.0 cosine seen by one.
    expect(shrink(0.6, 50)).toBeGreaterThan(shrink(1.0, 1));
  });
});

describe('the readiness threshold, in both directions', () => {
  const actorId = `cf-ready-${Date.now()}`;
  let productId: string;

  beforeAll(async () => {
    const product = await db.product.create({ data: { title: `Seuil ${Date.now()}` } });
    productId = product.id;
  });

  afterEach(async () => {
    await db.giftEvent.deleteMany({ where: { actorId } });
  });

  afterAll(async () => {
    await db.giftEvent.deleteMany({ where: { actorId } });
    await db.product.delete({ where: { id: productId } }).catch(() => {});
    await db.$disconnect();
  });

  it('refuses below the threshold', async () => {
    const { ready, events, threshold } = await cfReadiness();
    expect(threshold).toBe(CF_READY_THRESHOLD);
    // Reported as a number, not just a verdict: "not ready" with no figure
    // gives nobody a way to tell "nearly there" from "nothing at all".
    expect(events).toBeLessThan(threshold);
    expect(ready).toBe(false);
  });

  it('fires once the bar is genuinely crossed', async () => {
    // THE OTHER DIRECTION, and the reason this file exists. Without it, the
    // assertion above passes just as well against a cfIsReady() hard-wired to
    // false, and the threshold would be a guarantee nobody had seen work.
    const batch = Array.from({ length: CF_READY_THRESHOLD }, () => ({
      actorId,
      kind: 'reserve' as const,
      productId,
      weight: 6,
    }));
    // createMany in chunks: one statement with 5000 rows is fine, but the
    // chunking keeps this honest if the threshold is ever raised.
    for (let i = 0; i < batch.length; i += 1000) {
      await db.giftEvent.createMany({ data: batch.slice(i, i + 1000) });
    }

    const { ready, events } = await cfReadiness();
    expect(events).toBeGreaterThanOrEqual(CF_READY_THRESHOLD);
    expect(ready).toBe(true);
    expect(await cfIsReady()).toBe(true);
  });

  it('does not count browsing toward the gifting threshold', async () => {
    // Views are the kinds a client can log. If they counted, anyone could
    // trip the threshold by looping telemetry and force a CF built on nothing.
    //
    // Asserted as a DELTA, not as `events === 0`. The absolute version passed
    // only on an empty database and went red the moment a seed added gifting
    // rows — a global count that breaks as soon as the CI seeds. What this
    // test actually claims is "browsing adds nothing", and a delta says that
    // whatever else is in the table.
    const before = (await cfReadiness()).events;

    await db.giftEvent.createMany({
      data: Array.from({ length: 100 }, (_, i) => ({
        actorId,
        kind: 'view_product' as const,
        productId,
        weight: 0.3,
        sessionId: `s${i}`,
      })),
    });

    const after = (await cfReadiness()).events;
    expect(after).toBe(before);

    // Guards the guard: if the inserts silently failed, `after === before`
    // would hold for the wrong reason.
    expect(
      await db.giftEvent.count({ where: { actorId, kind: 'view_product' } }),
    ).toBe(100);
  });
});

describe('building the similarity matrix', () => {
  const tag = `cfm-${Date.now()}`;
  const givers: string[] = [];
  const products: string[] = [];

  beforeAll(async () => {
    // Six givers who all took A and B together, plus a single giver who took
    // A and C — so A~B has support 6 and A~C has support 1.
    for (let i = 0; i < 7; i++) {
      const user = await makeUser(`Giver ${tag} ${i}`);
      givers.push(user.id);
    }
    for (const name of ['A', 'B', 'C']) {
      const p = await db.product.create({ data: { title: `${tag}-${name}` } });
      products.push(p.id);
    }
    const [a, b, c] = products as [string, string, string];

    const rows = [];
    for (let i = 0; i < 6; i++) {
      rows.push(
        { actorId: givers[i]!, kind: 'purchase' as const, productId: a, weight: 10 },
        { actorId: givers[i]!, kind: 'purchase' as const, productId: b, weight: 10 },
      );
    }
    // The lone coincidence.
    rows.push(
      { actorId: givers[6]!, kind: 'purchase' as const, productId: a, weight: 10 },
      { actorId: givers[6]!, kind: 'purchase' as const, productId: c, weight: 10 },
    );
    await db.giftEvent.createMany({ data: rows });

    await buildItemSimilarity();
  });

  afterAll(async () => {
    await db.itemSimilarity.deleteMany({
      where: { productId: { in: products } },
    });
    await db.giftEvent.deleteMany({ where: { actorId: { in: givers } } });
    await db.product.deleteMany({ where: { id: { in: products } } });
    await cleanup(givers);
    await db.$disconnect();
  });

  it('keeps the well-supported pair', async () => {
    const [a, b] = products as [string, string];
    const row = await db.itemSimilarity.findUnique({
      where: { productId_neighborId: { productId: a, neighborId: b } },
    });
    expect(row).not.toBeNull();
    expect(row!.support).toBe(6);
  });

  it('drops the support-1 coincidence entirely', async () => {
    const [a, , c] = products as [string, string, string];
    // HAVING count(*) >= 3. Without it this pair would score a perfect 1.0
    // cosine and sit at the top of the list next to the real signal.
    expect(MIN_SUPPORT).toBe(3);
    const row = await db.itemSimilarity.findUnique({
      where: { productId_neighborId: { productId: a, neighborId: c } },
    });
    expect(row).toBeNull();
  });

  it('mirrors every pair so lookups work both ways', async () => {
    const [a, b] = products as [string, string];
    const forward = await db.itemSimilarity.findUnique({
      where: { productId_neighborId: { productId: a, neighborId: b } },
    });
    const backward = await db.itemSimilarity.findUnique({
      where: { productId_neighborId: { productId: b, neighborId: a } },
    });
    expect(backward).not.toBeNull();
    expect(backward!.score).toBeCloseTo(forward!.score, 9);
  });

  it('shrinks the score below the raw cosine', async () => {
    const [a, b] = products as [string, string];
    const row = await db.itemSimilarity.findUnique({
      where: { productId_neighborId: { productId: a, neighborId: b } },
    });
    // Worked by hand rather than asserted loosely, because a shrinkage that
    // silently did nothing would still satisfy "less than 1".
    //
    // A was taken by 7 givers (the 6 pairs plus the lone coincidence), B by 6,
    // and they overlap on 6. With log-damped confidence c = ln(1 + 10):
    //   dot   = 6c², |A| = √(7c²), |B| = √(6c²)
    //   cos   = 6c² / (c√7 · c√6) = 6/√42 ≈ 0.92582
    //   score = cos × 6/(6+10)    ≈ 0.347183
    //
    // The first version of this assertion assumed cos = 1.0 and expected
    // 0.375. The code was right and the arithmetic in the test was wrong: A
    // and B do not co-occur perfectly, because A has a seventh giver.
    const c = Math.log(1 + 10);
    const cosine = (6 * c * c) / (Math.sqrt(7 * c * c) * Math.sqrt(6 * c * c));
    expect(cosine).toBeCloseTo(0.92582, 5);
    expect(row!.score).toBeCloseTo(shrink(cosine, 6), 6);
    expect(row!.score).toBeLessThan(cosine); // the shrinkage really bit
    expect(SHRINKAGE).toBe(10);
  });

  it('is a full rebuild, not an append', async () => {
    const before = await db.itemSimilarity.count({
      where: { productId: { in: products } },
    });
    await buildItemSimilarity();
    const after = await db.itemSimilarity.count({
      where: { productId: { in: products } },
    });
    // Appending would double every row each night and inflate support.
    expect(after).toBe(before);
  });
});

describe('deduplicated products contribute one row, not two', () => {
  const tag = `cfd-${Date.now()}`;
  const givers: string[] = [];
  const products: string[] = [];

  afterAll(async () => {
    await db.itemSimilarity.deleteMany({ where: { productId: { in: products } } });
    await db.giftEvent.deleteMany({ where: { actorId: { in: givers } } });
    await db.product.deleteMany({ where: { id: { in: products } } });
    await cleanup(givers);
    await db.$disconnect();
  });

  it('resolves through mergedInto so support is not split', async () => {
    // THE failure tierMix() is meant to catch: if a duplicate product row is
    // not resolved, the signal splits across both halves, neither reaches the
    // support threshold, and cf_item stays silently empty. That looks like a
    // model problem and is a deduplication problem.
    const canonical = await db.product.create({ data: { title: `${tag}-canon` } });
    const duplicate = await db.product.create({
      data: { title: `${tag}-dup`, status: 'merged', mergedInto: canonical.id },
    });
    const other = await db.product.create({ data: { title: `${tag}-other` } });
    products.push(canonical.id, duplicate.id, other.id);

    const rows = [];
    for (let i = 0; i < 4; i++) {
      const user = await makeUser(`Dedup ${tag} ${i}`);
      givers.push(user.id);
      // Half the givers hit the canonical row, half hit the duplicate. Split
      // support would be 2 and 2 — under the threshold on both sides.
      rows.push(
        {
          actorId: user.id,
          kind: 'purchase' as const,
          productId: i % 2 === 0 ? canonical.id : duplicate.id,
          weight: 10,
        },
        { actorId: user.id, kind: 'purchase' as const, productId: other.id, weight: 10 },
      );
    }
    await db.giftEvent.createMany({ data: rows });

    await buildItemSimilarity();

    const row = await db.itemSimilarity.findUnique({
      where: { productId_neighborId: { productId: canonical.id, neighborId: other.id } },
    });
    expect(row).not.toBeNull();
    expect(row!.support).toBe(4); // 4, not 2 — the halves were reunited

    // And the duplicate itself never appears as a neighbour.
    const ghost = await db.itemSimilarity.findFirst({
      where: { OR: [{ productId: duplicate.id }, { neighborId: duplicate.id }] },
    });
    expect(ghost).toBeNull();
  });
});

describe('serving', () => {
  it('returns nothing while the threshold is unmet', async () => {
    // Today's real state: 0 gifting events. The tier must yield nothing and
    // let the cascade fall through to content, which is the shipped product.
    const recipient = await makeUser('Recipient');
    const candidates = await cfCandidates(recipient.id, new Set(), 12);
    expect(candidates).toEqual([]);
    await cleanup([recipient.id]);
  });

  it('seeds from wishes, never from reservations', async () => {
    // Structural: the seed query reads Gift rows for the recipient. Reading
    // Reservation here would be the covert channel the invariance suite
    // exists to prevent, and it would not be caught by an output comparison
    // because the leak would be in what the seeds ARE.
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('src/lib/cf.ts', 'utf8');
    const seedQuery = source.slice(
      source.indexOf('const wishes = await'),
      source.indexOf('});', source.indexOf('const wishes = await')),
    );
    expect(seedQuery).toContain('db.gift.findMany');
    expect(seedQuery).not.toContain('reservation');
    expect(seedQuery).not.toContain('Reservation');
  });
});
