import { judge, isNonProductTitle } from './catalogue-quality';
import { extractProduct } from './extract';

/**
 * What is allowed into the catalogue, and what is held back.
 *
 * Written against real HTML rather than hand-built objects, because the thing
 * being judged is what the extractor produces — and the whole reason the
 * naive filter was wrong is that a legitimate gift and a captcha page come
 * out of it with identical signatures.
 */

const page = {
  jsonLd: `<html><head><title>Pull</title>
    <script type="application/ld+json">
    {"@type":"Product","name":"Pull Shaggy Dog en laine - Crème",
     "image":"https://x/p.jpg","offers":{"price":"165.00","priceCurrency":"EUR"}}
    </script></head></html>`,

  // A real gift on a shop that publishes an image but no structured price.
  artisan: `<html><head>
    <meta property="og:title" content="Bol en grès émaillé bleu">
    <meta property="og:image" content="https://x/bol.jpg"></head></html>`,

  // A real gift on a site that publishes nothing at all.
  association: `<html><head><title>Adhésion annuelle - Les Amis du Vélo</title></head></html>`,

  captcha: `<html><head><title>Captcha</title></head></html>`,
  notFound: `<html><head><title>404 Not Found</title></head></html>`,

  // Structured product data behind a bot-check title.
  jsonLdBehindBotCheck: `<html><head><title>Just a moment...</title>
    <script type="application/ld+json">
    {"@type":"Product","name":"Livre rare","offers":{"price":"42.00"}}
    </script></head></html>`,
};

describe('pages that are never products', () => {
  it.each([
    'Captcha',
    'Just a moment...',
    '404 Not Found',
    'Access denied',
    'Accès refusé',
    'Vérification',
    'Service Unavailable',
    'Page not found',
  ])('refuses %s', (title) => {
    expect(isNonProductTitle(title)).toBe(true);
  });

  it('strips a merchant name appended to the title', () => {
    // "404 Not Found | Ma Boutique" is the same page state.
    expect(isNonProductTitle('404 Not Found | Ma Boutique')).toBe(true);
  });

  it.each([
    'Objectif 404 pages',
    'Bol en grès émaillé',
    'Erreur de Descartes',
    'Adhésion annuelle',
  ])('lets %s through', (title) => {
    // Every entry in that list is a claim that nothing on earth is called
    // this. A wrong one silently drops real gifts, so the patterns are
    // anchored — "404" alone is a page state, "Objectif 404 pages" is a book.
    expect(isNonProductTitle(title)).toBe(false);
  });
});

describe('judging an extraction', () => {
  it('accepts a page with structured data', () => {
    expect(judge(extractProduct(page.jsonLd)).kind).toBe('active');
  });

  it('accepts an image with no price', () => {
    // The case the naive filter would have lost. One field is enough: the
    // page described the thing rather than just naming it.
    expect(judge(extractProduct(page.artisan)).kind).toBe('active');
  });

  it('quarantines a title with nothing else', () => {
    // A real gift, on a site that publishes no metadata. Too thin to suggest
    // to somebody, too plausible to throw away.
    const verdict = judge(extractProduct(page.association));
    expect(verdict).toEqual({ kind: 'quarantine', reason: 'thin' });
  });

  it.each([
    ['a captcha page', page.captcha],
    ['a 404', page.notFound],
  ])('refuses %s outright', (_label, html) => {
    const verdict = judge(extractProduct(html));
    expect(verdict).toEqual({ kind: 'reject', reason: 'non-product-title' });
  });

  it('trusts structured data over a bot-check title', () => {
    /*
     * The ordering that matters.
     *
     * json-ld is markup a merchant wrote on purpose to describe a product.
     * Judging the <title> of a page that carries it would throw away the most
     * reliable signal there is, over the least.
     */
    expect(judge(extractProduct(page.jsonLdBehindBotCheck)).kind).toBe('active');
  });

  it('refuses an extraction with no title at all', () => {
    expect(judge(extractProduct('<html><head></head></html>'))).toEqual({
      kind: 'reject',
      reason: 'no-title',
    });
  });
});
