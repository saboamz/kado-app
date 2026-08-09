/**
 * Reading a merchant page that refuses to talk to us.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * A large share of retailers answer a server-side request with 403 or a bot
 * check, whatever user-agent it carries. Measured on the three links in this
 * app's own database: Suuupply reads fine, Cdiscount serves a captcha page,
 * Citadium refuses outright — one in three. That is not a flaw in the
 * extractor, it is what the web does to anything without a browser
 * fingerprint.
 *
 * r.jina.ai is a public reading proxy: give it a URL, it fetches the page and
 * returns it as Markdown. All three of those merchants come back 200 through
 * it.
 *
 * ── Why it asks for HTML, not Markdown ─────────────────────────────────────
 *
 * The proxy's default is Markdown, and that was the first thing tried. It is
 * the wrong format here, and the reason is worth stating because it looked
 * fine at first.
 *
 * Guessing a price out of prose does not work. Four rules were tried against
 * three real pages, and each was right on one and confidently wrong on
 * another: lowest-after-the-heading gave Citadium 20 € and Cdiscount nothing;
 * a wider window gave Cdiscount 29 €, which is a yearly subscription; most
 * frequent gave Citadium 110 €. Rendering to prose throws away the structure
 * that said which number was the price, leaving instalments, eco-levies,
 * delivery thresholds and cross-sells all looking alike.
 *
 * `x-return-format: html` returns the page's own markup instead — json-ld,
 * Open Graph, microdata, exactly what extractProduct() already parses. No
 * guessing: the merchant states the price, and we read the statement. On the
 * three pages measured it yields 20 € for Citadium and 419,99 € with a GTIN
 * for Cdiscount, where prose gave a wrong answer or none.
 *
 * ── What it costs ──────────────────────────────────────────────────────────
 *
 * A third party sees which product pages are being resolved. Nothing
 * identifies the person — no cookie, no account, and the request comes from
 * our server — but it is a URL leaving our infrastructure, and this app's
 * premise is that it keeps things to itself. Stated in the UI for the same
 * reason the Giphy dependency is.
 *
 * Free, rate limited by the provider at 20 requests per minute — far above
 * what this app can generate, since a person is already capped at 40 link
 * reads an hour and this only runs on the ones that failed.
 */

const READER = 'https://r.jina.ai/';

/** Its own budget: this is a second attempt, after a first one already spent
    up to 5 seconds failing. */
const BUDGET_MS = 8_000;
const MAX_BYTES = 1_000_000;

/**
 * Fetches a page through the reading proxy, as Markdown.
 *
 * Throws on anything that is not a usable answer, so a caller treats it
 * exactly like a failed direct read — which is what it is.
 */
export async function fetchViaReader(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BUDGET_MS);

  try {
    const response = await fetch(`${READER}${url}`, {
      signal: controller.signal,
      headers: {
        // The page's own markup, so the structured data survives. See above.
        'x-return-format': 'html',
        // Asked for, though the proxy does not always honour it: a shop that
        // geolocates its prices may still answer in another currency, which
        // is why what comes back is checked before it is trusted.
        'accept-language': 'fr-FR,fr;q=0.9',
      },
    });

    if (!response.ok) throw new Error(`reader status ${response.status}`);

    const text = await response.text();
    return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Currencies whose amounts we are willing to store.
 *
 * A shop that geolocates prices can answer the proxy in dollars — Suuupply
 * returns 243.00 USD for a jumper it sells at 165 €, because the proxy comes
 * from somewhere else. Storing that figure as euros would put a number on a
 * wish that is wrong by half, and nothing downstream would ever question it.
 *
 * "Euro" spelled out is Citadium's Open Graph tag; the ISO code is what
 * everything else uses.
 */
const CURRENCY_ALIASES: Record<string, string> = {
  EUR: 'EUR',
  EURO: 'EUR',
  EUROS: 'EUR',
  '€': 'EUR',
};

/**
 * The currency, normalised — or null when it is one we will not store.
 *
 * Null is not "unknown, assume euros". A price whose currency we could not
 * confirm is dropped along with it: no price at all is honest, and a price in
 * the wrong currency is a confident lie.
 */
export function normaliseCurrency(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return CURRENCY_ALIASES[raw.trim().toUpperCase()] ?? null;
}
