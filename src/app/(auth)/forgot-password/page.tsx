'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestPasswordReset } from '@/lib/auth-actions';
import { useErrorText, useT } from '@/lib/i18n/client';
import { Field } from '@/components/Field';
import { SubmitButton } from '@/components/SubmitButton';
import styles from '../auth.module.css';

export default function ForgotPasswordPage() {
  const t = useT();
  const errorText = useErrorText();
  const [state, action] = useActionState(requestPasswordReset, {});

  return (
    <>
      <div>
        <h1 className={styles.title}>{t('auth.forgotTitle')}</h1>
        <p className={styles.subtitle}>{t('auth.forgotLede')}</p>
      </div>

      {state.done ? (
        // The form goes away with the answer: there is nothing more to type,
        // and role="status" reads the confirmation out to a screen reader.
        // Deliberately the same sentence whether or not an account exists —
        // this page must not say which addresses are registered.
        <p className={styles.subtitle} role="status">
          {t('auth.forgotSent')}
        </p>
      ) : (
        <form action={action} className={styles.form} noValidate>
          {state.errors?.form && (
            <p className={styles.formError} role="alert">
              {errorText(state.errors.form)}
            </p>
          )}
          <Field
            id="email"
            name="email"
            type="email"
            label={t('auth.email')}
            autoComplete="email"
            inputMode="email"
            required
            error={state.errors?.email}
          />
          <SubmitButton pendingLabel={t('auth.forgotSending')}>
            {t('auth.forgotSend')}
          </SubmitButton>
        </form>
      )}

      <p className={styles.footer}>
        <Link href="/login">{t('auth.backToLogin')}</Link>
      </p>
    </>
  );
}
