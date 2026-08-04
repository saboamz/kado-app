import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/display';
import { BellIcon } from '@/components/icons';
import { MarkAllRead } from '@/components/MarkAllRead';
import { PageHeader } from '@/components/PageHeader';
import { db } from '@/lib/db';
import { formatRelative } from '@/lib/format';
import { requireUser } from '@/lib/session';
import styles from './notifications.module.css';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={unread > 0 && <MarkAllRead />}
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<BellIcon size={24} />}
          title="Rien de neuf"
          body="Les anniversaires, nouvelles listes et demandes d'amis apparaîtront ici."
        />
      ) : (
        <ul className={styles.list}>
          {notifications.map((n) => {
            const body = (
              <>
                <span className={styles.body}>{n.body}</span>
                <span className={styles.time}>
                  {formatRelative(n.createdAt)}
                </span>
              </>
            );

            return (
              <li
                key={n.id}
                className={styles.item}
                data-unread={n.read ? undefined : ''}
              >
                {!n.read && <span className={styles.dot} aria-label="Non lue" />}
                {n.href ? (
                  <Link href={n.href} className={styles.link}>
                    {body}
                  </Link>
                ) : (
                  <span className={styles.link}>{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
