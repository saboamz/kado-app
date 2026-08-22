import Link from 'next/link';
import type { ReactNode } from 'react';
import { getT } from '@/lib/i18n/server';
import styles from './marketing.module.css';

/**
 * The frame for the intent pages — one public page per search query.
 *
 * Same shape as the legal frame: reachable signed out, a way back to the
 * landing, and a reading column. Kept separate because these pages will grow
 * things the legal ones must never have — calls to action, cross-links.
 */
export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const t = await getT();

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <Link href="/" className={styles.back}>
          ← {t('legal.backHome')}
        </Link>
        {children}
      </div>
    </div>
  );
}
