import { checkUrl } from './ssrf';

/**
 * Fetching a merchant page, safely.
 *
 * Shared by the two callers that read an attacker-supplied URL — the gift
 * link resolver and the preview action. It lived in both as a copy, which is
 * a poor place for a security control: the redirect re-validation below is
 * the thing standing between a pasted link and an SSRF, and two copies drift.
 */

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 2_000_000;

/**
 * Fetches a page, refusing to follow redirects itself.
 *
 * `redirect: 'manual'` is the point: a merchant URL that passed the SSRF check
 * can still 302 to http://169.254.169.254/, and an automatic follow would make
 * that request with no check at all. Each hop is re-validated by checkUrl.
 */
export async function fetchHtml(url: string, hop = 0): Promise<string> {
  if (hop > 3) throw new Error('too many redirects');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': 'KadoBot/1.0 (+https://kado.app/bot)',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'fr-FR,fr;q=0.9',
      },
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) throw new Error('redirect without a target');
    const next = new URL(location, url).href;
    // Re-run the full guard on the hop. Skipping it here is exactly how an
    // SSRF filter gets bypassed.
    const verdict = await checkUrl(next);
    if (!verdict.ok) throw new Error(verdict.reason);
    return fetchHtml(verdict.url.href, hop + 1);
  }

  if (!response.ok) throw new Error(`status ${response.status}`);

  const type = response.headers.get('content-type') ?? '';
  if (!/text\/html|application\/xhtml/i.test(type)) {
    throw new Error('not an HTML page');
  }

  // Cap the read: a merchant streaming an endless body would otherwise hold a
  // server slot until the timeout, and the timeout is generous.
  const buffer = await response.arrayBuffer();
  return new TextDecoder('utf-8').decode(buffer.slice(0, MAX_BYTES));
}
