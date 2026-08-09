import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import styles from './legalFooter.module.css';

/**
 * The links that have to exist for the pages to count as published.
 *
 * Mentions légales are only "mises à disposition du public" if the public can
 * reach them, so a page nobody links to satisfies nothing. Kept to three
 * quiet links: this is a footer, not a section.
 */
export async function LegalFooter() {
  const t = await getT();

  return (
    <footer className={styles.footer}>
      <Link href="/mentions-legales" className={styles.link}>
        {t('legal.footerNotice')}
      </Link>
      <Link href="/confidentialite" className={styles.link}>
        {t('legal.footerPrivacy')}
      </Link>
      <Link href="/conditions" className={styles.link}>
        {t('legal.footerTerms')}
      </Link>
    </footer>
  );
}
