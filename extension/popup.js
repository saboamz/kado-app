/*
 * The popup: read the page the person is looking at, offer to add it.
 *
 * Everything network goes through the extension's own context, never a
 * content script — that is what lets the session cookie ride along: Chrome
 * exempts an extension's requests to a host it holds permission for from
 * SameSite, so the ordinary kadlio.com session signs these calls and no
 * token system has to exist.
 *
 * The page is only ever read on click (activeTab): this extension has no
 * business knowing where somebody browses the rest of the time.
 */

const BASE = 'https://www.kadlio.com';

const el = (id) => document.getElementById(id);
const show = (id) => {
  for (const section of ['loading', 'signin', 'unsupported', 'form', 'done']) {
    el(section).hidden = section !== id;
  }
};

/**
 * Runs IN the page. Self-contained by necessity: an injected function
 * carries no imports. A lighter cousin of the server's extractor — json-ld
 * first, Open Graph next, the document title last — reading the LIVE page,
 * walls and hydration included, which is the one thing the server can never
 * do.
 */
function readPage() {
  const clean = (value) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || null;
  };
  const parsePrice = (raw, currency) => {
    // Only a price we can call euros: the person sees the field and corrects
    // it, but prefilling dollars as euros would be a confident lie.
    if (currency && !/^(EUR|€|euros?)$/i.test(currency.trim())) return null;
    const amount = parseFloat(String(raw).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(amount) && amount >= 0 && amount < 100000
      ? Math.round(amount * 100)
      : null;
  };

  let title = null;
  let priceCents = null;
  let imageUrl = null;

  /*
   * 1. JSON-LD. Offers nest in the wild — an AggregateOffer holding the real
   * offers, a priceSpecification holding the real price — so both are walked
   * rather than assuming the flat shape the schema.org examples show.
   */
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    let nodes = [];
    try {
      const walk = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.forEach(walk);
        nodes.push(node);
        walk(node['@graph']);
      };
      walk(JSON.parse(script.textContent));
    } catch {
      continue;
    }
    const imageOf = (image) => {
      if (typeof image === 'string') return clean(image);
      if (Array.isArray(image)) {
        for (const entry of image) {
          const found = imageOf(entry);
          if (found) return found;
        }
        return null;
      }
      return image ? clean(image.url) ?? clean(image.contentUrl) : null;
    };
    for (const node of nodes) {
      const type = node['@type'];
      const isProduct =
        type === 'Product' || (Array.isArray(type) && type.includes('Product'));
      if (!isProduct) continue;
      title = title ?? clean(node.name);
      imageUrl = imageUrl ?? imageOf(node.image);

      const offers = [];
      const collectOffers = (offer) => {
        if (!offer) return;
        if (Array.isArray(offer)) return offer.forEach(collectOffers);
        offers.push(offer);
        collectOffers(offer.offers);
      };
      collectOffers(node.offers);
      for (const offer of offers) {
        if (priceCents != null) break;
        const spec = [offer.priceSpecification].flat().filter(Boolean)[0];
        const raw = offer.price ?? offer.lowPrice ?? spec?.price;
        const currency =
          offer.priceCurrency ?? spec?.priceCurrency ?? null;
        if (raw != null) priceCents = parsePrice(raw, currency);
      }
      if (priceCents == null && node.price != null) {
        priceCents = parsePrice(node.price, node.priceCurrency ?? null);
      }
    }
  }

  const meta = (name) =>
    clean(
      document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)
        ?.content,
    );

  /* 2. Open Graph. */
  title = title ?? meta('og:title');
  imageUrl =
    imageUrl ??
    meta('og:image') ??
    meta('og:image:secure_url') ??
    meta('twitter:image');
  if (priceCents == null) {
    const amount = meta('product:price:amount') ?? meta('og:price:amount');
    const currency =
      meta('product:price:currency') ?? meta('og:price:currency');
    if (amount) priceCents = parsePrice(amount, currency);
  }

  /*
   * 3. Microdata — itemprop attributes woven into the markup, the layer the
   * server's extractor also reads. A <meta itemprop> carries its value in
   * content; a visible element carries it in its text or its src.
   */
  const itemprop = (name) => {
    const element = document.querySelector(`[itemprop="${name}"]`);
    if (!element) return null;
    return (
      clean(element.getAttribute('content')) ??
      clean(element.getAttribute('src')) ??
      clean(element.getAttribute('href')) ??
      clean(element.textContent)
    );
  };
  title = title ?? itemprop('name');
  imageUrl = imageUrl ?? itemprop('image');
  if (priceCents == null) {
    const raw = itemprop('price');
    if (raw != null) priceCents = parsePrice(raw, itemprop('priceCurrency'));
  }

  /* 4. The document itself, last. */
  title = title ?? clean(document.title);

  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  return { title, priceCents, imageUrl, url: clean(canonical) ?? location.href };
}

async function activeTab() {
  // The override exists for automated tests, which open this popup as an
  // ordinary page — where the "active tab" would be the popup itself.
  const forced = new URLSearchParams(location.search).get('tabId');
  if (forced) return { id: Number(forced) };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function init() {
  const tab = await activeTab();
  if (!tab?.id) return show('unsupported');

  const [listsResponse, injected] = await Promise.all([
    fetch(`${BASE}/api/extension/lists`, { credentials: 'include' }).catch(
      () => null,
    ),
    chrome.scripting
      .executeScript({ target: { tabId: tab.id }, func: readPage })
      .catch(() => null),
  ]);

  if (!listsResponse || listsResponse.status === 401) return show('signin');
  if (!listsResponse.ok) return show('unsupported');
  const { lists } = await listsResponse.json();
  if (!injected?.[0]?.result) return show('unsupported');

  const page = injected[0].result;
  if (!page.title || !/^https?:\/\//.test(page.url)) return show('unsupported');

  el('name').value = page.title.slice(0, 140);
  if (page.priceCents != null) el('price').value = String(page.priceCents / 100);
  if (page.imageUrl) {
    el('preview').src = page.imageUrl;
    el('preview').hidden = false;
  }
  for (const list of lists) {
    const option = document.createElement('option');
    option.value = list.id;
    option.textContent = list.name;
    el('list').append(option);
  }

  show('form');

  el('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    el('submit').disabled = true;
    el('error').hidden = true;

    const price = el('price').value.trim().replace(',', '.');
    const priceCents = price ? Math.round(parseFloat(price) * 100) : null;
    if (price && !Number.isFinite(priceCents)) {
      el('error').textContent = 'Ce prix est illisible.';
      el('error').hidden = false;
      el('submit').disabled = false;
      return;
    }

    const response = await fetch(`${BASE}/api/extension/gifts`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        listId: el('list').value,
        name: el('name').value.trim(),
        url: page.url,
        priceCents,
        imageUrl: page.imageUrl,
      }),
    }).catch(() => null);

    if (!response?.ok) {
      el('error').textContent =
        'L’ajout n’a pas abouti. Vérifiez que vous êtes connecté à Kadlio.';
      el('error').hidden = false;
      el('submit').disabled = false;
      return;
    }

    const { listId } = await response.json();
    el('open-list').onclick = () =>
      chrome.tabs.create({ url: `${BASE}/lists/${listId}` });
    show('done');
  });
}

el('open-login').addEventListener('click', () =>
  chrome.tabs.create({ url: `${BASE}/login` }),
);

void init();
