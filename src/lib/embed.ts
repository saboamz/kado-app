import { db } from './db';

/**
 * Product embeddings for the content_vector tier.
 *
 * ── THE MODEL MUST BE MULTILINGUAL ──────────────────────────────────────
 *
 * The app is French. An English-only encoder turns "Vase en grès émaillé" into
 * noise — and it does so SILENTLY: the vector still has 384 dimensions, the
 * cosine distance still returns a number, the query still succeeds. Nothing
 * anywhere reports a failure. The only symptom is recommendations that feel
 * subtly random, months later.
 *
 * So the model identity is stored on every row, and comparisons must never
 * cross models. Cosine distance between vectors from two different models is
 * not imprecise, it is MEANINGLESS.
 */

/** Dimension of the stored vectors. Must match the migration's vector(384). */
export const EMBEDDING_DIM = 384;

/**
 * The model in use. Multilingual by requirement, not by preference.
 *
 * Changing this string is a migration, not a config tweak: every existing row
 * becomes incomparable and must be re-embedded. clearEmbeddings() exists for
 * that, and readiness checks refuse to serve a mixed catalogue.
 */
export const EMBEDDING_MODEL = 'paraphrase-multilingual-MiniLM-L12-v2';

/** Batch size for the cron. One request per product would take days. */
export const BATCH_SIZE = 100;

/**
 * Marketing boilerplate, removed before embedding.
 *
 * A sentence shared by every product in a catalogue distinguishes nothing and
 * dilutes the part that does. "Livraison gratuite" in 40,000 descriptions
 * pulls all 40,000 vectors toward each other.
 */
const BOILERPLATE =
  /\b(livraison (gratuite|offerte|rapide|en \d+ ?h)|retours? gratuits?|garantie \d+ ans?|paiement s[ée]curis[ée]|satisfait ou rembours[ée]|en stock|exp[ée]di[ée] sous \d+|free shipping|money.back guarantee)\b[^.]*\.?/gi;

/**
 * The text that gets embedded: title · brand · category · description(300).
 *
 * Order matters — the title carries most of the identity, so it goes first
 * where truncation cannot reach it.
 */
export function embeddingText(product: {
  title: string;
  brand?: string | null;
  categoryId?: string | null;
  description?: string | null;
}): string {
  const description = (product.description ?? '')
    .replace(BOILERPLATE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);

  return [product.title, product.brand, product.categoryId, description]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' · ');
}

/** An encoder: text in, unit-length vectors out. Injected so it can be faked. */
export type Encoder = (texts: string[]) => Promise<number[][]>;

/**
 * Products still waiting for a vector, or carrying one from another model.
 *
 * The second half matters: after a model change the old rows are not missing a
 * vector, they are carrying a WRONG one, and a query that only looked for
 * NULLs would leave them in place forever, silently incomparable.
 */
export async function pendingForEmbedding(limit = BATCH_SIZE) {
  return db.$queryRawUnsafe<
    { id: string; title: string; brand: string | null; categoryId: string | null; description: string | null }[]
  >(
    `
    SELECT id, title, brand, "categoryId", description
    FROM "Product"
    WHERE status = 'active'
      AND "mergedInto" IS NULL
      AND (embedding IS NULL OR "embeddingModel" IS DISTINCT FROM $1)
    ORDER BY popularity DESC, id
    LIMIT $2
    `,
    EMBEDDING_MODEL,
    limit,
  );
}

/** Formats a vector as the literal pgvector accepts. */
function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

/**
 * Embeds one batch. Returns how many rows were written.
 *
 * Refuses a vector of the wrong width rather than storing it: pgvector would
 * reject it anyway, but failing here names the cause instead of surfacing a
 * type error from three layers down.
 */
export async function embedBatch(encoder: Encoder, limit = BATCH_SIZE): Promise<number> {
  const products = await pendingForEmbedding(limit);
  if (products.length === 0) return 0;

  const vectors = await encoder(products.map(embeddingText));

  if (vectors.length !== products.length) {
    throw new Error(
      `encoder returned ${vectors.length} vectors for ${products.length} products`,
    );
  }

  let written = 0;
  for (const [i, product] of products.entries()) {
    const vector = vectors[i]!;
    if (vector.length !== EMBEDDING_DIM) {
      throw new Error(
        `encoder returned ${vector.length} dimensions, expected ${EMBEDDING_DIM}`,
      );
    }

    await db.$executeRawUnsafe(
      `UPDATE "Product"
       SET embedding = $1::vector, "embeddingModel" = $2, "embeddedAt" = NOW()
       WHERE id = $3`,
      toVectorLiteral(vector),
      EMBEDDING_MODEL,
      product.id,
    );
    written += 1;
  }

  return written;
}

/**
 * The recipient's taste vector: the mean of their wishes' embeddings.
 *
 * Restricted to the current model in SQL, not filtered afterwards — mixing
 * models into a mean produces a vector that points nowhere in particular and
 * looks entirely valid.
 */
export async function tasteVector(recipientId: string): Promise<number[] | null> {
  const rows = await db.$queryRawUnsafe<{ centroid: string | null }[]>(
    `
    SELECT AVG(p.embedding)::text AS centroid
    FROM "Gift" g
    JOIN "GiftList" l ON l.id = g."listId"
    JOIN "Product" p ON p.id = g."productId"
    WHERE l."ownerId" = $1
      AND p.embedding IS NOT NULL
      AND p."embeddingModel" = $2
    `,
    recipientId,
    EMBEDDING_MODEL,
  );

  const centroid = rows[0]?.centroid;
  if (!centroid) return null;
  return centroid
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map(Number);
}

/**
 * Nearest neighbours of a taste vector.
 *
 * `<=>` is cosine distance in pgvector: 0 identical, 2 opposite. Score is
 * 1 - distance so bigger is better, matching every other tier.
 *
 * ── THE LEAK ──
 * The seed is the recipient's WISHES (via tasteVector). Nothing here reads
 * Reservation, and nothing may: filtering on who reserved what is the covert
 * channel the invariance suite exists to prevent.
 */
export async function nearestByTaste(
  vector: number[],
  excluded: Set<string>,
  take: number,
): Promise<{ productId: string; score: number }[]> {
  const rows = await db.$queryRawUnsafe<{ id: string; distance: number }[]>(
    `
    SELECT id, (embedding <=> $1::vector) AS distance
    FROM "Product"
    WHERE embedding IS NOT NULL
      AND "embeddingModel" = $2
      AND status = 'active'
      AND "mergedInto" IS NULL
      AND NOT (id = ANY($3))
    ORDER BY embedding <=> $1::vector
    LIMIT $4
    `,
    toVectorLiteral(vector),
    EMBEDDING_MODEL,
    [...excluded],
    take,
  );

  return rows.map((r) => ({ productId: r.id, score: 1 - Number(r.distance) }));
}

/**
 * How much of the catalogue is embedded, and under which models.
 *
 * More than one model in the result means the catalogue is mid-migration and
 * comparisons are crossing models somewhere — the failure that has no symptom
 * except recommendations quietly going wrong.
 */
export async function embeddingCoverage(): Promise<{
  total: number;
  embedded: number;
  models: string[];
}> {
  const [totals] = await db.$queryRawUnsafe<{ total: bigint; embedded: bigint }[]>(
    `SELECT COUNT(*) AS total,
            COUNT(embedding) FILTER (WHERE "embeddingModel" = $1) AS embedded
     FROM "Product" WHERE status = 'active' AND "mergedInto" IS NULL`,
    EMBEDDING_MODEL,
  );

  const models = await db.$queryRawUnsafe<{ embeddingModel: string }[]>(
    `SELECT DISTINCT "embeddingModel" FROM "Product" WHERE "embeddingModel" IS NOT NULL`,
  );

  return {
    total: Number(totals?.total ?? 0),
    embedded: Number(totals?.embedded ?? 0),
    models: models.map((m) => m.embeddingModel),
  };
}

/** Drops every vector. For a model change, which invalidates all of them. */
export async function clearEmbeddings(): Promise<number> {
  return db.$executeRawUnsafe(
    `UPDATE "Product"
     SET embedding = NULL, "embeddingModel" = NULL, "embeddedAt" = NULL
     WHERE embedding IS NOT NULL`,
  );
}
