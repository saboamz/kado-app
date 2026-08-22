import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import styles from '../legal.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('legal.noticeTitle') };
}

/**
 * Mentions légales, LCEN article 6-III.
 *
 * ── Why no name appears here ───────────────────────────────────────────────
 *
 * 6-III-2 lets a NON-PROFESSIONAL publisher stay anonymous to the public,
 * provided the host holds their identity and can hand it to a court. Kadlio is
 * free, carries no advertising and earns nothing, so that applies.
 *
 * It stops applying the day the service monetises — advertising, affiliate
 * links on the shop URLs it already stores, a paid tier. At that point the
 * publisher's name and address become mandatory in clear.
 */
export default async function LegalNoticePage() {
  const t = await getT();

  return (
    <article className={styles.article}>
      <h1 className={styles.title}>{t('legal.noticeTitle')}</h1>
      <p className={styles.updated}>{t('legal.updated')}</p>

      <h2 className={styles.heading}>{t('legal.publisher')}</h2>
      <p className={styles.body}>{t('legal.publisherBody')}</p>

      <h2 className={styles.heading}>{t('legal.director')}</h2>
      <p className={styles.body}>{t('legal.directorBody')}</p>

      <h2 className={styles.heading}>{t('legal.host')}</h2>
      <p className={styles.body}>
        Vercel Inc.
        <br />
        440 N Barranca Ave #4133, Covina, CA 91723, États-Unis
        <br />
        <a href="https://vercel.com" className={styles.link}>
          vercel.com
        </a>
      </p>
      <p className={`${styles.body} ${styles.spaced}`}>{t('legal.hostDataBody')}</p>

      <h2 className={styles.heading}>{t('legal.contact')}</h2>
      <p className={styles.body}>
        <a href="mailto:sabri9595@gmail.com" className={styles.link}>
          sabri9595@gmail.com
        </a>
      </p>
    </article>
  );
}
