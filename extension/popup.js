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
 * Runs IN the page, in its main world. Self-contained by necessity: an
 * injected function carries no imports.
 *
 * Five layers, strongest first, each filling only what the previous left
 * empty: json-ld, Open Graph, microdata, the analytics dataLayer, and the
 * price the page shows. The last two exist because a large share of shops —
 * Sephora among them — publish no structured price at all: the only price on
 * the page is the one on screen, and the one in the analytics event that
 * fires when it is viewed.
 */
function readPage() {
  const clean = (value) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || null;
  };
  const parsePrice = (raw, currency) => {
    // Only a price we can call euros: the person sees the field and corrects
    // it, but prefilling dollars as euros would be a confident lie.
    if (currency && !/^(EUR|€|euros?)$/i.test(String(currency).trim())) return null;
    const amount = parseFloat(
      String(raw).replace(/[\s ]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'),
    );
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
        const currency = offer.priceCurrency ?? spec?.priceCurrency ?? null;
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
    const currency = meta('product:price:currency') ?? meta('og:price:currency');
    if (amount) priceCents = parsePrice(amount, currency);
  }

  /*
   * 3. Microdata — itemprop attributes woven into the markup. A <meta itemprop>
   * carries its value in content; a visible element in its text or its src.
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

  /*
   * 4. The analytics dataLayer. A shop that tells Google Analytics about the
   * product it is showing (GA4 `items`, Universal `detail.products`) states
   * its price there, machine-written, whatever its markup does. Read in the
   * page's main world, which is why this function is injected there.
   */
  if (priceCents == null) {
    const entries = Array.isArray(window.dataLayer) ? window.dataLayer : [];
    for (const entry of entries) {
      const ecommerce = entry && entry.ecommerce;
      if (!ecommerce) continue;
      const products =
        ecommerce.items ??
        ecommerce.detail?.products ??
        ecommerce.products ??
        [];
      const first = Array.isArray(products) ? products[0] : null;
      if (first && first.price != null) {
        priceCents = parsePrice(first.price, ecommerce.currency ?? first.currency ?? null);
        if (priceCents != null) break;
      }
    }
  }

  /*
   * 5. The price on screen, last and carefully. Candidates are elements
   * whose class, id or data attribute mentions a price and whose text is one
   * bare euro amount. Refused: anything that is, or sits inside, a unit price
   * ("900,00 € / litre"), a struck-out prior price, an instalment or a
   * saving. The first survivor in document order is what a person's eye
   * lands on too — and the field it fills stays theirs to correct.
   */
  if (priceCents == null) {
    const refuse =
      /unit|prior|old|strike|was|before|barr|cross|promo-info|discount|saving|econom|instal|mensual|per-|hide|crossed|regular-price-was|compare/i;
    const isRefused = (node) => {
      for (let n = node, depth = 0; n && depth < 4; n = n.parentElement, depth++) {
        if (n.tagName === 'DEL' || n.tagName === 'S') return true;
        const label = `${n.className || ''} ${n.id || ''}`;
        if (refuse.test(label)) return true;
      }
      return false;
    };
    const candidates = document.querySelectorAll(
      '[class*="price" i], [id*="price" i], [data-price], [data-product-price]',
    );
    for (const candidate of candidates) {
      if (isRefused(candidate)) continue;
      const text = (candidate.textContent || '')
        .replace(/\(\d+\)|\*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const match = text.match(/^(\d{1,4}(?:[ . ]\d{3})*(?:[,.]\d{1,2})?)\s*€$/);
      if (!match) continue;
      priceCents = parsePrice(match[1], 'EUR');
      if (priceCents != null) break;
    }
  }

  /* 6. The document itself, last. */
  title = title ?? clean(document.title);

  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  return { title, priceCents, imageUrl, url: clean(canonical) ?? location.href };
}

/**
 * Runs IN the page: brings the product picture on screen and says where it
 * is, so the popup can crop it out of a screenshot.
 *
 * This is the fallback for shops whose image CDN refuses every request that
 * is not a real browser — nothing our server sends, nor a cross-origin fetch
 * from the extension, will ever get those bytes. The picture is on the
 * person's screen, though, and activeTab lets the extension capture that
 * screen. The element is the one showing the page's declared image when it
 * can be matched, else the largest picture in view.
 */
function locateImage(imageUrl) {
  const key = (url) => {
    try {
      return new URL(url, location.href).pathname.split('/').pop() || '';
    } catch {
      return '';
    }
  };
  const wanted = imageUrl ? key(imageUrl) : '';
  const images = [...document.images].filter((img) => img.naturalWidth > 80);
  let picked = wanted ? images.find((img) => key(img.currentSrc || img.src) === wanted) : null;
  if (!picked) {
    picked = images
      .map((img) => ({ img, area: img.getBoundingClientRect().width * img.getBoundingClientRect().height }))
      .sort((a, b) => b.area - a.area)[0]?.img;
  }
  if (!picked) return null;
  picked.scrollIntoView({ block: 'center', inline: 'center' });
  const rect = picked.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    dpr: window.devicePixelRatio || 1,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
}

async function activeTab() {
  // The override exists for automated tests, which open this popup as an
  // ordinary page — where the "active tab" would be the popup itself.
  const forced = new URLSearchParams(location.search).get('tabId');
  if (forced) return { id: Number(forced) };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Crops the product picture out of a screenshot of the tab, as a PNG blob. */
async function captureImage(tab, imageUrl) {
  const [located] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: locateImage,
    args: [imageUrl],
  });
  const box = located?.result;
  if (!box || box.width < 40 || box.height < 40) return null;

  // A beat for lazy-loaded pictures to paint after the scroll.
  await new Promise((resolve) => setTimeout(resolve, 350));
  const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

  const bitmap = await createImageBitmap(await (await fetch(shot)).blob());
  const scale = bitmap.width / box.viewport.width;
  const x = Math.max(0, box.x * scale);
  const y = Math.max(0, box.y * scale);
  const width = Math.min(box.width * scale, bitmap.width - x);
  const height = Math.min(box.height * scale, bitmap.height - y);
  if (width < 40 || height < 40) return null;

  const canvas = new OffscreenCanvas(Math.round(width), Math.round(height));
  canvas.getContext('2d').drawImage(bitmap, x, y, width, height, 0, 0, width, height);
  return canvas.convertToBlob({ type: 'image/png' });
}

async function init() {
  const tab = await activeTab();
  if (!tab?.id) return show('unsupported');

  const [listsResponse, injected] = await Promise.all([
    fetch(`${BASE}/api/extension/lists`, { credentials: 'include' }).catch(() => null),
    chrome.scripting
      .executeScript({ target: { tabId: tab.id }, func: readPage, world: 'MAIN' })
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

    const { giftId, listId, imageStored } = await response.json();

    /*
     * The server could not fetch the picture — a CDN that only talks to
     * browsers. The person's screen has it: crop it out and send the bytes.
     * Best effort, silent: the wish is already saved either way.
     */
    if (!imageStored) {
      try {
        const blob = await captureImage(tab, page.imageUrl);
        if (blob) {
          const body = new FormData();
          body.append('image', blob, 'capture.png');
          await fetch(`${BASE}/api/extension/gifts/${giftId}/image`, {
            method: 'PUT',
            credentials: 'include',
            body,
          });
        }
      } catch {
        // No picture, then. Never at the cost of the wish.
      }
    }

    el('open-list').onclick = () => chrome.tabs.create({ url: `${BASE}/lists/${listId}` });
    show('done');
  });
}

el('open-login').addEventListener('click', () => chrome.tabs.create({ url: `${BASE}/login` }));

void init();
