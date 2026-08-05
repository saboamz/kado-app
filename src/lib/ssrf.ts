import { lookup } from 'node:dns/promises';

/**
 * The guard on fetching a user-supplied URL from our own infrastructure.
 *
 * The request leaves our network, not theirs. `http://169.254.169.254/` is the
 * cloud metadata endpoint: unreachable from a user's browser, reachable from
 * here, and it hands out credentials. The same applies to anything on the
 * private ranges — an internal admin panel, the database, a staging host.
 *
 * The check is on the RESOLVED ADDRESS, never the string. A hostname the
 * attacker controls can have an A record pointing at 10.0.0.1, so a blocklist
 * of hostnames or a regex on the URL text stops nothing.
 */

export type UrlVerdict =
  | { ok: true; url: URL; addresses: string[] }
  | { ok: false; reason: string };

/** Resolver seam, so the ranges can be tested without touching the network. */
export type Resolver = (hostname: string) => Promise<{ address: string }[]>;

const defaultResolver: Resolver = (hostname) => lookup(hostname, { all: true });

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_PORTS = new Set(['', '80', '443']);

/**
 * True when an address belongs to a range that must never be fetched.
 *
 * Written against the parsed octets rather than a regex on the text: '010.0.0.1'
 * and '0xA.0.0.1' are octal and hex spellings of 10.0.0.1 that a text pattern
 * misses and the network stack honours.
 */
export function isPrivateAddress(address: string): boolean {
  const addr = address.trim().toLowerCase();

  // IPv4-mapped IPv6 (::ffff:10.0.0.1) is an IPv4 destination wearing a
  // different spelling; unwrap before judging it.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isPrivateAddress(mapped[1]);
  if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(addr)) return true; // hex form

  if (addr.includes(':')) return isPrivateV6(addr);

  const parts = addr.split('.');
  if (parts.length !== 4) return true; // unparseable is not proven public
  const octets = parts.map((p) => {
    if (/^0[xX]/.test(p)) return parseInt(p, 16);
    if (/^0\d+$/.test(p)) return parseInt(p, 8);
    if (!/^\d+$/.test(p)) return NaN;
    return Number(p);
  });
  if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return true;

  const [a, b] = octets as [number, number, number, number];

  if (a === 0) return true; // 0.0.0.0/8 — "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local: the metadata endpoint
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a >= 224) return true; // multicast, reserved, broadcast

  return false;
}

function isPrivateV6(addr: string): boolean {
  const a = addr.replace(/^\[|\]$/g, '');
  if (a === '::1' || a === '::') return true; // loopback, unspecified
  if (/^fe[89ab]/i.test(a)) return true; // link-local
  if (/^f[cd]/i.test(a)) return true; // unique local
  if (/^ff/i.test(a)) return true; // multicast
  return false;
}

/**
 * Decides whether a user-supplied URL may be fetched server-side.
 *
 * Every resolved address must be public. Checking only the first would let a
 * hostname with one public A record and one private one through — the fetch
 * picks an address by its own rules, not ours, so anything less than "all of
 * them" is a race we would lose.
 */
export async function checkUrl(
  input: string,
  resolver: Resolver = defaultResolver,
): Promise<UrlVerdict> {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: 'Ce lien est illisible.' };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: 'Seuls les liens http et https sont acceptés.' };
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    return { ok: false, reason: 'Ce port n’est pas autorisé.' };
  }
  // Credentials in a URL are a redirect-laundering trick and never appear on a
  // real product link.
  if (url.username || url.password) {
    return { ok: false, reason: 'Ce lien est illisible.' };
  }

  let addresses: string[];
  try {
    addresses = (await resolver(url.hostname)).map((a) => a.address);
  } catch {
    return { ok: false, reason: 'Ce site est introuvable.' };
  }

  if (addresses.length === 0) {
    return { ok: false, reason: 'Ce site est introuvable.' };
  }

  // ALL, not SOME. See above.
  if (addresses.some(isPrivateAddress)) {
    return { ok: false, reason: 'Ce lien pointe vers une adresse interne.' };
  }

  return { ok: true, url, addresses };
}
