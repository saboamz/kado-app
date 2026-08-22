import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

type ScryptOptions = { N: number; r: number; p: number; maxmem: number };

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/*
 * Cost, and why it is written into every hash.
 *
 * The three-argument call used to leave Node's defaults in place: N=16384,
 * which is the 2009 paper's *interactive* figure and about 90ms here. OWASP's
 * current floor for scrypt is N=2^17, measured at roughly 540ms on this
 * machine — a cost paid once per sign-in, and multiplied by every guess an
 * attacker with the table has to make.
 *
 * maxmem has to be raised with it: N=131072 at r=8 needs ~134MB, and Node
 * refuses above 32MB by default.
 *
 * The parameters are stored alongside the hash rather than assumed, because
 * the previous format encoded none. Raising N with hashes that do not say
 * what they were made with means nobody can verify an old password again —
 * the only way out is a global reset. Now an old hash still verifies at its
 * own cost, and needsRehash() says when to quietly upgrade it.
 */
const CURRENT: ScryptOptions = {
  N: 131072,
  r: 8,
  p: 1,
  maxmem: 256 * 1024 * 1024,
};

/** What a hash with no parameters in it was made with. */
const LEGACY: ScryptOptions = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

/**
 * Hashes with scrypt from the Node standard library.
 *
 * bcrypt/argon2 would mean a native dependency; scrypt is memory-hard, in core,
 * and needs no build step. The salt and the cost are stored alongside the hash.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, CURRENT);
  const { N, r, p } = CURRENT;
  return `scrypt:${N}:${r}:${p}:${salt.toString('hex')}:${derived.toString('hex')}`;
}

/** The pieces of a stored hash, or null when it is not one. */
function parse(
  stored: string,
): { options: ScryptOptions; salt: Buffer; expected: Buffer } | null {
  const parts = stored.split(':');
  if (parts[0] !== 'scrypt') return null;

  let options: ScryptOptions;
  let saltHex: string | undefined;
  let hashHex: string | undefined;

  if (parts.length === 6) {
    const [, n, r, p, salt, hash] = parts;
    const parsed = { N: Number(n), r: Number(r), p: Number(p) };
    if (!Number.isSafeInteger(parsed.N) || parsed.N < 2) return null;
    if (!Number.isSafeInteger(parsed.r) || !Number.isSafeInteger(parsed.p)) return null;
    // Enough headroom for whatever cost the hash names, not just the current one.
    options = { ...parsed, maxmem: Math.max(CURRENT.maxmem, 128 * parsed.N * parsed.r * 2) };
    saltHex = salt;
    hashHex = hash;
  } else if (parts.length === 3) {
    // The original format: scrypt:<salt>:<hash>, made at Node's defaults.
    options = LEGACY;
    saltHex = parts[1];
    hashHex = parts[2];
  } else {
    return null;
  }

  if (!saltHex || !hashHex) return null;
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== KEY_LENGTH) return null;

  return { options, salt: Buffer.from(saltHex, 'hex'), expected };
}

/** Constant-time verification. Returns false rather than throwing on garbage. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;

  const derived = await scrypt(password, parsed.salt, KEY_LENGTH, parsed.options);
  return timingSafeEqual(derived, parsed.expected);
}

/**
 * Whether a stored hash was made below the cost we now want.
 *
 * Sign-in is the only moment the plaintext exists, so it is the only moment
 * an upgrade is possible.
 */
export function needsRehash(stored: string): boolean {
  const parsed = parse(stored);
  if (!parsed) return false;
  const { N, r, p } = parsed.options;
  return N < CURRENT.N || r < CURRENT.r || p < CURRENT.p;
}

/*
 * A real hash to verify against when the e-mail is unknown.
 *
 * The login action spent "comparable time" against the literal
 * 'scrypt:00:00', which parse() rejects on length before scrypt is ever
 * called — so an unknown address answered in microseconds and a known one in
 * hundreds of milliseconds. Measured, that gap was ~4850x: enough to test
 * whether an address is registered with a stopwatch, which is exactly what
 * the identical error messages exist to prevent.
 *
 * Built lazily and kept, so the cost lands on the first miss rather than on
 * module load, and once.
 */
let dummy: Promise<string> | null = null;

export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(32).toString('hex'));
  return dummy;
}
