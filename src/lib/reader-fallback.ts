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
 * ── Why it takes the title and NOT the price ───────────────────────────────
 *
 * This is the whole design, and it was settled by measurement rather than by
 * preference.
 *
 * A direct read gives STRUCTURED data: json-ld says `"price": "165.00"`, and
 * there is no ambiguity about which number that is. Rendering a page to prose
 * throws that structure away and leaves dozens of numbers with no way to tell
 * them apart — instalments, eco-levies, delivery thresholds, subscriptions,
 * cross-sells, sponsored rows.
 *
 * Four rules were tried against three real pages. Every one was right on one
 * page and confidently wrong on another:
 *
 *   lowest after the heading   Citadium 20 € ✓   Cdiscount nothing
 *   wider window               Citadium 20 € ✓   Cdiscount 29 €  ✗ (a yearly
 *                                                subscription)
 *   most frequent              Citadium 110 € ✗  Cdiscount 419,99 € ✓
 *   proximity + repetition     Citadium 20,39 € ✗ Cdiscount 419,99 € ✓
 *
 * And one case settles it outright: Suuupply does not print its price in the
 * rendered text at all. The 165 € is simply not there to find.
 *
 * A price guessed at 39 € instead of 20 € is worse than no price. The
 * "estimate" label on screen covers being a few euros out; it does not cover
 * being wrong by a factor of two, and somebody budgets against that figure.
 *
 * A title, by contrast, is unambiguous — the proxy puts the page's own on the
 * first line. That alone turns a link we could not read at all into a proper
 * catalogue row: deduplicated, attached to its merchant, countable by the
 * recommender. It is a smaller claim, and it is one that holds.
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
      headers: { accept: 'text/plain', 'x-return-format': 'markdown' },
    });

    if (!response.ok) throw new Error(`reader status ${response.status}`);

    const text = await response.text();
    return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The product's name, from the proxy's first line.
 *
 * "Casquette Carhartt wip Harlem cap Beige - Homme | Citadium" — the shop's
 * name is appended after a pipe or a dash, as in most <title> tags, and it is
 * trimmed so two shops selling the same article produce the same title key.
 *
 * Only the trailing segment is dropped, and only when it is short enough to
 * be a shop name rather than part of what the thing is called.
 */
export function readerTitle(markdown: string): string | null {
  const line = markdown.split('\n').find((l) => l.startsWith('Title:'));
  if (!line) return null;

  const raw = line.slice('Title:'.length).trim();
  if (!raw) return null;

  const trimmed = raw.replace(/\s*[|·—–]\s*[^|·—–]{1,30}$/, '').trim();
  return trimmed || raw;
}
