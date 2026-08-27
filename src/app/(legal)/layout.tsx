import Link from 'next/link';
import type { ReactNode } from 'react';
import { getLocale, getT } from '@/lib/i18n/server';
import { LANDING, pathFor } from '@/lib/public-pages';
import { LanguageLink } from '@/components/LanguageLink';
import styles from './legal.module.css';

/**
 * The frame for the pages nobody reads until they need them.
 *
 * Deliberately outside the app shell: these have to be reachable signed out,
 * from a footer, and they carry no navigation of their own.
 */
export default async function LegalLayout({ children }: { children: ReactNode }) {
  const t = await getT();
  const locale = await getLocale();

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.topBar}>
          <Link href={pathFor(LANDING, locale)} className={styles.back}>
            ← {t('legal.backHome')}
          </Link>
          <LanguageLink className={styles.language} />
        </div>
        {children}
      </div>
    </div>
  );
}
