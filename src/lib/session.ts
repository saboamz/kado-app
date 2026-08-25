import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db } from './db';

const COOKIE = 'kadlio_session';
const DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  /** Which language to render in. Carried here so resolving it costs no
      extra query — every page already loads the session user. */
  locale: string;
};

/*
 * The session token, and why it is not the row's own id.
 *
 * ── Why it is generated here ───────────────────────────────────────────────
 *
 * The cookie used to carry `Session.id`, which Prisma fills with cuid(). A
 * cuid is a timestamp, a counter, a machine fingerprint and Math.random() —
 * three of those are guessable and the fourth is not a CSPRNG. As a bearer
 * credential that is far below the ~128 bits a session needs, and forging one
 * is account takeover. invite-actions.ts already used randomBytes for an
 * invite code, with a comment explaining that a guessable one is
 * unacceptable; the session was the one place that did not.
 *
 * ── Why the database stores a hash ─────────────────────────────────────────
 *
 * The row's id is SHA-256 of the token, never the token. Anything that reads
 * the table — a backup, a replica, an injection elsewhere — comes away with
 * digests, and a digest cannot be presented as a cookie. The lookup stays a
 * primary-key hit, so this costs nothing.
 *
 * SHA-256 unsalted is right here and would be wrong for a password: the input
 * is 256 bits of CSPRNG output, so there is no dictionary to run and no
 * work factor to buy.
 */
function issueToken(): { token: string; id: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, id: sessionId(token) };
}

function sessionId(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Issues a session row and sets its httpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + DURATION_MS);
  const { token, id } = issueToken();
  await db.session.create({ data: { id, userId, expiresAt } });

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    /*
     * Secure unless explicitly allowed otherwise.
     *
     * Keyed on NODE_ENV this was false on any deployment not built as
     * "production" — a staging box would have sent the cookie in clear. The
     * opt-out is now a deliberate flag, so http://localhost keeps working and
     * nothing else does by accident.
     */
    secure: process.env.ALLOW_INSECURE_COOKIES !== '1',
    /*
     * strict, not lax.
     *
     * Nothing in the product needs the cookie on a cross-site navigation: the
     * invite link at /i/<code> is built to be read signed out. lax would still
     * attach it to a top-level GET from anywhere.
     */
    sameSite: 'strict',
    expires: expiresAt,
    path: '/',
  });
}

/**
 * Resolves the signed-in user, or null.
 *
 * Wrapped in React's `cache` so a page that asks several times during one
 * render costs a single query.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const id = sessionId(token);

  /*
   * The user is fetched separately, NOT through the relation.
   *
   * Prisma resolves a relation as a second query, and on a REQUIRED one it
   * asserts that query cannot come back empty — `include` and `select` alike
   * throw "Inconsistent query result: Field user is required" when it does.
   * Deleting an account opens exactly that window: the session row has been
   * read, the cascade removes its user, and the relation query then finds
   * nothing.
   *
   * The result is a 500 on the landing page for anyone who deletes their
   * account with a second tab open, and an intermittent e2e failure whenever
   * the account-deletion spec overlaps another spec loading a page.
   *
   * Two independent reads have no such assertion: a missing user is null,
   * which is the answer this function already knows how to give.
   */
  const session = await db.session.findUnique({
    where: { id },
    select: { expiresAt: true, userId: true },
  });
  if (!session) return null;

  // Expired sessions are treated as absent and cleaned up opportunistically.
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id } }).catch(() => {});
    return null;
  }

  return db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      theme: true,
      locale: true,
    },
  });
});

/** The signed-in user, or a thrown redirect to the sign-in page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Drops the session row and clears the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await db.session.delete({ where: { id: sessionId(token) } }).catch(() => {});
  }
  store.delete(COOKIE);
}

/**
 * Every session for one account, gone at once.
 *
 * For the moments a password changes because somebody else may know it —
 * the signed-in change and the e-mailed reset both end every open session.
 * Returns the un-awaited Prisma promise on purpose: both callers run it
 * inside the $transaction that writes the new hash, so the sessions and the
 * password can never disagree about which credential is current.
 */
export function destroyAllSessions(userId: string) {
  return db.session.deleteMany({ where: { userId } });
}

export const SESSION_COOKIE = COOKIE;
