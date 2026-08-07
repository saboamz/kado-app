import type { GifChoice } from './decorations';
import { isAllowedGifUrl } from './decorations';

/**
 * Searching Giphy, from the server.
 *
 * ── Why never from the browser ─────────────────────────────────────────────
 *
 * An API key shipped to the client is a public key: anyone can read it from
 * the network tab and spend the quota. So the search runs here and the key
 * never leaves the server.
 *
 * ── What this deliberately does not do ─────────────────────────────────────
 *
 * It does not proxy the images themselves. Those are served from Giphy's CDN,
 * which means Giphy sees the IP of everyone who views a decorated profile —
 * a real privacy cost, and the honest trade for a picker people will actually
 * enjoy using. It is disclosed in the UI rather than hidden.
 */

const ENDPOINT = 'https://api.giphy.com/v1/gifs';
const TIMEOUT_MS = 5_000;

export type GiphyResult =
  | { ok: true; gifs: GifChoice[] }
  | { ok: false; reason: 'unconfigured' | 'failed' };

/** Whether the integration can work at all. */
export function giphyConfigured(): boolean {
  return Boolean(process.env.GIPHY_API_KEY);
}

/**
 * Searches, or returns the trending set when the query is empty.
 *
 * An empty search showing nothing is a dead end — somebody opening the picker
 * with no idea what to type should still see something to click.
 */
export async function searchGifs(query: string, limit = 24): Promise<GiphyResult> {
  const key = process.env.GIPHY_API_KEY;
  // Refuses rather than pretending: an unconfigured integration must say so,
  // so the UI can explain instead of showing an empty grid that looks broken.
  if (!key) return { ok: false, reason: 'unconfigured' };

  const trimmed = query.trim();
  const url = new URL(`${ENDPOINT}/${trimmed ? 'search' : 'trending'}`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('limit', String(limit));
  // 'g' is the family-friendly rating. This is a wishlist app used with
  // relatives, and the default rating is not.
  url.searchParams.set('rating', 'g');
  url.searchParams.set('lang', 'fr');
  if (trimmed) url.searchParams.set('q', trimmed);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return { ok: false, reason: 'failed' };

    const payload: unknown = await response.json();
    return { ok: true, gifs: parseGifs(payload) };
  } catch {
    // Giphy being slow or down is not something the person can fix, and not
    // something to show a stack trace for.
    return { ok: false, reason: 'failed' };
  }
}

/**
 * Reads the fields we keep out of Giphy's response.
 *
 * Defensive on purpose: this is a third party's shape, it changes without
 * warning, and a missing field must drop one result rather than break the
 * whole picker.
 */
function parseGifs(payload: unknown): GifChoice[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  const gifs: GifChoice[] = [];
  for (const entry of data) {
    if (typeof entry !== 'object' || entry === null) continue;
    const item = entry as Record<string, unknown>;
    const images = item.images as Record<string, unknown> | undefined;
    if (!images) continue;

    // downsized keeps a decorative GIF from being a 10MB original; still is
    // what a visitor who asked for reduced motion sees instead.
    const animated = images.downsized_medium ?? images.downsized ?? images.original;
    const still = images.fixed_width_still ?? images.original_still;
    if (typeof animated !== 'object' || animated === null) continue;
    if (typeof still !== 'object' || still === null) continue;

    const gifUrl = (animated as Record<string, unknown>).url;
    const stillUrl = (still as Record<string, unknown>).url;
    const width = Number((animated as Record<string, unknown>).width);
    const height = Number((animated as Record<string, unknown>).height);

    if (typeof gifUrl !== 'string' || typeof stillUrl !== 'string') continue;
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue;
    // Same allowlist the save path applies, so a host we would refuse later
    // is never offered in the first place.
    if (!isAllowedGifUrl(gifUrl) || !isAllowedGifUrl(stillUrl)) continue;

    gifs.push({
      id: String(item.id ?? gifUrl),
      gifUrl,
      stillUrl,
      width,
      height,
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : null,
    });
  }
  return gifs;
}
