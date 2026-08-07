import { giftSchema, listSchema } from './validation';

describe('gift validation', () => {
  /**
   * FormData yields null for an input the form does not render. The first
   * version of this schema used .optional(), which rejects null, so adding a
   * wish failed with "merchant: Invalid input" — an error the form could not
   * even display, because it has no merchant field. Hence these cases.
   */
  it('accepts nulls for fields the form does not render', () => {
    const parsed = giftSchema.safeParse({
      name: 'Une théière',
      description: null,
      price: null,
      url: null,
      merchant: null,
      category: null,
      priority: '2',
      isPot: false,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.merchant).toBe('');
  });

  it('accepts a payload with only the fields the form actually sends', () => {
    const parsed = giftSchema.safeParse({
      name: 'Une théière',
      priority: '2',
    });
    expect(parsed.success).toBe(true);
  });

  it('trims the optional text it does receive', () => {
    const parsed = giftSchema.safeParse({
      name: 'X',
      priority: 2,
      category: '  Maison  ',
    });
    expect(parsed.success && parsed.data.category).toBe('Maison');
  });

  it('needs only a name', () => {
    // "Un week-end en Islande" is a real wish with no price, link or shop.
    const parsed = giftSchema.safeParse({
      name: 'Un week-end en Islande',
      priority: 2,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a nameless wish', () => {
    expect(giftSchema.safeParse({ name: '   ', priority: 2 }).success).toBe(
      false,
    );
  });

  it.each([
    ['a full url', 'https://apple.com/airpods'],
    ['a bare domain', 'apple.com/airpods'],
    ['nothing at all', ''],
  ])('accepts %s', (_label, url) => {
    expect(giftSchema.safeParse({ name: 'X', priority: 2, url }).success).toBe(
      true,
    );
  });

  it('rejects something that is not a link', () => {
    const parsed = giftSchema.safeParse({
      name: 'X',
      priority: 2,
      url: 'pas un lien',
    });
    expect(parsed.success).toBe(false);
  });

  it.each([0, 4, -1])('rejects priority %i', (priority) => {
    expect(giftSchema.safeParse({ name: 'X', priority }).success).toBe(false);
  });

  it('coerces the priority arriving as a form string', () => {
    const parsed = giftSchema.safeParse({ name: 'X', priority: '3' });
    expect(parsed.success && parsed.data.priority).toBe(3);
  });
});

describe('list validation', () => {
  it('accepts a null occasion, as an unfilled form sends', () => {
    const parsed = listSchema.safeParse({
      name: 'Noël',
      occasion: null,
      visibility: 'FRIENDS',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a named list', () => {
    const parsed = listSchema.safeParse({
      name: '  Noël  ',
      visibility: 'FRIENDS',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.name).toBe('Noël');
  });

  it('rejects a blank name', () => {
    expect(
      listSchema.safeParse({ name: '  ', visibility: 'FRIENDS' }).success,
    ).toBe(false);
  });

  it('rejects an unknown visibility', () => {
    expect(
      listSchema.safeParse({ name: 'X', visibility: 'EVERYONE' }).success,
    ).toBe(false);
  });
});

describe('the category is a closed list', () => {
  const base = {
    name: 'Casque',
    description: null,
    price: '',
    url: '',
    merchant: '',
    priority: 2,
  };

  it('accepts a canonical category', () => {
    for (const category of ['Maison', 'Jardin', 'Bijoux', 'Autre']) {
      expect(giftSchema.safeParse({ ...base, category }).success).toBe(true);
    }
  });

  it('refuses anything off the list', () => {
    // The reason the field stopped being free text: the recommender matches
    // on this value, so "Tech", "tech" and "High-tech" were three buckets
    // nobody shared, and content_facet quietly found less as the catalogue
    // grew. Every spelling that is not canonical is refused at the door.
    for (const category of ['tech', 'High-tech', 'Cuisine', 'inventé']) {
      const parsed = giftSchema.safeParse({ ...base, category });
      expect(parsed.success).toBe(false);
    }
  });

  it('still allows no category at all', () => {
    // "Un week-end en Islande" has no obvious bucket, and forcing a choice
    // would push people into picking one at random — worse than none.
    for (const category of ['', null, undefined]) {
      expect(giftSchema.safeParse({ ...base, category }).success).toBe(true);
    }
  });
});
