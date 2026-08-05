import { parsePrice, priceBand, titleKey } from './catalogue';

/**
 * Price parsing, where the failure mode is a factor of 100.
 *
 * A price read wrong by 100× does not crash anything. It lands in the wrong
 * band and quietly poisons every price-filtered recommendation, and there is
 * nothing in the output that looks wrong when you read it.
 */
describe('parsePrice', () => {
  it.each([
    ['12,99 €', 1299],
    ['12.99', 1299],
    ['€12.99', 1299],
    ['1 299,00 €', 129900],
    ['1,299.00', 129900],
    ['1.299,00', 129900],
    ['0,99', 99],
    ['1000', 100000],
    ['5', 500],
    ['12,9', 1290], // one decimal is tenths, not hundredths
  ])('parses %j as %i cents', (input, cents) => {
    expect(parsePrice(input)).toBe(cents);
  });

  it('reads three trailing digits as thousands, not millidecimals', () => {
    // '1.299' is the ambiguous case. Three digits and no other separator is a
    // thousands group in every real catalogue: 1 299 €, not 1,29 €.
    expect(parsePrice('1.299')).toBe(129900);
    expect(parsePrice('1,299')).toBe(129900);
    expect(parsePrice('12.500')).toBe(1250000);
  });

  it('handles the invisible separators French prices actually carry', () => {
    // Scraped French prices use U+00A0 and U+202F. They look like spaces and
    // are not, so a naive /\s/ strip leaves them and Number() returns NaN.
    expect(parsePrice('1 299,00 €')).toBe(129900);
    expect(parsePrice('1 299,00 €')).toBe(129900);
    expect(parsePrice('29,90 €')).toBe(2990);
  });

  it('refuses the ambiguous rather than guessing', () => {
    // Four decimals is not a price. Returning null makes the caller ask the
    // user; guessing would put a wrong number in the catalogue silently.
    expect(parsePrice('1.2999')).toBeNull();
    expect(parsePrice('12,3456')).toBeNull();
    // Two separators where the last group is three digits: 1.234,567 cannot be
    // resolved — the comma reads as decimal but 567 is not a cents value.
    expect(parsePrice('1.234,567')).toBeNull();
  });

  it.each(['', 'gratuit', 'Prix sur demande', '-5,00', 'abc'])(
    'returns null for %j',
    (input) => {
      expect(parsePrice(input)).toBeNull();
    },
  );

  it('never returns a fractional cent', () => {
    for (const input of ['12,99', '1.299', '0,01', '999,95', '1 000,50']) {
      const cents = parsePrice(input);
      if (cents !== null) expect(Number.isInteger(cents)).toBe(true);
    }
  });
});

describe('priceBand', () => {
  it('bands ascending, and never crosses', () => {
    const cents = [500, 2000, 4500, 9000, 20000, 40000, 90000];
    const bands = cents.map(priceBand);
    expect(bands).toEqual([...bands].sort((a, b) => a! - b!));
    expect(new Set(bands).size).toBe(bands.length);
  });

  it('has no band for an unknown price', () => {
    expect(priceBand(null)).toBeNull();
    expect(priceBand(-1)).toBeNull();
  });
});

describe('titleKey', () => {
  it('folds case, accents and punctuation so variants of one title meet', () => {
    expect(titleKey('Théière en Fonte 1,2L')).toBe(titleKey('theiere en fonte 1 2l'));
    expect(titleKey('Vase  en   grès')).toBe(titleKey('Vase en grès'));
    expect(titleKey('AirPods Pro (2ᵉ génération)')).toBe(titleKey('airpods pro 2 génération'));
  });

  it('keeps genuinely different titles apart', () => {
    expect(titleKey('Théière en fonte')).not.toBe(titleKey('Théière en verre'));
    expect(titleKey('AirPods Pro 2')).not.toBe(titleKey('AirPods Pro 3'));
  });

  it('has no key for a title with nothing in it', () => {
    expect(titleKey('')).toBeNull();
    expect(titleKey('!!! ???')).toBeNull();
  });
});
