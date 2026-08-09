import Link from 'next/link';
import type { ReactNode } from 'react';
import { getT } from '@/lib/i18n/server';
import styles from './legal.module.css';

/**
 * The frame for the pages nobody reads until they need them.
 *
 * Deliberately outside the app shell: these have to be reachable signed out,
 * from a footer, and they carry no navigation of their own.
 */
export default async function LegalLayout({ children }: { children: ReactNode }) {
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
