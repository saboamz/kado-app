import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/site';
import { TERMS } from '@/lib/public-pages';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import styles from '../legal.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return pageMetadata(TERMS, t('legal.termsTitle'), t('legal.termsDescription'));
}

export default async function TermsPage() {
  const t = await getT();

  return (
    <article className={styles.article}>
      <BreadcrumbSchema page={TERMS} name={t('legal.termsTitle')} />
      <h1 className={styles.title}>{t('legal.termsTitle')}</h1>
      <p className={styles.updated}>{t('legal.updated')}</p>
      <p className={styles.lede}>{t('legal.termsIntro')}</p>

      <h2 className={styles.heading}>{t('legal.termsAccess')}</h2>
      <p className={styles.body}>{t('legal.termsAccessBody')}</p>

      <h2 className={styles.heading}>{t('legal.termsContent')}</h2>
      <p className={styles.body}>{t('legal.termsContentBody')}</p>

      {/* Spelled out because nothing scans an upload: the rule is the only
          control there is, and the report link is how it is enforced. */}
      <h2 className={styles.heading}>{t('legal.termsImages')}</h2>
      <p className={styles.body}>{t('legal.termsImagesBody')}</p>

      <h2 className={styles.heading}>{t('legal.termsReport')}</h2>
      <p className={styles.body}>{t('legal.termsReportBody')}</p>

      <h2 className={styles.heading}>{t('legal.termsAvailability')}</h2>
      <p className={styles.body}>{t('legal.termsAvailabilityBody')}</p>

      <h2 className={styles.heading}>{t('legal.termsEnd')}</h2>
      <p className={styles.body}>{t('legal.termsEndBody')}</p>
    </article>
  );
}
