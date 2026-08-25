import { db } from './db';
import type { TFunction } from './i18n/t';

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

/*
 * Password reset requests. What is being limited is the outbound e-mail —
 * each request sends a real one, on our sending reputation — so every
 * attempt counts, whether or not the address has an account: only charging
 * the ones that do would turn this throttle into an oracle for which
 * addresses are registered.
 *
 * Per e-mail is tight (three links an hour is plenty for a lost password);
 * per IP is looser, because a household shares one address.
 */
export const RESET_PER_EMAIL: Limit = { attempts: 3, windowSeconds: 60 * 60 };
export const RESET_PER_IP: Limit = { attempts: 10, windowSeconds: 60 * 60 };

/**
 * Outbound page reads, per signed-in person.
 *
 * Saving a gift with a link makes our server fetch a URL the user chose. Left
 * unbounded that is a free relay: a loop of saves becomes a burst of requests
 * from our address to a target of their choosing, and on a metered plan it
 * spends the function quota too.
 *
 * Keyed on the user rather than the IP because the action already requires a
 * session, and a household sharing an address should not share this budget.
 * Generous enough that nobody adding wishes by hand will ever meet it — forty
 * links in an hour is far past what a person does.
 */
export const LINK_FETCH_PER_USER: Limit = { attempts: 40, windowSeconds: 60 * 60 };

/**
 * Writes that cost storage or somebody else's attention.
 *
 * None of these had a limit. An upload is 4MB of disk or Blob per call and
 * there is no quota behind it; a friend request and a report both put
 * something in front of another person; a chat message is a row nobody else
 * asked for. All four are cheap to fire in a loop and none of them is
 * something a person does dozens of times an hour.
 *
 * Deliberately generous: these are ceilings against a script, not pacing for
 * a human. Somebody adding photos to a new list should never meet them.
 */
export const UPLOAD_PER_USER: Limit = { attempts: 60, windowSeconds: 60 * 60 };
export const FRIEND_REQUEST_PER_USER: Limit = { attempts: 40, windowSeconds: 60 * 60 };
export const REPORT_PER_USER: Limit = { attempts: 20, windowSeconds: 24 * 60 * 60 };
export const CHAT_PER_USER: Limit = { attempts: 120, windowSeconds: 60 * 60 };

export type LimitResult = { allowed: true } | { allowed: false; retryAfter: number };

/** Lower-cased and namespaced, so two limits never share a bucket. */
function bucketFor(action: string, key: string): string {
  return `${action}:${key.toLowerCase()}`;
}

/**
 * Records one attempt against a bucket.
 *
 * WHICH attempts get recorded is the caller's decision, and the two callers
 * differ on purpose:
 *
 *  - sign-in records only FAILURES. Counting successes would make a shared
 *    address — a household, an office, a school — throttle itself simply by
 *    using the app, and the limit is meant to slow guessing, not use.
 *  - the link resolver records EVERY attempt, because there the cost being
 *    limited is the outbound request itself, and a successful fetch costs
 *    exactly as much as a failed one.
 */
export async function recordAttempt(action: string, key: string): Promise<void> {
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
export function retryMessage(seconds: number, t: TFunction): string {
  return t('error.retryMinutes', { count: Math.ceil(seconds / 60) });
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
