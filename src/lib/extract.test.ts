import { extractProduct, stripBoilerplate } from './extract';

/**
 * Extraction, tested on the shapes real merchant pages actually have.
 *
 * The order matters more than the parsing: JSON-LD must win over Open Graph
 * even when both are present, because only JSON-LD carries the GTIN and the
 * GTIN is the only key that survives across merchants.
 */

const JSON_LD = `
<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Théière en fonte 1,2 L",
 "brand":{"@type":"Brand","name":"Iwachu"},"gtin13":"4901234567894",
 "description":"Théière traditionnelle. Livraison gratuite sous 48h. Garantie 2 ans.",
 "image":["https://cdn.merchant.fr/theiere.jpg"],
 "offers":{"@type":"Offer","price":"89.90","priceCurrency":"EUR"}}
</script>
<meta property="og:title" content="Théière — Merchant.fr">
<title>Théière en fonte | Merchant.fr</title>
</head></html>`;

describe('extraction order is an order of identity', () => {
  it('prefers JSON-LD over Open Graph and <title>', () => {
    const p = extractProduct(JSON_LD);
    expect(p.extractedBy).toBe('json-ld');
    expect(p.title).toBe('Théière en fonte 1,2 L');
    expect(p.brand).toBe('Iwachu');
    // The whole reason JSON-LD is first.
    expect(p.gtin).toBe('4901234567894');
    expect(p.priceCents).toBe(8990);
    expect(p.currency).toBe('EUR');
  });

  it('falls back to Open Graph when there is no JSON-LD', () => {
    const html = `<html><head>
      <meta property="og:title" content="Vase en grès émaillé">
      <meta property="og:description" content="Fait main au Portugal">
      <meta property="og:image" content="https://cdn.merchant.fr/vase.jpg">
      <meta property="product:price:amount" content="45,00">
      <meta property="product:price:currency" content="EUR">
      <title>Vase | Merchant</title></head></html>`;
    const p = extractProduct(html);
    expect(p.extractedBy).toBe('open-graph');
    expect(p.title).toBe('Vase en grès émaillé');
    expect(p.priceCents).toBe(4500);
    // Open Graph carries no identity, and must not invent one.
    expect(p.gtin).toBeNull();
  });

  it('falls back to microdata when there is neither', () => {
    const html = `<html><body itemscope itemtype="https://schema.org/Product">
      <h1 itemprop="name">Carnet Leuchtturm A5</h1>
      <meta itemprop="price" content="19.90">
      <meta itemprop="priceCurrency" content="EUR">
      </body></html>`;
    const p = extractProduct(html);
    expect(p.extractedBy).toBe('microdata');
    expect(p.title).toBe('Carnet Leuchtturm A5');
    expect(p.priceCents).toBe(1990);
  });

  it('falls back to <title> last, stripping the merchant suffix', () => {
    const p = extractProduct('<html><head><title>Chemex 6 tasses | Cafés Richard</title></head></html>');
    expect(p.extractedBy).toBe('title');
    // The merchant name glued on is exactly what makes <title> a poor dedup
    // key; stripping the common separators is the most that can be done.
    expect(p.title).toBe('Chemex 6 tasses');
  });

  it('returns nothing usable for a page with no product on it', () => {
    const p = extractProduct('<html><body><p>Page introuvable</p></body></html>');
    expect(p.title).toBeNull();
    expect(p.extractedBy).toBeNull();
  });
});

describe('JSON-LD shapes that appear in the wild', () => {
  it('finds a Product nested in @graph', () => {
    const html = `<script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"WebSite","name":"Merchant"},
        {"@type":"Product","name":"Enceinte","offers":{"price":"120.00","priceCurrency":"EUR"}}]}
      </script>`;
    expect(extractProduct(html).title).toBe('Enceinte');
  });

  it('finds a Product in a top-level array', () => {
    const html = `<script type="application/ld+json">
      [{"@type":"BreadcrumbList"},{"@type":"Product","name":"Lampe"}]</script>`;
    expect(extractProduct(html).title).toBe('Lampe');
  });

  it('survives a broken JSON-LD block and uses the next one', () => {
    // Merchants ship malformed JSON constantly. One bad block must not cost
    // the whole page.
    const html = `
      <script type="application/ld+json">{ this is not json </script>
      <script type="application/ld+json">{"@type":"Product","name":"Théière"}</script>`;
    expect(extractProduct(html).title).toBe('Théière');
  });

  it('takes the first offer when several are listed', () => {
    const html = `<script type="application/ld+json">
      {"@type":"Product","name":"Casque","offers":[
        {"price":"199.00","priceCurrency":"EUR"},{"price":"249.00","priceCurrency":"EUR"}]}</script>`;
    expect(extractProduct(html).priceCents).toBe(19900);
  });

  it('rejects a SKU wearing a GTIN field name', () => {
    // A GTIN is 8, 12, 13 or 14 digits. A merchant SKU in that field would
    // become a globally-unique key that collides with a real product's.
    const html = `<script type="application/ld+json">
      {"@type":"Product","name":"X","gtin13":"REF-889"}</script>`;
    expect(extractProduct(html).gtin).toBeNull();
  });

  it('merges layers: GTIN from JSON-LD, image from Open Graph', () => {
    const html = `
      <script type="application/ld+json">{"@type":"Product","name":"Moulin","gtin13":"3401234567890"}</script>
      <meta property="og:image" content="https://cdn.merchant.fr/moulin.jpg">`;
    const p = extractProduct(html);
    expect(p.gtin).toBe('3401234567890');
    expect(p.imageUrl).toBe('https://cdn.merchant.fr/moulin.jpg');
    expect(p.extractedBy).toBe('json-ld'); // the layer that named it
  });

  it('decodes HTML entities in extracted text', () => {
    const html = `<script type="application/ld+json">
      {"@type":"Product","name":"Th&#233;i&#232;re &amp; filtre"}</script>`;
    expect(extractProduct(html).title).toBe('Théière & filtre');
  });
});

describe('stripBoilerplate', () => {
  it('removes the sentences every product on the site shares', () => {
    // A phrase common to the whole catalogue distinguishes nothing and dilutes
    // the embedding of what does.
    const out = stripBoilerplate(
      'Théière en fonte émaillée. Livraison gratuite dès 49 €. Garantie 2 ans. Retours gratuits.',
    );
    expect(out).toContain('Théière en fonte émaillée');
    expect(out.toLowerCase()).not.toContain('livraison gratuite');
    expect(out.toLowerCase()).not.toContain('garantie 2 ans');
  });

  it('leaves a description that is all substance alone', () => {
    const text = 'Fonte émaillée, capacité 1,2 L, filtre inox amovible.';
    expect(stripBoilerplate(text)).toBe(text);
  });
});

describe('price extraction inherits the parser rules', () => {
  it('reads a French-formatted price with a non-breaking space', () => {
    const html = `<meta property="og:title" content="Vélo">
      <meta property="product:price:amount" content="1 299,00">`;
    expect(extractProduct(html).priceCents).toBe(129900);
  });

  it('refuses an ambiguous price rather than guessing', () => {
    const html = `<script type="application/ld+json">
      {"@type":"Product","name":"X","offers":{"price":"1.2999"}}</script>`;
    // Better a null price the user can fill in than a 100×-wrong one that
    // silently lands the item in the wrong band.
    expect(extractProduct(html).priceCents).toBeNull();
  });
});
