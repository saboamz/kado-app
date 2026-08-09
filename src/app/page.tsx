import { redirect } from 'next/navigation';
import { ButtonLink } from '@/components/Button';
import { getCurrentUser } from '@/lib/session';
import { LegalFooter } from '@/components/LegalFooter';
import { getT } from '@/lib/i18n/server';
import styles from './landing.module.css';

/**
 * The page for somebody who has never heard of this.
 *
 * ── Who arrives here ───────────────────────────────────────────────────────
 *
 * Not people who were invited — an invitation link lands on /i/[code] with
 * the inviter's name already on screen. This page gets search results, a URL
 * pasted without context, and word of mouth. Every one of them arrives
 * knowing nothing, so the first job is to say what Kado IS, in words that
 * need no decoding.
 *
 * The previous version opened with "des listes de souhaits que vos proches
 * remplissent en secret", which reads as though the friends fill the list.
 * They do not: you fill it, they claim from it. A visitor had to work that
 * out, and most will not bother.
 *
 * ── Why the app is drawn rather than screenshotted ─────────────────────────
 *
 * The one thing this product needs to convey is what an owner does NOT see,
 * and no amount of prose does that as well as two cards side by side. Built
 * from the same tokens as the real thing, so it follows the theme, survives
 * a redesign, needs no image to load and no alt text to go stale.
 */
export default async function LandingPage() {
  const t = await getT();
  // Someone already signed in has no use for the pitch.
  if (await getCurrentUser()) redirect('/app');

  const steps = [
    { title: t('landing.step1Title'), body: t('landing.step1Body') },
    { title: t('landing.step2Title'), body: t('landing.step2Body') },
    { title: t('landing.step3Title'), body: t('landing.step3Body') },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.brand}>
            <span className={styles.mark} aria-hidden>
              K
            </span>
            Kado
          </span>
          {/* Says what kind of thing this is before the pitch does. */}
          <span className={styles.tagline}>{t('landing.tagline')}</span>
        </header>

        <h1 className={styles.title}>{t('landing.h1')}</h1>
        <p className={styles.lede}>{t('landing.intro')}</p>

        <div className={styles.actions}>
          <ButtonLink href="/signup">{t('landing.createAccount')}</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            {t('auth.signIn')}
          </ButtonLink>
        </div>

        {/*
          The product, in one look.

          Two views of the same gift: what its owner sees, and what everybody
          else sees. The gap between the two cards IS the product, and it is
          the one thing prose keeps failing to land.
        */}
        <div className={styles.demo}>
          <figure className={styles.demoPane}>
            <figcaption className={styles.demoLabel}>
              {t('landing.demoOwner')}
            </figcaption>
            <div className={styles.card}>
              <span className={styles.cardTitle}>{t('landing.demoGift')}</span>
              <span className={styles.cardPrice}>60 €</span>
              <span className={styles.cardQuiet}>{t('landing.demoNothing')}</span>
            </div>
          </figure>

          <figure className={styles.demoPane}>
            <figcaption className={styles.demoLabel}>
              {t('landing.demoFriend')}
            </figcaption>
            <div className={`${styles.card} ${styles.cardSecret}`}>
              <span className={styles.cardTitle}>{t('landing.demoGift')}</span>
              <span className={styles.cardPrice}>60 €</span>
              <span className={styles.cardBadge}>{t('landing.demoTaken')}</span>
              <span className={styles.cardPot}>{t('landing.demoPot')}</span>
              <span className={styles.cardBar} aria-hidden>
                <span className={styles.cardBarFill} />
              </span>
            </div>
          </figure>
        </div>

        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className={styles.stepNumber} aria-hidden>
                {index + 1}
              </span>
              <span className={styles.stepText}>
                <strong>{step.title}</strong>
                {step.body}
              </span>
            </li>
          ))}
        </ol>

        <section className={styles.secret}>
          <h2 className={styles.secretTitle}>{t('landing.secretTitle')}</h2>
          <p className={styles.secretBody}>{t('landing.secretBody')}</p>
        </section>

        {/* Mentions légales only count as published if the public can reach
            them, so the links have to exist somewhere signed out. */}
        <LegalFooter />
      </div>
    </main>
  );
}
