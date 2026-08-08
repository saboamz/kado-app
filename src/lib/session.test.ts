import { db } from './db';
import { cleanup, makeUser } from '@/test/factories';

/**
 * Resolving a session whose user is gone.
 *
 * getCurrentUser() itself reads a cookie, so it is exercised end to end in
 * the e2e suite. What is worth pinning here is the QUERY SHAPE it uses,
 * because that is where the bug was: a required relation traversed with
 * `include` (or `select` — both behave the same) makes Prisma assert the
 * related row exists, and it throws rather than returning null when it does
 * not.
 *
 * That window is real. Deleting an account cascades its sessions away, but a
 * request that already read the session row then resolves the relation
 * against a user that no longer exists — a 500 on the landing page for
 * anyone who deletes their account with a second tab open, and the cause of
 * an intermittent e2e failure when the deletion spec overlapped another.
 */
let userId: string;
let sessionId: string;

/** The orphan the race produces, which the cascade normally prevents. */
const orphanSession = async () => {
  const user = await makeUser('Compte Supprimé');
  userId = user.id;
  const session = await db.session.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  sessionId = session.id;

  await db.$executeRawUnsafe(
    'ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey"',
  );
  await db.$executeRawUnsafe('DELETE FROM "User" WHERE id = $1', user.id);
  return session.id;
};

afterAll(async () => {
  await db.$executeRawUnsafe('DELETE FROM "Session" WHERE id = $1', sessionId);
  await db.$executeRawUnsafe(
    'ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE',
  );
  await cleanup([userId]);
  await db.$disconnect();
});

describe('a session whose account was deleted mid-request', () => {
  it('reads as signed out rather than throwing', async () => {
    const id = await orphanSession();

    // The two independent reads getCurrentUser() performs. A missing user is
    // null here, which is an answer the caller already handles.
    const session = await db.session.findUnique({
      where: { id },
      select: { expiresAt: true, userId: true },
    });
    expect(session).not.toBeNull();

    const user = await db.user.findUnique({
      where: { id: session!.userId },
      select: { id: true, email: true, name: true, theme: true },
    });

    expect(user).toBeNull();
  });

  it('would throw if the user were fetched through the relation', async () => {
    // The shape this replaced, kept as the reason the shape above exists. If
    // Prisma ever stops asserting required relations this fails, and the
    // simpler query becomes available again.
    await expect(
      db.session.findUnique({
        where: { id: sessionId },
        include: { user: { select: { id: true } } },
      }),
    ).rejects.toThrow(/Inconsistent query result/);
  });
});
