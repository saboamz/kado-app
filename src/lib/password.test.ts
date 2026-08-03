import { hashPassword, verifyPassword } from './password';

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
