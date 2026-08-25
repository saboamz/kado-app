import { createHash } from 'node:crypto';
import { db } from './db';
import {
  claimPasswordReset,
  issuePasswordReset,
  purgeExpiredResets,
} from './password-reset';
import { cleanup, makeUser } from '@/test/factories';

/**
 * The reset token's whole contract: the database never holds the token, one
 * per account, spent exactly once, and the purge sweeps what no longer
 * matters. These are the properties an attacker probes, so they are pinned
 * here rather than trusted to review.
 */

const users: string[] = [];

async function user() {
  const created = await makeUser();
  users.push(created.id);
  return created;
}

afterAll(async () => {
  await cleanup(users);
  await db.$disconnect();
});

it('stores only the hash — a database read yields no working token', async () => {
  const owner = await user();
  const { token, id } = await issuePasswordReset(owner.id);

  expect(id).toBe(createHash('sha256').update(token).digest('hex'));
  expect(token).not.toBe(id);

  // The raw token is nowhere: looking a row up BY the token must fail.
  expect(await db.passwordReset.findUnique({ where: { id: token } })).toBeNull();
  expect(await db.passwordReset.findUnique({ where: { id } })).not.toBeNull();
});

it('a new request replaces the outstanding link', async () => {
  const owner = await user();
  const first = await issuePasswordReset(owner.id);
  const second = await issuePasswordReset(owner.id);

  // The older e-mail no longer opens the account.
  expect(await claimPasswordReset(first.token)).toBeNull();

  const rows = await db.passwordReset.findMany({ where: { userId: owner.id } });
  expect(rows).toHaveLength(1);
  expect(rows[0]!.id).toBe(second.id);
});

it('claims exactly once — the second submission of one link is refused', async () => {
  const owner = await user();
  const { token } = await issuePasswordReset(owner.id);

  const claimed = await claimPasswordReset(token);
  expect(claimed).toEqual({ userId: owner.id, email: owner.email });

  expect(await claimPasswordReset(token)).toBeNull();
});

it('refuses expired and garbage tokens alike', async () => {
  const owner = await user();
  const { token, id } = await issuePasswordReset(owner.id);
  await db.passwordReset.update({
    where: { id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });

  expect(await claimPasswordReset(token)).toBeNull();
  expect(await claimPasswordReset('not-a-token')).toBeNull();
});

it('purges the expired and the spent, spares the live', async () => {
  const owner = await user();

  const spent = await issuePasswordReset(owner.id);
  await claimPasswordReset(spent.token);
  // A second account keeps the spent row from being replaced by the next issue.
  const other = await user();
  const expired = await issuePasswordReset(other.id);
  await db.passwordReset.update({
    where: { id: expired.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const third = await user();
  const live = await issuePasswordReset(third.id);

  const purged = await purgeExpiredResets();
  expect(purged).toBeGreaterThanOrEqual(2);

  expect(await db.passwordReset.findUnique({ where: { id: spent.id } })).toBeNull();
  expect(await db.passwordReset.findUnique({ where: { id: expired.id } })).toBeNull();
  expect(await db.passwordReset.findUnique({ where: { id: live.id } })).not.toBeNull();
});
