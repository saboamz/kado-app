import { db } from './db';
import { merchantDomain, merchantName, merchantSlug } from './merchants';
import { findOrCreateProduct } from './product-resolve';

/**
 * Which shop a link belongs to.
 *
 * The table was empty in production, and an empty Merchant table is not a
 * cosmetic gap: `Product.merchantId` was null on every row, so the
 * (merchantId, titleKey) deduplication key never formed and the "at most 2
 * per merchant" diversity cap could never bind. Both read a column nothing
 * ever wrote.
 */
const productIds: string[] = [];
const merchantIds: string[] = [];

afterAll(async () => {
  await db.product.deleteMany({ where: { id: { in: productIds } } });
  await db.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  await db.$disconnect();
});

describe('the domain a shop is identified by', () => {
  it.each([
    ['suuupply.com', 'suuupply.com'],
    ['www.suuupply.com', 'suuupply.com'],
    ['shop.suuupply.com', 'suuupply.com'],
    ['boutique.la-brulerie.fr', 'la-brulerie.fr'],
  ])('folds %s to %s', (host, expected) => {
    // A storefront prefix is the same shop wearing a hat.
    expect(merchantDomain(host)).toBe(expected);
  });

  it('keeps three labels for a multi-part TLD', () => {
    // amazon.co.uk must group as one shop, not as "co.uk" — which would file
    // every British retailer under a single merchant.
    expect(merchantDomain('amazon.co.uk')).toBe('amazon.co.uk');
    expect(merchantDomain('www.amazon.co.uk')).toBe('amazon.co.uk');
  });

  it('leaves an unfamiliar subdomain as its own shop', () => {
    // Erring towards two merchants costs a missed deduplication. Erring the
    // other way merges two shops, and a wrong merge puts somebody else's
    // article on a real wish list.
    expect(merchantDomain('marketplace.acme.com')).toBe('marketplace.acme.com');
  });

  it.each(['localhost', 'x', '', '   '])('refuses %s', (host) => {
    expect(merchantDomain(host)).toBeNull();
  });
});

describe('naming a shop', () => {
  it('reads a name out of the domain', () => {
    expect(merchantName('suuupply.com')).toBe('Suuupply');
    expect(merchantName('la-brulerie.fr')).toBe('La Brulerie');
  });

  it('keys the row on something URL-safe', () => {
    expect(merchantSlug('amazon.co.uk')).toBe('amazon-co-uk');
  });
});

describe('resolving a product', () => {
  it('creates the merchant the first time its domain is seen', async () => {
    const domain = `boutique-${Date.now()}.fr`;
    const product = await findOrCreateProduct({
      title: 'Théière en fonte',
      sourceUrl: `https://${domain}/theiere`,
      categoryId: 'Maison',
      extractedBy: 'json-ld',
      priceCents: 4500,
      imageUrl: `https://${domain}/t.jpg`,
      brand: null,
      description: null,
      gtin: null,
      currency: 'EUR',
    });
    productIds.push(product!.id);

    expect(product!.merchantId).not.toBeNull();
    merchantIds.push(product!.merchantId!);

    const merchant = await db.merchant.findUnique({
      where: { id: product!.merchantId! },
    });
    expect(merchant!.domains).toContain(domain);
  });

  it('puts two links from the same shop under one merchant', async () => {
    // The whole point: without this, the second deduplication key never forms
    // and one shop can fill an entire list of suggestions.
    const domain = `atelier-${Date.now()}.fr`;
    const common = {
      categoryId: 'Maison',
      extractedBy: 'json-ld' as const,
      priceCents: 3000,
      imageUrl: `https://${domain}/x.jpg`,
      brand: null,
      description: null,
      gtin: null,
      currency: 'EUR',
    };

    const first = await findOrCreateProduct({
      ...common,
      title: 'Bol bleu',
      sourceUrl: `https://${domain}/bol-bleu`,
    });
    const second = await findOrCreateProduct({
      ...common,
      title: 'Bol vert',
      // A storefront subdomain of the same shop.
      sourceUrl: `https://shop.${domain}/bol-vert`,
    });
    productIds.push(first!.id, second!.id);
    merchantIds.push(first!.merchantId!);

    expect(second!.merchantId).toBe(first!.merchantId);
  });

  it('keeps two variants apart even though they share a shop and a title', async () => {
    /*
     * The trap that opened the moment merchants started existing.
     *
     * Before that, merchantId was always null and the (merchantId, titleKey)
     * key never formed. Live, it matches two colours of the same jumper —
     * same shop, same title, different URL — and would put the black one on
     * the list of somebody who asked for white. Worse, the unique index would
     * refuse to store the second variant at all.
     */
    const domain = `variantes-${Date.now()}.fr`;
    const common = {
      title: 'Pull en laine',
      categoryId: 'Mode',
      extractedBy: 'json-ld' as const,
      priceCents: 12000,
      imageUrl: `https://${domain}/p.jpg`,
      brand: null,
      description: null,
      gtin: null,
      currency: 'EUR',
    };

    const black = await findOrCreateProduct({
      ...common,
      sourceUrl: `https://${domain}/pull?couleur=noir`,
    });
    const white = await findOrCreateProduct({
      ...common,
      sourceUrl: `https://${domain}/pull?couleur=blanc`,
    });
    productIds.push(black!.id, white!.id);
    merchantIds.push(black!.merchantId!);

    expect(white!.id).not.toBe(black!.id);
    // Same shop, so the diversity cap still sees them as one merchant.
    expect(white!.merchantId).toBe(black!.merchantId);
    // And neither carries a title key, because each has a URL to be known by.
    expect(black!.titleKey).toBeNull();
    expect(white!.titleKey).toBeNull();
  });

  it('remembers each spelling of the host it has seen', async () => {
    const domain = `epicerie-${Date.now()}.fr`;
    const first = await findOrCreateProduct({
      title: 'Miel',
      sourceUrl: `https://${domain}/miel`,
      categoryId: 'Gourmandise',
      extractedBy: 'json-ld',
      priceCents: 900,
      imageUrl: `https://${domain}/m.jpg`,
      brand: null,
      description: null,
      gtin: null,
      currency: 'EUR',
    });
    await findOrCreateProduct({
      title: 'Confiture',
      sourceUrl: `https://shop.${domain}/confiture`,
      categoryId: 'Gourmandise',
      extractedBy: 'json-ld',
      priceCents: 700,
      imageUrl: `https://${domain}/c.jpg`,
      brand: null,
      description: null,
      gtin: null,
      currency: 'EUR',
    });
    productIds.push(first!.id);
    merchantIds.push(first!.merchantId!);

    const merchant = await db.merchant.findUnique({
      where: { id: first!.merchantId! },
    });
    // Both spellings, so the next lookup matches on the first query rather
    // than falling through to the registrable domain every time.
    expect(merchant!.domains).toEqual(
      expect.arrayContaining([domain, `shop.${domain}`]),
    );
  });
});
