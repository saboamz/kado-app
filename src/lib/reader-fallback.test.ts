import { judge } from './catalogue-quality';
import { EMPTY } from './extract';
import { readerTitle } from './reader-fallback';

/**
 * The fallback for a shop that refuses to talk to us.
 *
 * These fixtures are the opening lines of what r.jina.ai actually returned
 * for three real merchant pages — two that answer 403 or a captcha to a
 * direct request, and one that reads fine and therefore never reaches this
 * path.
 */
const citadium = `Title: Casquette Carhartt wip Harlem cap Beige - Homme | Citadium

URL Source: https://www.citadium.com/fr/fr/carhartt-casquette-beige-homme-10265644

Markdown Content:
# [carhartt wip](https://www.citadium.com/fr/fr/carhartt-homme) Harlem Cap - Casquette | Beige

20€39€-45%
`;

const cdiscount = `Title: Console Nintendo Switch 2 • Bleu Clair & Rouge Clair

URL Source: https://www.cdiscount.com/jeux-pc-video-console/nintendo-switch/f-10328.html

Markdown Content:
419 €99
`;

describe('the product name from a rendered page', () => {
  it('reads the title the proxy puts on the first line', () => {
    expect(readerTitle(citadium)).toBe('Casquette Carhartt wip Harlem cap Beige - Homme');
  });

  it('drops the shop name appended to it', () => {
    // "… | Citadium" is chrome, and leaving it in would give two shops
    // selling the same article two different title keys.
    expect(readerTitle(citadium)).not.toContain('Citadium');
  });

  it('leaves a title alone when nothing shop-like is appended', () => {
    expect(readerTitle(cdiscount)).toBe('Console Nintendo Switch 2 • Bleu Clair & Rouge Clair');
  });

  it('keeps a long trailing segment, which is part of the name', () => {
    // Only a short tail is a shop. "… - Édition Collector Limitée 2026" is
    // what the thing is called.
    const md = 'Title: Coffret - Édition Collector Limitée Numérotée 2026\n';
    expect(readerTitle(md)).toBe('Coffret - Édition Collector Limitée Numérotée 2026');
  });

  it('gives nothing when there is no title line', () => {
    expect(readerTitle('Markdown Content:\nrien du tout')).toBeNull();
    expect(readerTitle('Title:   \n')).toBeNull();
  });
});

describe('what a reader row is allowed to become', () => {
  const fromReader = (title: string) =>
    judge({ ...EMPTY, title, extractedBy: 'reader' as const });

  it('is quarantined, never active', () => {
    /*
     * A title and nothing else — no price, no image, because this path takes
     * the name only. That is the same evidence as the <title> fallback, so it
     * gets the same answer: kept, and held back from the recommender until a
     * better read arrives.
     */
    expect(fromReader('Casquette Carhartt wip Harlem cap Beige')).toEqual({
      kind: 'quarantine',
      reason: 'thin',
    });
  });

  it.each(['Captcha', '404 Not Found', 'Access denied'])(
    'refuses %s outright',
    (title) => {
      // The proxy gets past a shop's refusal, but it will happily render the
      // refusal page itself. Left out of the "weak" set, those would have
      // sailed in as active — the exact failure the quality gate exists for.
      expect(fromReader(title).kind).toBe('reject');
    },
  );
});
