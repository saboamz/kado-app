import { db } from './db';

/**
 * A sliding-window limiter for the endpoints that must not be brute-forced.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * Sign-in and sign-up were unthrottled. The login is careful about not
 * revealing which addresses are registered — same message and comparable
 * timing whether the account is missing or the password is wrong — but none
 * of that helps against someone simply trying passwords in a loop. On a
 * public deployment that is the first thing to happen.
 *
 * ── Why Postgres rather than Redis ─────────────────────────────────────────
 *
 * The database is already there. A dedicated store would mean another
 * account, another secret and another service that can be down while the app
 * is up, to protect two routes. The cost here is one indexed insert and one
 * indexed count on a path that already runs several queries and a deliberately
 * slow password hash.
 */

/** A window, and how many attempts it allows. */
export type Limit = { attempts: number; windowSeconds: number };

/**
 * Per e-mail: slows a targeted attack on one account without ever locking it
 * out for good — the window slides, so a legitimate person who mistyped their
 * password three times is back in a few minutes.
 */
export const LOGIN_PER_EMAIL: Limit = { attempts: 8, windowSeconds: 15 * 60 };

/**
 * Per IP: catches the spray across many accounts that a per-e-mail limit
 * cannot see. Deliberately looser, because a household or an office shares one
 * address and must not lock each other out.
 */
export const LOGIN_PER_IP: Limit = { attempts: 30, windowSeconds: 15 * 60 };

/** Sign-up is per IP only — there is no account yet to key on. */
export const SIGNUP_PER_IP: Limit = { attempts: 10, windowSeconds: 60 * 60 };

export type LimitResult = { allowed: true } | { allowed: false; retryAfter: number };

/** Lower-cased and namespaced, so two limits never share a bucket. */
function bucketFor(action: string, key: string): string {
  return `${action}:${key.toLowerCase()}`;
}

/**
 * Records one FAILED attempt.
 *
 * Only failures count. Counting successes too would make a shared address —
 * a household, an office, a school — throttle itself simply by using the app,
 * and the limit is meant to slow guessing, not use. It also made the e2e suite
 * lock itself out after thirty sign-ins from one address.
 */
export async function recordFailure(action: string, key: string): Promise<void> {
  await db.authAttempt.create({ data: { key: bucketFor(action, key) } });
}

/**
 * Says whether an attempt may proceed, without recording anything.
 *
 * Read-only on purpose: the caller records a failure afterwards, so a correct
 * password never consumes anyone's allowance.
 */
export async function rateLimit(
  action: string,
  key: string,
  limit: Limit,
): Promise<LimitResult> {
  const bucket = bucketFor(action, key);
  const since = new Date(Date.now() - limit.windowSeconds * 1000);

  const recent = await db.authAttempt.count({
    where: { key: bucket, createdAt: { gte: since } },
  });

  if (recent < limit.attempts) return { allowed: true };

  // How long until the oldest attempt in the window falls out of it.
  const oldest = await db.authAttempt.findFirst({
    where: { key: bucket, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  const retryAfter = oldest
    ? Math.max(
        1,
        Math.ceil(
          (oldest.createdAt.getTime() + limit.windowSeconds * 1000 - Date.now()) /
            1000,
        ),
      )
    : limit.windowSeconds;

  return { allowed: false, retryAfter };
}

/**
 * Forgets the attempts for one bucket, called after a successful sign-in.
 *
 * Without it a person who mistyped twice and then succeeded would carry those
 * failures for the rest of the window, and could be refused on their next
 * legitimate sign-in.
 */
export async function clearAttempts(action: string, key: string): Promise<void> {
  await db.authAttempt.deleteMany({
    where: { key: `${action}:${key.toLowerCase()}` },
  });
}

/** A human sentence for a refusal, in the app's language. */
export function retryMessage(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1
    ? 'Trop de tentatives. Réessayez dans une minute.'
    : `Trop de tentatives. Réessayez dans ${minutes} minutes.`;
}

/**
 * Removes attempts nobody will read again.
 *
 * Called from the nightly cron. Without it the table grows without bound: the
 * rows are only ever read inside a window measured in minutes, so anything
 * older than a day is dead weight.
 */
export async function purgeOldAttempts(): Promise<number> {
  const { count } = await db.authAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  return count;
}
