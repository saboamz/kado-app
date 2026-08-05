import { db } from './db';
import {
  BATCH_SIZE,
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
  clearEmbeddings,
  embedBatch,
  embeddingCoverage,
  embeddingText,
  nearestByTaste,
  pendingForEmbedding,
  tasteVector,
  type Encoder,
} from './embed';
import { cleanup, makeGift, makeList, makeUser } from '@/test/factories';

/**
 * Product embeddings.
 *
 * No real encoder runs here: the model is a batch job, not a test dependency.
 * The fake below is DETERMINISTIC and semantic enough to be discriminating —
 * texts sharing words land near each other — so "nearest neighbour" means
 * something rather than being a shuffle.
 *
 * What the fake CANNOT test is the thing the mission warns about: that the
 * real model is multilingual. An English-only encoder would fail silently,
 * with correctly-shaped vectors and working queries. That is why the model
 * identity is stored per row and asserted here — the guard survives even
 * though the failure itself cannot be reproduced without the real model.
 */

/** Hashed bag-of-words, L2-normalised. Same text → same vector, always. */
const fakeEncoder: Encoder = async (texts) =>
  texts.map((text) => {
    const vector = new Array<number>(EMBEDDING_DIM).fill(0);
    for (const word of text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
      let hash = 0;
      for (const char of word) hash = (hash * 31 + char.codePointAt(0)!) % EMBEDDING_DIM;
      vector[hash] = (vector[hash] ?? 0) + 1;
    }
    const norm = Math.hypot(...vector) || 1;
    return vector.map((v) => v / norm);
  });

describe('embeddingText', () => {
  it('puts the title first, where truncation cannot reach it', () => {
    const text = embeddingText({
      title: 'Théière en fonte',
      brand: 'Iwachu',
      categoryId: 'Maison',
      description: 'Fonte émaillée',
    });
    expect(text.startsWith('Théière en fonte')).toBe(true);
    expect(text).toContain('Iwachu');
    expect(text).toContain('Maison');
  });

  it('strips the boilerplate every product in a catalogue shares', () => {
    // "Livraison gratuite" in 40,000 descriptions pulls all 40,000 vectors
    // toward each other and distinguishes none of them.
    const text = embeddingText({
      title: 'Vase',
      description: 'Grès émaillé fait main. Livraison gratuite dès 49 €. Garantie 2 ans.',
    });
    expect(text).toContain('Grès émaillé fait main');
    expect(text.toLowerCase()).not.toContain('livraison gratuite');
    expect(text.toLowerCase()).not.toContain('garantie 2 ans');
  });

  it('caps the description so a long one cannot drown the title', () => {
    const text = embeddingText({ title: 'Court', description: 'a'.repeat(1000) });
    expect(text.length).toBeLessThan(400);
  });

  it('omits missing fields rather than emitting empty separators', () => {
    expect(embeddingText({ title: 'Seul' })).toBe('Seul');
  });
});

describe('the fake encoder is discriminating enough to test with', () => {
  it('gives the same text the same vector', async () => {
    const [a, b] = await fakeEncoder(['Théière en fonte', 'Théière en fonte']);
    expect(a).toEqual(b);
  });

  it('puts related texts nearer than unrelated ones', async () => {
    // Without this the neighbour tests below would be asserting over noise,
    // and would pass just as happily against a broken query.
    const [tea1, tea2, bike] = await fakeEncoder([
      'théière fonte cuisine',
      'théière fonte thé',
      'vélo route carbone',
    ]);
    const dot = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i]!, 0);
    expect(dot(tea1!, tea2!)).toBeGreaterThan(dot(tea1!, bike!));
  });

  it('produces vectors of the declared width', async () => {
    const [v] = await fakeEncoder(['x']);
    expect(v).toHaveLength(EMBEDDING_DIM);
  });
});

describe('embedding against the database', () => {
  const tag = `emb-${Date.now()}`;
  const productIds: string[] = [];

  const makeProduct = async (title: string, categoryId?: string) => {
    const p = await db.product.create({ data: { title: `${tag} ${title}`, categoryId } });
    productIds.push(p.id);
    return p;
  };

  afterAll(async () => {
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    await db.$disconnect();
  });

  it('embeds a pending product and records which model did it', async () => {
    await makeProduct('théière fonte');
    const written = await embedBatch(fakeEncoder);
    expect(written).toBeGreaterThan(0);

    const [row] = await db.$queryRawUnsafe<{ embeddingModel: string; has: boolean }[]>(
      `SELECT "embeddingModel", embedding IS NOT NULL AS has FROM "Product" WHERE id = $1`,
      productIds[0],
    );
    expect(row!.has).toBe(true);
    // The model identity is the whole defence against a silent multilingual
    // failure: without it, vectors from two models mix and nothing reports it.
    expect(row!.embeddingModel).toBe(EMBEDDING_MODEL);
  });

  it('does not re-embed what is already current', async () => {
    const before = await pendingForEmbedding();
    const mine = before.filter((p) => p.title.startsWith(tag));
    expect(mine).toHaveLength(0);
  });

  it('treats a row from another model as pending, not as done', async () => {
    // The decisive case. After a model change the old rows are not missing a
    // vector — they carry a WRONG one, and a query looking only for NULLs
    // would leave them incomparable forever.
    const stale = await makeProduct('ancien modèle');
    await db.$executeRawUnsafe(
      `UPDATE "Product" SET embedding = $1::vector, "embeddingModel" = 'english-only-v1' WHERE id = $2`,
      `[${new Array(EMBEDDING_DIM).fill(0.1).join(',')}]`,
      stale.id,
    );

    const pending = await pendingForEmbedding();
    expect(pending.map((p) => p.id)).toContain(stale.id);
  });

  it('refuses a vector of the wrong width instead of storing it', async () => {
    await makeProduct('mauvaise largeur');
    const wrongWidth: Encoder = async (texts) => texts.map(() => new Array(128).fill(0.1));
    await expect(embedBatch(wrongWidth)).rejects.toThrow(/dimensions/);
  });

  it('refuses a batch whose size does not match', async () => {
    const short: Encoder = async () => [];
    await expect(embedBatch(short)).rejects.toThrow(/vectors for/);
  });

  it('reports coverage, and names every model present', async () => {
    const coverage = await embeddingCoverage();
    expect(coverage.total).toBeGreaterThan(0);
    // More than one model means the catalogue is mid-migration and something
    // somewhere is comparing across models — a failure with no other symptom.
    expect(coverage.models).toContain('english-only-v1');
    expect(coverage.models.length).toBeGreaterThan(1);
  });

  it('clears every vector for a model change', async () => {
    await clearEmbeddings();
    const coverage = await embeddingCoverage();
    expect(coverage.embedded).toBe(0);
    expect(coverage.models).toEqual([]);
  });
});

describe('taste vector and neighbours', () => {
  const tag = `taste-${Date.now()}`;
  const productIds: string[] = [];
  let recipient: { id: string };
  let teaId: string;
  let bikeId: string;

  beforeAll(async () => {
    recipient = await makeUser(`Taste ${tag}`);

    const make = async (title: string) => {
      const p = await db.product.create({ data: { title: `${tag} ${title}` } });
      productIds.push(p.id);
      return p;
    };

    // Creation order deliberately CONTRADICTS the expected ranking: cuids are
    // monotonic, so creating the near product first makes `ORDER BY id` agree
    // with `ORDER BY distance` by accident, and a query sorting by the wrong
    // column passes. Found by sabotage — the first fixture could not tell the
    // two apart. The far product (bike) is created first here.
    const wish = await make('théière fonte cuisine thé');
    bikeId = (await make('vélo route carbone cyclisme')).id;
    await make('casque vélo route cyclisme');
    teaId = (await make('tasse thé cuisine porcelaine')).id;

    // Embed them all under the current model.
    await embedBatch(fakeEncoder, 50);

    // The recipient wishes for the teapot.
    const list = await makeList(recipient.id);
    const gift = await makeGift(list.id, { name: 'Souhait' });
    await db.gift.update({ where: { id: gift.id }, data: { productId: wish.id } });
  });

  afterAll(async () => {
    await db.gift.deleteMany({ where: { productId: { in: productIds } } });
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    await cleanup([recipient.id]);
    await db.$disconnect();
  });

  it('builds a taste vector from the wishes', async () => {
    const vector = await tasteVector(recipient.id);
    expect(vector).not.toBeNull();
    expect(vector).toHaveLength(EMBEDDING_DIM);
  });

  it('returns nothing for someone with no embedded wishes', async () => {
    const stranger = await makeUser('Sans souhaits');
    expect(await tasteVector(stranger.id)).toBeNull();
    await cleanup([stranger.id]);
  });

  it('ranks the semantically near product above the far one', async () => {
    const vector = await tasteVector(recipient.id);
    const neighbours = await nearestByTaste(vector!, new Set(), 20);
    const mine = neighbours.filter((n) => productIds.includes(n.productId));

    const tea = mine.find((n) => n.productId === teaId);
    const bike = mine.find((n) => n.productId === bikeId);
    expect(tea).toBeDefined();
    expect(bike).toBeDefined();
    // The teapot wish sits nearer the teacup than the bicycle.
    expect(tea!.score).toBeGreaterThan(bike!.score);

    // AND the rows come back in that order. Found by sabotage: replacing
    // `ORDER BY embedding <=> $1` with `ORDER BY id` left every assertion
    // green, because the SCORES were still computed correctly — only the
    // ordering was wrong, and nothing looked at it. A nearest-neighbour query
    // that returns the right numbers in the wrong order is not a
    // nearest-neighbour query: with LIMIT applied, it returns the wrong rows.
    const scores = neighbours.map((n) => n.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(neighbours.indexOf(tea!)).toBeLessThan(neighbours.indexOf(bike!));
  });

  it('returns the NEAREST rows when the limit bites', async () => {
    // The consequence of the ordering bug, stated directly: with a limit
    // smaller than the catalogue, a mis-ordered query silently returns a
    // different set of products, not merely the same set rearranged.
    const vector = await tasteVector(recipient.id);
    const top = await nearestByTaste(vector!, new Set(), 2);
    expect(top).toHaveLength(2);

    const all = await nearestByTaste(vector!, new Set(), 100);
    const bestTwo = [...all].sort((a, b) => b.score - a.score).slice(0, 2);
    expect(top.map((n) => n.productId)).toEqual(bestTwo.map((n) => n.productId));
  });

  it('honours the exclusion set', async () => {
    const vector = await tasteVector(recipient.id);
    const neighbours = await nearestByTaste(vector!, new Set([teaId]), 20);
    expect(neighbours.map((n) => n.productId)).not.toContain(teaId);
  });

  it('never compares across models', async () => {
    // Cosine distance between vectors from two models is not imprecise, it is
    // meaningless. This proves the filter is real: relabel a row and it
    // disappears from the results entirely.
    const before = await nearestByTaste((await tasteVector(recipient.id))!, new Set(), 20);
    expect(before.map((n) => n.productId)).toContain(teaId);

    await db.$executeRawUnsafe(
      `UPDATE "Product" SET "embeddingModel" = 'other-model' WHERE id = $1`,
      teaId,
    );
    const after = await nearestByTaste((await tasteVector(recipient.id))!, new Set(), 20);
    expect(after.map((n) => n.productId)).not.toContain(teaId);

    await db.$executeRawUnsafe(
      `UPDATE "Product" SET "embeddingModel" = $1 WHERE id = $2`,
      EMBEDDING_MODEL,
      teaId,
    );
  });
});

describe('the batch size is a real batch', () => {
  it('is large enough that ingestion does not take days', () => {
    // One request per product would make a catalogue import run for days.
    expect(BATCH_SIZE).toBeGreaterThanOrEqual(50);
  });
});
