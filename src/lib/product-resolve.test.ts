import { db } from './db';
import { findOrCreateProduct, resolveCanonical } from './product-resolve';
import { extractProduct } from './extract';

/**
 * Deduplication against the real database.
 *
 * The corpus in catalogue-dedup.test.ts proves normalizeUrl agrees with itself.
 * This proves the catalogue actually converges: the same product arriving twice
 * by different routes must end as ONE row, because a fragmented catalogue is
 * indiscernible from a bad recommender.
 */

const created: string[] = [];
const track = <T extends { id: string } | null>(p: T): T => {
  if (p) created.push(p.id);
  return p;
};

const page = (over: Partial<Record<string, string>> = {}) => ({
  title: over.title ?? 'Théière en fonte 1,2 L',
  brand: over.brand ?? 'Iwachu',
  description: null,
  imageUrl: over.imageUrl ?? null,
  gtin: over.gtin ?? null,
  priceCents: over.priceCents != null ? Number(over.priceCents) : 8990,
  currency: 'EUR',
  extractedBy: 'json-ld' as const,
  sourceUrl: over.sourceUrl ?? 'https://merchant-test.fr/p/theiere',
});

describe('the catalogue converges on one row', () => {
  afterAll(async () => {
    await db.product.deleteMany({ where: { id: { in: created } } });
    await db.merchant.deleteMany({ where: { slug: { startsWith: 'test-' } } });
    await db.$disconnect();
  });

  it('creates a row the first time a link is seen', async () => {
    const p = track(await findOrCreateProduct(page({ sourceUrl: 'https://merchant-test.fr/p/a' })));
    expect(p).not.toBeNull();
    expect(p!.urlHash).not.toBeNull();
    expect(p!.priceBand).toBeGreaterThan(0);
  });

  it('returns the SAME row for a link differing only by tracking parameters', async () => {
    const first = track(await findOrCreateProduct(page({ sourceUrl: 'https://merchant-test.fr/p/b' })));
    const second = track(
      await findOrCreateProduct(
        page({ sourceUrl: 'https://www.merchant-test.fr/p/b/?utm_source=ig&gclid=xx#avis' }),
      ),
    );

    // The whole premise of the recommender: two people pasting the same product
    // from different places must land on one row, or their agreement is
    // invisible to the co-occurrence matrix.
    expect(second!.id).toBe(first!.id);
    expect(await db.product.count({ where: { urlHash: first!.urlHash } })).toBe(1);
  });

  it('keeps a genuine variant apart', async () => {
    const black = track(
      await findOrCreateProduct(page({ sourceUrl: 'https://merchant-test.fr/p/c?color=noir' })),
    );
    const white = track(
      await findOrCreateProduct(page({ sourceUrl: 'https://merchant-test.fr/p/c?color=blanc' })),
    );
    // A wrong merge is the costlier error: it would put the black one on the
    // list of somebody who asked for white.
    expect(white!.id).not.toBe(black!.id);
  });

  it('merges across merchants on a shared GTIN', async () => {
    const a = track(
      await findOrCreateProduct(
        page({ gtin: '4901234567894', sourceUrl: 'https://merchant-test.fr/p/d' }),
      ),
    );
    const b = track(
      await findOrCreateProduct(
        page({ gtin: '4901234567894', sourceUrl: 'https://other-test.fr/p/zzz' }),
      ),
    );
    // Different hosts, different paths — only the GTIN proves they are one
    // product, which is why it is tried first.
    expect(b!.id).toBe(a!.id);
  });

  it('fills a missing GTIN without overwriting one it already has', async () => {
    const first = track(
      await findOrCreateProduct(page({ sourceUrl: 'https://merchant-test.fr/p/e' })),
    );
    expect(first!.gtin).toBeNull();

    const enriched = await findOrCreateProduct(
      page({ sourceUrl: 'https://merchant-test.fr/p/e', gtin: '3401234567890' }),
    );
    expect(enriched!.id).toBe(first!.id);
    expect(enriched!.gtin).toBe('3401234567890');

    // A later weaker extraction must not blank it back out.
    const weaker = await findOrCreateProduct(page({ sourceUrl: 'https://merchant-test.fr/p/e' }));
    expect(weaker!.gtin).toBe('3401234567890');
  });

  it('refuses to create a product with no title', async () => {
    const p = await findOrCreateProduct(page({ title: '' }) as never);
    expect(p).toBeNull();
  });

  it('resolves the same link twice to one row', async () => {
    const url = 'https://merchant-test.fr/p/race';
    await db.product.deleteMany({ where: { urlNorm: 'merchant-test.fr/p/race' } });
    const twice = { sourceUrl: url, title: `Course ${Date.now()}` };
    const [a, b] = await Promise.all([
      findOrCreateProduct(page(twice)),
      findOrCreateProduct(page(twice)),
    ]);
    for (const p of [a, b]) if (p) created.push(p.id);

    // Exactly one, not "at most one": <= 1 would also pass on zero rows.
    expect(await db.product.findMany({ where: { urlNorm: 'merchant-test.fr/p/race' } })).toHaveLength(1);
    expect(a!.id).toBe(b!.id);
  });

  it('resolves a differently-titled paste of the same URL to the same row', async () => {
    const url = 'https://merchant-test.fr/p/retitled';
    await db.product.deleteMany({ where: { urlNorm: 'merchant-test.fr/p/retitled' } });

    const first = await findOrCreateProduct(page({ sourceUrl: url, title: 'Gagnant' }));
    created.push(first!.id);
    const second = await findOrCreateProduct(page({ sourceUrl: url, title: 'Perdant' }));

    // The urlHash lookup carries this, not the title: the same page is the
    // same product however the extractor happened to name it that day.
    expect(second!.id).toBe(first!.id);
    expect(await db.product.count({ where: { urlNorm: 'merchant-test.fr/p/retitled' } })).toBe(1);
  });

  /**
   * The unique-violation recovery in findOrCreateProduct is deliberately NOT
   * asserted here, because nothing in this file can reach it.
   *
   * Two awaits in one test share a Prisma connection and serialise, so the
   * second call's urlHash lookup runs after the first has committed, finds the
   * row, and returns before ever attempting an insert. Every version of a
   * "concurrent" test I wrote passed identically with the recovery deleted —
   * it asserted a path it never executed, which is the vacuous pass this suite
   * exists to avoid. Instrumenting the catch confirmed it: reached 0 times.
   *
   * The recovery stays in the code because real requests arrive on separate
   * connections, where the insert genuinely does lose the race — verified by
   * running two parallel raw creates, which produced one success and one
   * unique-constraint failure. Reproducing that here would need a second
   * connection pool, which is more machinery than the guarantee is worth.
   */
});

describe('merged rows', () => {
  const ids: string[] = [];
  afterAll(async () => {
    await db.product.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });

  it('follows mergedInto to the surviving row', async () => {
    const winner = await db.product.create({ data: { title: 'Canonique' } });
    const loser = await db.product.create({
      data: { title: 'Doublon', status: 'merged', mergedInto: winner.id },
    });
    ids.push(winner.id, loser.id);

    // A reader that ignored mergedInto would count this pair twice, and the
    // support threshold in the CF would never be reached by either half.
    expect(await resolveCanonical(loser.id)).toBe(winner.id);
    expect(await resolveCanonical(winner.id)).toBe(winner.id);
  });

  it('does not loop forever on a cyclic merge', async () => {
    const a = await db.product.create({ data: { title: 'A' } });
    const b = await db.product.create({ data: { title: 'B', mergedInto: a.id } });
    await db.product.update({ where: { id: a.id }, data: { mergedInto: b.id } });
    ids.push(a.id, b.id);

    // A bad backfill can produce a cycle. Terminating with a wrong-but-bounded
    // answer beats hanging the request.
    await expect(resolveCanonical(a.id)).resolves.toBeDefined();
  });
});

describe('extraction feeds resolution end to end', () => {
  const ids: string[] = [];
  afterAll(async () => {
    await db.product.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });

  it('turns merchant HTML into a catalogue row that carries its provenance', async () => {
    const html = `<script type="application/ld+json">
      {"@type":"Product","name":"Chemex 6 tasses","brand":{"name":"Chemex"},
       "gtin13":"0632963000064","offers":{"price":"49,90","priceCurrency":"EUR"}}</script>`;

    const product = await findOrCreateProduct({
      ...extractProduct(html),
      sourceUrl: 'https://merchant-test.fr/p/chemex?utm_source=news',
    });
    if (product) ids.push(product.id);

    expect(product!.title).toBe('Chemex 6 tasses');
    expect(product!.gtin).toBe('0632963000064');
    expect(product!.priceCents).toBe(4990);
    // Tracking stripped before storage, or the next paste would not match.
    expect(product!.urlNorm).toBe('merchant-test.fr/p/chemex');
    // extractedBy is what lets a bad row be traced to its source months later.
    expect(product!.extractedBy).toBe('json-ld');
  });
});
