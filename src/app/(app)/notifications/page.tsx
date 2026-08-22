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

  /*
   * The count is asked of the database, not derived from the page.
   *
   * Counting unread rows within the 50 fetched missed any that had fallen
   * past the cutoff, so somebody with a long history saw "tout marquer comme
   * lu" disappear while unread notifications were still waiting behind it.
   */
  const [notifications, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);

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
                {/* aria-label on a bare span with no role is not reliably
                    exposed, so the unread state rested on colour alone. The
                    dot is decorative now and the word carries the meaning. */}
                {!n.read && (
                  <>
                    <span className={styles.dot} aria-hidden />
                    <span className="srOnly">{t('notifications.unread')}</span>
                  </>
                )}
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
