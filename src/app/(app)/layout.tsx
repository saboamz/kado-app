import { AppShell } from '@/components/AppShell';
import { db } from '@/lib/db';
import { getT } from '@/lib/i18n/server';
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
  const t = await getT();

  // The avatar is read here rather than added to SessionUser: getCurrentUser
  // runs on every request under this layout, and the desktop bar is the only
  // thing that needs the photo.
  const [unreadCount, profile] = await Promise.all([
    db.notification.count({ where: { userId: user.id, read: false } }),
    db.user.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true },
    }),
  ]);

  return (
    <AppShell
      unreadCount={unreadCount}
      user={{ name: user.name, avatarUrl: profile?.avatarUrl ?? null }}
      labels={{
        main: t('nav.main'),
        home: t('nav.home'),
        lists: t('nav.lists'),
        search: t('nav.search'),
        alerts: t('nav.alerts'),
        profile: t('nav.profile'),
        unread: t('nav.unread', { count: unreadCount }),
      }}
    >
      {children}
    </AppShell>
  );
}
