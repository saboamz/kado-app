import { normalizeUrl, urlHash } from './catalogue';

/**
 * The deduplication corpus.
 *
 * This is the guard the whole recommender rests on. A fragmented catalogue is
 * indiscernible from a bad model: the co-occurrence matrix comes back empty,
 * the tier mix never shifts to cf_item, and the obvious response is to spend
 * months tuning a recommender whose real fault is that a tracking parameter
 * was not stripped. Better to fail here, loudly, on a fixture.
 *
 * Each pair carries the verdict it must get. Precision matters more than
 * recall: a missed merge costs signal, a wrong merge puts somebody else's
 * article on a real person's wish list.
 */

type Pair = { why: string; a: string; b: string; same: boolean };

const BASE = 'https://www.merchant.fr/p/theiere-fonte-1l';

const PAIRS: Pair[] = [
  // ---- must merge -------------------------------------------------------
  { why: 'utm_source', same: true, a: BASE, b: `${BASE}?utm_source=newsletter` },
  { why: 'utm family, several', same: true, a: BASE, b: `${BASE}?utm_medium=cpc&utm_campaign=promo&utm_content=a1` },
  { why: 'gclid', same: true, a: BASE, b: `${BASE}?gclid=Cj0KCQiA` },
  { why: 'fbclid', same: true, a: BASE, b: `${BASE}?fbclid=IwAR0abc` },
  { why: 'mc_cid (Mailchimp)', same: true, a: BASE, b: `${BASE}?mc_cid=12ab&mc_eid=34cd` },
  { why: 'http vs https', same: true, a: 'http://merchant.fr/p/x', b: 'https://merchant.fr/p/x' },
  { why: 'with and without www.', same: true, a: 'https://www.merchant.fr/p/x', b: 'https://merchant.fr/p/x' },
  { why: 'trailing slash', same: true, a: 'https://merchant.fr/p/x/', b: 'https://merchant.fr/p/x' },
  { why: '#fragment', same: true, a: 'https://merchant.fr/p/x#avis', b: 'https://merchant.fr/p/x' },
  { why: 'host casing', same: true, a: 'https://MERCHANT.fr/p/x', b: 'https://merchant.fr/p/x' },
  { why: 'parameter order', same: true, a: `${BASE}?color=noir&size=L`, b: `${BASE}?size=L&color=noir` },
  { why: 'default port made explicit', same: true, a: 'https://merchant.fr:443/p/x', b: 'https://merchant.fr/p/x' },
  { why: 'tracking mixed with a real parameter', same: true, a: `${BASE}?color=noir&utm_source=ig&srsltid=zz`, b: `${BASE}?color=noir` },
  { why: 'ref= exact name is tracking', same: true, a: `${BASE}?ref=homepage`, b: BASE },

  // ---- must stay distinct -----------------------------------------------
  { why: 'different paths', same: false, a: 'https://merchant.fr/p/x', b: 'https://merchant.fr/p/y' },
  { why: 'different hosts', same: false, a: 'https://merchant.fr/p/x', b: 'https://other.fr/p/x' },
  { why: 'colour variant', same: false, a: `${BASE}?color=noir`, b: `${BASE}?color=blanc` },
  { why: 'size variant', same: false, a: `${BASE}?size=L`, b: `${BASE}?size=M` },
  // The regression the prefix regex causes. `refurbished` starts with "ref",
  // so /^(ref)/ eats it and merges a second-hand unit into the new one.
  { why: 'refurbished is a real parameter, not a referrer', same: false, a: `${BASE}?refurbished=1`, b: BASE },
  { why: 'refresh is not a referrer either', same: false, a: `${BASE}?refresh=1`, b: BASE },
  { why: 'reference is a product code', same: false, a: `${BASE}?reference=AB12`, b: BASE },
  { why: 'source_material is not source', same: false, a: `${BASE}?source_material=fonte`, b: BASE },
  { why: 'a real port is not a default one', same: false, a: 'https://merchant.fr:8443/p/x', b: 'https://merchant.fr/p/x' },
  { why: 'path case (servers distinguish it)', same: false, a: 'https://merchant.fr/p/X', b: 'https://merchant.fr/p/x' },
];

/** Two links merge iff their hashes match — the production rule, not a proxy. */
const merges = (a: string, b: string) => {
  const na = normalizeUrl(a);
  const nb = normalizeUrl(b);
  return na !== null && nb !== null && urlHash(na) === urlHash(nb);
};

describe('deduplication corpus', () => {
  it('has enough pairs, and both verdicts represented', () => {
    expect(PAIRS.length).toBeGreaterThanOrEqual(14);
    expect(PAIRS.filter((p) => p.same).length).toBeGreaterThan(0);
    expect(PAIRS.filter((p) => !p.same).length).toBeGreaterThan(0);
  });

  for (const pair of PAIRS) {
    it(`${pair.same ? 'merges' : 'keeps apart'}: ${pair.why}`, () => {
      expect(merges(pair.a, pair.b)).toBe(pair.same);
    });
  }

  it('reports recall and precision, and both are perfect', () => {
    const shouldMerge = PAIRS.filter((p) => p.same);
    const shouldNot = PAIRS.filter((p) => !p.same);

    const truePositives = shouldMerge.filter((p) => merges(p.a, p.b)).length;
    const falsePositives = shouldNot.filter((p) => merges(p.a, p.b)).length;

    const recall = truePositives / shouldMerge.length;
    const precision = truePositives / (truePositives + falsePositives);

    // Precision first: a wrong merge is the costlier error, because it puts
    // the wrong article on a real person's list rather than merely losing
    // signal the way a missed merge does.
    expect(precision).toBe(1);
    expect(recall).toBe(1);
  });
});

describe('the corpus can actually fail', () => {
  /**
   * A corpus that cannot fail proves nothing. This replays it against the two
   * wrong implementations that are genuinely tempting, and asserts each one is
   * caught — by the specific pairs that exist to catch it.
   */

  /** The naive fix: drop every query parameter. Merges all variants. */
  const naive = (u: string) => {
    const url = new URL(u);
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}`;
  };

  it('catches a normaliser that strips all parameters', () => {
    const wronglyMerged = PAIRS.filter(
      (p) => !p.same && naive(p.a) === naive(p.b),
    ).map((p) => p.why);

    // Variants and refurbished must be among the casualties — those are the
    // pairs whose whole job is to notice this.
    expect(wronglyMerged).toContain('colour variant');
    expect(wronglyMerged).toContain('refurbished is a real parameter, not a referrer');
    expect(wronglyMerged.length).toBeGreaterThan(0);
  });

  /** The prefix-regex bug the real implementation is written to avoid. */
  const prefixBug = (u: string) => {
    const url = new URL(u);
    const kept = [...url.searchParams.entries()]
      .filter(([k]) => !/^(utm_|gclid|ref|source)/.test(k)) // deliberately wrong
      .sort((a, b) => a[0].localeCompare(b[0]));
    const q = kept.length ? '?' + kept.map(([k, v]) => `${k}=${v}`).join('&') : '';
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${q}`;
  };

  it('catches the ^(ref) prefix regression specifically', () => {
    const casualties = PAIRS.filter(
      (p) => !p.same && prefixBug(p.a) === prefixBug(p.b),
    ).map((p) => p.why);

    expect(casualties).toContain('refurbished is a real parameter, not a referrer');
    expect(casualties).toContain('refresh is not a referrer either');
    expect(casualties).toContain('reference is a product code');
    expect(casualties).toContain('source_material is not source');

    // And the real implementation keeps every one of them apart.
    for (const why of casualties) {
      const pair = PAIRS.find((p) => p.why === why)!;
      expect(merges(pair.a, pair.b)).toBe(false);
    }
  });
});

describe('normalizeUrl refuses what is not a product link', () => {
  it.each(['javascript:alert(1)', 'mailto:a@b.fr', 'data:text/html,x', 'not a url', ''])(
    'returns null for %j',
    (input) => {
      expect(normalizeUrl(input)).toBeNull();
    },
  );
});
