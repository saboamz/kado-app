import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/site';
import { PRIVACY } from '@/lib/public-pages';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import styles from '../legal.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return pageMetadata(PRIVACY, t('legal.privacyTitle'), t('legal.privacyDescription'));
}

/**
 * Written from the code, not from a template.
 *
 * Every figure here was read out of the app: 30 days is DURATION_MS in
 * session.ts, 24 hours is what purgeOldAttempts deletes, and the list of
 * third parties is the set of hosts the server actually calls. A privacy
 * policy that describes a generic app is worse than none: it is a statement
 * about a system nobody checked.
 */
export default async function PrivacyPage() {
  const t = await getT();

  return (
    <article className={styles.article}>
      <BreadcrumbSchema page={PRIVACY} name={t('legal.privacyTitle')} />
      <h1 className={styles.title}>{t('legal.privacyTitle')}</h1>
      <p className={styles.updated}>{t('legal.updated')}</p>
      <p className={styles.lede}>{t('legal.privacyIntro')}</p>

      <h2 className={styles.heading}>{t('legal.controller')}</h2>
      <p className={styles.body}>{t('legal.controllerBody')}</p>

      <h2 className={styles.heading}>{t('legal.collected')}</h2>
      <ul className={styles.list}>
        <li>{t('legal.collectedAccount')}</li>
        <li>{t('legal.collectedOptional')}</li>
        <li>{t('legal.collectedSurvey')}</li>
        <li>{t('legal.collectedUse')}</li>
        <li>{t('legal.collectedTech')}</li>
      </ul>

      <h2 className={styles.heading}>{t('legal.why')}</h2>
      <p className={styles.body}>{t('legal.whyBody')}</p>

      <h2 className={styles.heading}>{t('legal.retention')}</h2>
      <p className={styles.body}>{t('legal.retentionBody')}</p>

      <h2 className={styles.heading}>{t('legal.thirdParties')}</h2>
      <p className={styles.body}>{t('legal.thirdPartiesBody')}</p>

      <h2 className={styles.heading}>{t('legal.cookies')}</h2>
      <p className={styles.body}>{t('legal.cookiesBody')}</p>

      {/* Its own section rather than a line in the cookie one: this is a
          different thing being done for a different reason, and burying it
          under "cookies" would be technically true and practically hidden. */}
      <h2 className={styles.heading}>{t('legal.measurement')}</h2>
      <p className={styles.body}>{t('legal.measurementBody')}</p>

      {/* Recording a click is a different activity from measuring audience:
          it is tied to an account rather than anonymous, and it feeds the
          suggestions. Folding it into the section above would describe it
          as something it is not. */}
      <h2 className={styles.heading}>{t('legal.outbound')}</h2>
      <p className={styles.body}>{t('legal.outboundBody')}</p>

      <h2 className={styles.heading}>{t('legal.rights')}</h2>
      <p className={styles.body}>{t('legal.rightsBody')}</p>

      {/* The one thing a generic policy would never say, and the thing this
          app is actually built around. */}
      <h2 className={styles.heading}>{t('legal.secretNote')}</h2>
      <p className={styles.body}>{t('legal.secretNoteBody')}</p>
    </article>
  );
}
