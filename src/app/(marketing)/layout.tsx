import Link from 'next/link';
import type { ReactNode } from 'react';
import { getLocale, getT } from '@/lib/i18n/server';
import { LANDING, pathFor } from '@/lib/public-pages';
import { LanguageLink } from '@/components/LanguageLink';
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
