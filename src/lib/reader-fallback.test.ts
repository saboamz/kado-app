import { judge } from './catalogue-quality';
import { extractProduct, EMPTY } from './extract';
import { normaliseCurrency } from './reader-fallback';

/**
 * Reading a shop that refuses us, through the proxy.
 *
 * The fixtures below are trimmed from what r.jina.ai actually returned for
 * two real merchant pages when asked for HTML rather than Markdown — the
 * markup the merchant published, not a rendering of it. That difference is
 * the whole design: prose has to be guessed at, markup states the price.
 */
const citadiumHtml = `<html><head>
<title>Casquette Carhartt wip Harlem cap Beige - Homme | Citadium</title>
<meta property="og:title" content="Casquette Carhartt wip Harlem cap Beige">
<meta property="og:image" content="https://media.citadium.com/cap.jpg">
<meta property="product:price:amount" content="20">
<meta property="product:price:currency" content="Euro">
</head><body></body></html>`;

const cdiscountHtml = `<html><head><title>Console Nintendo Switch 2</title>
<script type="application/ld+json">
{"@type":"Product","name":"Console Nintendo Switch 2 • Bleu Clair & Rouge Clair",
 "gtin13":"0045496321444","image":"https://cdiscount.com/switch.jpg",
 "offers":{"price":"419.99","priceCurrency":"EUR"}}
</script></head><body></body></html>`;

// A shop that geolocates: the proxy reaches it from elsewhere and is quoted
// in dollars for an article sold in euros.
const geolocatedHtml = `<html><head><title>Shaggy Dog Sweater</title>
<script type="application/ld+json">
{"@type":"Product","name":"Shaggy Dog Sweater - Cream",
 "offers":{"price":"243.00","priceCurrency":"USD"}}
</script></head><body></body></html>`;

describe('what the proxy gives back', () => {
  it('yields a price where guessing at prose could not', () => {
    /*
     * Citadium renders "20€39€-45%" as text, and every rule tried against
     * that gave either 20, 39 or 20.39 depending on the page it was tuned
     * for. The markup simply says 20.
     */
    const extracted = extractProduct(citadiumHtml);
    expect(extracted.priceCents).toBe(2000);
    expect(extracted.title).toBe('Casquette Carhartt wip Harlem cap Beige');
  });

  it('yields the structured extras too', () => {
    // A GTIN is the only globally unique key there is, and prose never
    // carries one.
    const extracted = extractProduct(cdiscountHtml);
    expect(extracted.priceCents).toBe(41999);
    expect(extracted.gtin).toBe('0045496321444');
    expect(extracted.imageUrl).toContain('switch.jpg');
  });
});

describe('the currency a price is quoted in', () => {
  it('accepts the ISO code and the word', () => {
    // "Euro" spelled out is Citadium's Open Graph tag.
    expect(normaliseCurrency('EUR')).toBe('EUR');
    expect(normaliseCurrency('Euro')).toBe('EUR');
    expect(normaliseCurrency('euros')).toBe('EUR');
    expect(normaliseCurrency('€')).toBe('EUR');
  });

  it('refuses one we cannot store', () => {
    /*
     * Not "unknown, assume euros".
     *
     * Suuupply quotes the proxy 243.00 USD for a jumper it sells at 165 €,
     * because the proxy reaches it from somewhere else. Storing that as euros
     * would put a figure on somebody's wish that is wrong by half, and
     * nothing downstream would ever question it.
     */
    expect(normaliseCurrency('USD')).toBeNull();
    expect(normaliseCurrency('GBP')).toBeNull();
    expect(normaliseCurrency(null)).toBeNull();
    expect(normaliseCurrency('')).toBeNull();
  });

  it('is what decides whether a geolocated price is kept', () => {
    // The extraction succeeds; it is the currency check that must drop it.
    const extracted = extractProduct(geolocatedHtml);
    expect(extracted.priceCents).toBe(24300);
    expect(normaliseCurrency(extracted.currency)).toBeNull();
  });
});

describe('what a reader row is allowed to become', () => {
  const fromReader = (over: Partial<typeof EMPTY>) =>
    judge({ ...EMPTY, extractedBy: 'reader' as const, ...over });

  it('is active once it carries a price', () => {
    // The point of asking for HTML: a described row, not a bare name.
    expect(
      fromReader({ title: 'Casquette Carhartt', priceCents: 2000 }).kind,
    ).toBe('active');
  });

  it('is quarantined when the page named it and nothing more', () => {
    expect(fromReader({ title: 'Adhésion annuelle' })).toEqual({
      kind: 'quarantine',
      reason: 'thin',
    });
  });

  it.each(['Captcha', '404 Not Found', 'Access denied'])(
    'refuses %s outright',
    (title) => {
      // The proxy gets past a shop's refusal, and will happily render the
      // refusal page itself. Left out of the "weak" set, those would have
      // sailed in — the exact failure the quality gate exists for.
      expect(fromReader({ title }).kind).toBe('reject');
    },
  );
});
