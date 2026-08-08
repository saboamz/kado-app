import { db } from './db';
import { findOrCreateProduct } from './product-resolve';
import { recommend } from './reco';
import { cleanup, makeUser } from '@/test/factories';

/**
 * What quarantine actually buys.
 *
 * The unit tests above decide the verdict; these check the consequence — that
 * a held-back row really is invisible to the recommender, and that a row
 * already promoted is not demoted again by a later weak read.
 *
 * This is the part a type cannot enforce: every tier filters on
 * `status: 'active'`, and until now nothing ever wrote anything else, so that
 * filter had never once excluded a row.
 */
let viewer: { id: string };
let recipient: { id: string };
const productIds: string[] = [];

const track = <T extends { id: string } | null>(product: T): T => {
  if (product) productIds.push(product.id);
  return product;
};

beforeAll(async () => {
  viewer = await makeUser('Celui qui offre');
  recipient = await makeUser('Celle qui reçoit');
  await db.interest.create({ data: { userId: recipient.id, label: 'Céramique' } });
});

afterAll(async () => {
  await db.product.deleteMany({ where: { id: { in: productIds } } });
  await cleanup([viewer.id, recipient.id]);
  await db.$disconnect();
});

describe('a thin extraction', () => {
  it('is stored, but not as active', async () => {
    // Kept rather than refused: a title with no price and no image is a real
    // gift often enough — the association's membership fee looks exactly
    // like this.
    const product = track(
      await findOrCreateProduct({
        title: `Adhésion annuelle ${Date.now()}`,
        sourceUrl: `https://amis-du-velo.test/adhesion-${Date.now()}`,
        categoryId: 'Maison',
        extractedBy: 'title',
        brand: null,
        description: null,
        imageUrl: null,
        gtin: null,
        priceCents: null,
        currency: null,
      }),
    );

    expect(product).not.toBeNull();
    expect(product!.status).toBe('stale');
  });

  it('is never recommended', async () => {
    // The row above is categorised Maison, which is what "Céramique" maps to,
    // so it WOULD be a candidate — the only thing keeping it out is status.
    // Checked on the full output AND on the candidate set, since a diversity
    // cap could otherwise hide the row for the wrong reason.
    const rows = await recommend({
      viewerId: viewer.id,
      recipientId: recipient.id,
      tier: 'content_facet',
    });
    expect(rows.map((r) => r.productId)).not.toContain(productIds[0]);

    const candidates = await db.product.findMany({
      where: { status: 'active', mergedInto: null, categoryId: 'Maison' },
      select: { id: true },
    });
    expect(candidates.map((c) => c.id)).not.toContain(productIds[0]);
  });
});

describe('a page that is not a product at all', () => {
  it('creates no row', async () => {
    // The one that reached production: "Captcha", active and recommendable.
    const product = track(
      await findOrCreateProduct({
        title: 'Captcha',
        sourceUrl: `https://shop.test/bot-check-${Date.now()}`,
        categoryId: 'Jeux',
        extractedBy: 'title',
        brand: null,
        description: null,
        imageUrl: null,
        gtin: null,
        priceCents: null,
        currency: null,
      }),
    );

    expect(product).toBeNull();
  });
});

describe('a described extraction', () => {
  it('is active and recommendable', async () => {
    const product = track(
      await findOrCreateProduct({
        title: `Bol en grès ${Date.now()}`,
        sourceUrl: `https://atelier.test/bol-${Date.now()}`,
        categoryId: 'Maison',
        extractedBy: 'open-graph',
        imageUrl: 'https://atelier.test/bol.jpg',
        brand: null,
        description: null,
        gtin: null,
        priceCents: null,
        currency: null,
      }),
    );

    expect(product!.status).toBe('active');

    /*
     * Asserted as "is a candidate", not "appears in the output".
     *
     * applyDiversity caps the result at 2 per category, and this shared test
     * database holds other Maison rows — so a correct row can legitimately be
     * crowded out of the final list. What this test is about is the status
     * filter, so it checks the set the tier draws from.
     */
    const candidates = await db.product.findMany({
      where: { status: 'active', mergedInto: null, categoryId: 'Maison' },
      select: { id: true },
    });
    expect(candidates.map((c) => c.id)).toContain(product!.id);
  });

  it('is not demoted by a later, weaker read of the same URL', async () => {
    /*
     * The gate runs on CREATION only.
     *
     * The same page read again while a merchant is mid-deploy can come back
     * thin. Re-judging on every visit would let that undo a promotion, and a
     * row would flicker in and out of the catalogue with the merchant's
     * uptime.
     */
    const url = `https://atelier.test/vase-${Date.now()}`;
    const first = track(
      await findOrCreateProduct({
        title: 'Vase en grès',
        sourceUrl: url,
        categoryId: 'Maison',
        extractedBy: 'json-ld',
        priceCents: 4500,
        imageUrl: 'https://atelier.test/vase.jpg',
        brand: null,
        description: null,
        gtin: null,
        currency: 'EUR',
      }),
    );
    expect(first!.status).toBe('active');

    const second = await findOrCreateProduct({
      title: 'Vase en grès',
      sourceUrl: url,
      categoryId: 'Maison',
      extractedBy: 'title',
      brand: null,
      description: null,
      imageUrl: null,
      gtin: null,
      priceCents: null,
      currency: null,
    });

    expect(second!.id).toBe(first!.id);
    expect(second!.status).toBe('active');
  });
});
