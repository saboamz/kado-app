import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db } from './db';

const COOKIE = 'kado_session';
const DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
};

/** Issues a session row and sets its httpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + DURATION_MS);
  const session = await db.session.create({ data: { userId, expiresAt } });

  const store = await cookies();
  store.set(COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
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
  const id = store.get(COOKIE)?.value;
  if (!id) return null;

  const session = await db.session.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarColor: true,
          theme: true,
        },
      },
    },
  });
  if (!session) return null;

  // Expired sessions are treated as absent and cleaned up opportunistically.
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id } }).catch(() => {});
    return null;
  }

  return session.user;
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
  const id = store.get(COOKIE)?.value;
  if (id) await db.session.delete({ where: { id } }).catch(() => {});
  store.delete(COOKIE);
}

export const SESSION_COOKIE = COOKIE;
