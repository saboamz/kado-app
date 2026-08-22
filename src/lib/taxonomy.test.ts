import { db } from './db';
import {
  CATEGORIES,
  categoriesForInterest,
  categoriesForInterests,
  normalizeLabel,
  SURVEY_INTERESTS,
  unmappedInterests,
} from './taxonomy';

/**
 * The interest → category bridge.
 *
 * This exists because content_facet compared Interest.label to
 * Product.categoryId with strict equality and the two vocabularies had NO
 * overlap: interests read "Café", "Céramique", "Randonnée"; categories read
 * "Maison", "Sport", "Tech", "Voyage". The launch tier could never match, and
 * failed silently.
 */

describe('the vocabularies really were disjoint', () => {
  it('shows why strict equality could never work', () => {
    // The bug, stated as a test. If someone "simplifies" the taxonomy away,
    // this is the assertion that says what they broke.
    const declaredInterests = ['Café', 'Céramique', 'Randonnée', 'Lecture', 'Vélo'];
    const productCategories: string[] = [...CATEGORIES];

    const directMatches = declaredInterests.filter((i) => productCategories.includes(i));
    expect(directMatches).toEqual([]);

    // And every one of them maps to something through the taxonomy.
    for (const interest of declaredInterests) {
      expect(categoriesForInterest(interest).length).toBeGreaterThan(0);
    }
  });
});

describe('normalizeLabel', () => {
  it('folds case and accents so a spelling variant is not lost', () => {
    // A lookup missing on an accent would silently drop that person's whole
    // interest, and nothing downstream would report it.
    expect(normalizeLabel('Café')).toBe(normalizeLabel('CAFE'));
    expect(normalizeLabel('Céramique')).toBe(normalizeLabel('ceramique'));
    expect(normalizeLabel('  Vélo  ')).toBe('velo');
    expect(normalizeLabel('Jeux   Vidéo')).toBe('jeux video');
  });

  it('keeps genuinely different labels apart', () => {
    expect(normalizeLabel('Café')).not.toBe(normalizeLabel('Thé'));
  });
});

describe('categoriesForInterest', () => {
  it.each([
    ['Café', 'Gourmandise'],
    ['Céramique', 'Maison'],
    ['Randonnée', 'Sport'],
    ['Lecture', 'Culture'],
    ['Vélo', 'Sport'],
    // Jardinage used to fall into Maison for want of anywhere better; the
    // enriched list gives it its own bucket.
    ['Jardinage', 'Jardin'],
    ['Bricolage', 'Bricolage'],
    ['Bijoux', 'Bijoux'],
    ['Design', 'Maison'],
  ])('maps %s to %s', (interest, expected) => {
    expect(categoriesForInterest(interest)).toContain(expected);
  });

  it('maps an interest that spans two worlds to both', () => {
    // "Café" is a kitchen object and a consumable; someone who says it may
    // want either, and picking one would silently halve their candidates.
    expect(categoriesForInterest('Café')).toEqual(
      expect.arrayContaining(['Gourmandise', 'Maison']),
    );
    expect(categoriesForInterest('Randonnée')).toEqual(
      expect.arrayContaining(['Sport', 'Voyage']),
    );
  });

  it('returns nothing for an interest nobody mapped', () => {
    // Deliberate: guessing a category for an unknown word files products under
    // a guess, and a wrong recommendation is worse than none.
    expect(categoriesForInterest('Spéléologie')).toEqual([]);
    expect(categoriesForInterest('')).toEqual([]);
  });

  it('only ever returns declared categories', () => {
    // A typo in the table would produce a categoryId no product carries, and
    // the tier would go quietly empty again — the exact failure this replaced.
    const declared = new Set<string>(CATEGORIES);
    for (const interest of ['Café', 'Vélo', 'Parfum', 'Camping', 'Bijoux']) {
      for (const category of categoriesForInterest(interest)) {
        expect(declared.has(category)).toBe(true);
      }
    }
  });
});

describe('categoriesForInterests', () => {
  it('unions several interests without duplicates', () => {
    const categories = categoriesForInterests(['Café', 'Thé', 'Céramique']);
    expect(new Set(categories).size).toBe(categories.length);
    expect(categories).toEqual(expect.arrayContaining(['Gourmandise', 'Maison']));
  });

  it('is empty for a person whose interests are all unmapped', () => {
    expect(categoriesForInterests(['Spéléologie', 'Fauconnerie'])).toEqual([]);
  });
});

describe('unmappedInterests keeps the table honest', () => {
  it('names what the table does not know', () => {
    // The measurement that stops this degrading back into the silent failure
    // it replaced: a mapping nobody maintains stops matching, and without a
    // way to see that, nobody finds out.
    expect(unmappedInterests(['Café', 'Spéléologie', 'Vélo'])).toEqual(['Spéléologie']);
  });

  it('reports nothing when everything is mapped', () => {
    expect(unmappedInterests(['Café', 'Vélo'])).toEqual([]);
  });

  it('covers every interest currently in the database', async () => {
    // The real check, against real data rather than a fixture. If someone
    // declares an interest the table has never heard of, content_facet gives
    // them nothing — so this fails loudly instead.
    const interests = await db.interest.findMany({ select: { label: true } });
    const labels = interests.map((i) => i.label);

    if (labels.length === 0) {
      // Nothing to check, and saying so beats a green tick that means nothing.
      expect(labels).toEqual([]);
      await db.$disconnect();
      return;
    }

    expect(unmappedInterests(labels)).toEqual([]);
    await db.$disconnect();
  });
});

describe('the sign-up questionnaire', () => {
  it('offers only interests the table can map', () => {
    // An offered interest that maps to nothing produces an Interest row
    // content_facet cannot use — the silent failure this table exists to end,
    // reintroduced through the one form that fills the table for new accounts.
    expect(unmappedInterests([...SURVEY_INTERESTS])).toEqual([]);
  });

  it('offers no duplicates, including across accents and case', () => {
    const normalized = SURVEY_INTERESTS.map(normalizeLabel);
    expect(new Set(normalized).size).toBe(SURVEY_INTERESTS.length);
  });

  it('reaches most of the catalogue, so a ticked box is worth ticking', () => {
    // Every category bar the escape hatch should be reachable from the grid;
    // one that is not means products filed there can never be suggested to
    // somebody who answered the questionnaire and nothing else.
    const reached = new Set(categoriesForInterests([...SURVEY_INTERESTS]));
    const missing = CATEGORIES.filter((c) => c !== 'Autre' && !reached.has(c));
    expect(missing).toEqual([]);
  });
});
