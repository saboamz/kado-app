import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/**
 * Hashes with scrypt from the Node standard library.
 *
 * bcrypt/argon2 would mean a native dependency; scrypt is memory-hard, in core,
 * and needs no build step. The salt is stored alongside the hash.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

/** Constant-time verification. Returns false rather than throwing on garbage. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split(':');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== KEY_LENGTH) return false;

  const derived = await scrypt(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH);
  return timingSafeEqual(derived, expected);
}
