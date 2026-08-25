'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { resetPassword } from '@/lib/auth-actions';
import { useErrorText, useT } from '@/lib/i18n/client';
import { Field } from '@/components/Field';
import { SubmitButton } from '@/components/SubmitButton';
import styles from '../auth.module.css';

/**
 * Where the e-mailed link lands. The token rides the URL into a hidden
 * field — the action, not this page, decides whether it is still good, so
 * an expired link fails with a sentence and a way to ask again rather than
 * a dead end.
 */
export default function ResetPasswordPage() {
  const t = useT();
  const errorText = useErrorText();
  const [state, action] = useActionState(resetPassword, {});
  const token = useSearchParams().get('token');

  const invalid = !token || state.errors?.form === 'error.resetInvalid';

  return (
    <>
      <div>
        <h1 className={styles.title}>{t('auth.resetTitle')}</h1>
        <p className={styles.subtitle}>{t('auth.resetLede')}</p>
      </div>

      {invalid ? (
        <>
          <p className={styles.formError} role="alert">
            {errorText('error.resetInvalid')}
          </p>
          <p className={styles.footer}>
            <Link href="/forgot-password">{t('auth.resetAgain')}</Link>
          </p>
        </>
      ) : (
        <form action={action} className={styles.form} noValidate>
          <input type="hidden" name="token" value={token} />
          {state.errors?.form && (
            <p className={styles.formError} role="alert">
              {errorText(state.errors.form)}
            </p>
          )}
          <Field
            id="password"
            name="password"
            type="password"
            label={t('password.next')}
            autoComplete="new-password"
            required
            hint={t('auth.passwordHint')}
            error={state.errors?.password}
          />
          <SubmitButton pendingLabel={t('password.saving')}>
            {t('password.save')}
          </SubmitButton>
        </form>
      )}

      <p className={styles.footer}>
        <Link href="/login">{t('auth.backToLogin')}</Link>
      </p>
    </>
  );
}
