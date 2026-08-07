import { db } from './db';
import { linkGiftToProduct } from './gift-product-link';
import { findOrCreateProduct } from './product-resolve';
import { LINK_FETCH_PER_USER } from './rate-limit';
import { cleanup, makeGift, makeList, makeUser } from '@/test/factories';

/**
 * Attaching a wish to the catalogue.
 *
 * The machinery for this existed and was tested; what was missing was anybody
 * calling it. Product stayed empty in production, Gift.productId stayed null,
 * and the two recommender tiers that read them could never fire.
 *
 * The property that matters most here is not that linking works — it is that
 * FAILING to link costs nothing. A merchant that is slow, paywalled,
 * JS-rendered or hostile to bots is an ordinary Tuesday, and none of it may
 * take a person's gift down with it.
 */
const created: string[] = [];

let owner: { id: string };
let listId: string;

beforeAll(async () => {
  owner = await makeUser('Catalogue Owner');
  listId = (await makeList(owner.id)).id;
});

afterAll(async () => {
  await db.product.deleteMany({ where: { id: { in: created } } });
  await cleanup([owner.id]);
  await db.$disconnect();
});

describe('a link we cannot resolve leaves the gift alone', () => {
  it('does nothing when the gift has no URL', async () => {
    const gift = await makeGift(listId, { name: 'Un week-end en Islande' });

    // The wish with no link is not a failure mode, it is the normal case for
    // anything that is not a product.
    expect(await linkGiftToProduct(gift.id, null, 'Voyage', owner.id)).toBeNull();

    const after = await db.gift.findUnique({ where: { id: gift.id } });
    expect(after?.productId).toBeNull();
    expect(after?.name).toBe('Un week-end en Islande');
  });

  it('refuses a URL the SSRF guard rejects, without throwing', async () => {
    const gift = await makeGift(listId, { name: 'Cadeau douteux' });

    // A pasted link is attacker-controlled and this runs server-side. The
    // guard has its own suite; what matters here is that a refusal returns
    // rather than raising into the caller's save.
    for (const url of [
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:3000/admin',
      'file:///etc/passwd',
    ]) {
      await expect(linkGiftToProduct(gift.id, url, null, owner.id)).resolves.toBeNull();
    }

    expect((await db.gift.findUnique({ where: { id: gift.id } }))?.productId).toBeNull();
  });

  it('survives a host that does not exist', async () => {
    const gift = await makeGift(listId, { name: 'Lien mort' });

    // DNS failure, connection refused, timeout — all the same to the caller:
    // the gift is already saved and stays exactly as it was.
    const linked = await linkGiftToProduct(
      gift.id,
      'https://this-host-does-not-exist-kado-test.invalid/p/1',
      'Tech',
      owner.id,
    );

    expect(linked).toBeNull();
    const after = await db.gift.findUnique({ where: { id: gift.id } });
    expect(after).not.toBeNull();
    expect(after?.productId).toBeNull();
  });
});

describe('the category comes from the person who made the wish', () => {
  it('files a new product under the category they chose', async () => {
    // A merchant page does not carry our taxonomy, so this is the only place
    // the value can come from — and the list is closed, so what they picked
    // is already canonical.
    const product = await findOrCreateProduct({
      title: 'Vélo de ville Reine Bike',
      brand: 'Reine Bike',
      description: null,
      imageUrl: null,
      gtin: null,
      priceCents: 159900,
      currency: 'EUR',
      extractedBy: 'json-ld',
      sourceUrl: 'https://merchant-cat-test.fr/p/velo',
      categoryId: 'Sport',
    });
    if (product) created.push(product.id);

    expect(product?.categoryId).toBe('Sport');
  });

  it('does not recategorise a product somebody already filed', async () => {
    // Gaps only, like every other field here. The second wisher picking
    // differently must not silently move everyone else's row — that would
    // make the category a race between whoever saved last.
    const first = await findOrCreateProduct({
      title: 'Casque Sony',
      brand: 'Sony',
      description: null,
      imageUrl: null,
      gtin: null,
      priceCents: 39900,
      currency: 'EUR',
      extractedBy: 'json-ld',
      sourceUrl: 'https://merchant-cat-test.fr/p/casque',
      categoryId: 'Tech',
    });
    if (first) created.push(first.id);

    const second = await findOrCreateProduct({
      title: 'Casque Sony',
      brand: 'Sony',
      description: null,
      imageUrl: null,
      gtin: null,
      priceCents: 39900,
      currency: 'EUR',
      extractedBy: 'json-ld',
      sourceUrl: 'https://merchant-cat-test.fr/p/casque',
      categoryId: 'Musique',
    });

    expect(second?.id).toBe(first?.id);
    expect(second?.categoryId).toBe('Tech');
  });

  it('accepts a product with no category at all', async () => {
    const product = await findOrCreateProduct({
      title: 'Objet sans catégorie',
      brand: null,
      description: null,
      imageUrl: null,
      gtin: null,
      priceCents: 1000,
      currency: 'EUR',
      extractedBy: 'title',
      sourceUrl: 'https://merchant-cat-test.fr/p/sans',
      categoryId: null,
    });
    if (product) created.push(product.id);

    expect(product?.categoryId).toBeNull();
  });
});

describe('an existing link is not overwritten', () => {
  it('leaves a gift that already points at a product', async () => {
    const gift = await makeGift(listId, { name: 'Déjà lié' });
    const product = await findOrCreateProduct({
      title: 'Produit déjà lié',
      brand: null,
      description: null,
      imageUrl: null,
      gtin: null,
      priceCents: 2500,
      currency: 'EUR',
      extractedBy: 'json-ld',
      sourceUrl: 'https://merchant-cat-test.fr/p/deja',
      categoryId: 'Maison',
    });
    if (product) created.push(product.id);

    await db.gift.update({
      where: { id: gift.id },
      data: { productId: product!.id },
    });

    // The update inside linkGiftToProduct is scoped to `productId: null`, so
    // a slow request that finishes after the wisher edited the link again
    // cannot clobber the newer decision.
    await linkGiftToProduct(
      gift.id,
      'https://this-host-does-not-exist-kado-test.invalid/p/2',
      'Tech',
      owner.id,
    );

    const after = await db.gift.findUnique({ where: { id: gift.id } });
    expect(after?.productId).toBe(product!.id);
  });
});

describe('outbound reads are budgeted per person', () => {
  afterEach(async () => {
    await db.authAttempt.deleteMany({ where: { key: { startsWith: 'link:fetch:' } } });
  });

  it('stops fetching once the hourly budget is spent', async () => {
    // Saving a gift with a link makes OUR server fetch a URL somebody else
    // chose. Unbounded, a loop of saves turns the app into a relay pointed
    // wherever they like, and spends the function quota doing it.
    const gift = await makeGift(listId, { name: 'Budget' });
    const key = `link:fetch:${owner.id.toLowerCase()}`;

    await db.authAttempt.createMany({
      data: Array.from({ length: LINK_FETCH_PER_USER.attempts }, () => ({ key })),
    });

    const before = await db.authAttempt.count({ where: { key } });
    const linked = await linkGiftToProduct(
      gift.id,
      'https://this-host-does-not-exist-kado-test.invalid/p/3',
      'Tech',
      owner.id,
    );

    expect(linked).toBeNull();
    // Refused before the request, so nothing more was recorded either.
    expect(await db.authAttempt.count({ where: { key } })).toBe(before);
  });

  it('counts a successful read as well as a failed one', async () => {
    // Unlike the sign-in limiter, where only failures count: there the thing
    // being limited is guessing, here it is the request itself, and a
    // successful fetch costs exactly as much as a failed one.
    const gift = await makeGift(listId, { name: 'Compte' });
    const key = `link:fetch:${owner.id.toLowerCase()}`;

    await linkGiftToProduct(
      gift.id,
      'https://this-host-does-not-exist-kado-test.invalid/p/4',
      'Tech',
      owner.id,
    );

    expect(await db.authAttempt.count({ where: { key } })).toBe(1);
  });

  it('gives each person their own budget', async () => {
    // One person exhausting theirs must not stop everybody else adding wishes.
    const other = await makeUser('Autre Personne');
    const gift = await makeGift(listId, { name: 'Séparé' });
    const mine = `link:fetch:${owner.id.toLowerCase()}`;

    await db.authAttempt.createMany({
      data: Array.from({ length: LINK_FETCH_PER_USER.attempts }, () => ({ key: mine })),
    });

    // Theirs is untouched, so their attempt is recorded rather than refused.
    await linkGiftToProduct(
      gift.id,
      'https://this-host-does-not-exist-kado-test.invalid/p/5',
      'Tech',
      other.id,
    );

    expect(
      await db.authAttempt.count({ where: { key: `link:fetch:${other.id.toLowerCase()}` } }),
    ).toBe(1);
    await cleanup([other.id]);
  });
});
