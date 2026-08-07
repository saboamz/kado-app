import { checkUrl } from './ssrf';

/**
 * Fetching a merchant page, safely.
 *
 * Shared by the two callers that read an attacker-supplied URL — the gift
 * link resolver and the preview action. It lived in both as a copy, which is
 * a poor place for a security control: the redirect re-validation below is
 * the thing standing between a pasted link and an SSRF, and two copies drift.
 */

/**
 * How long the WHOLE attempt may take, redirects included.
 *
 * This used to be a per-request timeout of 8s with up to 4 hops, so the worst
 * case was 32s: a public host that redirects three times and then stops
 * answering. A Server Action on Vercel's Hobby plan is cut off at 10s, so
 * that case did not merely make a save slow — it made the save fail, which is
 * the one outcome this whole design exists to prevent.
 *
 * A single budget across every hop makes the worst case knowable and keeps it
 * well inside the platform's limit. 5s is generous for a merchant that is
 * actually going to answer; one that is not has already cost us enough.
 */
const TOTAL_BUDGET_MS = 5_000;
const MAX_BYTES = 2_000_000;
const MAX_HOPS = 3;

/**
 * Fetches a page, refusing to follow redirects itself.
 *
 * `redirect: 'manual'` is the point: a merchant URL that passed the SSRF check
 * can still 302 to http://169.254.169.254/, and an automatic follow would make
 * that request with no check at all. Each hop is re-validated by checkUrl.
 */
export async function fetchHtml(url: string): Promise<string> {
  // One signal for the whole chain, including the body read. Aborting it stops
  // whichever stage is in flight.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOTAL_BUDGET_MS);

  try {
    return await follow(url, 0, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function follow(
  url: string,
  hop: number,
  signal: AbortSignal,
): Promise<string> {
  if (hop > MAX_HOPS) throw new Error('too many redirects');

  const response = await fetch(url, {
    redirect: 'manual',
    signal,
    headers: {
      'user-agent': 'KadoBot/1.0 (+https://kado.app/bot)',
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'fr-FR,fr;q=0.9',
    },
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) throw new Error('redirect without a target');
    const next = new URL(location, url).href;
    // Re-run the full guard on the hop. Skipping it here is exactly how an
    // SSRF filter gets bypassed.
    const verdict = await checkUrl(next);
    if (!verdict.ok) throw new Error(verdict.reason);
    return follow(verdict.url.href, hop + 1, signal);
  }

  if (!response.ok) throw new Error(`status ${response.status}`);

  const type = response.headers.get('content-type') ?? '';
  if (!/text\/html|application\/xhtml/i.test(type)) {
    throw new Error('not an HTML page');
  }

  /*
   * Read the body under the same signal.
   *
   * The previous version cleared its timer before reading, so a merchant that
   * answered fast and then dripped the body one byte at a time was bounded by
   * nothing at all. The 2MB cap did not help: it truncates what we keep, not
   * what we wait for.
   */
  const buffer = await response.arrayBuffer();
  return new TextDecoder('utf-8').decode(buffer.slice(0, MAX_BYTES));
}
