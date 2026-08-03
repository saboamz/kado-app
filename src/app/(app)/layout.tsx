import { AppShell } from '@/components/AppShell';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';

/**
 * Everything under this layout requires a session.
 *
 * Guarding here rather than in middleware means the check runs against the
 * database, not against an unverified cookie, and every nested page inherits it.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const unreadCount = await db.notification.count({
    where: { userId: user.id, read: false },
  });

  return <AppShell unreadCount={unreadCount}>{children}</AppShell>;
}
