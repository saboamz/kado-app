import Link from 'next/link';
import { ButtonLink } from '@/components/Button';
import { getT } from '@/lib/i18n/server';
import { INTENT_PAGES, type IntentKey } from '@/lib/intent-pages';
import styles from './marketing.module.css';

/**
 * The shape every intent page shares.
 *
 * One page answers one search query, and they all answer it the same way: a
 * claim, three facts, the questions a visitor actually has, an invitation to
 * start, and the way to the sibling pages. The copy lives in the dictionaries
 * under `seo.<key>.*`, so a page differs from its siblings by its words and
 * nothing else — which is the point: the template is not the content.
 *
 * The FAQ is emitted twice on purpose: once as HTML for the reader, once as
 * schema.org FAQPage for the crawler. Both are built from the same strings,
 * because Google treats a schema that says more than the page as spam.
 */
export async function IntentPage({ page }: { page: IntentKey }) {
  const t = await getT();

  const sections = [
    { title: t(`seo.${page}.s1Title`), body: t(`seo.${page}.s1Body`) },
    { title: t(`seo.${page}.s2Title`), body: t(`seo.${page}.s2Body`) },
    { title: t(`seo.${page}.s3Title`), body: t(`seo.${page}.s3Body`) },
  ];

  const faq = [
    { q: t(`seo.${page}.faq1q`), a: t(`seo.${page}.faq1a`) },
    { q: t(`seo.${page}.faq2q`), a: t(`seo.${page}.faq2a`) },
    { q: t(`seo.${page}.faq3q`), a: t(`seo.${page}.faq3a`) },
    { q: t(`seo.${page}.faq4q`), a: t(`seo.${page}.faq4a`) },
  ];

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  const others = INTENT_PAGES.filter((entry) => entry.key !== page);

  return (
    <article className={styles.article}>
      <script
        type="application/ld+json"
        // Built from our own dictionary strings; no user input reaches it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }}
      />

      <h1 className={styles.title}>{t(`seo.${page}.h1`)}</h1>
      <p className={styles.lede}>{t(`seo.${page}.lede`)}</p>

      {sections.map((section) => (
        <section key={section.title}>
          <h2 className={styles.heading}>{section.title}</h2>
          <p className={styles.body}>{section.body}</p>
        </section>
      ))}

      <section>
        <h2 className={styles.heading}>{t('seo.faqTitle')}</h2>
        {faq.map((item) => (
          <div key={item.q}>
            <h3 className={styles.question}>{item.q}</h3>
            <p className={styles.body}>{item.a}</p>
          </div>
        ))}
      </section>

      <section className={styles.cta}>
        <h2 className={styles.heading}>{t('seo.ctaTitle')}</h2>
        <p className={styles.ctaBody}>{t('seo.ctaBody')}</p>
        <div className={styles.actions}>
          <ButtonLink href="/signup">{t('landing.createAccount')}</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            {t('auth.signIn')}
          </ButtonLink>
        </div>
      </section>

      <nav className={styles.others} aria-label={t('seo.othersTitle')}>
        <h2 className={styles.heading}>{t('seo.othersTitle')}</h2>
        <ul className={styles.othersList}>
          {others.map((entry) => (
            <li key={entry.slug}>
              <Link href={entry.slug} className={styles.othersLink}>
                {t(`seo.${entry.key}.navLabel`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
