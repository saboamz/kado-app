import { parsePrice } from './catalogue';

/**
 * Pulling a product out of a merchant's HTML.
 *
 * The order below is an order of IDENTITY, not convenience. JSON-LD is first
 * because it is the only source that carries a GTIN, and a GTIN is the only key
 * that identifies a product across merchants. `<title>` is last because it is
 * the worst possible dedup key: merchants glue their own name onto it, so the
 * same item reads differently on every site.
 */

export type Extracted = {
  title: string | null;
  brand: string | null;
  description: string | null;
  imageUrl: string | null;
  gtin: string | null;
  priceCents: number | null;
  currency: string | null;
  /** Which layer produced this, so a bad row can be traced back. */
  /**
   * Which layer produced this, so a bad row can be traced back months later.
   *
   * 'reader' is the odd one out: it did not come from parsing the page's own
   * markup at all, but from a proxy's rendering of it after the merchant
   * refused us. Those rows carry a title and nothing else, on purpose.
   */
  extractedBy: 'json-ld' | 'open-graph' | 'microdata' | 'title' | 'reader' | null;
};

export const EMPTY: Extracted = {
  title: null,
  brand: null,
  description: null,
  imageUrl: null,
  gtin: null,
  priceCents: null,
  currency: null,
  extractedBy: null,
};

/** Marketing boilerplate shared across a whole catalogue distinguishes nothing. */
const BOILERPLATE =
  /\b(livraison (gratuite|offerte|rapide|en \d+ ?h)|retours? gratuits?|garantie \d+ ans?|paiement s[ée]curis[ée]|satisfait ou rembours[ée]|en stock|exp[ée]di[ée] sous \d+|free shipping|money.back guarantee)\b[^.]*\.?/gi;

export function stripBoilerplate(text: string): string {
  return text.replace(BOILERPLATE, ' ').replace(/\s+/g, ' ').trim();
}

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));

const clean = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const text = decode(v).replace(/\s+/g, ' ').trim();
  return text || null;
};

/** GTINs are 8, 12, 13 or 14 digits. Anything else is a SKU, not a GTIN. */
const asGtin = (v: unknown): string | null => {
  const digits = typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\D/g, '') : '';
  return [8, 12, 13, 14].includes(digits.length) ? digits : null;
};

/**
 * Extracts a product, trying each layer in identity order.
 *
 * Layers are merged rather than exclusive: JSON-LD may carry the GTIN while
 * only Open Graph has a usable image. `extractedBy` records the layer that
 * supplied the *title*, which is the field that decides identity.
 */
export function extractProduct(html: string): Extracted {
  const layers = [fromJsonLd(html), fromOpenGraph(html), fromMicrodata(html), fromTitleTag(html)];

  const result = { ...EMPTY };
  for (const layer of layers) {
    if (!layer) continue;
    for (const key of ['title', 'brand', 'description', 'imageUrl', 'gtin', 'priceCents', 'currency'] as const) {
      if (result[key] === null && layer[key] != null) {
        // @ts-expect-error homogeneous copy across a union of field types
        result[key] = layer[key];
      }
    }
    if (result.extractedBy === null && layer.title) {
      result.extractedBy = layer.extractedBy;
    }
  }
  if (result.description) result.description = stripBoilerplate(result.description);
  return result;
}

/** 1. JSON-LD — the only layer that carries a GTIN. */
function fromJsonLd(html: string): Extracted | null {
  const blocks = [
    ...html.matchAll(
      /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];

  for (const [, raw] of blocks) {
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      continue; // a broken block is not a reason to abandon the others
    }

    const product = findProductNode(parsed);
    if (!product) continue;

    const offer = firstOf(product.offers);
    const price = offer?.price ?? offer?.lowPrice ?? product.price;

    return {
      title: clean(product.name),
      brand: clean(typeof product.brand === 'object' ? product.brand?.name : product.brand),
      description: clean(product.description),
      imageUrl: clean(firstOf(product.image)) ?? clean(firstOf(product.image)?.url),
      gtin:
        asGtin(product.gtin13) ??
        asGtin(product.gtin) ??
        asGtin(product.gtin12) ??
        asGtin(product.gtin14) ??
        asGtin(product.gtin8) ??
        asGtin(product.ean) ??
        asGtin(product.isbn),
      priceCents: price != null ? parsePrice(String(price)) : null,
      currency: clean(offer?.priceCurrency) ?? null,
      extractedBy: 'json-ld',
    };
  }
  return null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const firstOf = (v: any): any => (Array.isArray(v) ? v[0] : v);

/** JSON-LD nests Products inside @graph, arrays, and itemListElement. */
function findProductNode(node: any, depth = 0): any | null {
  if (!node || typeof node !== 'object' || depth > 6) return null;

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findProductNode(child, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const type = node['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === 'string' && /^(Product|IndividualProduct)$/i.test(t))) {
    return node;
  }

  for (const key of ['@graph', 'itemListElement', 'mainEntity', 'item']) {
    const found = findProductNode(node[key], depth + 1);
    if (found) return found;
  }
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const metaContent = (html: string, pattern: RegExp): string | null => {
  const match = html.match(pattern);
  return match ? clean(match[1]) : null;
};

/** 2. Open Graph — near-universal, carries no identity at all. */
function fromOpenGraph(html: string): Extracted | null {
  const og = (property: string) =>
    metaContent(
      html,
      new RegExp(
        `<meta[^>]+(?:property|name)\\s*=\\s*["']${property}["'][^>]+content\\s*=\\s*["']([^"']*)["']`,
        'i',
      ),
    ) ??
    metaContent(
      html,
      new RegExp(
        `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]+(?:property|name)\\s*=\\s*["']${property}["']`,
        'i',
      ),
    );

  const title = og('og:title');
  const price = og('product:price:amount') ?? og('og:price:amount');
  const image = og('og:image') ?? og('og:image:secure_url');
  const description = og('og:description');
  // Not `!title && !price`: a page whose JSON-LD names the product may still
  // have its only usable image here, and returning null would drop it.
  if (!title && !price && !image && !description) return null;

  return {
    title,
    brand: og('product:brand') ?? og('og:brand'),
    description,
    imageUrl: image,
    gtin: null, // Open Graph has no identity field, by design
    priceCents: price ? parsePrice(price) : null,
    currency: og('product:price:currency') ?? og('og:price:currency'),
    extractedBy: 'open-graph',
  };
}

/** 3. microdata */
function fromMicrodata(html: string): Extracted | null {
  const prop = (name: string) => {
    const meta = metaContent(
      html,
      new RegExp(`<meta[^>]+itemprop\\s*=\\s*["']${name}["'][^>]+content\\s*=\\s*["']([^"']*)["']`, 'i'),
    );
    if (meta) return meta;
    const inline = html.match(
      new RegExp(`<[^>]+itemprop\\s*=\\s*["']${name}["'][^>]*>([^<]{1,300})<`, 'i'),
    );
    return inline ? clean(inline[1]) : null;
  };

  if (!/itemtype\s*=\s*["'][^"']*schema\.org\/Product/i.test(html)) return null;

  const title = prop('name');
  const price = prop('price');
  if (!title && !price) return null;

  return {
    title,
    brand: prop('brand'),
    description: prop('description'),
    imageUrl: prop('image'),
    gtin: asGtin(prop('gtin13') ?? prop('gtin') ?? prop('sku')),
    priceCents: price ? parsePrice(price) : null,
    currency: prop('priceCurrency'),
    extractedBy: 'microdata',
  };
}

/**
 * 4. <title> — last resort, and the worst dedup key there is.
 *
 * Merchants append their own name ("Théière — Nature & Découvertes"), so the
 * same product reads differently at every site and titleKey fragments. Better
 * than nothing only because the user can correct it by hand.
 */
function fromTitleTag(html: string): Extracted | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const raw = match ? clean(match[1]) : null;
  if (!raw) return null;

  // Strip the trailing "| Merchant" the separator conventions all use.
  const title = raw.split(/\s+[|—–·]\s+/)[0]?.trim() || raw;

  return { ...EMPTY, title, extractedBy: 'title' };
}
