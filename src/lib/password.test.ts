import { dummyHash, hashPassword, needsRehash, verifyPassword } from './password';

it('accepts the correct password', async () => {
  const stored = await hashPassword('correct horse battery staple');
  await expect(verifyPassword('correct horse battery staple', stored)).resolves.toBe(
    true,
  );
});

it('rejects the wrong password', async () => {
  const stored = await hashPassword('correct horse battery staple');
  await expect(verifyPassword('Correct horse battery staple', stored)).resolves.toBe(
    false,
  );
});

it('salts, so the same password hashes differently every time', async () => {
  const a = await hashPassword('same');
  const b = await hashPassword('same');
  expect(a).not.toBe(b);
  await expect(verifyPassword('same', a)).resolves.toBe(true);
  await expect(verifyPassword('same', b)).resolves.toBe(true);
});

it('never stores the password in the clear', async () => {
  const stored = await hashPassword('hunter2');
  expect(stored).not.toContain('hunter2');
});

it.each([
  ['empty', ''],
  ['malformed', 'not-a-hash'],
  ['unknown scheme', 'md5:aa:bb'],
  ['truncated hash', 'scrypt:aabb:cc'],
])('rejects a %s stored value without throwing', async (_label, stored) => {
  await expect(verifyPassword('anything', stored)).resolves.toBe(false);
});

describe('cost', () => {
  it('writes its parameters into the hash, so they can be raised later', async () => {
    // The old format was scrypt:<salt>:<hash> and said nothing about cost.
    // Raising N with hashes like that in the table means none of them can be
    // verified again — a global password reset is the only way out.
    const stored = await hashPassword('whatever');
    const [scheme, n, r, p] = stored.split(':');

    expect(scheme).toBe('scrypt');
    expect(Number(n)).toBeGreaterThanOrEqual(131072);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
  });

  it('still verifies a hash written in the old parameterless format', async () => {
    // Made the way the previous implementation made them: Node's defaults.
    const { randomBytes, scryptSync } = await import('crypto');
    const salt = randomBytes(16);
    const legacy = `scrypt:${salt.toString('hex')}:${scryptSync('hunter2', salt, 64).toString('hex')}`;

    await expect(verifyPassword('hunter2', legacy)).resolves.toBe(true);
    await expect(verifyPassword('wrong', legacy)).resolves.toBe(false);
  });

  it('asks for a rehash of an old hash, and not of a current one', async () => {
    const { randomBytes, scryptSync } = await import('crypto');
    const salt = randomBytes(16);
    const legacy = `scrypt:${salt.toString('hex')}:${scryptSync('hunter2', salt, 64).toString('hex')}`;

    expect(needsRehash(legacy)).toBe(true);
    expect(needsRehash(await hashPassword('hunter2'))).toBe(false);
  });
});

describe('the sentinel an unknown e-mail is verified against', () => {
  it('costs what a real verification costs', async () => {
    /*
     * The login action spends this to keep a miss and a hit indistinguishable.
     * It used to be the literal 'scrypt:00:00', which is rejected on shape
     * before scrypt runs: measured, an unknown address answered ~4850x faster
     * than a known one, which is a stopwatch away from enumerating accounts.
     *
     * The bar is deliberately loose — this is a wall-clock measurement on a
     * shared machine — but 4850x and 2x are not the same order of magnitude.
     */
    const real = await hashPassword('hunter2');
    const sentinel = await dummyHash();

    const time = async (stored: string) => {
      await verifyPassword('guess', stored);
      const started = process.hrtime.bigint();
      await verifyPassword('guess', stored);
      return Number(process.hrtime.bigint() - started) / 1e6;
    };

    const ratio = (await time(real)) / (await time(sentinel));
    expect(ratio).toBeGreaterThan(0.25);
    expect(ratio).toBeLessThan(4);
  });
});
