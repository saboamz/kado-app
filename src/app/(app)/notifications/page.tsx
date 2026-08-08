import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/display';
import { BellIcon } from '@/components/icons';
import { MarkAllRead } from '@/components/MarkAllRead';
import { PageHeader } from '@/components/PageHeader';
import { db } from '@/lib/db';
import { formatRelative } from '@/lib/format';
import { requireUser } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import styles from './notifications.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('notifications.title') };
}

export default async function NotificationsPage() {
  const t = await getT();
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
        title={t('notifications.title')}
        actions={unread > 0 && <MarkAllRead />}
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<BellIcon size={24} />}
          title={t('notifications.emptyTitle')}
          body={t('notifications.emptyBody')}
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
                {!n.read && <span className={styles.dot} aria-label={t('notifications.unread')} />}
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
