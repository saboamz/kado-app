import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';

/**
 * The tokens behind "mot de passe oublié".
 *
 * Same primitive as a session (see createSession() in session.ts): 32 bytes
 * from the CSPRNG travel in the e-mail, the database keeps only their
 * SHA-256. Nothing is signed and no secret exists — the token IS the secret,
 * and a row read out of the database opens nothing.
 *
 * An hour to live: long enough for a slow inbox, short enough that the link
 * sitting in a mailbox somebody may no longer control is not a standing
 * credential.
 */
const DURATION_MS = 60 * 60 * 1000;

function resetTokenId(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issues the one valid link for an account.
 *
 * REPLACING any outstanding one, in the same transaction: two valid links
 * would mean the older e-mail still opens the account after a newer one was
 * asked for, and "I requested again because the first never arrived" is the
 * common case, not the attack.
 */
export async function issuePasswordReset(
  userId: string,
): Promise<{ token: string; id: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const id = resetTokenId(token);
  const expiresAt = new Date(Date.now() + DURATION_MS);

  await db.$transaction([
    db.passwordReset.deleteMany({ where: { userId } }),
    db.passwordReset.create({ data: { id, userId, expiresAt } }),
  ]);

  return { token, id, expiresAt };
}

/**
 * Spends a token, exactly once.
 *
 * The conditional updateMany IS the lock: two racing submissions of the same
 * link both reach it, one flips usedAt and proceeds, the other matches zero
 * rows and is refused. Claim-first is deliberate — the password update that
 * follows runs in its own transaction, and if it fails the token stays
 * burnt. A person can always ask for a new link; a link that works twice
 * cannot be taken back.
 *
 * Returns who the token belongs to, or null for unknown, expired and spent
 * alike — the caller has one message for all three, because distinguishing
 * them tells an attacker which guesses were close.
 */
export async function claimPasswordReset(
  token: string,
): Promise<{ userId: string; email: string } | null> {
  const id = resetTokenId(token);
  const claimed = await db.passwordReset.updateMany({
    where: { id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  const row = await db.passwordReset.findUnique({
    where: { id },
    select: { userId: true, user: { select: { email: true } } },
  });
  if (!row) return null;
  return { userId: row.userId, email: row.user.email };
}

/** Nightly sweep: expired and spent tokens, gone. Same shape as
    purgeOldAttempts(), for the same cron. */
export async function purgeExpiredResets(): Promise<number> {
  const { count } = await db.passwordReset.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
    },
  });
  return count;
}
