import Link from 'next/link';
import { getLocale, getT } from '@/lib/i18n/server';
import { LEGAL_NOTICE, PRIVACY, TERMS, pathFor } from '@/lib/public-pages';
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
  // Each of these has two addresses; a French footer on an English page would
  // hand the reader back a language they just left.
  const locale = await getLocale();

  return (
    <footer className={styles.footer}>
      <Link href={pathFor(LEGAL_NOTICE, locale)} className={styles.link}>
        {t('legal.footerNotice')}
      </Link>
      <Link href={pathFor(PRIVACY, locale)} className={styles.link}>
        {t('legal.footerPrivacy')}
      </Link>
      <Link href={pathFor(TERMS, locale)} className={styles.link}>
        {t('legal.footerTerms')}
      </Link>
    </footer>
  );
}
