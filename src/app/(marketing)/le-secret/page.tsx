import type { Metadata } from 'next';
import Link from 'next/link';
import { ButtonLink } from '@/components/Button';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { getLocale, getT } from '@/lib/i18n/server';
import { PRIVACY, SECRET, pathFor } from '@/lib/public-pages';
import { pageMetadata } from '@/lib/site';
import styles from '../marketing.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return pageMetadata(SECRET, t('secret.title'), t('secret.metaDescription'));
}

/**
 * The one claim nobody else in this market can copy without building it.
 *
 * Every competitor says "secure" and stops. What Kadlio can say instead is
 * mechanical and checkable — an owner's payload for a claimed gift is the
 * same bytes as for a free one, because the rows are never fetched — and it
 * was written down only in the repository README, where no visitor goes.
 *
 * It doubles as the page explaining what this project is. There is no "about
 * us" to write: the editor is anonymous on purpose and by law, so the honest
 * answer to "who is behind this" is the set of choices they made, which is
 * what the closing list states.
 *
 * Every sentence here is checkable against src/lib/secrecy.ts. If that file
 * changes, this page is what has to come back into step — which is the same
 * rule the privacy policy already follows.
 */
export default async function SecretPage() {
  const t = await getT();
  const locale = await getLocale();

  const sections = [
    { title: t('secret.ruleTitle'), body: t('secret.ruleBody') },
    { title: t('secret.interfaceTitle'), body: t('secret.interfaceBody') },
    { title: t('secret.boundaryTitle'), body: t('secret.boundaryBody') },
    { title: t('secret.provenTitle'), body: t('secret.provenBody') },
    { title: t('secret.friendsTitle'), body: t('secret.friendsBody') },
    { title: t('secret.moneyTitle'), body: t('secret.moneyBody') },
  ];

  const principles = [
    t('secret.principle1'),
    t('secret.principle2'),
    t('secret.principle3'),
  ];

  const faq = [
    { q: t('secret.faq1q'), a: t('secret.faq1a') },
    { q: t('secret.faq2q'), a: t('secret.faq2a') },
    { q: t('secret.faq3q'), a: t('secret.faq3a') },
  ];

  // Built from the same strings the reader sees, for the reason the intent
  // pages give: a schema that says more than the page is read as spam.
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <article className={styles.article}>
      <BreadcrumbSchema page={SECRET} name={t('secret.navLabel')} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }}
      />

      <h1 className={styles.title}>{t('secret.h1')}</h1>
      <p className={styles.lede}>{t('secret.lede')}</p>

      <p className={styles.leadAction}>
        <ButtonLink href="/signup">{t('landing.createAccount')}</ButtonLink>
      </p>

      {sections.map((section) => (
        <section key={section.title}>
          <h2 className={styles.heading}>{section.title}</h2>
          <p className={styles.body}>{section.body}</p>
        </section>
      ))}

      <section>
        <h2 className={styles.heading}>{t('secret.principlesTitle')}</h2>
        <ul className={styles.principles}>
          {principles.map((principle) => (
            <li key={principle} className={styles.body}>
              {principle}
            </li>
          ))}
        </ul>
        <p className={styles.body}>
          <Link href={pathFor(PRIVACY, locale)} className={styles.othersLink}>
            {t('secret.privacyLink')}
          </Link>
        </p>
      </section>

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
    </article>
  );
}
