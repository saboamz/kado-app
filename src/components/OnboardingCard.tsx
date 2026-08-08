'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { dismissOnboarding } from '@/lib/onboarding-actions';
import type { Onboarding } from '@/lib/onboarding';
import styles from './onboardingCard.module.css';

/**
 * The getting-started checklist, at the top of the home page.
 *
 * ── Why the done steps stay on screen ──────────────────────────────────────
 *
 * Dropping each step as it is completed would shrink the card to nothing and
 * lose the one thing a checklist is for: seeing that you are getting
 * somewhere. Ticked rows stay, dimmed, and stop being links — there is
 * nothing left to do on them.
 */
export function OnboardingCard({ onboarding }: { onboarding: Onboarding }) {
  const { steps, doneCount } = onboarding;
  const [dismissing, startDismiss] = useTransition();

  return (
    <section className={styles.card} aria-labelledby='onboarding-title'>
      <div className={styles.head}>
        <div>
          <h2 id='onboarding-title' className={styles.title}>
            Pour bien commencer
          </h2>
          <p className={styles.progress}>
            {doneCount} sur {steps.length} — quelques minutes, pas plus.
          </p>
        </div>

        <button
          type='button'
          className={styles.dismiss}
          disabled={dismissing}
          onClick={() => startDismiss(() => void dismissOnboarding())}
        >
          {dismissing ? '…' : 'Masquer'}
        </button>
      </div>

      {/* A real progress element: the bar is the value, so assistive tech
          reads the same thing the eye does without a parallel announcement. */}
      <progress className={styles.bar} value={doneCount} max={steps.length}>
        {doneCount} sur {steps.length}
      </progress>

      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={styles.step}
            data-done={step.done || undefined}
          >
            <span className={styles.marker} aria-hidden>
              {step.done ? '✓' : index + 1}
            </span>

            <div className={styles.text}>
              <span className={styles.stepTitle}>
                {step.title}
                {step.done && <span className='srOnly'> — terminé</span>}
              </span>
              {!step.done && <span className={styles.body}>{step.body}</span>}
            </div>

            {!step.done && (
              <Link href={step.href} className={styles.cta}>
                {step.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
